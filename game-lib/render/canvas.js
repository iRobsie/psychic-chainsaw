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
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D context from canvas.');
  }
  return { canvas, ctx };
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
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  } else {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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