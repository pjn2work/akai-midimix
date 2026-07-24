import { WaveEngine } from "./wave-engine.js";
import { CanvasRenderer } from "./canvas-renderer.js";
import { LayoutUI } from "./layout-ui.js";
import { MidiIO } from "./midi-io.js";

const engine = new WaveEngine();
const canvas = document.getElementById("wave-canvas");
const layoutRoot = document.getElementById("layout-root");
const legendRoot = document.getElementById("legend");
const statusEl = document.getElementById("status");
const portSelect = document.getElementById("midi-port");
const connectBtn = document.getElementById("midi-connect");
const mirrorCheck = document.getElementById("mirror-leds");

const renderer = new CanvasRenderer(canvas);
const midi = new MidiIO(engine, {
  onStatus: (msg) => {
    statusEl.textContent = msg;
  },
  onStateChange: () => {
    connectBtn.textContent = midi.connected ? "Disconnect" : "Connect";
    portSelect.disabled = midi.connected;
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
});

async function refreshPorts() {
  if (!midi.supported) {
    statusEl.textContent = "Web MIDI not supported — use Chrome or Edge.";
    connectBtn.disabled = true;
    return;
  }
  try {
    const { inputs } = await midi.listPorts();
    portSelect.innerHTML = "";
    if (inputs.length === 0) {
      const opt = document.createElement("option");
      opt.textContent = "No MIDI inputs found";
      portSelect.appendChild(opt);
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
  } catch (err) {
    statusEl.textContent = `MIDI error: ${err.message}`;
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

refreshPorts().then(() => scheduleRender());
