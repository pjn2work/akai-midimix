import {
  DEFAULT_MIDI_CHANNEL,
  noteControl,
  muteNote,
  soloNote,
  GLOBAL_BUTTONS,
  BUTTON_ROWS,
} from "./midi-map.js";

function noteIsActive(data, type) {
  if (type === "noteoff") return false;
  const velocity = data[2] ?? 0;
  return type === "noteon" && velocity > 0;
}

function defaultMidimixPort(access, direction) {
  const ports = direction === "input" ? access.inputs : access.outputs;
  for (const port of ports.values()) {
    const name = port.name.toLowerCase();
    if (name.includes("midimix") || name.includes("midi mix")) return port;
  }
  return ports.values().next().value ?? null;
}

function matchingOutputPort(inputName, access) {
  for (const port of access.outputs.values()) {
    if (port.name === inputName) return port;
  }
  const normalized = inputName.toLowerCase().replace(/\s/g, "");
  for (const port of access.outputs.values()) {
    if (port.name.toLowerCase().replace(/\s/g, "") === normalized) return port;
  }
  return defaultMidimixPort(access, "output");
}

/** @returns {{ ok: boolean, reason?: string, hint?: string }} */
export function checkMidiEnvironment() {
  if (typeof navigator.requestMIDIAccess !== "function") {
    return {
      ok: false,
      reason: "Web MIDI is not supported in this browser.",
      hint: "Use Chrome or Edge on the computer that has the MIDIMIX plugged in.",
    };
  }
  if (!window.isSecureContext) {
    const origin = window.location.origin;
    return {
      ok: false,
      reason: `Web MIDI is blocked on ${origin} (not a secure context).`,
      hint:
        "Open http://localhost:3000 on the machine with the MIDIMIX, or serve this app over HTTPS. "
        + "LAN HTTP URLs like http://192.168.x.x are not allowed for MIDI.",
    };
  }
  return { ok: true };
}

export class MidiIO {
  /**
   * @param {import('./wave-engine.js').WaveEngine} engine
   * @param {{ onStateChange?: ()=>void, onStatus?: (msg:string)=>void }} options
   */
  constructor(engine, options = {}) {
    this.engine = engine;
    this.onStateChange = options.onStateChange ?? (() => {});
    this.onStatus = options.onStatus ?? (() => {});
    this.access = null;
    this.input = null;
    this.output = null;
    this.mirrorLeds = true;
    this.ledState = new Map();
    this.soloKeyHeldByMidi = false;
  }

  get supported() {
    return typeof navigator.requestMIDIAccess === "function";
  }

  get connected() {
    return this.input != null;
  }

  async listPorts() {
    const env = checkMidiEnvironment();
    if (!env.ok) throw new Error(env.reason);

    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => {
      this.onStateChange();
    };

    return {
      inputs: [...this.access.inputs.values()].map((p) => p.name),
      outputs: [...this.access.outputs.values()].map((p) => p.name),
    };
  }

  async connect(inputName) {
    const env = checkMidiEnvironment();
    if (!env.ok) throw new Error(env.reason);
    if (!this.access) await this.listPorts();

    this.disconnect();
    for (const port of this.access.inputs.values()) {
      if (port.name === inputName) {
        this.input = port;
        break;
      }
    }
    if (!this.input) throw new Error(`MIDI input not found: ${inputName}`);

    this.input.onmidimessage = (event) => this._handleMessage(event);
    if (this.mirrorLeds) {
      const out = matchingOutputPort(inputName, this.access);
      if (out) this.output = out;
    }
    this.onStatus(`Listening: ${inputName}${this.output ? " · LED mirror on" : ""}`);
    this.onStateChange();
  }

  disconnect() {
    if (this.input) {
      this.input.onmidimessage = null;
      this.input = null;
    }
    this.output = null;
    this.onStatus("Disconnected");
    this.onStateChange();
  }

  /** @param {Uint8Array} data */
  _handleMessage(event) {
    const [status, a, b] = event.data;
    const channel = status & 0x0f;
    if (channel !== DEFAULT_MIDI_CHANNEL) return;
    const type = status & 0xf0;

    if (type === 0xb0) {
      this.engine.ccValue(a, b);
      return;
    }

    if (type === 0x90 || type === 0x80) {
      const active = noteIsActive(event.data, type === 0x90 ? "noteon" : "noteoff");
      const result = this.engine.handleNote(a, active, { requireSoloKey: true });
      if (!result) return;

      if (result.control.kind === "soloKey") {
        this.soloKeyHeldByMidi = active;
      }

      if (result.toggled && this.mirrorLeds) {
        this._syncLedForNote(a);
      } else if (result.control.kind === "soloKey" && this.mirrorLeds) {
        this.sendLed(a, active);
      }
    }
  }

  _syncLedForNote(note) {
    const control = noteControl(note);
    if (!control) return;
    if (control.kind === "mute") {
      this.sendLed(note, this.engine.tracks[control.trackIndex].muted);
    } else if (control.kind === "solo") {
      this.sendLed(note, this.engine.tracks[control.trackIndex].soloed);
    }
  }

  sendLed(note, on) {
    if (!this.output) return;
    this.output.send([0x90 | DEFAULT_MIDI_CHANNEL, note, on ? 127 : 0]);
    this.ledState.set(note, on);
  }

  /** Called when UI toggles mute/solo — mirror to hardware. */
  mirrorTrackButton(note) {
    if (!this.mirrorLeds) return;
    this._syncLedForNote(note);
  }

  /** Push all mute/solo LED states to hardware. */
  syncAllLeds() {
    if (!this.output) return;
    for (let i = 0; i < 8; i += 1) {
      this.sendLed(muteNote(i), this.engine.tracks[i].muted);
      this.sendLed(soloNote(i), this.engine.tracks[i].soloed);
    }
  }

  openOutput(outputName) {
    if (!this.access) return false;
    for (const port of this.access.outputs.values()) {
      if (port.name === outputName) {
        this.output = port;
        this.syncAllLeds();
        return true;
      }
    }
    return false;
  }
}

export { defaultMidimixPort, matchingOutputPort };
