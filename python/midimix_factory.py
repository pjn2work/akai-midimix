"""Akai MIDIMIX factory MIDI map and I/O (input, output, LED control)."""

from __future__ import annotations

import queue
import sys
import threading
from dataclasses import dataclass
from typing import Iterator, Literal

try:
    import mido
except ImportError:
    print("Install dependencies: pip install -r requirements.txt", file=sys.stderr)
    raise

# Factory-default MIDIMIX layout (MIDI channel 1). Custom editor mappings may differ.
KNOB_ROWS: list[tuple[str, list[int]]] = [
    ("Knobs row 1 (Rec Arm labels)", [16, 20, 24, 28, 46, 50, 54, 58]),
    ("Knobs row 2 (Mute labels)", [17, 21, 25, 29, 47, 51, 55, 59]),
    ("Knobs row 3 (Solo labels)", [18, 22, 26, 30, 48, 52, 56, 60]),
]
FADER_CCS = [19, 23, 27, 31, 49, 53, 57, 61]
MASTER_CC = 62

BUTTON_ROWS: list[tuple[str, list[int]]] = [
    ("Mute", [1, 4, 7, 10, 13, 16, 19, 22]),
    ("Rec Arm", [3, 6, 9, 12, 15, 18, 21, 24]),
    ("Solo (per channel, SOLO key held)", [2, 5, 8, 11, 14, 17, 20, 23]),
]
GLOBAL_BUTTONS: list[tuple[str, int]] = [
    ("Bank Left", 25),
    ("Bank Right", 26),
    ("Solo key", 27),
]

LED_NOTE_GROUPS: list[tuple[str, list[int]]] = BUTTON_ROWS + [
    ("Global (Bank L/R; Solo key may not light)", [25, 26, 27]),
]

DEFAULT_MIDI_CHANNEL = 0  # MIDIMIX factory default is MIDI channel 1


@dataclass
class ControlState:
    value: int = 0
    active: bool = False
    last_raw: str = "—"


@dataclass(frozen=True)
class ControlUpdate:
    kind: Literal["cc", "note"]
    raw: str
    cc: int | None = None
    note: int | None = None
    value: int = 0
    active: bool = False


def list_input_ports() -> list[str]:
    return mido.get_input_names()


def list_output_ports() -> list[str]:
    return mido.get_output_names()


def default_midimix_port(names: list[str]) -> str:
    for name in names:
        lower = name.lower()
        if "midimix" in lower or "midi mix" in lower:
            return name
    return names[0] if names else ""


def matching_output_port(input_port: str, outputs: list[str]) -> str:
    if input_port in outputs:
        return input_port
    normalized = input_port.lower().replace(" ", "")
    for name in outputs:
        if name.lower().replace(" ", "") == normalized:
            return name
    return default_midimix_port(outputs)


def all_led_notes() -> list[int]:
    notes: set[int] = set()
    for _, group in LED_NOTE_GROUPS:
        notes.update(group)
    return sorted(notes)


def factory_control_ids() -> tuple[set[int], set[int]]:
    ccs = set(FADER_CCS + [MASTER_CC])
    for _, row in KNOB_ROWS:
        ccs.update(row)
    notes: set[int] = set()
    for _, row in BUTTON_ROWS:
        notes.update(row)
    for _, note in GLOBAL_BUTTONS:
        notes.add(note)
    return ccs, notes


def note_message_active(msg: mido.Message) -> tuple[int, int, bool]:
    """Return (note, velocity, pressed) for note_on / note_off."""
    note = msg.note
    velocity = msg.velocity if msg.type == "note_on" else 0
    if msg.type == "note_on" and velocity == 0:
        return note, 0, False
    if msg.type == "note_off":
        return note, 0, False
    return note, velocity, True


class _MidiInputReader(threading.Thread):
    def __init__(self, port_name: str, out_queue: queue.Queue) -> None:
        super().__init__(daemon=True)
        self.port_name = port_name
        self.out_queue = out_queue
        self._stop = threading.Event()

    def run(self) -> None:
        try:
            with mido.open_input(self.port_name) as port:
                for msg in port:
                    if self._stop.is_set():
                        break
                    self.out_queue.put(msg)
        except Exception as exc:  # noqa: BLE001 — surfaced to caller via queue
            self.out_queue.put(("error", str(exc)))

    def stop(self) -> None:
        self._stop.set()


