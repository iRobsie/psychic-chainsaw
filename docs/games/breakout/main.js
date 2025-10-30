import { initCanvas, drawRect, drawText, drawCircle, resizeCanvasToDisplaySize } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { initKeyboard, isKeyDown } from '../../game-lib/input/keyboard.js';
import { buildLevel, LEVELS, getBrickColor } from './levels.js';
import { POWER_UP_DEFS, rollPowerUp, createPowerUp, updatePowerUps, drawPowerUps, powerUpIntersects } from './powerups.js';

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 540;
const BALL_SIZE = 10;
const BASE_BALL_SPEED = 260;
const MAX_COMBO_TIME = 2.8;
const LOCAL_STORAGE_KEY = 'breakout-highscore-v2';

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

const state = {
  paddle: { x: WORLD_WIDTH / 2 - 60, y: WORLD_HEIGHT - 40, w: 120, h: 16, baseWidth: 110, speed: 420 },
  balls: [],
  bricks: [],
  powerUps: [],
  effects: new Map(),
  floatingText: [],
  shield: { strength: 0, y: WORLD_HEIGHT - 28, h: 6, pulse: 0 },
  score: 0,
  highScore: Number(localStorage.getItem(LOCAL_STORAGE_KEY)) || 0,
  lives: 3,
  levelIndex: 0,
  combo: 0,
  comboTimer: 0,
  phase: 'intro', // intro -> serve -> playing -> level-complete -> game-over
  levelName: '',
  messageTimer: 0,
  speedMultiplier: 1,
  dropBonus: 0,
};

function resetPaddle() {
  state.paddle.w = state.paddle.baseWidth;
  state.paddle.x = WORLD_WIDTH / 2 - state.paddle.w / 2;
}

function createBall(sticky = true) {
  const ball = {
    x: state.paddle.x + state.paddle.w / 2 - BALL_SIZE / 2,
    y: state.paddle.y - BALL_SIZE - 2,
    size: BALL_SIZE,
    speed: BASE_BALL_SPEED * state.speedMultiplier,
    vx: 0,
    vy: 0,
    sticky,
  };
  if (!sticky) {
    launchBall(ball);
  }
  state.balls.push(ball);
}

function launchBall(ball = state.balls[0]) {
  if (!ball) return;
  const angle = (Math.random() * Math.PI) / 3 + Math.PI / 6; // between 30° and 150°
  const direction = Math.random() < 0.5 ? -1 : 1;
  ball.vx = Math.cos(angle) * ball.speed * direction;
  ball.vy = -Math.abs(Math.sin(angle) * ball.speed);
  ball.sticky = false;
  state.phase = 'playing';
}

function loadLevel(index) {
  const { bricks, level } = buildLevel(index, WORLD_WIDTH);
  state.bricks = bricks;
  state.levelName = level.name;
  state.speedMultiplier = level.speedBoost;
  state.dropBonus = level.dropBoost;
  state.phase = 'serve';
  state.combo = 0;
  state.comboTimer = 0;
  state.powerUps.length = 0;
  state.effects.clear();
  state.shield.strength = 0;
  state.shield.pulse = 0;
  state.messageTimer = 2;
  state.balls.length = 0;
  resetPaddle();
  createBall(true);
}

function startGame() {
  state.score = 0;
  state.lives = 3;
  state.levelIndex = 0;
  state.phase = 'intro';
  loadLevel(state.levelIndex);
}

startGame();

function spawnFloatingText(text, x, y, color = '#fef3c7') {
  state.floatingText.push({ text, x, y, life: 1.2, color });
}

function handlePowerUp(type) {
  const def = POWER_UP_DEFS[type];
  if (!def) return;
  if (type === 'multiball') {
    if (state.balls.length === 0) {
      createBall(true);
      return;
    }
    const clones = [];
    for (const ball of state.balls) {
      const clone = { ...ball };
      const angle = (Math.random() * Math.PI) / 6 - Math.PI / 12;
      const speed = ball.speed * 1.05;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      clone.vx = ball.vx * cos - ball.vy * sin;
      clone.vy = ball.vx * sin + ball.vy * cos;
      clone.speed = speed;
      clones.push(clone);
    }
    state.balls.push(...clones);
    spawnFloatingText('MULTIBALL!', state.paddle.x + state.paddle.w / 2, state.paddle.y - 24, '#f97316');
    return;
  }
  state.effects.set(type, def.duration);
  switch (type) {
    case 'expand':
      spawnFloatingText('PADDLE +', state.paddle.x + state.paddle.w / 2, state.paddle.y - 26, '#4ade80');
      break;
    case 'slow':
      spawnFloatingText('SLOW MO', state.paddle.x + state.paddle.w / 2, state.paddle.y - 26, '#60a5fa');
      break;
    case 'shield':
      state.shield.strength = Math.min(state.shield.strength + 2, 3);
      state.shield.pulse = 1;
      spawnFloatingText('SHIELD READY', WORLD_WIDTH / 2, state.shield.y - 12, '#c084fc');
      break;
  }
}

