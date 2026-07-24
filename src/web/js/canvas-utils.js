/** Shared canvas sizing for flex layouts. */

export function setupCanvasResize(canvas, onResize) {
  const observer = new ResizeObserver(() => measure(canvas, onResize));
  observer.observe(canvas);
  requestAnimationFrame(() => {
    measure(canvas, onResize);
    requestAnimationFrame(() => measure(canvas, onResize));
  });
  return observer;
}

function measure(canvas, onResize) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width < 2 || height < 2) return;

  const dpr = window.devicePixelRatio || 1;
  const bufferWidth = Math.floor(width * dpr);
  const bufferHeight = Math.floor(height * dpr);
  if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  onResize(width, height, ctx);
}
