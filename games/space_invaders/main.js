import { initCanvas, clear, drawRect, drawText } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { initKeyboard, isKeyDown } from '../../game-lib/input/keyboard.js';
import { aabbIntersect } from '../../game-lib/physics/collision.js';

export function init() {
  const { canvas, ctx } = initCanvas('#game', 640, 480);

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 40;
  }

  window.addEventListener('resize', resizeCanvas);
  initKeyboard();

  const player = { x: 0, y: 0, width: 40, height: 20, speed: 300 };
  const bullets = [];
  const aliens = [];
  let alienDirection = 1;
  let alienSpeed = 40;
  let bulletCooldown = 0;
  let score = 0;
  let highScore = 0;
  let gameOver = false;

  function initAliens() {
    aliens.length = 0;
    const rows = 5;
    const cols = 8;
    const spacingX = 60;
    const spacingY = 40;
    const startX = 80;
    const startY = 60;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        aliens.push({
          x: startX + c * spacingX,
          y: startY + r * spacingY,
          width: 30,
          height: 20,
        });
      }
    }
  }

  function resetGame() {
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 40;
    bullets.length = 0;
    initAliens();
    alienDirection = 1;
    alienSpeed = 40;
    score = 0;
    gameOver = false;
  }

  function update(dt) {
    if (gameOver) return;

    if (isKeyDown('ArrowLeft') || isKeyDown('KeyA')) {
      player.x -= player.speed * dt;
    }
    if (isKeyDown('ArrowRight') || isKeyDown('KeyD')) {
      player.x += player.speed * dt;
    }
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));

    bulletCooldown -= dt;
    if ((isKeyDown('Space') || isKeyDown('KeyW')) && bulletCooldown <= 0) {
      bullets.push({ x: player.x + player.width / 2 - 2, y: player.y - 10, width: 4, height: 10, vy: -400 });
      bulletCooldown = 0.3;
    }

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.y += b.vy * dt;
      if (b.y + b.height < 0) {
        bullets.splice(i, 1);
      }
    }

    let reachedEdge = false;
    for (const a of aliens) {
      a.x += alienDirection * alienSpeed * dt;
      if (a.x < 0 || a.x + a.width > canvas.width) reachedEdge = true;
    }
    if (reachedEdge) {
      alienDirection *= -1;
      for (const a of aliens) {
        a.y += 20;
      }
    }
    alienSpeed += dt * 2;

    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      for (let j = aliens.length - 1; j >= 0; j -= 1) {
        const a = aliens[j];
        if (aabbIntersect(b, a)) {
          bullets.splice(i, 1);
          aliens.splice(j, 1);
          score += 10;
          break;
        }
      }
    }

    for (const a of aliens) {
      if (a.y + a.height >= player.y) {
        gameOver = true;
        highScore = Math.max(highScore, score);
        break;
      }
    }

    if (aliens.length === 0) {
      gameOver = true;
      highScore = Math.max(highScore, score);
    }
  }

  function render() {
    clear(ctx, '#000');

    drawRect(ctx, player.x, player.y, player.width, player.height, '#0f0');

    for (const b of bullets) {
      drawRect(ctx, b.x, b.y, b.width, b.height, '#ff0');
    }

    for (const a of aliens) {
      drawRect(ctx, a.x, a.y, a.width, a.height, '#f00');
    }

    drawText(ctx, `Score: ${score}`, 10, 10, { color: '#fff', font: '16px monospace' });
    drawText(ctx, `High: ${highScore}`, 10, 28, { color: '#888', font: '14px monospace' });

    if (gameOver) {
      drawText(ctx, 'Game Over!', canvas.width / 2, 200, {
        color: '#fff',
        font: '32px sans-serif',
        textAlign: 'center',
      });
      drawText(
        ctx,
        aliens.length === 0 ? 'You Win!' : 'Invaders Reached You',
        canvas.width / 2,
        240,
        {
          color: '#ccc',
          font: '18px sans-serif',
          textAlign: 'center',
        },
      );
      drawText(ctx, 'Press R or Space to restart', canvas.width / 2, 280, {
        color: '#888',
        font: '14px sans-serif',
        textAlign: 'center',
      });
    }
  }

  window.addEventListener('keydown', (e) => {
    if ((e.code === 'KeyR' || e.code === 'Space') && gameOver) {
      resetGame();
    }
  });

  resizeCanvas();
  resetGame();
  startGameLoop(update, render);
}

init();