function updateEffects(dt) {
  for (const [key, time] of state.effects.entries()) {
    const newTime = time - dt;
    if (newTime <= 0) {
      state.effects.delete(key);
      if (key === 'expand') {
        state.paddle.w = state.paddle.baseWidth;
      }
    } else {
      state.effects.set(key, newTime);
    }
  }
  if (state.effects.has('expand')) {
    const target = state.paddle.baseWidth * 1.6;
    state.paddle.w += (target - state.paddle.w) * 0.12;
  } else {
    state.paddle.w += (state.paddle.baseWidth - state.paddle.w) * 0.18;
  }
}

function updateFloatingText(dt) {
  for (let i = state.floatingText.length - 1; i >= 0; i--) {
    const ft = state.floatingText[i];
    ft.y -= 24 * dt;
    ft.life -= dt;
    if (ft.life <= 0) state.floatingText.splice(i, 1);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ballBrickCollision(ball, brick, dt) {
  const prevX = ball.x - ball.vx * dt;
  const prevY = ball.y - ball.vy * dt;
  const overlapX = Math.min(ball.x + ball.size, brick.x + brick.w) - Math.max(ball.x, brick.x);
  const overlapY = Math.min(ball.y + ball.size, brick.y + brick.h) - Math.max(ball.y, brick.y);
  if (overlapX < overlapY) {
    ball.vx *= -1;
    if (prevX >= brick.x + brick.w) {
      ball.x = brick.x + brick.w;
    } else if (prevX + ball.size <= brick.x) {
      ball.x = brick.x - ball.size;
    }
  } else {
    ball.vy *= -1;
    if (prevY >= brick.y + brick.h) {
      ball.y = brick.y + brick.h;
    } else if (prevY + ball.size <= brick.y) {
      ball.y = brick.y - ball.size;
    }
  }
}

function applyScore(brick) {
  const comboMultiplier = 1 + state.combo * 0.15;
  const points = Math.round(brick.score * comboMultiplier);
  state.score += points;
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem(LOCAL_STORAGE_KEY, String(state.highScore));
  }
  spawnFloatingText(`+${points}`, brick.x + brick.w / 2, brick.y + brick.h / 2);
}

function allBreakableDestroyed() {
  return state.bricks.every((b) => b.unbreakable || b.hitPoints <= 0);
}

function serveIfNeeded() {
  if (state.phase === 'serve' && state.balls.length === 0) {
    createBall(true);
  }
}

function update(dt) {
  updateEffects(dt);
  updateFloatingText(dt);
  if (state.shield.pulse > 0) {
    state.shield.pulse = Math.max(0, state.shield.pulse - dt * 1.8);
  }
  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
  }

  if (state.phase === 'game-over') {
    return;
  }

  // Paddle control
  let move = 0;
  if (isKeyDown('ArrowLeft') || isKeyDown('KeyA')) move -= 1;
  if (isKeyDown('ArrowRight') || isKeyDown('KeyD')) move += 1;
  state.paddle.x += move * state.paddle.speed * dt;
  state.paddle.x = clamp(state.paddle.x, 10, WORLD_WIDTH - state.paddle.w - 10);

  // Keep sticky balls attached to paddle until launch
  for (const ball of state.balls) {
    if (ball.sticky) {
      ball.x = state.paddle.x + state.paddle.w / 2 - ball.size / 2;
      ball.y = state.paddle.y - ball.size - 2;
    }
  }

  if (state.phase === 'serve' && (isKeyDown('Space') || isKeyDown('ArrowUp'))) {
    launchBall();
  }

  if (state.phase !== 'playing' && state.phase !== 'serve') {
    return;
  }

  const slowFactor = state.effects.has('slow') ? 0.65 : 1;
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer === 0) {
    state.combo = Math.max(0, state.combo - dt * 0.4);
  }

  updatePowerUps(state.powerUps, dt, WORLD_HEIGHT);

  for (let i = state.powerUps.length - 1; i >= 0; i--) {
    const p = state.powerUps[i];
    if (powerUpIntersects(p, state.paddle)) {
      state.powerUps.splice(i, 1);
      handlePowerUp(p.type);
    }
  }

  for (let i = state.balls.length - 1; i >= 0; i--) {
    const ball = state.balls[i];
    if (ball.sticky) continue;
    const effectiveSpeed = ball.speed * slowFactor;
    const speedScale = effectiveSpeed / Math.hypot(ball.vx, ball.vy);
    ball.vx *= speedScale;
    ball.vy *= speedScale;

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall collisions
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.size >= WORLD_WIDTH) {
      ball.x = WORLD_WIDTH - ball.size;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    // Paddle collision (only when moving downward)
    if (ball.vy > 0 && ball.y + ball.size >= state.paddle.y && ball.y <= state.paddle.y + state.paddle.h) {
      if (ball.x + ball.size > state.paddle.x && ball.x < state.paddle.x + state.paddle.w) {
        const relative = ((ball.x + ball.size / 2) - (state.paddle.x + state.paddle.w / 2)) / (state.paddle.w / 2);
        const clamped = clamp(relative, -1, 1);
        const bounceAngle = (clamped * Math.PI) / 2.4; // ~75° max
        const speed = ball.speed * (1 + Math.abs(clamped) * 0.12);
        ball.vx = Math.sin(bounceAngle) * speed;
        ball.vy = -Math.abs(Math.cos(bounceAngle) * speed);
        ball.speed = speed;
        state.combo = Math.min(state.combo + 0.4, 6);
        state.comboTimer = MAX_COMBO_TIME;
        spawnFloatingText('PING!', ball.x + ball.size / 2, ball.y - 16, '#38bdf8');
      }
    }

    // Shield collision
    if (state.shield.strength > 0 && ball.y + ball.size >= state.shield.y) {
      if (ball.x + ball.size > 0 && ball.x < WORLD_WIDTH) {
        ball.y = state.shield.y - ball.size - 2;
        ball.vy = -Math.abs(ball.vy) * 1.05;
        state.shield.strength -= 1;
        state.shield.pulse = 1;
        spawnFloatingText('SHIELD!', ball.x + ball.size / 2, state.shield.y - 18, '#c084fc');
      }
    }

    // Brick collisions
    for (const brick of state.bricks) {
      if (brick.hitPoints <= 0) continue;
      if (
        ball.x < brick.x + brick.w &&
        ball.x + ball.size > brick.x &&
        ball.y < brick.y + brick.h &&
        ball.y + ball.size > brick.y
      ) {
        ballBrickCollision(ball, brick, dt);
        if (!brick.unbreakable) {
          brick.hitPoints -= 1;
          state.combo = Math.min(state.combo + 1, 12);
          state.comboTimer = MAX_COMBO_TIME;
          applyScore(brick);
          if (brick.hitPoints <= 0) {
            const powerType = rollPowerUp(brick, 0.16, state.dropBonus);
            if (powerType) {
              state.powerUps.push(createPowerUp(brick.x + brick.w / 2 - 13, brick.y + brick.h / 2, powerType));
            }
          }
        } else {
          spawnFloatingText('CLANG', brick.x + brick.w / 2, brick.y + brick.h / 2, '#38bdf8');
        }
        break;
      }
    }

    if (ball.y > WORLD_HEIGHT + ball.size) {
      state.balls.splice(i, 1);
    }
  }

  if (state.balls.length === 0) {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.phase = 'game-over';
      state.messageTimer = 0;
    } else {
      state.phase = 'serve';
      createBall(true);
    }
  }

  if (allBreakableDestroyed()) {
    state.levelIndex += 1;
    state.phase = 'level-complete';
    state.messageTimer = 0;
  }

  serveIfNeeded();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  gradient.addColorStop(0, '#020617');
  gradient.addColorStop(0.5, '#0f172a');
  gradient.addColorStop(1, '#1e293b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawBricks() {
  const level = LEVELS[state.levelIndex % LEVELS.length];
  for (const brick of state.bricks) {
    if (brick.hitPoints <= 0) continue;
    const color = getBrickColor(brick, level?.palette);
    ctx.fillStyle = color;
    ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
    if (brick.hitPoints > 1) {
      ctx.fillStyle = 'rgba(15,23,42,0.25)';
      ctx.fillRect(brick.x + 4, brick.y + 4, brick.w - 8, brick.h - 8);
    }
  }
}

