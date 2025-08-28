// game-lib/input/keyboard.js
// Simple keyboard input handler.  This module registers global
// keydown and keyup event listeners and exposes a query function
// to check whether a key is currently pressed.  Keys are identified
// using their `event.code` values (e.g., 'ArrowLeft', 'Space', etc.).

// Map of key codes to their pressed state
const keysPressed = {};

let initialized = false;

/**
 * Initializes keyboard event listeners.  It is safe to call
 * this function multiple times; the event listeners will only
 * be registered once.  This function should be invoked before
 * reading key states via `isKeyDown` or `keysPressed`.
 */
export function initKeyboard() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('keydown', (e) => {
    keysPressed[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    keysPressed[e.code] = false;
  });
  // Clear key states when window loses focus
  window.addEventListener('blur', () => {
    for (const key in keysPressed) {
      keysPressed[key] = false;
    }
  });
  console.log('[Keyboard] Initialized.');
}

/**
 * Returns whether the specified key code is currently pressed.
 *
 * @param {string} code - KeyboardEvent.code (e.g. 'ArrowLeft')
 * @returns {boolean}
 */
export function isKeyDown(code) {
  return !!keysPressed[code];
}

/**
 * Expose the keysPressed map for advanced use cases.  You can
 * iterate over this object to check multiple keys.
 */
export { keysPressed };