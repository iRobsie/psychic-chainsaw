// game-lib/physics/collision.js
// Provides basic axis-aligned bounding box (AABB) collision detection
// for rectangular objects.  Each object should have x, y, width and
// height properties.  The coordinate system uses top-left origin
// with y increasing downward, as per the HTML5 canvas default.

/**
 * Checks whether two axis-aligned rectangles intersect.  The objects
 * should have x, y, width and height numeric properties.  The x and y
 * values correspond to the top-left corner of each rectangle.
 *
 * @param {object} a
 * @param {object} b
 * @returns {boolean}
 */
export function aabbIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Resolves penetration by moving object `a` out of object `b` along
 * the smallest axis.  This simple resolution only works for static
 * objects.  It modifies a.x and a.y directly and optionally zeros
 * out the corresponding velocity component.
 *
 * @param {object} a - moving object (should have x,y,width,height,vx,vy)
 * @param {object} b - static object (should have x,y,width,height)
 */
export function resolveAABB(a, b) {
  // Calculate overlap on each axis
  const left = b.x + b.width - a.x;
  const right = a.x + a.width - b.x;
  const top = b.y + b.height - a.y;
  const bottom = a.y + a.height - b.y;
  // Find smallest penetration depth
  const minX = Math.min(left, right);
  const minY = Math.min(top, bottom);
  if (minX < minY) {
    // Resolve horizontally
    if (left < right) {
      a.x = b.x + b.width;
    } else {
      a.x = b.x - a.width;
    }
    if (a.vx !== undefined) a.vx = 0;
  } else {
    // Resolve vertically
    if (top < bottom) {
      a.y = b.y + b.height;
    } else {
      a.y = b.y - a.height;
    }
    if (a.vy !== undefined) a.vy = 0;
  }
}