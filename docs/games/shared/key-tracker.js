import { initKeyboard, isKeyDown } from '../../game-lib/input/keyboard.js';

/**
 * Wraps the `game-lib` keyboard module with a small helper that exposes
 * one-shot queries for key presses.  `consume(code)` returns true only on
 * frames where the key was newly pressed, making it easy to build menus and
 * state transitions without juggling additional DOM listeners.
 */
export function createKeyTracker() {
  initKeyboard();
  const pressedThisFrame = new Set();

  function handleKeyDown(event) {
    pressedThisFrame.add(event.code);
  }

  window.addEventListener('keydown', handleKeyDown);

  return {
    isDown: (code) => isKeyDown(code),
    consume(code) {
      if (pressedThisFrame.has(code)) {
        pressedThisFrame.delete(code);
        return true;
      }
      return false;
    },
    /** Clears the one-shot press buffer.  Should be called once per frame. */
    nextFrame() {
      pressedThisFrame.clear();
    },
    destroy() {
      window.removeEventListener('keydown', handleKeyDown);
      pressedThisFrame.clear();
    },
  };
}
