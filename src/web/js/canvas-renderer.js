import { PLOT } from "./constants.js";
import { SUM_WAVE_COLOR } from "./color.js";
import { TRACK_COUNT } from "./midi-map.js";
import { setupCanvasResize } from "./canvas-utils.js";

const Y_AXIS_LIMIT = PLOT.yAxisLimit;

export class CanvasRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.displayWidth = 0;
    this.displayHeight = 0;
    this.engine = null;
    setupCanvasResize(canvas, (width, height, ctx) => {
      this.displayWidth = width;
      this.displayHeight = height;
      this.ctx = ctx;
      if (this.engine) this.render(this.engine);
    });
  }

  /** @param {import('./wave-engine.js').WaveEngine} engine */
  render(engine) {
    this.engine = engine;
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    if (w < 2 || h < 2) return;

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
    const yMin = -Y_AXIS_LIMIT;
    const yMax = Y_AXIS_LIMIT;
    const plotCenterY = pad.top + plotH / 2;
    const halfPlot = plotH / 2;

    const xScale = (t) => pad.left + (t / engine.masterTime) * plotW;
    const yScale = (v) => plotCenterY - (v / Y_AXIS_LIMIT) * halfPlot;

    this.drawGrid(ctx, pad, plotW, plotH, yMin, yMax, yScale, plotCenterY);

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

  drawGrid(ctx, pad, plotW, plotH, yMin, yMax, yScale, plotCenterY) {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;

    for (let v = -Y_AXIS_LIMIT; v <= Y_AXIS_LIMIT; v += 1) {
      if (v === 0) continue;
      const y = yScale(v);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + plotW, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.moveTo(pad.left, plotCenterY);
    ctx.lineTo(pad.left + plotW, plotCenterY);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillText(String(yMax), 4, pad.top + 10);
    ctx.fillText("0", 4, plotCenterY + 4);
    ctx.fillText(String(yMin), 4, pad.top + plotH);
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
