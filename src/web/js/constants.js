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
  min: -Math.PI * 10,
  max: Math.PI * 10,
};

/** Knob row 3 → starting phase in radians. */
export const PHASE = {
  min: 0,
  max: Math.PI * 2,
};

/** Master fader → plot/audio window length in seconds. */
export const MASTER_TIME = {
  min: 0,
  max: 5,
};

/** Sample step Δt for drawing wave lines (seconds per point). */
export const TIME_STEP = {
  default: 0.015,
  min: 0.005,
  max: 0.1,
  delta: 0.005,
  sliderStep: 0.005,
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

/** Fixed Y-axis for the time canvas: ±yAxisLimit with 0 centered. */
export const PLOT = {
  yAxisLimit: 5,
};

/** Fixed radius for the polar canvas (vector sum scale). */
export const POLAR = {
  yAxisLimit: 3,
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
