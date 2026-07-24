import { AUDIO } from "./constants.js";

export class SumAudioPlayer {
  /** @param {import('./wave-engine.js').WaveEngine} engine */
  constructor(engine) {
    this.engine = engine;
    this.context = null;
    this.source = null;
    this.playing = false;
    this.onStateChange = () => {};
  }

  get canPlay() {
    return this.engine.masterTime > 0;
  }

  async play() {
    if (!this.canPlay) return;

    this.stop();

    const ctx = this.context ?? new AudioContext();
    this.context = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    const duration = this.engine.masterTime;
    const sampleRate = ctx.sampleRate;
    const length = Math.max(1, Math.ceil(duration * sampleRate));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = Math.min(duration, i / sampleRate);
      data[i] = this.engine.sumAtAudio(t) / AUDIO.sumGainDivisor;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      this.playing = false;
      this.source = null;
      this.onStateChange();
    };
    source.start();
    this.source = source;
    this.playing = true;
    this.onStateChange();
  }

  stop() {
    if (this.source) {
      try {
        this.source.stop();
      } catch {
        /* already stopped */
      }
      this.source.disconnect();
      this.source = null;
    }
    if (this.playing) {
      this.playing = false;
      this.onStateChange();
    }
  }
}
