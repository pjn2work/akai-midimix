/**
 * Tunable parameters for the wave visualizer.
 * Edit values here — MIDI CC mapping stays in midi-map.js.
 */

import { TRACK_COUNT } from "./midi-map.js";

/** MIDI control change value range (knobs and faders). */
export const MIDI_CC = {
  min: 0,
  max: 127,
};

/** Per-track fader → wave amplitude (wave = amplitude × sin(…)). */
export const AMPLITUDE = {
  min: 0,
  max: 1,
};

/** Knob row 2 → angular frequency in rad/s (visual plot). */
export const FREQUENCY = {
  min: -Math.PI * 2,
  max: Math.PI * 2,
};

/** Knob row 3 → starting phase in radians. */
export const PHASE = {
  min: -Math.PI,
  max: Math.PI,
};

/** Master fader → plot/audio window length in seconds. */
export const MASTER_TIME = {
  min: 0,
  max: 20,
};

/** Sample step Δt for drawing wave lines (seconds per point). */
export const TIME_STEP = {
  default: 0.05,
  min: 0.01,
  max: 0.5,
  delta: 0.01,
  sliderStep: 0.01,
};

/**
 * Audio-only frequency multiplier (Hz).
 * At max frequency knob, pitch ≈ centerFrequency.
 */
export const CENTER_FREQUENCY = {
  min: 50,
  max: 3000,
  default: 440,
};

/** Fixed Y-axis for the canvas: ±yAxisLimit with 0 centered. */
export const PLOT = {
  yAxisLimit: TRACK_COUNT,
};

/** Knob row 1 color mapping input range. */
export const COLOR_KNOB = {
  ccMin: 0,
  ccMax: 127,
};

/** Audio playback headroom divisor (matches PLOT.yAxisLimit by default). */
export const AUDIO = {
  sumGainDivisor: PLOT.yAxisLimit,
};
