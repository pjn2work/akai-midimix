import { ccToColor } from "./color.js";
import {
  AMPLITUDE,
  CENTER_FREQUENCY,
  FREQUENCY,
  MASTER_TIME,
  MIDI_CC,
  PHASE,
  TIME_STEP,
} from "./constants.js";
import { ccControl, noteControl, TRACK_COUNT } from "./midi-map.js";

function lerpRange(value, min, max) {
  return min + ((value - MIDI_CC.min) / (MIDI_CC.max - MIDI_CC.min)) * (max - min);
}

function createTrack(index) {
  return {
    index,
    colorCc: MIDI_CC.min,
    color: ccToColor(MIDI_CC.min),
    frequency: 0,
    phase: 0,
    amplitude: AMPLITUDE.min,
    muted: false,
    soloed: false,
    knobValues: [0, 0, 0],
    faderValue: 0,
  };
}

export class WaveEngine {
  constructor() {
    this.tracks = Array.from({ length: TRACK_COUNT }, (_, i) => createTrack(i));
    this.masterTime = (MASTER_TIME.min + MASTER_TIME.max) / 2;
    this.masterCc = Math.round((MIDI_CC.min + MIDI_CC.max) / 2);
    this.timeStep = TIME_STEP.default;
    this.soloKeyHeld = false;
    this.centerFrequency = CENTER_FREQUENCY.default;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this);
  }

  ccValue(cc, value) {
    const clamped = Math.max(MIDI_CC.min, Math.min(MIDI_CC.max, value));
    const control = ccControl(cc);
    if (!control) return false;

    if (control.kind === "master") {
      this.masterCc = clamped;
      this.masterTime = lerpRange(clamped, MASTER_TIME.min, MASTER_TIME.max);
      this.notify();
      return true;
    }

    if (control.kind === "fader") {
      const track = this.tracks[control.trackIndex];
      track.faderValue = clamped;
      track.amplitude =
        AMPLITUDE.min +
        (clamped / MIDI_CC.max) * (AMPLITUDE.max - AMPLITUDE.min);
      this.notify();
      return true;
    }

    const track = this.tracks[control.trackIndex];
    track.knobValues[control.rowIndex] = clamped;
    if (control.rowIndex === 0) {
      track.colorCc = clamped;
      track.color = ccToColor(clamped);
    } else if (control.rowIndex === 1) {
      track.frequency = lerpRange(clamped, FREQUENCY.min, FREQUENCY.max);
    } else if (control.rowIndex === 2) {
      track.phase = lerpRange(clamped, PHASE.min, PHASE.max);
    }
    this.notify();
    return true;
  }

  /** @param {'mute'|'solo'} kind */
  toggleTrackButton(kind, trackIndex) {
    const track = this.tracks[trackIndex];
    if (kind === "mute") track.muted = !track.muted;
    else track.soloed = !track.soloed;
    this.notify();
    return track;
  }

  setSoloKeyHeld(held) {
    if (this.soloKeyHeld === held) return;
    this.soloKeyHeld = held;
    this.notify();
  }

  adjustTimeStep(delta) {
    const next = Math.round((this.timeStep + delta) / TIME_STEP.delta) * TIME_STEP.delta;
    this.timeStep = Math.max(TIME_STEP.min, Math.min(TIME_STEP.max, next));
    this.notify();
  }

  setTimeStep(value) {
    this.timeStep = Math.max(TIME_STEP.min, Math.min(TIME_STEP.max, value));
    this.notify();
  }

  setCenterFrequency(hz) {
    this.centerFrequency = Math.max(
      CENTER_FREQUENCY.min,
      Math.min(CENTER_FREQUENCY.max, hz),
    );
  }

  /** Audio-only: knob frequency scaled by center freq (|knob| at max ≈ centerFrequency Hz). */
  trackAudioAngularFrequency(track) {
    return track.frequency * this.centerFrequency;
  }

  /** @returns {boolean[]} */
  visibleTracks() {
    const anySolo = this.tracks.some((t) => t.soloed);
    return this.tracks.map((track) => {
      if (anySolo) return track.soloed;
      return !track.muted;
    });
  }

  waveAt(trackIndex, t) {
    const track = this.tracks[trackIndex];
    return track.amplitude * Math.sin(track.frequency * t + track.phase);
  }

  waveAtAudio(trackIndex, t) {
    const track = this.tracks[trackIndex];
    const omega = this.trackAudioAngularFrequency(track);
    return track.amplitude * Math.sin(omega * t + track.phase);
  }

  sumAt(t) {
    const visible = this.visibleTracks();
    let total = 0;
    for (let i = 0; i < TRACK_COUNT; i += 1) {
      if (visible[i]) total += this.waveAt(i, t);
    }
    return total;
  }

  sumAtAudio(t) {
    const visible = this.visibleTracks();
    let total = 0;
    for (let i = 0; i < TRACK_COUNT; i += 1) {
      if (visible[i]) total += this.waveAtAudio(i, t);
    }
    return total;
  }

  /** Sample visible waves and sum over [0, masterTime]. */
  sampleSeries() {
    const visible = this.visibleTracks();
    const points = [];
    const step = this.timeStep;
    const end = this.masterTime;
    if (end <= 0) {
      const row = { t: 0, sum: 0, waves: Array(TRACK_COUNT).fill(0) };
      for (let i = 0; i < TRACK_COUNT; i += 1) row.waves[i] = this.waveAt(i, 0);
      points.push(row);
      return points;
    }

    for (let t = 0; t <= end + step * 0.001; t += step) {
      const sampleT = Math.min(t, end);
      const waves = Array(TRACK_COUNT);
      for (let i = 0; i < TRACK_COUNT; i += 1) {
        waves[i] = visible[i] ? this.waveAt(i, sampleT) : null;
      }
      points.push({ t: sampleT, sum: this.sumAt(sampleT), waves });
      if (sampleT >= end) break;
    }
    return points;
  }

  handleNote(note, active, { requireSoloKey = true } = {}) {
    const control = noteControl(note);
    if (!control) return null;

    if (control.kind === "soloKey") {
      this.setSoloKeyHeld(active);
      return { control, toggled: false };
    }

    if (control.kind === "bankLeft") {
      if (active) this.adjustTimeStep(-TIME_STEP.delta);
      return { control, toggled: active };
    }

    if (control.kind === "bankRight") {
      if (active) this.adjustTimeStep(TIME_STEP.delta);
      return { control, toggled: active };
    }

    if (control.kind === "mute" && active) {
      this.toggleTrackButton("mute", control.trackIndex);
      return { control, toggled: true };
    }

    if (control.kind === "solo" && active) {
      if (requireSoloKey && !this.soloKeyHeld) return { control, toggled: false };
      this.toggleTrackButton("solo", control.trackIndex);
      return { control, toggled: true };
    }

    if (control.kind === "recArm" && active) {
      this.toggleTrackButton("solo", control.trackIndex);
      return { control, toggled: true };
    }

    return { control, toggled: false };
  }
}
