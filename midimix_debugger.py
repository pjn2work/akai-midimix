#!/usr/bin/env python3
"""Tkinter GUI for Akai MIDIMIX debugging."""

from __future__ import annotations

import tkinter as tk
from tkinter import messagebox, ttk

from midimix_factory import (
    BUTTON_ROWS,
    DEFAULT_MIDI_CHANNEL,
    FADER_CCS,
    GLOBAL_BUTTONS,
    KNOB_ROWS,
    LED_NOTE_GROUPS,
    MASTER_CC,
    ControlUpdate,
    MidimixFactory,
    default_midimix_port,
    list_input_ports,
    list_output_ports,
    matching_output_port,
)

CELL_WIDTH = 92
DEFAULT_WINDOW_WIDTH = 980
DEFAULT_WINDOW_HEIGHT = 1150
DEFAULT_WINDOW_GEOMETRY = f"{DEFAULT_WINDOW_WIDTH}x{DEFAULT_WINDOW_HEIGHT}"


class MidimixDebuggerApp:
    def __init__(self) -> None:
        self.root = tk.Tk()
        self.root.title("Akai MIDIMIX Debugger")
        self.root.minsize(DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT)
        self.root.geometry(DEFAULT_WINDOW_GEOMETRY)

        self.midi = MidimixFactory()
        self.cc_widgets: dict[int, dict[str, tk.Widget]] = {}
        self.note_widgets: dict[int, dict[str, tk.Widget]] = {}

        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)
        self.root.after(50, self._poll_midi)

    def _build_ui(self) -> None:
        top = ttk.Frame(self.root, padding=8)
        top.pack(fill=tk.X)

        controls = ttk.Frame(top)
        controls.pack(fill=tk.X)

        ttk.Label(controls, text="MIDI input:").pack(side=tk.LEFT)
        self.port_var = tk.StringVar()
        self.port_combo = ttk.Combobox(
            controls, textvariable=self.port_var, values=[], width=28, state="readonly"
        )
        self.port_combo.pack(side=tk.LEFT, padx=(6, 8))

        ttk.Button(controls, text="Refresh ports", command=self._refresh_ports).pack(
            side=tk.LEFT, padx=4
        )
        self.connect_btn = ttk.Button(controls, text="Connect", command=self._toggle_connect)
        self.connect_btn.pack(side=tk.LEFT, padx=4)
        self.mirror_leds_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            controls,
            text="Mirror button LEDs",
            variable=self.mirror_leds_var,
            command=self._sync_mirror_leds,
        ).pack(side=tk.LEFT, padx=8)

        self.status_var = tk.StringVar(value="Disconnected")
        ttk.Label(top, textvariable=self.status_var, anchor=tk.W).pack(
            fill=tk.X, pady=(6, 0)
        )

        notebook = ttk.Notebook(self.root)
        notebook.pack(fill=tk.BOTH, expand=True, padx=8, pady=(0, 8))

        layout = ttk.Frame(notebook, padding=8)
        led = ttk.Frame(notebook, padding=8)
        raw = ttk.Frame(notebook, padding=8)
        notebook.add(layout, text="MIDIMIX layout")
        notebook.add(led, text="LED test")
        notebook.add(raw, text="Raw MIDI log")

        self._build_layout_tab(layout)
        self._build_led_tab(led)
        self._build_raw_tab(raw)

    def _build_layout_tab(self, parent: ttk.Frame) -> None:
        ttk.Label(
            parent,
            text="Default factory CC/note map. If you changed mappings in Akai Editor, use the Raw log tab.",
            wraplength=860,
        ).pack(anchor=tk.W)

        self._build_knobs_with_globals(parent)
        self._add_cc_row(
            parent,
            "Faders",
            FADER_CCS,
            extra=[("Master", MASTER_CC)],
        )

        ttk.Separator(parent, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=10)
        for row_label, notes in BUTTON_ROWS:
            extra_notes: list[tuple[str, int]] | None = None
            if row_label == "Mute":
                extra_notes = [("Solo key", 27)]
            self._add_note_row(parent, row_label, notes, extra=extra_notes)

    def _build_knobs_with_globals(self, parent: ttk.Frame) -> None:
        area = ttk.Frame(parent)
        area.pack(fill=tk.X, pady=6)
        area.grid_columnconfigure(0, weight=1)

        for row_idx, (row_label, ccs) in enumerate(KNOB_ROWS):
            frame = ttk.LabelFrame(area, text=row_label, padding=8)
            frame.grid(row=row_idx, column=0, sticky=tk.EW, pady=4, padx=(0, 8))
            items = [(f"Ch {i + 1}", cc) for i, cc in enumerate(ccs)]
            self._add_cc_cells(frame, items)

        global_frame = ttk.LabelFrame(area, text="Global buttons", padding=8)
        global_frame.grid(row=0, column=1, rowspan=len(KNOB_ROWS), sticky=tk.NS)
        knob_globals = [(label, note) for label, note in GLOBAL_BUTTONS if note != 27]
        for row_idx, (label, note) in enumerate(knob_globals):
            cell = ttk.Frame(global_frame, width=CELL_WIDTH)
            cell.grid(row=row_idx, column=0, pady=6)
            cell.grid_propagate(False)
            self._add_note_cell(cell, label, note, grid_col=0)

    def _add_cc_cells(self, frame: ttk.Frame, items: list[tuple[str, int]]) -> None:
        for col in range(len(items)):
            frame.grid_columnconfigure(col, minsize=CELL_WIDTH, weight=0)
        for col, (label, cc) in enumerate(items):
            cell = ttk.Frame(frame, width=CELL_WIDTH)
            cell.grid(row=0, column=col, padx=2, pady=2, sticky=tk.N)
            cell.grid_propagate(False)
            ttk.Label(cell, text=label, font=("", 9, "bold")).pack()
            ttk.Label(cell, text=f"CC {cc}", foreground="#666").pack()
            bar = ttk.Progressbar(cell, length=72, maximum=127, mode="determinate")
            bar.pack(pady=2)
            val = ttk.Label(cell, text="0", width=5, anchor=tk.CENTER)
            val.pack()
            self.cc_widgets[cc] = {"bar": bar, "val": val}

    def _add_cc_row(
        self,
        parent: ttk.Frame,
        title: str,
        ccs: list[int],
        *,
        extra: list[tuple[str, int]] | None = None,
    ) -> None:
        frame = ttk.LabelFrame(parent, text=title, padding=8)
        frame.pack(fill=tk.X, pady=6)
        items = [(f"Ch {i + 1}", cc) for i, cc in enumerate(ccs)]
        if extra:
            items.extend(extra)
        self._add_cc_cells(frame, items)

    def _add_note_row(
        self,
        parent: ttk.Frame,
        title: str,
        notes: list[int],
        *,
        extra: list[tuple[str, int]] | None = None,
    ) -> None:
        frame = ttk.LabelFrame(parent, text=title, padding=8)
        frame.pack(fill=tk.X, pady=6)
        items: list[tuple[str, int]] = [(f"Ch {i + 1}", n) for i, n in enumerate(notes)]
        if extra:
            items.extend(extra)
        for col in range(len(items)):
            frame.grid_columnconfigure(col, minsize=CELL_WIDTH, weight=0)
        for col, (label, note) in enumerate(items):
            cell = ttk.Frame(frame, width=CELL_WIDTH)
            cell.grid(row=0, column=col, padx=2, pady=2, sticky=tk.N)
            cell.grid_propagate(False)
            self._add_note_cell(cell, label, note, grid_col=col)

    def _add_note_cell(
        self, parent: ttk.Frame, title: str, note: int, grid_col: int | None
    ) -> None:
        if grid_col is None:
            cell = ttk.Frame(parent)
            cell.pack(side=tk.LEFT, padx=8)
        else:
            cell = parent
        ttk.Label(cell, text=title, font=("", 9, "bold")).pack()
        ttk.Label(cell, text=f"Note {note}", foreground="#666").pack()
        lamp = tk.Canvas(cell, width=28, height=28, highlightthickness=0)
        lamp.pack(pady=2)
        oval = lamp.create_oval(4, 4, 24, 24, fill="#ccc", outline="#888")
        val = ttk.Label(cell, text="off", width=7, anchor=tk.CENTER)
        val.pack()
        self.note_widgets[note] = {"canvas": lamp, "oval": oval, "val": val}

    def _build_led_tab(self, parent: ttk.Frame) -> None:
        ttk.Label(
            parent,
            text=(
                "Sends Note On to the MIDIMIX output port to drive button LEDs "
                "(velocity 127 = on, 0 = off). In Akai MIDIMIX Editor, set LED mode to External."
            ),
            wraplength=860,
        ).pack(anchor=tk.W, pady=(0, 8))

        bar = ttk.Frame(parent)
        bar.pack(fill=tk.X, pady=4)

        ttk.Label(bar, text="MIDI output:").pack(side=tk.LEFT)
        self.out_port_var = tk.StringVar()
        self.out_port_combo = ttk.Combobox(
            bar, textvariable=self.out_port_var, values=[], width=40, state="readonly"
        )
        self.out_port_combo.pack(side=tk.LEFT, padx=(6, 8))

        ttk.Button(bar, text="Refresh", command=self._refresh_ports).pack(side=tk.LEFT, padx=2)
        self.out_connect_btn = ttk.Button(bar, text="Open output", command=self._toggle_output)
        self.out_connect_btn.pack(side=tk.LEFT, padx=4)
        self.out_status_var = tk.StringVar(value="Output closed")
        ttk.Label(bar, textvariable=self.out_status_var).pack(side=tk.LEFT, padx=8)

        ttk.Label(bar, text="Channel:").pack(side=tk.LEFT, padx=(12, 4))
        self.led_channel_var = tk.IntVar(value=DEFAULT_MIDI_CHANNEL + 1)
        ttk.Spinbox(
            bar,
            from_=1,
            to=16,
            width=4,
            textvariable=self.led_channel_var,
            command=self._sync_led_channel,
        ).pack(side=tk.LEFT)
        self.led_channel_var.trace_add("write", lambda *_: self._sync_led_channel())

        bulk = ttk.Frame(parent)
        bulk.pack(fill=tk.X, pady=8)
        ttk.Button(bulk, text="All LEDs off", command=lambda: self._set_all_leds(False)).pack(
            side=tk.LEFT, padx=(0, 6)
        )
        ttk.Button(bulk, text="All LEDs on", command=lambda: self._set_all_leds(True)).pack(
            side=tk.LEFT, padx=6
        )
        ttk.Label(
            bulk,
            text="Bank L/R LEDs are a pair (binary bank indicator on hardware).",
            foreground="#666",
        ).pack(side=tk.LEFT, padx=12)

        canvas = tk.Canvas(parent, highlightthickness=0)
        scroll = ttk.Scrollbar(parent, orient=tk.VERTICAL, command=canvas.yview)
        inner = ttk.Frame(canvas)
        inner.bind("<Configure>", lambda e: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.create_window((0, 0), window=inner, anchor=tk.NW)
        canvas.configure(yscrollcommand=scroll.set)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)

        for group_title, notes in LED_NOTE_GROUPS:
            frame = ttk.LabelFrame(inner, text=group_title, padding=8)
            frame.pack(fill=tk.X, pady=6, padx=2)
            for col, note in enumerate(notes):
                cell = ttk.Frame(frame)
                cell.grid(row=0, column=col, padx=3, pady=2)
                ttk.Label(cell, text=f"n{note}", font=("Menlo", 9)).pack()
                btn_col = ttk.Frame(cell)
                btn_col.pack()
                ttk.Button(btn_col, text="On", width=4, command=lambda n=note: self._set_led(n, True)).pack(
                    pady=1
                )
                ttk.Button(btn_col, text="Off", width=4, command=lambda n=note: self._set_led(n, False)).pack(
                    pady=1
                )
                ttk.Button(
                    btn_col, text="↕", width=4, command=lambda n=note: self._toggle_led(n)
                ).pack(pady=1)

    def _build_raw_tab(self, parent: ttk.Frame) -> None:
        ttk.Label(
            parent,
            text="Every message from the selected port (newest at top). Useful for unknown CC/note numbers.",
        ).pack(anchor=tk.W)
        self.log_text = tk.Text(parent, height=30, font=("Menlo", 11), wrap=tk.NONE)
        scroll = ttk.Scrollbar(parent, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scroll.set)
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, pady=8)
        scroll.pack(side=tk.RIGHT, fill=tk.Y, pady=8)

    def _sync_led_channel(self) -> None:
        try:
            self.midi.set_led_channel(int(self.led_channel_var.get()))
        except tk.TclError:
            pass

    def _sync_mirror_leds(self) -> None:
        self.midi.mirror_button_leds = bool(self.mirror_leds_var.get())

    def _refresh_ports(self, *, warn_if_empty: bool = False) -> None:
        ports = list_input_ports()
        self.port_combo["values"] = ports
        if self.port_var.get() not in ports and ports:
            self.port_var.set(default_midimix_port(ports))

        out_ports = list_output_ports()
        self.out_port_combo["values"] = out_ports
        if self.out_port_var.get() not in out_ports and out_ports:
            self.out_port_var.set(default_midimix_port(out_ports))

        if warn_if_empty and not ports:
            messagebox.showinfo(
                "No MIDI inputs",
                "No MIDI input ports found.\n\n"
                "Connect your MIDIMIX via USB and ensure it appears in Audio MIDI Setup.",
            )

    def _toggle_connect(self) -> None:
        if self.midi.input_connected:
            self._disconnect()
        else:
            self._connect()

    def _ensure_output_for_input(self, input_port: str) -> bool:
        if self.midi.output_open:
            return True
        out_name = matching_output_port(input_port, list_output_ports())
        if not out_name:
            return False
        try:
            self.midi.open_output(out_name)
            self.out_port_var.set(out_name)
            self._sync_led_channel()
            self._set_output_ui_open(out_name)
            return True
        except OSError:
            return False

    def _connect(self) -> None:
        port = self.port_var.get().strip()
        if not port:
            messagebox.showwarning("No port", "Select a MIDI input port first.")
            return
        self._sync_mirror_leds()
        self.midi.connect_input(port)
        if self.mirror_leds_var.get() and not self.midi.output_open:
            if not self._ensure_output_for_input(port):
                messagebox.showwarning(
                    "MIDI output",
                    "LED mirroring needs MIDI output.\n\n"
                    "Open the output manually on the LED test tab.",
                )
        self.connect_btn.configure(text="Disconnect")
        status = f"Listening: {port}"
        if self.midi.output_open and self.mirror_leds_var.get():
            status += " · LED mirror on"
        self.status_var.set(status)
        self.port_combo.configure(state="disabled")

    def _set_output_ui_open(self, name: str) -> None:
        self.out_connect_btn.configure(text="Close output")
        self.out_status_var.set(f"Output open: {name}")
        self.out_port_combo.configure(state="disabled")

    def _set_output_ui_closed(self) -> None:
        self.out_connect_btn.configure(text="Open output")
        self.out_status_var.set("Output closed")
        self.out_port_combo.configure(state="readonly")

    def _disconnect(self) -> None:
        self.midi.disconnect_input()
        self.connect_btn.configure(text="Connect")
        self.status_var.set("Disconnected")
        self.port_combo.configure(state="readonly")

    def _toggle_output(self) -> None:
        if self.midi.output_open:
            self._close_output()
        else:
            self._open_output()

    def _open_output(self) -> None:
        name = self.out_port_var.get().strip()
        if not name:
            messagebox.showwarning("No port", "Select a MIDI output port first.")
            return
        try:
            self.midi.open_output(name)
        except OSError as exc:
            messagebox.showerror("MIDI output error", str(exc))
            return
        self._sync_led_channel()
        self._set_output_ui_open(name)

    def _close_output(self) -> None:
        self.midi.close_output()
        self._set_output_ui_closed()

    def _set_led(self, note: int, on: bool) -> None:
        try:
            msg = self.midi.send_led(note, on)
        except RuntimeError:
            messagebox.showwarning(
                "Output closed", "Open the MIDI output port on the LED test tab first."
            )
            return
        self._log_line(f"→ {msg}")

    def _toggle_led(self, note: int) -> None:
        try:
            msg = self.midi.toggle_led(note)
        except RuntimeError:
            messagebox.showwarning(
                "Output closed", "Open the MIDI output port on the LED test tab first."
            )
            return
        self._log_line(f"→ {msg}")

    def _set_all_leds(self, on: bool) -> None:
        try:
            messages = self.midi.send_all_leds(on)
        except RuntimeError:
            messagebox.showwarning(
                "Output closed", "Open the MIDI output port on the LED test tab first."
            )
            return
        for msg in messages:
            self._log_line(f"→ {msg}")

    def _log_line(self, line: str) -> None:
        self.log_text.insert("1.0", line + "\n")
        if int(self.log_text.index("end-1c").split(".")[0]) > 500:
            self.log_text.delete("501.0", tk.END)

    def _poll_midi(self) -> None:
        for item in self.midi.poll_incoming():
            if isinstance(item, tuple) and item[0] == "error":
                messagebox.showerror("MIDI error", item[1])
                self._disconnect()
                continue
            self._apply_incoming(item)
        self.root.after(50, self._poll_midi)

    def _apply_incoming(self, msg) -> None:
        self._log_line(str(msg))
        update, led_msg = self.midi.interpret_message(msg)
        if led_msg is not None:
            self._log_line(f"→ {led_msg}")
        if update:
            self._apply_update(update)

    def _apply_update(self, update: ControlUpdate) -> None:
        if update.kind == "cc" and update.cc is not None:
            widgets = self.cc_widgets.get(update.cc)
            if widgets:
                widgets["bar"]["value"] = update.value
                widgets["val"].configure(text=str(update.value))
            return

        if update.kind == "note" and update.note is not None:
            widgets = self.note_widgets.get(update.note)
            if widgets:
                color = "#2ecc71" if update.active else "#ccc"
                widgets["canvas"].itemconfigure(widgets["oval"], fill=color)
                widgets["val"].configure(
                    text=f"{'on' if update.active else 'off':>3} {update.value:>3}"
                )

    def _on_close(self) -> None:
        self.midi.close()
        self.root.destroy()

    def run(self) -> None:
        self.root.after(0, lambda: self._refresh_ports(warn_if_empty=True))
        self.root.mainloop()


def main() -> None:
    MidimixDebuggerApp().run()


if __name__ == "__main__":
    main()
