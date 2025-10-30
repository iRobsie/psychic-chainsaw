import { startTinyCraft } from './engine.js';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => startTinyCraft());
} else {
  startTinyCraft();
}
