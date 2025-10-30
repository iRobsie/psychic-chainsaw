import { initCanvas, drawRect, drawText, resizeCanvasToDisplaySize } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { initKeyboard, isKeyDown } from '../../game-lib/input/keyboard.js';

const WORLD_WIDTH = 640;
const WORLD_HEIGHT = 480;
const CELL_SIZE = 20;
const COLS = Math.floor(WORLD_WIDTH / CELL_SIZE);
const ROWS = Math.floor(WORLD_HEIGHT / CELL_SIZE);
const LOCAL_STORAGE_KEY = 'snake-highscore-v2';

const { canvas, ctx } = initCanvas('#game', WORLD_WIDTH, WORLD_HEIGHT);
let displayWidth = WORLD_WIDTH;
let displayHeight = WORLD_HEIGHT;

initKeyboard();

function resizeCanvas() {
  const size = resizeCanvasToDisplaySize(canvas, ctx, window.innerWidth, window.innerHeight);
  displayWidth = size.width;
  displayHeight = size.height;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const FOOD_TYPES = {
  apple: { color: '#ef4444', score: 1, growth: 1, weight: 0.75 },
  berry: { color: '#ec4899', score: 2, growth: 1, weight: 0.15 },
  golden: { color: '#facc15', score: 5, growth: 3, weight: 0.07, effect: 'speed' },
  ice: { color: '#38bdf8', score: 0, growth: 0, weight: 0.04, effect: 'slow' },
  portal: { color: '#8b5cf6', score: 0, growth: 0, weight: 0.03, effect: 'wrap' },
  poison: { color: '#22c55e', score: -2, growth: -2, weight: 0.02, effect: 'obstacle' },
};

const FOOD_POOL = Object.entries(FOOD_TYPES).flatMap(([type, def]) => Array(Math.round(def.weight * 100)).fill(type));

const state = {
  snake: [],
  dir: { x: 1, y: 0 },
  nextDir: { x: 1, y: 0 },
  directionQueue: [],
  pendingGrowth: 0,
  food: { x: 0, y: 0, type: 'apple', timer: 0 },
  stepTimer: 0,
  stepInterval: 0.16,
  speedModifier: 1,
  slowTimer: 0,
  wrapTimer: 0,
  comboTimer: 0,
  comboChain: 0,
  score: 0,
  highScore: Number(localStorage.getItem(LOCAL_STORAGE_KEY)) || 0,
  gameOver: false,
  obstacles: [],
  mission: { target: 12, reward: 10 },
  boostMeter: 1,
  floatingText: [],
};

function resetGame() {
  state.snake = [{ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }];
  state.dir = { x: 1, y: 0 };
  state.nextDir = { x: 1, y: 0 };
  state.directionQueue = [];
  state.pendingGrowth = 2;
  state.stepTimer = 0;
  state.stepInterval = 0.16;
  state.speedModifier = 1;
  state.slowTimer = 0;
  state.wrapTimer = 0;
  state.comboTimer = 0;
  state.comboChain = 0;
  state.score = 0;
  state.gameOver = false;
  state.obstacles = [];
  state.mission = { target: 12, reward: 10 };
  state.boostMeter = 1;
  state.floatingText = [];
  spawnFood('apple');
}

resetGame();

function spawnFood(type) {
  const choice = type || FOOD_POOL[Math.floor(Math.random() * FOOD_POOL.length)] || 'apple';
  while (true) {
    const x = Math.floor(Math.random() * COLS);
    const y = Math.floor(Math.random() * ROWS);
    const occupied = state.snake.some((seg) => seg.x === x && seg.y === y) || state.obstacles.some((o) => o.x === x && o.y === y);
    if (!occupied) {
      state.food = { x, y, type: choice, timer: 12 };
      return;
    }
  }
}

function spawnObstacle() {
  const freeCells = [];
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      const occupied =
        state.snake.some((seg) => seg.x === x && seg.y === y) ||
        state.obstacles.some((o) => o.x === x && o.y === y) ||
        (state.food.x === x && state.food.y === y);
      if (!occupied) freeCells.push({ x, y });
    }
  }
  if (freeCells.length === 0) return;
  const cell = freeCells[Math.floor(Math.random() * freeCells.length)];
  state.obstacles.push({ ...cell, timer: 30 });
}

function queueDirection(x, y) {
  const last = state.directionQueue[state.directionQueue.length - 1] || state.nextDir;
  if (last.x === -x && last.y === -y) return;
  state.directionQueue.push({ x, y });
}

