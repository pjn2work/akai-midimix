import { CENTER_FREQUENCY } from "./constants.js";
import { WaveEngine } from "./wave-engine.js";
import { CanvasRenderer } from "./canvas-renderer.js";
import { LayoutUI } from "./layout-ui.js";
import { MidiIO, checkMidiEnvironment } from "./midi-io.js";
import { SumAudioPlayer } from "./sum-audio.js";

const engine = new WaveEngine();
const canvas = document.getElementById("wave-canvas");
const layoutRoot = document.getElementById("layout-root");
const legendRoot = document.getElementById("legend");
const statusEl = document.getElementById("status");
const warningEl = document.getElementById("midi-warning");
const portSelect = document.getElementById("midi-port");
const connectBtn = document.getElementById("midi-connect");
const mirrorCheck = document.getElementById("mirror-leds");
const playBtn = document.getElementById("play-sum");
const centerFreqSlider = document.getElementById("center-frequency");
const centerFreqValue = document.getElementById("center-frequency-value");

function showMidiWarning(message) {
  if (!warningEl) return;
  if (message) {
    warningEl.hidden = false;
    warningEl.textContent = message;
  } else {
    warningEl.hidden = true;
    warningEl.textContent = "";
  }
}

const renderer = new CanvasRenderer(canvas);
const sumAudio = new SumAudioPlayer(engine);
sumAudio.onStateChange = updatePlayButton;

function updatePlayButton() {
  if (!playBtn) return;
  playBtn.disabled = !sumAudio.canPlay;
  playBtn.textContent = sumAudio.playing ? "■ Stop" : "▶ Play sum";
}

const midi = new MidiIO(engine, {
  onStatus: (msg) => {
    statusEl.textContent = msg;
  },
  onStateChange: () => {
    connectBtn.textContent = midi.connected ? "Disconnect" : "Connect";
    portSelect.disabled = midi.connected;
    if (!midi.connected) refreshPorts();
  },
});

let renderScheduled = false;
function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    renderer.render(engine);
    updateLegend();
  });
}

function updateLegend() {
  legendRoot.innerHTML = "";
  const sumItem = document.createElement("div");
  sumItem.className = "legend-item";
  sumItem.innerHTML = `<span class="legend-swatch sum"></span><span>Sum</span>`;
  legendRoot.appendChild(sumItem);

  engine.tracks.forEach((track, i) => {
    const item = document.createElement("div");
    item.className = "legend-item";
    const visible = engine.visibleTracks()[i];
    item.style.opacity = visible ? "1" : "0.35";
    item.innerHTML = `<span class="legend-swatch" style="background:${track.color.hex}"></span><span>T${i + 1}</span>`;
    legendRoot.appendChild(item);
  });
}

function applyCc(cc, value) {
  engine.ccValue(cc, value);
}

function applyNoteToggle(note) {
  const result = engine.handleNote(note, true, { requireSoloKey: false });
  if (result?.toggled) midi.mirrorTrackButton(note);
}

const layout = new LayoutUI(layoutRoot, engine, {
  onCcChange: applyCc,
  onNoteToggle: applyNoteToggle,
  onTimeStepChange: () => {},
});

engine.onChange(() => {
  layout.syncFromEngine();
  scheduleRender();
  updatePlayButton();
});

async function refreshPorts() {
  const env = checkMidiEnvironment();
  if (!env.ok) {
    showMidiWarning(env.hint ?? env.reason);
    statusEl.textContent = env.reason ?? "Web MIDI unavailable";
    connectBtn.disabled = true;
    portSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.textContent = "MIDI unavailable";
    portSelect.appendChild(opt);
    return;
  }

  showMidiWarning(null);
  connectBtn.disabled = false;

  try {
    const { inputs } = await midi.listPorts();
    portSelect.innerHTML = "";
    if (inputs.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No MIDI inputs on this device";
      portSelect.appendChild(opt);
      statusEl.textContent =
        "No MIDI inputs found on this computer. Plug in the MIDIMIX here (MIDI is local to the browser machine).";
      return;
    }
    inputs.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      portSelect.appendChild(opt);
    });
    const preferred = inputs.find((n) => /midimix|midi mix/i.test(n)) ?? inputs[0];
    portSelect.value = preferred;
    statusEl.textContent = `${inputs.length} MIDI input(s) on this computer`;
  } catch (err) {
    showMidiWarning("Try http://localhost:3000 on the machine with the MIDIMIX, or use HTTPS.");
    statusEl.textContent = `MIDI error: ${err.message}`;
    connectBtn.disabled = true;
  }
}

connectBtn.addEventListener("click", async () => {
  if (midi.connected) {
    midi.disconnect();
    return;
  }
  midi.mirrorLeds = mirrorCheck.checked;
  try {
    await midi.connect(portSelect.value);
    midi.syncAllLeds();
  } catch (err) {
    statusEl.textContent = err.message;
  }
});

mirrorCheck.addEventListener("change", () => {
  midi.mirrorLeds = mirrorCheck.checked;
});

document.getElementById("refresh-ports").addEventListener("click", refreshPorts);

centerFreqSlider.min = String(CENTER_FREQUENCY.min);
centerFreqSlider.max = String(CENTER_FREQUENCY.max);
centerFreqSlider.value = String(CENTER_FREQUENCY.default);
centerFreqValue.textContent = `${CENTER_FREQUENCY.default} Hz`;
engine.setCenterFrequency(CENTER_FREQUENCY.default);

centerFreqSlider.addEventListener("input", () => {
  const hz = parseInt(centerFreqSlider.value, 10);
  engine.setCenterFrequency(hz);
  centerFreqValue.textContent = `${hz} Hz`;
  if (sumAudio.playing) sumAudio.play();
});

playBtn.addEventListener("click", async () => {
  if (sumAudio.playing) {
    sumAudio.stop();
    return;
  }
  try {
    await sumAudio.play();
  } catch (err) {
    statusEl.textContent = `Audio error: ${err.message}`;
    updatePlayButton();
  }
});

refreshPorts().then(() => {
  scheduleRender();
  updatePlayButton();
});
