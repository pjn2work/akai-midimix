/** Map knob CC 0–127 to bright RGB colors (no wrap, no green — reserved for sum wave). */

const COLOR_STOPS = [
  { cc: 0, rgb: [255, 0, 0] },
  { cc: 25, rgb: [255, 128, 0] },
  { cc: 42, rgb: [255, 255, 0] },
  { cc: 64, rgb: [255, 255, 255] },
  { cc: 85, rgb: [0, 255, 255] },
  { cc: 106, rgb: [0, 0, 255] },
  { cc: 127, rgb: [255, 0, 255] },
];

const SUM_GREEN = [0, 255, 0];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpRgb(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsv([r, g, b]) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hsvToRgb([h, s, v]) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255),
  ];
}

/** Nudge colors that land in the green hue band away from sum-green. */
function avoidGreen(rgb) {
  const [h, s, v] = rgbToHsv(rgb);
  if (s < 0.35) return rgb;
  if (h >= 80 && h <= 160) {
    const distLow = h - 80;
    const distHigh = 160 - h;
    return hsvToRgb([distLow <= distHigh ? 79 : 161, s, v]);
  }
  const dr = rgb[0] - SUM_GREEN[0];
  const dg = rgb[1] - SUM_GREEN[1];
  const db = rgb[2] - SUM_GREEN[2];
  if (dr * dr + dg * dg + db * db < 3600) {
    return hsvToRgb([79, s, v]);
  }
  return rgb;
}

/**
 * @param {number} cc 0–127
 * @returns {{ r: number, g: number, b: number, hex: string }}
 */
export function ccToColor(cc) {
  const value = Math.max(0, Math.min(127, cc));
  let lower = COLOR_STOPS[0];
  let upper = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i += 1) {
    if (value >= COLOR_STOPS[i].cc && value <= COLOR_STOPS[i + 1].cc) {
      lower = COLOR_STOPS[i];
      upper = COLOR_STOPS[i + 1];
      break;
    }
  }
  const span = upper.cc - lower.cc || 1;
  const t = (value - lower.cc) / span;
  const rgb = avoidGreen(lerpRgb(lower.rgb, upper.rgb, t));
  return { r: rgb[0], g: rgb[1], b: rgb[2], hex: rgbToHex(rgb) };
}

export const SUM_WAVE_COLOR = "#00ff00";
