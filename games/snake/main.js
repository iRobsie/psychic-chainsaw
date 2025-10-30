import { initCanvas, clear, drawRect, drawText } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { initKeyboard } from '../../game-lib/input/keyboard.js';

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

  const cellSize = 20;
  const cols = Math.floor(WORLD_WIDTH / cellSize);
  const rows = Math.floor(WORLD_HEIGHT / cellSize);

  let snake = [];
  let dir = { x: 1, y: 0 };
  let nextDir = { x: 1, y: 0 };
  let food = { x: 10, y: 10 };
  let gameOver = false;
  let score = 0;
  let stepTimer = 0;
  const stepInterval = 0.12;

  function resetGame() {
    snake = [{ x: Math.floor(cols / 2), y: Math.floor(rows / 2) }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    placeFood();
    gameOver = false;
    score = 0;
    stepTimer = 0;
  }

  function placeFood() {
    while (true) {
      const fx = Math.floor(Math.random() * cols);
      const fy = Math.floor(Math.random() * rows);
      if (!snake.some((seg) => seg.x === fx && seg.y === fy)) {
        food.x = fx;
        food.y = fy;
        return;
      }
    }
  }

  window.addEventListener('keydown', (e) => {
    if (gameOver && e.code === 'Space') {
      resetGame();
      return;
    }
    switch (e.code) {
      case 'ArrowUp':
        if (dir.y === 0) nextDir = { x: 0, y: -1 };
        break;
      case 'ArrowDown':
        if (dir.y === 0) nextDir = { x: 0, y: 1 };
        break;
      case 'ArrowLeft':
        if (dir.x === 0) nextDir = { x: -1, y: 0 };
        break;
      case 'ArrowRight':
        if (dir.x === 0) nextDir = { x: 1, y: 0 };
        break;
      default:
    }
  });

  function update(dt) {
    stepTimer += dt;
    if (stepTimer >= stepInterval && !gameOver) {
      stepTimer -= stepInterval;
      dir = { ...nextDir };
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (
        head.x < 0 ||
        head.x >= cols ||
        head.y < 0 ||
        head.y >= rows ||
        snake.some((seg) => seg.x === head.x && seg.y === head.y)
      ) {
        gameOver = true;
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 1;
        placeFood();
      } else {
        snake.pop();
      }
    }
  }

  function render() {
    const scaleX = canvas.width / WORLD_WIDTH;
    const scaleY = canvas.height / WORLD_HEIGHT;

    ctx.save();
    ctx.scale(scaleX, scaleY);
    clear(ctx, '#000');

    drawRect(ctx, food.x * cellSize, food.y * cellSize, cellSize - 2, cellSize - 2, '#f33');

    snake.forEach((seg, index) => {
      const color = index === 0 ? '#0f0' : '#7c7';
      drawRect(ctx, seg.x * cellSize, seg.y * cellSize, cellSize - 2, cellSize - 2, color);
    });

    drawText(ctx, `Score: ${score}`, 10, 10, { color: '#fff', font: '16px monospace' });
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
  resetGame();
  startGameLoop(update, render);
}

init();