function drawHUD() {
  drawText(ctx, `Score ${state.score}`, 16, 12, { color: '#e2e8f0', font: '16px "JetBrains Mono", monospace' });
  drawText(ctx, `High ${state.highScore}`, 16, 32, { color: '#94a3b8', font: '14px "JetBrains Mono", monospace' });
  drawText(ctx, `Lives ${state.lives}`, WORLD_WIDTH - 16, 12, { color: '#e2e8f0', font: '16px "JetBrains Mono", monospace', textAlign: 'right' });
  drawText(ctx, `Level ${state.levelIndex + 1}: ${state.levelName}`, WORLD_WIDTH / 2, 12, { color: '#38bdf8', font: '16px "JetBrains Mono", monospace', textAlign: 'center' });
  if (state.combo > 1) {
    drawText(ctx, `Combo x${state.combo.toFixed(1)}`, WORLD_WIDTH / 2, 34, { color: '#facc15', font: '14px "JetBrains Mono", monospace', textAlign: 'center' });
  }
  if (state.effects.size > 0) {
    let offset = 0;
    for (const [key, time] of state.effects.entries()) {
      const def = POWER_UP_DEFS[key];
      drawText(ctx, `${def?.label ?? key}: ${time.toFixed(1)}s`, WORLD_WIDTH - 16, 40 + offset, {
        color: def?.color ?? '#fff',
        font: '12px "JetBrains Mono", monospace',
        textAlign: 'right',
      });
      offset += 16;
    }
  }
}

