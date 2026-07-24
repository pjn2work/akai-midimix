/** Factory-default MIDIMIX layout (MIDI channel 1). Ported from src/python/midimix_factory.py */

export const KNOB_ROWS = [
  { label: "Knobs row 1 (color)", ccs: [16, 20, 24, 28, 46, 50, 54, 58] },
  { label: "Knobs row 2 (frequency)", ccs: [17, 21, 25, 29, 47, 51, 55, 59] },
  { label: "Knobs row 3 (phase)", ccs: [18, 22, 26, 30, 48, 52, 56, 60] },
];

export const FADER_CCS = [19, 23, 27, 31, 49, 53, 57, 61];
export const MASTER_CC = 62;

export const BUTTON_ROWS = {
  mute: { label: "Mute", notes: [1, 4, 7, 10, 13, 16, 19, 22] },
  recArm: { label: "Rec Arm", notes: [3, 6, 9, 12, 15, 18, 21, 24] },
  solo: { label: "Solo", notes: [2, 5, 8, 11, 14, 17, 20, 23] },
};

export const GLOBAL_BUTTONS = {
  bankLeft: { label: "Bank Left", note: 25 },
  bankRight: { label: "Bank Right", note: 26 },
  soloKey: { label: "Solo key", note: 27 },
};

export const DEFAULT_MIDI_CHANNEL = 0;
export const TRACK_COUNT = 8;

const CC_TO_KNOB = new Map();
KNOB_ROWS.forEach((row, rowIndex) => {
  row.ccs.forEach((cc, trackIndex) => {
    CC_TO_KNOB.set(cc, { rowIndex, trackIndex });
  });
});

const CC_TO_FADER = new Map();
FADER_CCS.forEach((cc, trackIndex) => {
  CC_TO_FADER.set(cc, trackIndex);
});

const NOTE_TO_MUTE = new Map();
BUTTON_ROWS.mute.notes.forEach((note, trackIndex) => {
  NOTE_TO_MUTE.set(note, trackIndex);
});

const NOTE_TO_SOLO = new Map();
BUTTON_ROWS.solo.notes.forEach((note, trackIndex) => {
  NOTE_TO_SOLO.set(note, trackIndex);
});

/** @returns {{ kind: 'knob', rowIndex: number, trackIndex: number } | { kind: 'fader', trackIndex: number } | { kind: 'master' } | null} */
export function ccControl(cc) {
  if (cc === MASTER_CC) return { kind: "master" };
  const knob = CC_TO_KNOB.get(cc);
  if (knob) return { kind: "knob", ...knob };
  const fader = CC_TO_FADER.get(cc);
  if (fader !== undefined) return { kind: "fader", trackIndex: fader };
  return null;
}

/** @returns {{ kind: 'mute' | 'solo', trackIndex: number } | { kind: 'bankLeft' | 'bankRight' | 'soloKey' } | null} */
export function noteControl(note) {
  if (note === GLOBAL_BUTTONS.bankLeft.note) return { kind: "bankLeft" };
  if (note === GLOBAL_BUTTONS.bankRight.note) return { kind: "bankRight" };
  if (note === GLOBAL_BUTTONS.soloKey.note) return { kind: "soloKey" };
  const mute = NOTE_TO_MUTE.get(note);
  if (mute !== undefined) return { kind: "mute", trackIndex: mute };
  const solo = NOTE_TO_SOLO.get(note);
  if (solo !== undefined) return { kind: "solo", trackIndex: solo };
  return null;
}

export function knobCc(rowIndex, trackIndex) {
  return KNOB_ROWS[rowIndex].ccs[trackIndex];
}

export function faderCc(trackIndex) {
  return FADER_CCS[trackIndex];
}

export function muteNote(trackIndex) {
  return BUTTON_ROWS.mute.notes[trackIndex];
}

export function soloNote(trackIndex) {
  return BUTTON_ROWS.solo.notes[trackIndex];
}
