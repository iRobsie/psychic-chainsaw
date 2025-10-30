import { clear, drawRect, drawText } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { createViewport } from '../shared/viewport.js';
import { createKeyTracker } from '../shared/key-tracker.js';
import { randInt } from '../shared/random.js';

const WORLD_WIDTH = 640;
const WORLD_HEIGHT = 480;
const CELL_SIZE = 20;
const COLS = Math.floor(WORLD_WIDTH / CELL_SIZE);
const ROWS = Math.floor(WORLD_HEIGHT / CELL_SIZE);
const LOCAL_STORAGE_KEY = 'psychic-snake-high-score-v2';

const DIFFICULTIES = [
  {
    id: 'classic',
    label: 'Classic',
    baseInterval: 0.14,
    minInterval: 0.07,
    wrap: false,
    obstacleFrequency: 5,
    description: 'Pure arcade snake with solid walls and steady speed ups.',
  },
  {
    id: 'wrap',
    label: 'Wraparound',
    baseInterval: 0.12,
    minInterval: 0.06,
    wrap: true,
    obstacleFrequency: 6,
    description: 'World edges loop, so survival means mastering your momentum.',
  },
  {
    id: 'blitz',
    label: 'Blitz',
    baseInterval: 0.1,
    minInterval: 0.05,
    wrap: false,
    obstacleFrequency: 4,
    description: 'Faster pace, more bonus fruit, and frequent arena hazards.',
  },
];

const COMBO_WINDOW = 4; // seconds
const BONUS_INTERVAL = 4; // every N foods spawn a timed bonus

function loadHighScore() {
  const raw = window.localStorage?.getItem(LOCAL_STORAGE_KEY);
  return raw ? Number(raw) : 0;
}

function saveHighScore(score) {
  try {
    window.localStorage?.setItem(LOCAL_STORAGE_KEY, String(score));
  } catch (err) {
    console.warn('Unable to save high score', err);
  }
}

function createGradient(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, '#0c1822');
  gradient.addColorStop(1, '#0b0f17');
  return gradient;
}

function positionsEqual(a, b) {
  return a.x === b.x && a.y === b.y;
}

function snakeContains(snake, pos) {
  return snake.some((segment) => positionsEqual(segment, pos));
}

function arrayContains(array, pos) {
  return array.some((item) => positionsEqual(item, pos));
}

class SnakeGame {
  constructor(viewport, input) {
    this.viewport = viewport;
    this.input = input;

    this.state = 'menu';
    this.difficultyIndex = 0;
    this.highScore = loadHighScore();

    this.snake = [];
    this.direction = { x: 1, y: 0 };
    this.directionQueue = [];
    this.food = { x: 0, y: 0 };
    this.bonusFood = null;
    this.obstacles = [];

    this.stepAccumulator = 0;
    this.baseInterval = DIFFICULTIES[0].baseInterval;
    this.currentInterval = this.baseInterval;
    this.minInterval = DIFFICULTIES[0].minInterval;
    this.wrap = DIFFICULTIES[0].wrap;
    this.obstacleFrequency = DIFFICULTIES[0].obstacleFrequency;

    this.score = 0;
    this.comboLevel = 1;
    this.comboTimer = 0;
    this.foodsEaten = 0;
    this.grow = 0;

    this.countdown = 0;
    this.flashTimer = 0;

    this.setDifficulty(0);
  }

  start() {
    startGameLoop((dt) => this.update(dt), () => this.render());
  }

  setDifficulty(index) {
    this.difficultyIndex = (index + DIFFICULTIES.length) % DIFFICULTIES.length;
    const settings = DIFFICULTIES[this.difficultyIndex];
    this.baseInterval = settings.baseInterval;
    this.currentInterval = settings.baseInterval;
    this.minInterval = settings.minInterval;
    this.wrap = settings.wrap;
    this.obstacleFrequency = settings.obstacleFrequency;
  }