window.addEventListener('keydown', (event) => {
  if (state.gameOver && event.code === 'Space') {
    resetGame();
    return;
  }
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      queueDirection(0, -1);
      break;
    case 'ArrowDown':
    case 'KeyS':
      queueDirection(0, 1);
      break;
    case 'ArrowLeft':
    case 'KeyA':
      queueDirection(-1, 0);
      break;
    case 'ArrowRight':
    case 'KeyD':
      queueDirection(1, 0);
      break;
    case 'KeyP':
      state.wrapTimer = 20;
      break;
  }
});

function spawnFloatingText(text, gridX, gridY, color = '#f8fafc') {
  state.floatingText.push({ text, x: gridX * CELL_SIZE + CELL_SIZE / 2, y: gridY * CELL_SIZE + CELL_SIZE / 2, life: 1, color });
}

function consumeFood(food) {
  const def = FOOD_TYPES[food.type] || FOOD_TYPES.apple;
  state.score += def.score;
  state.pendingGrowth += def.growth;
  if (state.score < 0) state.score = 0;
  if (state.pendingGrowth < 0) state.pendingGrowth = 0;
  state.comboChain += 1;
  state.comboTimer = 4;
  spawnFloatingText(`+${def.score}`, food.x, food.y, def.color);

  switch (def.effect) {
    case 'speed':
      state.speedModifier = 0.7;
      state.stepTimer = 0;
      break;
    case 'slow':
      state.slowTimer = 5;
      break;
    case 'wrap':
      state.wrapTimer = 40;
      spawnFloatingText('WRAP!', food.x, food.y - 1, '#8b5cf6');
      break;
    case 'obstacle':
      spawnObstacle();
      spawnFloatingText('HAZARD', food.x, food.y - 1, '#22c55e');
      break;
  }

  if (state.comboChain > 1) {
    const bonus = Math.floor(state.comboChain * 0.5);
    state.score += bonus;
    spawnFloatingText(`Combo +${bonus}`, food.x, food.y - 1, '#facc15');
  }

  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem(LOCAL_STORAGE_KEY, String(state.highScore));
  }

  if (state.snake.length + state.pendingGrowth >= state.mission.target) {
    state.score += state.mission.reward;
    spawnFloatingText(`Mission +${state.mission.reward}`, food.x, food.y - 2, '#22d3ee');
    const nextTarget = state.mission.target + 6;
    state.mission = { target: nextTarget, reward: state.mission.reward + 5 };
  }

  spawnFood();
}

function updateFloatingText(dt) {
  for (let i = state.floatingText.length - 1; i >= 0; i--) {
    const ft = state.floatingText[i];
    ft.y -= dt * 20;
    ft.life -= dt;
    if (ft.life <= 0) state.floatingText.splice(i, 1);
  }
}

function gameStep() {
  if (state.directionQueue.length > 0) {
    const next = state.directionQueue.shift();
    if (!(next.x === -state.dir.x && next.y === -state.dir.y)) {
      state.nextDir = next;
    }
  }
  state.dir = state.nextDir;
  const head = state.snake[0];
  let newX = head.x + state.dir.x;
  let newY = head.y + state.dir.y;

  if (state.wrapTimer > 0) {
    if (newX < 0) newX = COLS - 1;
    if (newX >= COLS) newX = 0;
    if (newY < 0) newY = ROWS - 1;
    if (newY >= ROWS) newY = 0;
  }

  if (newX < 0 || newX >= COLS || newY < 0 || newY >= ROWS) {
    state.gameOver = true;
    spawnFloatingText('CRASH', head.x, head.y, '#f87171');
    return;
  }

  if (state.snake.some((seg) => seg.x === newX && seg.y === newY)) {
    state.gameOver = true;
    spawnFloatingText('SELF!', head.x, head.y, '#f87171');
    return;
  }

  if (state.obstacles.some((o) => o.x === newX && o.y === newY)) {
    state.gameOver = true;
    spawnFloatingText('SPIKE!', head.x, head.y, '#f97316');
    return;
  }

  state.snake.unshift({ x: newX, y: newY });
  if (state.pendingGrowth > 0) {
    state.pendingGrowth -= 1;
  } else {
    state.snake.pop();
  }

  if (state.food.x === newX && state.food.y === newY) {
    consumeFood(state.food);
  }
}