function render() {
  const scaleX = displayWidth / WORLD_WIDTH;
  const scaleY = displayHeight / WORLD_HEIGHT;
  ctx.save();
  ctx.scale(scaleX, scaleY);

  drawBackground();
  drawBricks();

  // Paddle
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(state.paddle.x, state.paddle.y, state.paddle.w, state.paddle.h);
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(state.paddle.x, state.paddle.y + state.paddle.h - 4, state.paddle.w, 4);

  // Shield line
  if (state.shield.strength > 0) {
    const alpha = 0.25 + state.shield.pulse * 0.5;
    ctx.fillStyle = `rgba(192,132,252,${alpha})`;
    ctx.fillRect(0, state.shield.y, WORLD_WIDTH, state.shield.h);
    drawText(ctx, `Shield ${state.shield.strength}`, WORLD_WIDTH / 2, state.shield.y - 20, {
      color: '#c084fc',
      font: '12px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
  }

  // Balls
  for (const ball of state.balls) {
    ctx.fillStyle = '#f8fafc';
    drawCircle(ctx, ball.x + ball.size / 2, ball.y + ball.size / 2, ball.size / 2, '#f8fafc');
  }

  // Power-ups
  drawPowerUps(ctx, state.powerUps);

  // Floating text
  for (const ft of state.floatingText) {
    drawText(ctx, ft.text, ft.x, ft.y, { color: ft.color, font: '14px "JetBrains Mono", monospace', textAlign: 'center' });
  }

  drawHUD();

  if (state.phase === 'serve') {
    drawText(ctx, 'Press Space to Launch', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 20, {
      color: '#e2e8f0',
      font: '20px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
  }

  if (state.phase === 'level-complete') {
    drawText(ctx, 'Level Cleared!', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, {
      color: '#facc15',
      font: '28px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Press Space for the next challenge', WORLD_WIDTH / 2, WORLD_HEIGHT / 2, {
      color: '#94a3b8',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
  }

  if (state.phase === 'game-over') {
    drawText(ctx, 'Game Over', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, {
      color: '#f87171',
      font: '32px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Press R to try again', WORLD_WIDTH / 2, WORLD_HEIGHT / 2, {
      color: '#94a3b8',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
  }

  ctx.restore();
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    if (state.phase === 'level-complete') {
      loadLevel(state.levelIndex);
    } else if (state.phase === 'game-over') {
      startGame();
    }
  }
  if (event.code === 'KeyR' && state.phase === 'game-over') {
    startGame();
  }
});

startGameLoop(update, render);