  resetRun() {
    this.snake = [
      { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) },
      { x: Math.floor(COLS / 2) - 1, y: Math.floor(ROWS / 2) },
    ];
    this.direction = { x: 1, y: 0 };
    this.directionQueue = [];
    this.placeFood();
    this.bonusFood = null;
    this.obstacles = [];
    this.stepAccumulator = 0;
    this.currentInterval = this.baseInterval;
    this.score = 0;
    this.comboLevel = 1;
    this.comboTimer = 0;
    this.foodsEaten = 0;
    this.grow = 0;
    this.flashTimer = 0;
  }

  placeFood(exclude = []) {
    while (true) {
      const pos = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
      if (
        !snakeContains(this.snake, pos) &&
        !arrayContains(this.obstacles, pos) &&
        (!this.bonusFood || !positionsEqual(this.bonusFood, pos)) &&
        !arrayContains(exclude, pos)
      ) {
        this.food = pos;
        return;
      }
    }
  }

  spawnBonus() {
    const forbidden = [this.food, ...this.obstacles, ...this.snake];
    while (true) {
      const pos = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) };
      if (!arrayContains(forbidden, pos)) {
        this.bonusFood = { ...pos, timer: 7, value: 40 };
        return;
      }
    }
  }

  spawnObstacle() {
    const forbidden = [this.food, this.bonusFood, ...this.snake, ...this.obstacles];
    while (true) {
      const pos = { x: randInt(1, COLS - 2), y: randInt(1, ROWS - 2) };
      if (!arrayContains(forbidden.filter(Boolean), pos)) {
        this.obstacles.push(pos);
        return;
      }
    }
  }

  enqueueDirection(x, y) {
    const next = { x, y };
    const last = this.directionQueue.length ? this.directionQueue[this.directionQueue.length - 1] : this.direction;
    if (last.x === -next.x && last.y === -next.y) {
      return; // ignore reversal
    }
    this.directionQueue.push(next);
  }

  startCountdown() {
    this.resetRun();
    this.state = 'countdown';
    this.countdown = 2.5;
  }

  update(dt) {
    switch (this.state) {
      case 'menu':
        this.updateMenu();
        break;
      case 'countdown':
        this.updateCountdown(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'paused':
        this.updatePaused();
        break;
      case 'gameover':
        this.updateGameOver();
        break;
    }
    this.flashTimer += dt;
    this.input.nextFrame();
  }

  updateMenu() {
    if (this.input.consume('ArrowLeft') || this.input.consume('KeyA')) {
      this.setDifficulty(this.difficultyIndex - 1);
    }
    if (this.input.consume('ArrowRight') || this.input.consume('KeyD')) {
      this.setDifficulty(this.difficultyIndex + 1);
    }
    if (this.input.consume('Enter') || this.input.consume('Space')) {
      this.startCountdown();
    }
  }

  updateCountdown(dt) {
    if (this.input.consume('Escape')) {
      this.state = 'menu';
      return;
    }
    this.handleDirectionInput();
    this.countdown -= dt;
    if (this.countdown <= 0) {
      this.state = 'playing';
    }
  }

  updatePlaying(dt) {
    if (this.input.consume('Escape')) {
      this.state = 'paused';
      return;
    }

    this.handleDirectionInput();

    this.stepAccumulator += dt;
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0 && this.comboLevel > 1) {
      this.comboLevel = 1;
    }

    if (this.bonusFood) {
      this.bonusFood.timer -= dt;
      if (this.bonusFood.timer <= 0) {
        this.bonusFood = null;
      }
    }

    while (this.stepAccumulator >= this.currentInterval) {
      this.stepAccumulator -= this.currentInterval;
      this.advance();
      if (this.state !== 'playing') {
        break;
      }
    }
  }

  updatePaused() {
    if (this.input.consume('Escape') || this.input.consume('Space')) {
      this.state = 'playing';
    }
    if (this.input.consume('KeyQ')) {
      this.state = 'menu';
    }
  }

  updateGameOver() {
    if (this.input.consume('Space')) {
      this.startCountdown();
    } else if (this.input.consume('Enter')) {
      this.state = 'menu';
    }
  }

  handleDirectionInput() {
    if (this.input.consume('ArrowUp') || this.input.consume('KeyW')) {
      this.enqueueDirection(0, -1);
    }
    if (this.input.consume('ArrowDown') || this.input.consume('KeyS')) {
      this.enqueueDirection(0, 1);
    }
    if (this.input.consume('ArrowLeft') || this.input.consume('KeyA')) {
      this.enqueueDirection(-1, 0);
    }
    if (this.input.consume('ArrowRight') || this.input.consume('KeyD')) {
      this.enqueueDirection(1, 0);
    }
  }

  advance() {
    if (this.directionQueue.length > 0) {
      const candidate = this.directionQueue.shift();
      if (!(candidate.x === -this.direction.x && candidate.y === -this.direction.y)) {
        this.direction = candidate;
      }
    }

    const nextHead = {
      x: this.snake[0].x + this.direction.x,
      y: this.snake[0].y + this.direction.y,
    };

    if (this.wrap) {
      nextHead.x = (nextHead.x + COLS) % COLS;
      nextHead.y = (nextHead.y + ROWS) % ROWS;
    } else {
      if (nextHead.x < 0 || nextHead.x >= COLS || nextHead.y < 0 || nextHead.y >= ROWS) {
        return this.endRun();
      }
    }

    if (snakeContains(this.snake, nextHead) || arrayContains(this.obstacles, nextHead)) {
      return this.endRun();
    }

    this.snake.unshift(nextHead);

    let grew = false;
    if (positionsEqual(nextHead, this.food)) {
      this.handleFoodPickup(10);
      grew = true;
    }
    if (this.bonusFood && positionsEqual(nextHead, this.bonusFood)) {
      this.handleFoodPickup(this.bonusFood.value);
      this.bonusFood = null;
      this.grow += 2; // extra growth for bonus
      grew = true;
    }

    if (this.grow > 0) {
      this.grow--;
      grew = true;
    }

    if (!grew) {
      this.snake.pop();
    }
  }

  handleFoodPickup(basePoints) {
    this.foodsEaten += 1;
    if (this.comboTimer > 0) {
      this.comboLevel = Math.min(6, this.comboLevel + 1);
    } else {
      this.comboLevel = 1;
    }
    this.comboTimer = COMBO_WINDOW;
    const points = Math.floor(basePoints * this.comboLevel);
    this.score += points;
    this.grow += 1;
    this.currentInterval = Math.max(this.minInterval, this.currentInterval - 0.004);

    if (this.foodsEaten % BONUS_INTERVAL === 0) {
      this.spawnBonus();
    }
    if (this.foodsEaten % this.obstacleFrequency === 0) {
      this.spawnObstacle();
    }

    this.placeFood();
  }

  endRun() {
    this.state = 'gameover';
    this.highScore = Math.max(this.highScore, this.score);
    saveHighScore(this.highScore);
  }

  render() {
    this.viewport.withContext((ctx) => {
      clear(ctx, '#05090f');
      this.renderGrid(ctx);
      this.renderObstacles(ctx);
      this.renderFood(ctx);
      this.renderSnake(ctx);
      this.renderUI(ctx);
      switch (this.state) {
        case 'menu':
          this.renderMenuOverlay(ctx);
          break;
        case 'countdown':
          this.renderCountdown(ctx);
          break;
        case 'paused':
          this.renderPauseOverlay(ctx);
          break;
        case 'gameover':
          this.renderGameOverOverlay(ctx);
          break;
      }
    });
  }

  renderGrid(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(WORLD_WIDTH, y * CELL_SIZE);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderSnake(ctx) {
    const gradient = createGradient(ctx);
    this.snake.forEach((segment, index) => {
      const color = index === 0 ? '#7afc6c' : gradient;
      drawRect(
        ctx,
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
        color
      );
    });
  }

  renderFood(ctx) {
    drawRect(
      ctx,
      this.food.x * CELL_SIZE + 2,
      this.food.y * CELL_SIZE + 2,
      CELL_SIZE - 4,
      CELL_SIZE - 4,
      '#ff4d67'
    );
    if (this.bonusFood) {
      const t = Math.max(0, this.bonusFood.timer);
      const pulse = 0.5 + Math.sin(performance.now() / 120) * 0.5;
      const color = `rgba(255, 196, 64, ${0.7 + 0.3 * pulse})`;
      drawRect(
        ctx,
        this.bonusFood.x * CELL_SIZE + 2,
        this.bonusFood.y * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4,
        color
      );
    }
  }

  renderObstacles(ctx) {
    for (const obstacle of this.obstacles) {
      drawRect(
        ctx,
        obstacle.x * CELL_SIZE + 1,
        obstacle.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
        '#1f2a36'
      );
    }
  }

  renderUI(ctx) {
    drawText(ctx, `Score: ${this.score}`, 10, 8, {
      color: '#e6f3ff',
      font: '16px "JetBrains Mono", monospace',
    });
    drawText(ctx, `Best: ${this.highScore}`, 10, 28, {
      color: '#7d92a8',
      font: '14px "JetBrains Mono", monospace',
    });
    drawText(ctx, `Combo x${this.comboLevel}`, WORLD_WIDTH - 10, 8, {
      color: this.comboLevel > 1 ? '#ffda6a' : '#6f8094',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'right',
    });
    const settings = DIFFICULTIES[this.difficultyIndex];
    drawText(ctx, `${settings.label} ${this.wrap ? '• Wrap' : '• Walls'}`, WORLD_WIDTH - 10, 28, {
      color: '#6f8094',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'right',
    });
  }

  renderMenuOverlay(ctx) {
    const settings = DIFFICULTIES[this.difficultyIndex];
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 20, 0.86)';
    ctx.fillRect(80, 80, WORLD_WIDTH - 160, WORLD_HEIGHT - 160);
    drawText(ctx, 'Neon Serpent', WORLD_WIDTH / 2, 110, {
      color: '#7afc6c',
      font: '32px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, settings.label, WORLD_WIDTH / 2, 160, {
      color: '#ffda6a',
      font: '20px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, settings.description, WORLD_WIDTH / 2, 188, {
      color: '#d9e7ff',
      font: '16px "Inter", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, '← / →  switch modes', WORLD_WIDTH / 2, 240, {
      color: '#8aa0b8',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Enter / Space  to begin', WORLD_WIDTH / 2, 268, {
      color: '#7afc6c',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'WASD / Arrows steer • Esc pauses • Combos boost score and speed', WORLD_WIDTH / 2, 306, {
      color: '#8aa0b8',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }

  renderCountdown(ctx) {
    const value = Math.ceil(this.countdown);
    const alpha = 0.4 + 0.6 * Math.sin(this.flashTimer * 8);
    ctx.save();
    ctx.fillStyle = `rgba(10, 16, 28, ${alpha.toFixed(2)})`;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawText(ctx, value > 0 ? String(value) : 'Go!', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 20, {
      color: '#7afc6c',
      font: '48px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    ctx.restore();
  }

  renderPauseOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 10, 18, 0.75)';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawText(ctx, 'Paused', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 30, {
      color: '#ffda6a',
      font: '36px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, 'Esc to resume • Q to quit', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 10, {
      color: '#8aa0b8',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }

  renderGameOverOverlay(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 12, 20, 0.86)';
    ctx.fillRect(80, 110, WORLD_WIDTH - 160, 220);
    drawText(ctx, 'Game Over', WORLD_WIDTH / 2, 140, {
      color: '#ff4d67',
      font: '32px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, `Score ${this.score}`, WORLD_WIDTH / 2, 180, {
      color: '#d9e7ff',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, `Best ${this.highScore}`, WORLD_WIDTH / 2, 206, {
      color: '#7d92a8',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Space to retry • Enter for menu', WORLD_WIDTH / 2, 244, {
      color: '#8aa0b8',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }
}

export function startSnakeGame() {
  const viewport = createViewport('#game', WORLD_WIDTH, WORLD_HEIGHT);
  const input = createKeyTracker();
  const game = new SnakeGame(viewport, input);
  game.start();
}
