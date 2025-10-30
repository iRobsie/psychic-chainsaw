// game-lib/render/canvas.js
// Utilities for working with a HTML canvas.  This module simplifies
// setting up the canvas element, clearing it, and drawing basic
// shapes or text.  Additional rendering helpers can be added here.

/**
 * Initializes a canvas.  Accepts either a CSS selector string
 * or a DOM element.  If the provided selector does not match
 * an existing canvas element, a new canvas will be created and
 * appended to the document body.
 *
 * @param {string|HTMLCanvasElement} target - Selector or canvas element
 * @param {number} width - Width of the canvas
 * @param {number} height - Height of the canvas
 * @returns {{canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D}}
 */
export function initCanvas(target, width = 800, height = 600) {
  let canvas;
  if (typeof target === 'string') {
    canvas = document.querySelector(target);
  } else if (target instanceof HTMLCanvasElement) {
    canvas = target;
  }
  if (!canvas) {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context from canvas.');
  }
  resizeCanvasToDisplaySize(canvas, ctx, width, height);
  return { canvas, ctx };
}

/**
 * Ensures the canvas matches the requested display size while respecting the
 * current device pixel ratio.  The canvas backing resolution is scaled by the
 * DPR so visuals remain crisp on high DPI displays, while the drawing
 * coordinate system stays aligned with CSS pixels.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width - Desired CSS width
 * @param {number} height - Desired CSS height
 * @returns {{width:number, height:number, dpr:number}}
 */
export function resizeCanvasToDisplaySize(canvas, ctx, width, height) {
  const fallbackWidth = canvas.__logicalWidth || canvas.clientWidth || canvas.width || 1;
  const fallbackHeight = canvas.__logicalHeight || canvas.clientHeight || canvas.height || 1;
  const cssWidth = Math.max(1, Math.floor(width ?? fallbackWidth));
  const cssHeight = Math.max(1, Math.floor(height ?? fallbackHeight));
  const dpr = window.devicePixelRatio || 1;
  const displayWidth = Math.round(cssWidth * dpr);
  const displayHeight = Math.round(cssHeight * dpr);

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  canvas.__logicalWidth = cssWidth;
  canvas.__logicalHeight = cssHeight;
  canvas.__devicePixelRatio = dpr;
  ctx.__logicalWidth = cssWidth;
  ctx.__logicalHeight = cssHeight;
  ctx.__devicePixelRatio = dpr;

  return { width: cssWidth, height: cssHeight, dpr };
}

/**
 * Clears the entire canvas by filling it with the given color.
 * If no color is provided, a transparent clear (erase) is performed.
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {string} [color] - Fill style used for clearing
 */
export function clear(ctx, color) {
  if (color) {
    ctx.fillStyle = color;
    const w = ctx.__logicalWidth || ctx.canvas.__logicalWidth || ctx.canvas.width;
    const h = ctx.__logicalHeight || ctx.canvas.__logicalHeight || ctx.canvas.height;
    ctx.fillRect(0, 0, w, h);
  } else {
    const w = ctx.__logicalWidth || ctx.canvas.__logicalWidth || ctx.canvas.width;
    const h = ctx.__logicalHeight || ctx.canvas.__logicalHeight || ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
  }
}

/**
 * Draws a filled rectangle at the specified location.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} w - Width of the rectangle
 * @param {number} h - Height of the rectangle
 * @param {string} color - Fill style
 */
export function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * Draws a circle (filled) at the specified location.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Radius of the circle
 * @param {string} color - Fill style
 */
export function drawCircle(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Draws text on the canvas.  The font, size and color can be specified.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {object} [options]
 * @param {string} [options.color] - Fill style for the text
 * @param {string} [options.font] - CSS font property (e.g. '16px Arial')
 * @param {string} [options.textAlign] - Horizontal alignment ('left','center','right')
 */
export function drawText(ctx, text, x, y, options = {}) {
  ctx.save();
  ctx.fillStyle = options.color || '#fff';
  ctx.font = options.font || '16px sans-serif';
  ctx.textAlign = options.textAlign || 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}