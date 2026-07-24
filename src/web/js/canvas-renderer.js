import { SUM_WAVE_COLOR } from "./color.js";
import { TRACK_COUNT } from "./midi-map.js";

export class CanvasRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const width = parent?.clientWidth ?? 640;
    const height = parent?.clientHeight ?? 400;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.displayWidth = width;
    this.displayHeight = height;
  }

  /** @param {import('./wave-engine.js').WaveEngine} engine */
  render(engine) {
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    const pad = { top: 24, right: 16, bottom: 36, left: 48 };
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;

    ctx.fillStyle = "#301022";
    ctx.fillRect(0, 0, w, h);

    const points = engine.sampleSeries();
    if (points.length === 0 || engine.masterTime <= 0) {
      this.drawEmpty(ctx, w, h, engine.masterTime);
      return;
    }

    const visible = engine.visibleTracks();
    let yMin = 0;
    let yMax = 0;
    for (const p of points) {
      yMin = Math.min(yMin, p.sum);
      yMax = Math.max(yMax, p.sum);
      for (let i = 0; i < TRACK_COUNT; i += 1) {
        if (visible[i] && p.waves[i] != null) {
          yMin = Math.min(yMin, p.waves[i]);
          yMax = Math.max(yMax, p.waves[i]);
        }
      }
    }
    const yPad = Math.max(0.15, (yMax - yMin) * 0.08);
    yMin -= yPad;
    yMax += yPad;
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }

    const xScale = (t) => pad.left + (t / engine.masterTime) * plotW;
    const yScale = (v) => pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

    this.drawGrid(ctx, pad, plotW, plotH, engine.masterTime, yMin, yMax, xScale, yScale);

    for (let ti = 0; ti < TRACK_COUNT; ti += 1) {
      if (!visible[ti]) continue;
      const color = engine.tracks[ti].color.hex;
      this.drawSeries(ctx, points, (p) => p.waves[ti], color, 1.5, xScale, yScale);
    }

    this.drawSeries(ctx, points, (p) => p.sum, SUM_WAVE_COLOR, 2.5, xScale, yScale);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`0 s`, pad.left, h - 12);
    ctx.fillText(`${engine.masterTime.toFixed(1)} s`, pad.left + plotW - 36, h - 12);
    ctx.fillText(`Σ sum`, pad.left, pad.top - 8);
  }

  drawGrid(ctx, pad, plotW, plotH, masterTime, yMin, yMax, xScale, yScale) {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    const zeroY = yScale(0);
    if (zeroY >= pad.top && zeroY <= pad.top + plotH) {
      ctx.beginPath();
      ctx.moveTo(pad.left, zeroY);
      ctx.lineTo(pad.left + plotW, zeroY);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(yMax.toFixed(2), 4, pad.top + 10);
    ctx.fillText(yMin.toFixed(2), 4, pad.top + plotH);
  }

  drawSeries(ctx, points, accessor, color, lineWidth, xScale, yScale) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    let started = false;
    for (const p of points) {
      const y = accessor(p);
      if (y == null) {
        started = false;
        continue;
      }
      const x = xScale(p.t);
      const py = yScale(y);
      if (!started) {
        ctx.moveTo(x, py);
        started = true;
      } else {
        ctx.lineTo(x, py);
      }
    }
    ctx.stroke();
  }

  drawEmpty(ctx, w, h, masterTime) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      masterTime <= 0 ? "Set master fader above 0 s to plot waves" : "No data",
      w / 2,
      h / 2,
    );
    ctx.textAlign = "start";
  }
}
