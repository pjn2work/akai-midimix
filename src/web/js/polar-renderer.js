import { POLAR } from "./constants.js";
import { SUM_WAVE_COLOR } from "./color.js";
import { setupCanvasResize } from "./canvas-utils.js";

const Y_AXIS_LIMIT = POLAR.yAxisLimit;
const MAX_VECTOR_FRAMES = 120;

export class PolarRenderer {
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

  toScreen(x, y, cx, cy, radius) {
    return {
      x: cx + (x / Y_AXIS_LIMIT) * radius,
      y: cy - (y / Y_AXIS_LIMIT) * radius,
    };
  }

  pickVectorFrames(samples) {
    if (samples.length <= MAX_VECTOR_FRAMES) return samples;
    const picked = [];
    const last = samples.length - 1;
    for (let i = 0; i < MAX_VECTOR_FRAMES; i += 1) {
      const index = Math.round((i / (MAX_VECTOR_FRAMES - 1)) * last);
      picked.push(samples[index]);
    }
    return picked;
  }

  /** @param {import('./wave-engine.js').WaveEngine} engine */
  render(engine) {
    this.engine = engine;
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;
    if (w < 2 || h < 2) return;

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 28;

    ctx.fillStyle = "#301022";
    ctx.fillRect(0, 0, w, h);

    this.drawGrid(ctx, cx, cy, radius);

    if (engine.masterTime <= 0) {
      this.drawEmpty(ctx, w, h);
      return;
    }

    const samples = engine.samplePolarSeries();
    if (samples.length === 0) return;

    for (const sample of this.pickVectorFrames(samples)) {
      for (const seg of sample.segments) {
        const p0 = this.toScreen(seg.x0, seg.y0, cx, cy, radius);
        const p1 = this.toScreen(seg.x1, seg.y1, cx, cy, radius);
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    ctx.strokeStyle = SUM_WAVE_COLOR;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    let started = false;
    for (const sample of samples) {
      const p = this.toScreen(sample.tip.x, sample.tip.y, cx, cy, radius);
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else {
        ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`±${Y_AXIS_LIMIT}`, cx, cy - radius - 8);
    ctx.textAlign = "start";
  }

  drawGrid(ctx, cx, cy, radius) {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawEmpty(ctx, w, h) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Set master fader above 0 s", w / 2, h / 2);
    ctx.textAlign = "start";
  }
}
