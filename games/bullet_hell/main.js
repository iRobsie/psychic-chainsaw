import { initCanvas, clear, drawCircle, drawText } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { initKeyboard, isKeyDown } from '../../game-lib/input/keyboard.js';

export function init() {
  const { canvas, ctx } = initCanvas('#game', 640, 480);
  initKeyboard();

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.x = canvas.width / 2;
    player.y = canvas.height * 0.8;
  }
  window.addEventListener('resize', resizeCanvas);

  const player = { x: 320, y: 400, radius: 10, speed: 220 };
  resizeCanvas();

  const bullets = [];
  let timeSinceLastWave = 0;
  const waveInterval = 2;
  let survivedTime = 0;
  let gameOver = false;
  let highScore = 0;

  function spawnWave() {
    const bulletCount = 32;
    const speed = 100 + survivedTime * 5;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    for (let i = 0; i < bulletCount; i += 1) {
      const angle = (i / bulletCount) * Math.PI * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      bullets.push({ x: centerX, y: centerY, vx, vy, radius: 4 });
    }
  }

  function resetGame() {
    bullets.length = 0;
    player.x = canvas.width / 2;
    player.y = canvas.height * 0.8;
    timeSinceLastWave = 0;
    survivedTime = 0;
    gameOver = false;
  }

  function update(dt) {
    if (gameOver) return;

    survivedTime += dt;
    timeSinceLastWave += dt;
    if (timeSinceLastWave >= waveInterval) {
      spawnWave();
      timeSinceLastWave = 0;
    }

    let dx = 0;
    let dy = 0;
    if (isKeyDown('ArrowLeft') || isKeyDown('KeyA')) dx -= 1;
    if (isKeyDown('ArrowRight') || isKeyDown('KeyD')) dx += 1;
    if (isKeyDown('ArrowUp') || isKeyDown('KeyW')) dy -= 1;
    if (isKeyDown('ArrowDown') || isKeyDown('KeyS')) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (
        b.x < -b.radius ||
        b.x > canvas.width + b.radius ||
        b.y < -b.radius ||
        b.y > canvas.height + b.radius
      ) {
        bullets.splice(i, 1);
        continue;
      }
      const dxp = b.x - player.x;
      const dyp = b.y - player.y;
      const distSq = dxp * dxp + dyp * dyp;
      const radSum = b.radius + player.radius;
      if (distSq < radSum * radSum) {
        gameOver = true;
        highScore = Math.max(highScore, survivedTime);
        break;
      }
    }
  }

  function render() {
    clear(ctx, '#000');

    for (const b of bullets) {
      drawCircle(ctx, b.x, b.y, b.radius, '#f00');
    }
    drawCircle(ctx, player.x, player.y, player.radius, '#0f0');

    drawText(ctx, `Survived: ${survivedTime.toFixed(1)}s`, 10, 10, {
      color: '#fff',
      font: '16px monospace',
    });
    drawText(ctx, `Best: ${highScore.toFixed(1)}s`, 10, 28, {
      color: '#888',
      font: '14px monospace',
    });

    if (gameOver) {
      drawText(ctx, 'Game Over!', canvas.width / 2, 200, {
        color: '#fff',
        font: '32px sans-serif',
        textAlign: 'center',
      });
      drawText(ctx, 'Press R to restart', canvas.width / 2, 240, {
        color: '#ccc',
        font: '16px sans-serif',
        textAlign: 'center',
      });
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && gameOver) {
      resetGame();
    }
  });

  startGameLoop(update, render);
}

init();
