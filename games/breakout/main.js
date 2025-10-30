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

  const paddle = { x: 280, y: 450, width: 80, height: 10, speed: 350 };
  const ball = {
    x: WORLD_WIDTH / 2,
    y: 300,
    width: 8,
    height: 8,
    vx: 200,
    vy: -250,
  };

  const rows = 5;
  const cols = 10;
  const brickWidth = 60;
  const brickHeight = 20;
  const bricks = [];
  let lives = 3;
  let score = 0;
  let levelComplete = false;

  function initBricks() {
    bricks.length = 0;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        bricks.push({
          x: c * brickWidth + 20,
          y: r * brickHeight + 40,
          width: brickWidth - 4,
          height: brickHeight - 4,
          destroyed: false,
        });
      }
    }
  }

  function resetBall() {
    ball.x = WORLD_WIDTH / 2;
    ball.y = 300;
    ball.vx = (Math.random() < 0.5 ? -1 : 1) * 200;
    ball.vy = -250;
  }

  function clampPaddle() {
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.width > WORLD_WIDTH) paddle.x = WORLD_WIDTH - paddle.width;
  }

  function update(dt) {
    if (isKeyDown('ArrowLeft')) paddle.x -= paddle.speed * dt;
    if (isKeyDown('ArrowRight')) paddle.x += paddle.speed * dt;
    clampPaddle();

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x < 0) {
      ball.x = 0;
      ball.vx *= -1;
    }
    if (ball.x + ball.width > WORLD_WIDTH) {
      ball.x = WORLD_WIDTH - ball.width;
      ball.vx *= -1;
    }
    if (ball.y < 0) {
      ball.y = 0;
      ball.vy *= -1;
    }

    if (aabbIntersect(ball, paddle)) {
      ball.y = paddle.y - ball.height;
      ball.vy = -Math.abs(ball.vy);
      const hit = ball.x + ball.width / 2 - (paddle.x + paddle.width / 2);
      ball.vx += hit * 5;
    }

    for (const brick of bricks) {
      if (!brick.destroyed && aabbIntersect(ball, brick)) {
        brick.destroyed = true;
        score += 1;
        const prevX = ball.x - ball.vx * dt;
        const prevY = ball.y - ball.vy * dt;
        const collidedHorizontally =
          prevX + ball.width <= brick.x || prevX >= brick.x + brick.width;
        const collidedVertically =
          prevY + ball.height <= brick.y || prevY >= brick.y + brick.height;

        if (collidedHorizontally) {
          ball.vx *= -1;
        }
        if (collidedVertically) {
          ball.vy *= -1;
        }
        break;
      }
    }

    if (ball.y > WORLD_HEIGHT) {
      lives -= 1;
      if (lives > 0) {
        resetBall();
      } else {
        lives = 3;
        score = 0;
        initBricks();
        resetBall();
      }
    }

    if (bricks.every((b) => b.destroyed)) {
      levelComplete = true;
      initBricks();
      resetBall();
    }
  }

  function render() {
    const scaleX = canvas.width / WORLD_WIDTH;
    const scaleY = canvas.height / WORLD_HEIGHT;

    ctx.save();
    ctx.scale(scaleX, scaleY);
    clear(ctx, '#000');

    drawRect(ctx, paddle.x, paddle.y, paddle.width, paddle.height, '#0af');
    drawRect(ctx, ball.x, ball.y, ball.width, ball.height, '#fa0');

    for (const brick of bricks) {
      if (!brick.destroyed) {
        drawRect(ctx, brick.x, brick.y, brick.width, brick.height, '#a5f');
      }
    }

    drawText(ctx, `Score: ${score}`, 10, 10, { color: '#fff', font: '16px monospace' });
    drawText(ctx, `Lives: ${lives}`, WORLD_WIDTH - 10, 10, {
      color: '#fff',
      font: '16px monospace',
      textAlign: 'right',
    });

    if (levelComplete) {
      drawText(ctx, 'Level Complete!', WORLD_WIDTH / 2, 220, {
        color: '#fff',
        font: '28px sans-serif',
        textAlign: 'center',
      });
      drawText(ctx, 'Press Space to continue', WORLD_WIDTH / 2, 256, {
        color: '#bbb',
        font: '16px sans-serif',
        textAlign: 'center',
      });
    }

    ctx.restore();
  }

  initKeyboard();
  initBricks();
  resetBall();
  startGameLoop(update, render);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && levelComplete) {
      levelComplete = false;
    }
  });
}

init();