function update(dt) {
  if (state.gameOver) {
    updateFloatingText(dt);
    return;
  }

  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer === 0) {
    state.comboChain = Math.max(0, state.comboChain - dt * 2);
  }

  if (state.speedModifier < 1) {
    state.speedModifier += dt * 0.3;
    if (state.speedModifier > 1) state.speedModifier = 1;
  }

  if (state.slowTimer > 0) {
    state.slowTimer -= dt;
  }

  if (state.wrapTimer > 0) {
    state.wrapTimer -= dt;
  }

  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const o = state.obstacles[i];
    o.timer -= dt;
    if (o.timer <= 0) state.obstacles.splice(i, 1);
  }

  state.stepTimer += dt * (state.slowTimer > 0 ? 0.7 : 1) * (isKeyDown('ShiftLeft') || isKeyDown('ShiftRight') ? 1.5 : 1);
  const interval = state.stepInterval * state.speedModifier;
  if (state.stepTimer >= interval) {
    state.stepTimer -= interval;
    gameStep();
  }

  state.food.timer -= dt;
  if (state.food.timer <= 0) {
    spawnFood();
  }

  updateFloatingText(dt);
}

function drawBackground() {
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = '#0f172a';
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      if ((x + y) % 2 === 0) {
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
}

function renderSnake() {
  state.snake.forEach((seg, index) => {
    const color = index === 0 ? '#22d3ee' : '#0ea5e9';
    drawRect(ctx, seg.x * CELL_SIZE + 2, seg.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4, color);
  });
}

function renderObstacles() {
  ctx.fillStyle = '#f97316';
  for (const o of state.obstacles) {
    drawRect(ctx, o.x * CELL_SIZE + 4, o.y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8, '#f97316');
  }
}

function renderFood() {
  const def = FOOD_TYPES[state.food.type] || FOOD_TYPES.apple;
  drawRect(ctx, state.food.x * CELL_SIZE + 3, state.food.y * CELL_SIZE + 3, CELL_SIZE - 6, CELL_SIZE - 6, def.color);
}

function renderHUD() {
  drawText(ctx, `Score ${state.score}`, 12, 10, { color: '#e2e8f0', font: '16px "JetBrains Mono", monospace' });
  drawText(ctx, `Best ${state.highScore}`, 12, 28, { color: '#64748b', font: '12px "JetBrains Mono", monospace' });
  drawText(ctx, `Length ${state.snake.length}`, WORLD_WIDTH - 12, 10, { color: '#38bdf8', font: '14px "JetBrains Mono", monospace', textAlign: 'right' });
  drawText(ctx, `Mission reach ${state.mission.target}`, WORLD_WIDTH - 12, 30, { color: '#facc15', font: '12px "JetBrains Mono", monospace', textAlign: 'right' });
  if (state.wrapTimer > 0) {
    drawText(ctx, `Wrap ${state.wrapTimer.toFixed(1)}s`, WORLD_WIDTH / 2, 10, { color: '#a855f7', font: '12px "JetBrains Mono", monospace', textAlign: 'center' });
  }
  if (state.slowTimer > 0) {
    drawText(ctx, `Chill ${state.slowTimer.toFixed(1)}s`, WORLD_WIDTH / 2, 26, { color: '#38bdf8', font: '12px "JetBrains Mono", monospace', textAlign: 'center' });
  }
  if (state.comboChain > 1) {
    drawText(ctx, `Combo ${state.comboChain.toFixed(1)}x`, WORLD_WIDTH / 2, 42, { color: '#fbbf24', font: '12px "JetBrains Mono", monospace', textAlign: 'center' });
  }
}

function renderFloatingText() {
  for (const ft of state.floatingText) {
    drawText(ctx, ft.text, ft.x, ft.y, { color: ft.color, font: '12px "JetBrains Mono", monospace', textAlign: 'center' });
  }
}

function render() {
  const scaleX = displayWidth / WORLD_WIDTH;
  const scaleY = displayHeight / WORLD_HEIGHT;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  drawBackground();
  renderObstacles();
  renderSnake();
  renderFood();
  renderFloatingText();
  renderHUD();

  if (state.gameOver) {
    drawText(ctx, 'Game Over', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 20, { color: '#f87171', font: '32px "JetBrains Mono", monospace', textAlign: 'center' });
    drawText(ctx, 'Press Space to restart', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 + 16, { color: '#e2e8f0', font: '16px "JetBrains Mono", monospace', textAlign: 'center' });
  }

  ctx.restore();
}

startGameLoop(update, render);
