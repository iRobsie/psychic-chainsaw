import { initCanvas, clear, drawRect, drawText } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { initKeyboard, isKeyDown } from '../../game-lib/input/keyboard.js';
import { aabbIntersect } from '../../game-lib/physics/collision.js';

export function init() {
  const WORLD_WIDTH = 640;
  const WORLD_HEIGHT = 480;
  const { canvas, ctx } = initCanvas('#game', WORLD_WIDTH, WORLD_HEIGHT);

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  const paddleWidth = 10;
  const paddleHeight = 80;
  const ballSize = 10;

  const player = { x: 10, y: 200, width: paddleWidth, height: paddleHeight, speed: 300 };
  const ai = { x: WORLD_WIDTH - 20, y: 200, width: paddleWidth, height: paddleHeight, speed: 250 };
  const ball = {
    x: WORLD_WIDTH / 2 - ballSize / 2,
    y: WORLD_HEIGHT / 2 - ballSize / 2,
    width: ballSize,
    height: ballSize,
    vx: 220,
    vy: 150,
  };

  let score = 0;
  let highScore = 0;
  let gameOver = false;

  function resetBall() {
    ball.x = WORLD_WIDTH / 2 - ball.width / 2;
    ball.y = WORLD_HEIGHT / 2 - ball.height / 2;
    const angle = (Math.random() * 0.5 - 0.25) * Math.PI;
    const speed = 250 + score * 10;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
    if (Math.random() < 0.5) ball.vx *= -1;
  }

  function clampPaddle(paddle) {
    if (paddle.y < 0) paddle.y = 0;
    if (paddle.y + paddle.height > WORLD_HEIGHT) paddle.y = WORLD_HEIGHT - paddle.height;
  }

  function update(dt) {
    if (gameOver) return;

    if (isKeyDown('ArrowUp')) player.y -= player.speed * dt;
    if (isKeyDown('ArrowDown')) player.y += player.speed * dt;
    clampPaddle(player);

    const aiCenter = ai.y + ai.height / 2;
    const delta = ball.y + ball.height / 2 - aiCenter;
    ai.y += Math.sign(delta) * ai.speed * dt;
    clampPaddle(ai);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y < 0) {
      ball.y = 0;
      ball.vy *= -1;
    }
    if (ball.y + ball.height > WORLD_HEIGHT) {
      ball.y = WORLD_HEIGHT - ball.height;
      ball.vy *= -1;
    }

    if (aabbIntersect(ball, player)) {
      ball.x = player.x + player.width;
      ball.vx = Math.abs(ball.vx) * 1.05;
      const hitPos = ball.y + ball.height / 2 - (player.y + player.height / 2);
      ball.vy = hitPos * 5;
    } else if (aabbIntersect(ball, ai)) {
      ball.x = ai.x - ball.width;
      ball.vx = -Math.abs(ball.vx) * 1.05;
      const hitPos = ball.y + ball.height / 2 - (ai.y + ai.height / 2);
      ball.vy = hitPos * 5;
    }

    if (ball.x + ball.width < 0) {
      gameOver = true;
      highScore = Math.max(highScore, score);
    } else if (ball.x > WORLD_WIDTH) {
      score += 1;
      resetBall();
    }
  }

  function render() {
    const scaleX = canvas.width / WORLD_WIDTH;
    const scaleY = canvas.height / WORLD_HEIGHT;

    ctx.save();
    ctx.scale(scaleX, scaleY);
    clear(ctx, '#000');

    drawRect(ctx, player.x, player.y, player.width, player.height, '#0f0');
    drawRect(ctx, ai.x, ai.y, ai.width, ai.height, '#f00');
    drawRect(ctx, ball.x, ball.y, ball.width, ball.height, '#fff');

    drawText(ctx, `Score: ${score}`, 10, 10, { color: '#fff', font: '16px monospace' });
    drawText(ctx, `High: ${highScore}`, 10, 28, { color: '#888', font: '14px monospace' });

    if (gameOver) {
      drawText(ctx, 'Game Over!', WORLD_WIDTH / 2, 200, {
        color: '#fff',
        font: '32px sans-serif',
        textAlign: 'center',
      });
      drawText(ctx, 'Press Space to restart', WORLD_WIDTH / 2, 240, {
        color: '#ccc',
        font: '16px sans-serif',
        textAlign: 'center',
      });
    }

    ctx.restore();
  }

  initKeyboard();
  resetBall();
  startGameLoop(update, render);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameOver) {
      score = 0;
      gameOver = false;
      resetBall();
    }
  });
}

init();
