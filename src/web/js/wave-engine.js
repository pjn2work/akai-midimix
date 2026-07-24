import { ccToColor } from "./color.js";
import { ccControl, noteControl, TRACK_COUNT } from "./midi-map.js";

const TWO_PI = Math.PI * 2;

export const TIME_STEP_DEFAULT = 0.05;
export const TIME_STEP_MIN = 0.025;
export const TIME_STEP_MAX = 0.5;
export const TIME_STEP_DELTA = 0.025;
export const MASTER_TIME_MAX = 10;

function lerpRange(value, min, max) {
  return min + (value / 127) * (max - min);
}

function createTrack(index) {
  return {
    index,
    colorCc: 0,
    color: ccToColor(0),
    frequency: 0,
    phase: 0,
    amplitude: 0,
    muted: false,
    soloed: false,
    knobValues: [0, 0, 0],
    faderValue: 0,
  };
}

export class WaveEngine {
  constructor() {
    this.tracks = Array.from({ length: TRACK_COUNT }, (_, i) => createTrack(i));
    this.masterTime = 5;
    this.masterCc = 64;
    this.timeStep = TIME_STEP_DEFAULT;
    this.soloKeyHeld = false;
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
    const clamped = Math.max(0, Math.min(127, value));
    const control = ccControl(cc);
    if (!control) return false;

    if (control.kind === "master") {
      this.masterCc = clamped;
      this.masterTime = lerpRange(clamped, 0, MASTER_TIME_MAX);
      this.notify();
      return true;
    }

    if (control.kind === "fader") {
      const track = this.tracks[control.trackIndex];
      track.faderValue = clamped;
      track.amplitude = clamped / 127;
      this.notify();
      return true;
    }

    const track = this.tracks[control.trackIndex];
    track.knobValues[control.rowIndex] = clamped;
    if (control.rowIndex === 0) {
      track.colorCc = clamped;
      track.color = ccToColor(clamped);
    } else if (control.rowIndex === 1) {
      track.frequency = lerpRange(clamped, -TWO_PI, TWO_PI);
    } else if (control.rowIndex === 2) {
      track.phase = lerpRange(clamped, -Math.PI, Math.PI);
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
    const next = Math.round((this.timeStep + delta) / TIME_STEP_DELTA) * TIME_STEP_DELTA;
    this.timeStep = Math.max(TIME_STEP_MIN, Math.min(TIME_STEP_MAX, next));
    this.notify();
  }

  setTimeStep(value) {
    this.timeStep = Math.max(TIME_STEP_MIN, Math.min(TIME_STEP_MAX, value));
    this.notify();
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

  sumAt(t) {
    const visible = this.visibleTracks();
    let total = 0;
    for (let i = 0; i < TRACK_COUNT; i += 1) {
      if (visible[i]) total += this.waveAt(i, t);
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
      if (active) this.adjustTimeStep(-TIME_STEP_DELTA);
      return { control, toggled: active };
    }

    if (control.kind === "bankRight") {
      if (active) this.adjustTimeStep(TIME_STEP_DELTA);
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

    return { control, toggled: false };
  }
}
