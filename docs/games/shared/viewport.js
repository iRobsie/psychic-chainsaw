import { initCanvas, resizeCanvasToDisplaySize } from '../../game-lib/render/canvas.js';

/**
 * Creates a viewport that keeps a canvas scaled to the browser window while
 * preserving a fixed world coordinate system.  Consumers can call
 * `withContext()` during rendering to automatically apply the correct
 * transform.  The viewport also exposes the raw canvas/context and current
 * scale values for advanced usage.
 */
export function createViewport(selector, worldWidth, worldHeight) {
  const { canvas, ctx } = initCanvas(selector, worldWidth, worldHeight);
  const viewport = {
    canvas,
    ctx,
    worldWidth,
    worldHeight,
    displayWidth: worldWidth,
    displayHeight: worldHeight,
    scaleX: 1,
    scaleY: 1,
    resize,
    withContext,
  };

  function resize(width = window.innerWidth, height = window.innerHeight) {
    const size = resizeCanvasToDisplaySize(canvas, ctx, width, height);
    viewport.displayWidth = size.width;
    viewport.displayHeight = size.height;
    viewport.scaleX = size.width / worldWidth;
    viewport.scaleY = size.height / worldHeight;
  }

  function withContext(fn) {
    ctx.save();
    ctx.scale(viewport.scaleX, viewport.scaleY);
    try {
      fn(ctx, viewport);
    } finally {
      ctx.restore();
    }
  }

  window.addEventListener('resize', () => resize());
  resize();

  return viewport;
}
