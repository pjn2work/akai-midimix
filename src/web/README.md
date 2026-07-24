# MIDIMIX Wave Visualizer

Web app to configure and visualize 8 sine waves using an **Akai MIDIMIX** controller (or mouse). Each of the 8 strips controls one wave; the canvas shows individual waves in track colors and their sum in green.

<img src="../../img/akai_midimix.png" width="300" alt="Akai MIDIMIX" style="box-shadow: 8px 8px 16px rgba(30,0,20,0.4); border-radius: 10px;"/>

## Requirements

- Chrome or Edge (Web MIDI API)
- Akai MIDIMIX with factory-default MIDI mapping
- For hardware LED feedback: Akai MIDIMIX Editor → button **LED mode** = **External**

## Run

Serve this folder over HTTP (required for Web MIDI on some setups):

```bash
cd src/web
npx --yes serve .
# or: python3 -m http.server 8080
```

Open `http://localhost:3000` (or `:8080`), select your MIDIMIX input, click **Connect**.

## Controls

| Control | Parameter |
|---------|-----------|
| Knob row 1 | Track color (bright RGB path, no green) |
| Knob row 2 | Frequency −2π … 2π |
| Knob row 3 | Phase −π … π |
| Fader | Amplitude 0 … 1 (fader / 127) |
| Master fader | Time range 0 … 10 s (X-axis end) |
| Mute | Hide wave and exclude from sum |
| Solo key + Solo button | Solo track (hardware); mouse solo works without key |
| Bank L/R or Δt slider | Sample step (default 0.05, step 0.025) |

Wave formula: `wave(t) = amplitude × sin(frequency × t + phase)`

## MIDI map

CC/note layout matches `src/python/midimix_factory.py` (see `js/midi-map.js`).

## Files

| File | Role |
|------|------|
| `js/midi-map.js` | Factory CC/note constants |
| `js/color.js` | Knob → RGB (no green, no red wrap) |
| `js/wave-engine.js` | State, math, mute/solo |
| `js/canvas-renderer.js` | Canvas plotting |
| `js/layout-ui.js` | Controller mirror + mouse |
| `js/midi-io.js` | Web MIDI in/out, LED mirror |
| `js/app.js` | Wiring |
