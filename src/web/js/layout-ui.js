import {
  GLOBAL_BUTTONS,
  KNOB_ROWS,
  FADER_CCS,
  MASTER_CC,
  BUTTON_ROWS,
  TRACK_COUNT,
  knobCc,
  faderCc,
  muteNote,
  soloNote,
} from "./midi-map.js";
import { TIME_STEP_MIN, TIME_STEP_MAX } from "./wave-engine.js";

export class LayoutUI {
  /**
   * @param {HTMLElement} root
   * @param {import('./wave-engine.js').WaveEngine} engine
   * @param {{ onCcChange: (cc:number,value:number)=>void, onNoteToggle: (note:number)=>void, onTimeStepChange: (value:number)=>void }} handlers
   */
  constructor(root, engine, handlers) {
    this.root = root;
    this.engine = engine;
    this.handlers = handlers;
    this.ccSliders = new Map();
    this.noteButtons = new Map();
    this.trackSwatches = [];
    this.masterTimeLabel = null;
    this.timeStepSlider = null;
    this.timeStepValue = null;
    this.soloKeyButton = null;
    this._build();
    this.syncFromEngine();
  }

  _build() {
    this.root.innerHTML = "";

    const knobsArea = document.createElement("div");
    knobsArea.className = "knobs-area";

    const knobGrid = document.createElement("div");
    knobGrid.className = "knob-grid";

    KNOB_ROWS.forEach((row, rowIndex) => {
      const frame = document.createElement("div");
      frame.className = "control-row";
      const title = document.createElement("div");
      title.className = "row-label";
      title.textContent = row.label;
      frame.appendChild(title);

      const cells = document.createElement("div");
      cells.className = "cell-row";
      row.ccs.forEach((cc, trackIndex) => {
        const swatch = rowIndex === 0;
        const cell = this._createCcCell(`T${trackIndex + 1}`, cc, { swatch, rowIndex, trackIndex });
        if (swatch) this.trackSwatches[trackIndex] = cell.querySelector(".swatch");
        cells.appendChild(cell);
      });
      frame.appendChild(cells);
      knobGrid.appendChild(frame);
    });

    knobsArea.appendChild(knobGrid);

    const globals = document.createElement("div");
    globals.className = "global-buttons";
    const bankLeft = this._createMomentaryButton(GLOBAL_BUTTONS.bankLeft.label, GLOBAL_BUTTONS.bankLeft.note, () => {
      this.engine.adjustTimeStep(-0.025);
      this.handlers.onTimeStepChange?.(this.engine.timeStep);
    });
    const bankRight = this._createMomentaryButton(
      GLOBAL_BUTTONS.bankRight.label,
      GLOBAL_BUTTONS.bankRight.note,
      () => {
        this.engine.adjustTimeStep(0.025);
        this.handlers.onTimeStepChange?.(this.engine.timeStep);
      },
    );
    globals.append(bankLeft, bankRight);
    knobsArea.appendChild(globals);
    this.root.appendChild(knobsArea);

    const faderFrame = document.createElement("div");
    faderFrame.className = "control-row";
    faderFrame.innerHTML = `<div class="row-label">Faders</div>`;
    const faderCells = document.createElement("div");
    faderCells.className = "cell-row fader-row";
    FADER_CCS.forEach((cc, trackIndex) => {
      faderCells.appendChild(this._createFaderCell(`T${trackIndex + 1}`, cc, trackIndex));
    });
    const masterCell = this._createFaderCell("Master", MASTER_CC, null, true);
    this.masterTimeLabel = masterCell.querySelector(".meta");
    faderCells.appendChild(masterCell);
    faderFrame.appendChild(faderCells);
    this.root.appendChild(faderFrame);

    const timeStepRow = document.createElement("div");
    timeStepRow.className = "timestep-row";
    timeStepRow.innerHTML = `<span class="row-label">Time step Δt</span>`;
    this.timeStepSlider = document.createElement("input");
    this.timeStepSlider.type = "range";
    this.timeStepSlider.min = String(TIME_STEP_MIN);
    this.timeStepSlider.max = String(TIME_STEP_MAX);
    this.timeStepSlider.step = "0.025";
    this.timeStepSlider.className = "timestep-slider";
    this.timeStepSlider.addEventListener("input", () => {
      const value = parseFloat(this.timeStepSlider.value);
      this.engine.setTimeStep(value);
      this.handlers.onTimeStepChange?.(value);
    });
    this.timeStepValue = document.createElement("span");
    this.timeStepValue.className = "timestep-value";
    timeStepRow.append(this.timeStepSlider, this.timeStepValue);
    this.root.appendChild(timeStepRow);

    const muteFrame = this._createButtonRow(BUTTON_ROWS.mute.label, BUTTON_ROWS.mute.notes, "mute");
    this.root.appendChild(muteFrame);

    const soloFrame = this._createButtonRow(BUTTON_ROWS.solo.label, BUTTON_ROWS.solo.notes, "solo");
    const soloKeyCell = document.createElement("div");
    soloKeyCell.className = "button-cell";
    this.soloKeyButton = document.createElement("button");
    this.soloKeyButton.type = "button";
    this.soloKeyButton.className = "note-btn";
    this.soloKeyButton.textContent = GLOBAL_BUTTONS.soloKey.label;
    this.soloKeyButton.title = "Hold (or click) then press a Solo button";
    this.soloKeyButton.addEventListener("mousedown", () => this._setSoloKey(true));
    this.soloKeyButton.addEventListener("mouseup", () => this._setSoloKey(false));
    this.soloKeyButton.addEventListener("mouseleave", () => this._setSoloKey(false));
    this.soloKeyButton.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this._setSoloKey(true);
    });
    this.soloKeyButton.addEventListener("touchend", () => this._setSoloKey(false));
    soloKeyCell.appendChild(this.soloKeyButton);
    soloFrame.querySelector(".cell-row").appendChild(soloKeyCell);
    this.noteButtons.set(GLOBAL_BUTTONS.soloKey.note, this.soloKeyButton);
    this.root.appendChild(soloFrame);
  }

  _setSoloKey(held) {
    this.engine.setSoloKeyHeld(held);
    this._setButtonLit(this.soloKeyButton, held);
  }

  _createCcCell(label, cc, { swatch, trackIndex, rowIndex }) {
    const cell = document.createElement("div");
    cell.className = "cc-cell";
    cell.innerHTML = `
      <div class="track-label">${label}</div>
      ${swatch ? '<div class="swatch"></div>' : ""}
      <input type="range" min="0" max="127" value="0" class="cc-slider" orient="horizontal" />
      <div class="value">0</div>
    `;
    const slider = cell.querySelector(".cc-slider");
    const valueEl = cell.querySelector(".value");
    slider.addEventListener("input", () => {
      const value = parseInt(slider.value, 10);
      valueEl.textContent = String(value);
      this.handlers.onCcChange?.(cc, value);
    });
    this.ccSliders.set(cc, { slider, valueEl, swatch: cell.querySelector(".swatch") });
    return cell;
  }

  _createFaderCell(label, cc, trackIndex, isMaster = false) {
    const cell = document.createElement("div");
    cell.className = "fader-cell";
    cell.innerHTML = `
      <div class="track-label">${label}</div>
      <input type="range" min="0" max="127" value="${isMaster ? 64 : 0}" class="fader-slider" />
      <div class="value">${isMaster ? 64 : 0}</div>
      ${isMaster ? '<div class="meta">Time: 0 – 5.0 s</div>' : ""}
    `;
    const slider = cell.querySelector(".fader-slider");
    const valueEl = cell.querySelector(".value");
    slider.addEventListener("input", () => {
      const value = parseInt(slider.value, 10);
      valueEl.textContent = String(value);
      this.handlers.onCcChange?.(cc, value);
    });
    this.ccSliders.set(cc, { slider, valueEl, meta: cell.querySelector(".meta") });
    return cell;
  }

  _createButtonRow(title, notes, kind) {
    const frame = document.createElement("div");
    frame.className = "control-row";
    frame.innerHTML = `<div class="row-label">${title}</div>`;
    const cells = document.createElement("div");
    cells.className = "cell-row button-row";
    notes.forEach((note, trackIndex) => {
      const cell = document.createElement("div");
      cell.className = "button-cell";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "note-btn";
      btn.textContent = `T${trackIndex + 1}`;
      btn.addEventListener("click", () => {
        this.handlers.onNoteToggle?.(note);
      });
      cell.appendChild(btn);
      this.noteButtons.set(note, btn);
      cells.appendChild(cell);
    });
    frame.appendChild(cells);
    return frame;
  }

  _createMomentaryButton(label, note, onPress) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "note-btn global-btn";
    btn.textContent = label;
    btn.addEventListener("click", onPress);
    this.noteButtons.set(note, btn);
    return btn;
  }

  _setButtonLit(btn, lit) {
    if (!btn) return;
    btn.classList.toggle("lit", lit);
  }

  syncFromEngine() {
    const engine = this.engine;
    for (let ti = 0; ti < TRACK_COUNT; ti += 1) {
      const track = engine.tracks[ti];
      for (let ri = 0; ri < 3; ri += 1) {
        const cc = knobCc(ri, ti);
        this._syncCc(cc, track.knobValues[ri], ri === 0 ? track.color.hex : null);
      }
      this._syncCc(faderCc(ti), track.faderValue);
      this._setButtonLit(this.noteButtons.get(muteNote(ti)), track.muted);
      this._setButtonLit(this.noteButtons.get(soloNote(ti)), track.soloed);
    }
    this._syncCc(MASTER_CC, engine.masterCc);
    if (this.masterTimeLabel) {
      this.masterTimeLabel.textContent = `Time: 0 – ${engine.masterTime.toFixed(1)} s`;
    }
    if (this.timeStepSlider) {
      this.timeStepSlider.value = String(engine.timeStep);
    }
    if (this.timeStepValue) {
      this.timeStepValue.textContent = engine.timeStep.toFixed(3);
    }
    this._setButtonLit(this.soloKeyButton, engine.soloKeyHeld);
  }

  _syncCc(cc, value, swatchColor = undefined) {
    const widgets = this.ccSliders.get(cc);
    if (!widgets) return;
    widgets.slider.value = String(value);
    widgets.valueEl.textContent = String(value);
    if (widgets.swatch && swatchColor) widgets.swatch.style.background = swatchColor;
    if (widgets.meta && cc === MASTER_CC) {
      widgets.meta.textContent = `Time: 0 – ${this.engine.masterTime.toFixed(1)} s`;
    }
  }

  /** Prevent feedback loops when updating from MIDI. */
  setCcFromExternal(cc, value, swatchColor) {
    this._syncCc(cc, value, swatchColor);
  }

  setButtonLit(note, lit) {
    this._setButtonLit(this.noteButtons.get(note), lit);
  }
}