class MidimixFactory:
    """MIDI bridge for MIDIMIX using the factory CC/note map."""

    def __init__(self) -> None:
        self.message_queue: queue.Queue = queue.Queue()
        self._reader: _MidiInputReader | None = None
        self._out_port: mido.ports.BaseOutput | None = None
        self.led_midi_channel: int = DEFAULT_MIDI_CHANNEL
        self.mirror_button_leds: bool = True
        self.led_state: dict[int, bool] = {}
        self.cc_states: dict[int, ControlState] = {}
        self.note_states: dict[int, ControlState] = {}
        _, button_notes = factory_control_ids()
        self._button_notes = button_notes
        self._init_states()

    def _init_states(self) -> None:
        ccs, notes = factory_control_ids()
        for cc in ccs:
            self.cc_states[cc] = ControlState()
        for note in notes:
            self.note_states[note] = ControlState()

    @property
    def input_connected(self) -> bool:
        return self._reader is not None

    @property
    def output_open(self) -> bool:
        return self._out_port is not None

    @property
    def input_port_name(self) -> str | None:
        return self._reader.port_name if self._reader else None

    @property
    def output_port_name(self) -> str | None:
        if self._out_port is None:
            return None
        return getattr(self._out_port, "name", None)

    def connect_input(self, port_name: str) -> None:
        if self._reader:
            self.disconnect_input()
        self._reader = _MidiInputReader(port_name, self.message_queue)
        self._reader.start()

    def disconnect_input(self) -> None:
        if self._reader:
            self._reader.stop()
            self._reader = None

    def open_output(self, port_name: str) -> None:
        self.close_output()
        self._out_port = mido.open_output(port_name)

    def close_output(self) -> None:
        if self._out_port:
            self._out_port.close()
            self._out_port = None

    def set_led_channel(self, channel_1_to_16: int) -> None:
        self.led_midi_channel = max(0, min(15, channel_1_to_16 - 1))

    def poll_incoming(self) -> Iterator[mido.Message | tuple[Literal["error"], str]]:
        while True:
            try:
                item = self.message_queue.get_nowait()
            except queue.Empty:
                break
            yield item

    def interpret_message(
        self, msg: mido.Message
    ) -> tuple[ControlUpdate | None, mido.Message | None]:
        line = str(msg)
        if msg.type == "control_change":
            cc = msg.control
            state = self.cc_states.setdefault(cc, ControlState())
            state.value = msg.value
            state.last_raw = line
            return ControlUpdate(kind="cc", raw=line, cc=cc, value=msg.value), None

        if msg.type in ("note_on", "note_off"):
            note, velocity, active = note_message_active(msg)
            state = self.note_states.setdefault(note, ControlState())
            state.active = active
            state.value = velocity
            state.last_raw = line
            update = ControlUpdate(
                kind="note", raw=line, note=note, value=velocity, active=active
            )
            led_msg = self._mirror_button_led(note, msg)
            return update, led_msg
        return None, None

    def _mirror_button_led(self, note: int, msg: mido.Message) -> mido.Message | None:
        if not self.mirror_button_leds or not self._out_port or note not in self._button_notes:
            return None
        _, velocity, _active = note_message_active(msg)
        # MIDIMIX buttons are toggles: each press sends note_on; flip LED to match.
        if msg.type == "note_on" and velocity > 0:
            return self.send_led(note, not self.led_state.get(note, False))
        return None

    def send_led(self, note: int, on: bool) -> mido.Message:
        if not self._out_port:
            raise RuntimeError("MIDI output is not open")
        velocity = 127 if on else 0
        msg = mido.Message(
            "note_on", channel=self.led_midi_channel, note=note, velocity=velocity
        )
        self._out_port.send(msg)
        self.led_state[note] = on
        return msg

    def toggle_led(self, note: int) -> mido.Message:
        return self.send_led(note, not self.led_state.get(note, False))

    def send_all_leds(self, on: bool) -> list[mido.Message]:
        return [self.send_led(note, on) for note in all_led_notes()]

    def close(self) -> None:
        self.disconnect_input()
        self.close_output()
