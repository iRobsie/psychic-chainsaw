// game-lib/core/loop.js
// Simple game loop utility that uses requestAnimationFrame.  It calculates
// a delta time between frames and calls provided update and render functions.
// The verbose logging included in this module can help you trace the loop
// execution and identify performance problems.

let loopHandle = null;

/**
 * Starts the main game loop. The loop will call the provided update
 * and render callbacks on each animation frame.  The update function
 * receives a `dt` parameter (in seconds) representing the time elapsed
 * since the last frame.  The render callback is called without
 * parameters after the update.
 *
 * @param {function(number)} updateFn - function to update game state
 * @param {function()} renderFn - function to render the game
 */
export function startGameLoop(updateFn, renderFn) {
  if (typeof updateFn !== 'function' || typeof renderFn !== 'function') {
    console.error('[GameLoop] Both updateFn and renderFn must be functions.');
    return;
  }
  let lastTime = performance.now();
  function frame(currentTime) {
    // Compute delta time in seconds
    const dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    try {
      updateFn(dt);
    } catch (err) {
      console.error('[GameLoop] Error in update function:', err);
    }
    try {
      renderFn();
    } catch (err) {
      console.error('[GameLoop] Error in render function:', err);
    }
    loopHandle = requestAnimationFrame(frame);
  }
  loopHandle = requestAnimationFrame(frame);
}

/**
 * Stops the currently running game loop.  Useful when switching scenes
 * or pausing the game.
 */
export function stopGameLoop() {
  if (loopHandle !== null) {
    cancelAnimationFrame(loopHandle);
    loopHandle = null;
    console.log('[GameLoop] Loop stopped.');
  }
}