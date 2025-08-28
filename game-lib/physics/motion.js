// game-lib/physics/motion.js
// Provides simple motion and physics helpers for 2D games.  These
// utilities implement velocity, acceleration and gravity updates for
// objects with x/y positions and vx/vy velocities.

/**
 * Applies acceleration to velocity and velocity to position.  The object
 * should have properties `x`, `y`, `vx`, `vy`, `ax` and `ay`.  The
 * delta time `dt` should be provided in seconds.  This function does
 * not clamp or restrict velocities; friction or bounds checks should
 * be applied by the caller if needed.
 *
 * @param {object} obj - Any object with numeric x, y, vx, vy, ax and ay properties
 * @param {number} dt - Delta time in seconds
 */
export function applyMovement(obj, dt) {
  obj.vx += (obj.ax || 0) * dt;
  obj.vy += (obj.ay || 0) * dt;
  obj.x += obj.vx * dt;
  obj.y += obj.vy * dt;
}

/**
 * Assigns a constant downward acceleration to the object to simulate gravity.
 * The object must have an `ay` property; this function simply sets it.
 *
 * @param {object} obj - Object to add gravity to
 * @param {number} g - Acceleration due to gravity (positive value)
 */
export function setGravity(obj, g) {
  obj.ay = g;
}

/**
 * Applies a jump impulse to the object by setting its vertical velocity.
 * Negative velocity corresponds to upward motion in canvas coordinate
 * system (y increases downward).  Ensure the object has `vy`
 * property.  Optionally resets vertical acceleration.
 *
 * @param {object} obj
 * @param {number} speed - Jump velocity (positive number)
 */
export function jump(obj, speed) {
  obj.vy = -Math.abs(speed);
}

/**
 * Applies simple friction by damping the object's velocity.  The
 * coefficient should be between 0 (stop immediately) and 1 (no
 * friction).  It is applied per second, so the final multiplier is
 * `Math.pow(coef, dt)`.  Use values like 0.8 for a noticeable
 * slowdown.
 *
 * @param {object} obj
 * @param {number} coef - Friction coefficient (0..1)
 * @param {number} dt - Delta time in seconds
 */
export function applyFriction(obj, coef, dt) {
  const factor = Math.pow(coef, dt);
  obj.vx *= factor;
  obj.vy *= factor;
}