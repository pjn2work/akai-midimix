# MIDIMIX Wave Visualizer

Web app to configure and visualize 8 sine waves using an **Akai MIDIMIX** controller (or mouse). Each of the 8 strips controls one wave; the canvas shows individual waves in track colors and their sum in green.

<img src="../../img/akai_midimix.png" width="300" alt="Akai MIDIMIX" style="box-shadow: 8px 8px 16px rgba(30,0,20,0.4); border-radius: 10px;"/>

## Requirements

- Chrome or Edge (Web MIDI API)
- Akai MIDIMIX with factory-default MIDI mapping
- For hardware LED feedback: Akai MIDIMIX Editor → button **LED mode** = **External**

## Run

Serve this folder over HTTP and open it **on the same computer that has the MIDIMIX plugged in**:

```bash
cd src/web
npx --yes serve .
# or: python3 -m http.server 8080
```

Open **`http://localhost:3000`** (not a LAN IP like `http://192.168.x.x`). The browser Web MIDI API only works in a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts): `localhost`, `127.0.0.1`, or HTTPS. Python/mido has no such restriction, which is why the debugger worked over any setup.

MIDI ports are also **local to the browser machine** — opening the app on a phone or another PC will list that device's MIDI ports, not your Mac's MIDIMIX.

Select your MIDIMIX input and click **Connect**.

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
