import { clear, drawRect, drawText, drawCircle } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { createViewport } from '../shared/viewport.js';
import { createKeyTracker } from '../shared/key-tracker.js';
import { randInt, choose } from '../shared/random.js';

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 540;
const LOCAL_STORAGE_KEY = 'psychic-breakout-high-score-v2';

const BRICK_TYPES = {
  '1': { hits: 1, score: 120, color: '#6de0ff' },
  '2': { hits: 2, score: 180, color: '#4bd1ff' },
  '3': { hits: 3, score: 260, color: '#ff8cff' },
  '4': { hits: 4, score: 350, color: '#ff6d8a' },
  'A': { hits: 1, score: 180, color: '#9bf59b', powerUpBias: ['expand'] },
  'B': { hits: 2, score: 220, color: '#ffc66d', powerUpBias: ['multi', 'pierce'] },
  'C': { hits: 3, score: 260, color: '#ffd392', powerUpBias: ['slow'] },
};

const LEVELS = [
  {
    name: 'Neon Dawn',
    layout: [
      '   11111111   ',
      '   12222221   ',
      '   13333331   ',
      '   14444441   ',
    ],
    powerUps: 0.22,
  },
  {
    name: 'Cascade Bloom',
    layout: [
      ' B3B3B3B3B3B ',
      '  233333332  ',
      '  122AAA221  ',
      '   1111111   ',
    ],
    powerUps: 0.26,
  },
  {
    name: 'Pulse Storm',
    layout: [
      '   CCCCCCC   ',
      '  344444443  ',
      '  B3333333B  ',
      '   2222222   ',
      '    11111    ',
    ],
    powerUps: 0.3,
  },
];

const POWER_UP_TYPES = ['expand', 'multi', 'slow', 'pierce'];

function loadHighScore() {
  const raw = window.localStorage?.getItem(LOCAL_STORAGE_KEY);
  return raw ? Number(raw) : 0;
}

function saveHighScore(score) {
  try {
    window.localStorage?.setItem(LOCAL_STORAGE_KEY, String(score));
  } catch (err) {
    console.warn('Unable to save breakout high score', err);
  }
}

function createBall(x, y) {
  return {
    x,
    y,
    radius: 7,
    vx: 0,
    vy: 0,
    baseSpeed: 280,
    pierceTimer: 0,
    trail: [],
  };
}

class BreakoutGame {
  constructor(viewport, input) {
    this.viewport = viewport;
    this.input = input;

    this.state = 'menu';
    this.levelIndex = 0;
    this.bricks = [];
    this.paddle = {
      x: WORLD_WIDTH / 2 - 50,
      y: WORLD_HEIGHT - 40,
      w: 120,
      baseW: 120,
      h: 16,
      speed: 520,
    };
    this.balls = [createBall(WORLD_WIDTH / 2, this.paddle.y - 20)];
    this.powerUps = [];
    this.particles = [];
    this.effects = { expand: 0, slow: 0 };
    this.score = 0;
    this.comboLevel = 1;
    this.comboTimer = 0;
    this.lives = 3;
    this.highScore = loadHighScore();
    this.levelTitleTimer = 0;
  }

  start() {
    startGameLoop((dt) => this.update(dt), () => this.render());
  }

  resetGame() {
    this.levelIndex = 0;
    this.score = 0;
    this.comboLevel = 1;
    this.comboTimer = 0;
    this.lives = 3;
    this.effects = { expand: 0, slow: 0 };
    this.spawnLevel();
    this.state = 'serving';
  }

  spawnLevel() {
    const level = LEVELS[this.levelIndex % LEVELS.length];
    const cols = level.layout[0].length;
    const rows = level.layout.length;
    const marginX = 70;
    const marginY = 70;
    const usableWidth = WORLD_WIDTH - marginX * 2;
    const brickWidth = usableWidth / cols;
    const brickHeight = 24;
    this.bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const code = level.layout[r][c];
        if (code === ' ') continue;
        const def = BRICK_TYPES[code] || BRICK_TYPES['1'];
        this.bricks.push({
          x: marginX + c * brickWidth + 2,
          y: marginY + r * brickHeight + 2,
          w: brickWidth - 4,
          h: brickHeight - 4,
          hp: def.hits,
          color: def.color,
          score: def.score,
          bias: def.powerUpBias || null,
        });
      }
    }
    this.levelTitleTimer = 3;
    this.paddle.x = WORLD_WIDTH / 2 - this.paddle.w / 2;
    this.balls = [createBall(WORLD_WIDTH / 2, this.paddle.y - 20)];
  }

  launchBall() {
    const ball = this.balls[0];
    ball.x = this.paddle.x + this.paddle.w / 2;
    ball.y = this.paddle.y - 18;
    ball.vx = (Math.random() * 2 - 1) * 120;
    ball.vy = -ball.baseSpeed;
  }

  update(dt) {
    switch (this.state) {
      case 'menu':
        this.updateMenu();
        break;
      case 'serving':
        this.updateServing(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'levelComplete':
        this.updateLevelComplete(dt);
        break;
      case 'gameover':
        this.updateGameOver();
        break;
    }
    this.updateParticles(dt);
    this.input.nextFrame();
  }

  updateMenu() {
    if (this.input.consume('Space') || this.input.consume('Enter')) {
      this.resetGame();
    }
  }

  updateServing(dt) {
    this.movePaddle(dt);
    const ball = this.balls[0];
    ball.x = this.paddle.x + this.paddle.w / 2;
    ball.y = this.paddle.y - 18;
    ball.vx = 0;
    ball.vy = 0;
    if (this.input.consume('Space') || this.input.consume('ArrowUp')) {
      this.launchBall();
      this.state = 'playing';
    }
  }

  movePaddle(dt) {
    if (this.input.isDown('ArrowLeft') || this.input.isDown('KeyA')) {
      this.paddle.x -= this.paddle.speed * dt;
    }
    if (this.input.isDown('ArrowRight') || this.input.isDown('KeyD')) {
      this.paddle.x += this.paddle.speed * dt;
    }
    const expanded = this.effects.expand > 0;
    this.paddle.w = expanded ? this.paddle.baseW * 1.4 : this.paddle.baseW;
    this.paddle.x = Math.max(30, Math.min(WORLD_WIDTH - this.paddle.w - 30, this.paddle.x));
  }

  updatePlaying(dt) {
    this.movePaddle(dt);

    if (this.input.consume('Escape')) {
      this.state = 'menu';
      return;
    }

    this.effects.expand = Math.max(0, this.effects.expand - dt);
    this.effects.slow = Math.max(0, this.effects.slow - dt);

    const speedScale = this.effects.slow > 0 ? 0.7 : 1;
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer === 0) {
      this.comboLevel = 1;
    }

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      const prevX = ball.x;
      const prevY = ball.y;
      ball.x += ball.vx * dt * speedScale;
      ball.y += ball.vy * dt * speedScale;
      if (ball.pierceTimer > 0) {
        ball.pierceTimer = Math.max(0, ball.pierceTimer - dt);
      }
      this.updateBallCollisions(ball, prevX, prevY, speedScale);
      if (ball.y - ball.radius > WORLD_HEIGHT + 40) {
        this.balls.splice(i, 1);
      }
    }

    if (this.balls.length === 0) {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.highScore = Math.max(this.highScore, this.score);
        saveHighScore(this.highScore);
        this.state = 'gameover';
      } else {
        this.balls = [createBall(this.paddle.x + this.paddle.w / 2, this.paddle.y - 20)];
        this.state = 'serving';
      }
    }

    this.updatePowerUps(dt);

    if (this.bricks.every((b) => b.hp <= 0)) {
      this.levelIndex += 1;
      this.spawnLevel();
      this.state = 'levelComplete';
    }
  }

  updatePowerUps(dt) {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      p.y += p.vy * dt;
      if (p.y > WORLD_HEIGHT + 20) {
        this.powerUps.splice(i, 1);
        continue;
      }
      if (
        p.x < this.paddle.x + this.paddle.w &&
        p.x + p.size > this.paddle.x &&
        p.y + p.size > this.paddle.y &&
        p.y < this.paddle.y + this.paddle.h
      ) {
        this.applyPowerUp(p.type);
        this.powerUps.splice(i, 1);
      }
    }
  }

  applyPowerUp(type) {
    switch (type) {
      case 'expand':
        this.effects.expand = Math.max(this.effects.expand, 12);
        break;
      case 'multi':
        this.spawnMultiBall();
        break;
      case 'slow':
        this.effects.slow = Math.max(this.effects.slow, 8);
        break;
      case 'pierce':
        for (const ball of this.balls) {
          ball.pierceTimer = Math.max(ball.pierceTimer, 6);
        }
        break;
    }
  }

  spawnMultiBall() {
    const clones = [];
    for (const ball of this.balls) {
      const speed = Math.hypot(ball.vx, ball.vy) || ball.baseSpeed;
      clones.push({
        ...createBall(ball.x, ball.y),
        vx: -speed * Math.sign(ball.vx || 1) * 0.8,
        vy: -Math.abs(speed) * 0.9,
      });
      clones.push({
        ...createBall(ball.x, ball.y),
        vx: speed * Math.sign(ball.vx || 1) * 0.8,
        vy: -Math.abs(speed) * 0.9,
      });
    }
    this.balls.push(...clones);
    if (this.balls.length > 6) {
      this.balls = this.balls.slice(0, 6);
    }
  }

  updateBallCollisions(ball, prevX, prevY, speedScale) {
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx) || ball.baseSpeed * 0.5;
    } else if (ball.x + ball.radius > WORLD_WIDTH) {
      ball.x = WORLD_WIDTH - ball.radius;
      ball.vx = -Math.abs(ball.vx) || -ball.baseSpeed * 0.5;
    }
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      ball.vy = Math.abs(ball.vy);
    }

    if (this.collides(ball, this.paddle) && ball.vy > 0) {
      const paddleCenter = this.paddle.x + this.paddle.w / 2;
      const relative = (ball.x - paddleCenter) / (this.paddle.w / 2);
      const clamped = Math.max(-1, Math.min(1, relative));
      const angle = (Math.PI / 4) * clamped;
      const speed = Math.min(520, Math.hypot(ball.vx, ball.vy) * 1.05 + 20);
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      this.comboTimer = 0; // reset combos when rally restarts
    }

    for (const brick of this.bricks) {
      if (brick.hp <= 0) continue;
      if (this.ballHitsBrick(ball, brick)) {
        this.handleBrickHit(ball, brick, prevX, prevY, speedScale);
        break;
      }
    }
  }

  collides(ball, rect) {
    return (
      ball.x + ball.radius > rect.x &&
      ball.x - ball.radius < rect.x + rect.w &&
      ball.y + ball.radius > rect.y &&
      ball.y - ball.radius < rect.y + rect.h
    );
  }

  ballHitsBrick(ball, brick) {
    return (
      ball.x + ball.radius > brick.x &&
      ball.x - ball.radius < brick.x + brick.w &&
      ball.y + ball.radius > brick.y &&
      ball.y - ball.radius < brick.y + brick.h
    );
  }

  handleBrickHit(ball, brick, prevX, prevY, speedScale) {
    brick.hp -= 1;
    this.comboTimer = 3;
    this.comboLevel = Math.min(9, this.comboLevel + 1);
    this.score += Math.round(brick.score * (1 + (this.comboLevel - 1) * 0.15));
    this.emitBrickParticles(brick);

    if (brick.hp <= 0) {
      const level = LEVELS[this.levelIndex % LEVELS.length];
      const baseChance = level.powerUps;
      const bias = brick.bias ? brick.bias : null;
      if (Math.random() < baseChance) {
        const type = bias ? choose(bias) : choose(POWER_UP_TYPES);
        this.powerUps.push({ x: brick.x + brick.w / 2 - 10, y: brick.y, size: 20, vy: 140, type });
      }
    }

    if (ball.pierceTimer > 0) {
      return; // keep direction while piercing
    }

    const prevInsideX = prevX + ball.radius > brick.x && prevX - ball.radius < brick.x + brick.w;
    const prevInsideY = prevY + ball.radius > brick.y && prevY - ball.radius < brick.y + brick.h;
    if (!prevInsideX || !prevInsideY) {
      if (!prevInsideX) {
        ball.vx *= -1;
      }
      if (!prevInsideY) {
        ball.vy *= -1;
      }
    } else {
      const overlapLeft = prevX + ball.radius - brick.x;
      const overlapRight = brick.x + brick.w - (prevX - ball.radius);
      const overlapTop = prevY + ball.radius - brick.y;
      const overlapBottom = brick.y + brick.h - (prevY - ball.radius);
      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
      if (minOverlap === overlapLeft || minOverlap === overlapRight) {
        ball.vx *= -1;
      } else {
        ball.vy *= -1;
      }
    }
  }

  emitBrickParticles(brick) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: brick.x + brick.w / 2,
        y: brick.y + brick.h / 2,
        vx: (Math.random() * 2 - 1) * 60,
        vy: randInt(-120, -40),
        life: 0.5,
        color: brick.color,
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  updateLevelComplete(dt) {
    this.levelTitleTimer = Math.max(0, this.levelTitleTimer - dt);
    if (this.input.consume('Space') || this.input.consume('Enter')) {
      this.state = 'serving';
    }
  }

  updateGameOver() {
    if (this.input.consume('Space') || this.input.consume('Enter')) {
      this.resetGame();
    }
  }

  render() {
    this.viewport.withContext((ctx) => {
      clear(ctx, '#05070f');
      this.renderBackground(ctx);
      this.renderBricks(ctx);
      this.renderPaddle(ctx);
      this.renderBalls(ctx);
      this.renderPowerUps(ctx);
      this.renderParticles(ctx);
      this.renderUI(ctx);
      switch (this.state) {
        case 'menu':
          this.renderMenu(ctx);
          break;
        case 'serving':
          this.renderServeHint(ctx);
          break;
        case 'levelComplete':
          this.renderLevelComplete(ctx);
          break;
        case 'gameover':
          this.renderGameOver(ctx);
          break;
      }
    });
  }

  renderBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    gradient.addColorStop(0, '#101525');
    gradient.addColorStop(1, '#06080f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  renderBricks(ctx) {
    for (const brick of this.bricks) {
      if (brick.hp <= 0) continue;
      ctx.save();
      ctx.fillStyle = brick.color;
      ctx.globalAlpha = 0.7 + brick.hp * 0.05;
      ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      ctx.restore();
    }
  }

  renderPaddle(ctx) {
    drawRect(ctx, this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h, '#8be9fd');
  }

  renderBalls(ctx) {
    for (const ball of this.balls) {
      const alpha = ball.pierceTimer > 0 ? 0.9 : 0.8;
      drawCircle(ctx, ball.x, ball.y, ball.radius, `rgba(255,255,255,${alpha})`);
      if (ball.pierceTimer > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(255, 110, 168, ${0.6 + 0.4 * Math.sin(performance.now() / 120)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  renderPowerUps(ctx) {
    for (const p of this.powerUps) {
      ctx.save();
      ctx.fillStyle = this.powerUpColor(p.type);
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.fillStyle = '#0b0f16';
      ctx.font = '12px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.powerUpLabel(p.type), p.x + p.size / 2, p.y + p.size / 2);
      ctx.restore();
    }
  }

  powerUpLabel(type) {
    switch (type) {
      case 'expand':
        return '+';
      case 'multi':
        return '×';
      case 'slow':
        return 'S';
      case 'pierce':
        return 'P';
      default:
        return '?';
    }
  }

  powerUpColor(type) {
    switch (type) {
      case 'expand':
        return '#7afc6c';
      case 'multi':
        return '#ffda6a';
      case 'slow':
        return '#6cc4ff';
      case 'pierce':
        return '#ff89c2';
      default:
        return '#cccccc';
    }
  }

  renderParticles(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life * 2);
      drawRect(ctx, p.x, p.y, 3, 3, `${p.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
    }
    ctx.restore();
  }

  renderUI(ctx) {
    drawText(ctx, `Score ${this.score}`, 20, 12, {
      color: '#f2f8ff',
      font: '16px "JetBrains Mono", monospace',
    });
    drawText(ctx, `Best ${this.highScore}`, 20, 32, {
      color: '#7886a0',
      font: '14px "JetBrains Mono", monospace',
    });
    drawText(ctx, `Lives ${this.lives}`, WORLD_WIDTH - 20, 12, {
      color: '#f2f8ff',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'right',
    });
    drawText(ctx, `Combo x${this.comboLevel}`, WORLD_WIDTH - 20, 32, {
      color: this.comboLevel > 1 ? '#ffda6a' : '#5d6b82',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'right',
    });
    if (this.effects.slow > 0) {
      drawText(ctx, 'Time warp active', WORLD_WIDTH - 20, 52, {
        color: '#6cc4ff',
        font: '12px "JetBrains Mono", monospace',
        textAlign: 'right',
      });
    }
  }

  renderMenu(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 16, 0.85)';
    ctx.fillRect(100, 100, WORLD_WIDTH - 200, WORLD_HEIGHT - 200);
    drawText(ctx, 'Breakout Redux', WORLD_WIDTH / 2, 150, {
      color: '#8be9fd',
      font: '36px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, 'Three handcrafted gauntlets packed with power-ups and score combos.', WORLD_WIDTH / 2, 200, {
      color: '#d6e1ff',
      font: '16px "Inter", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, '← / → move paddle • Space to launch • Chain hits for higher multipliers', WORLD_WIDTH / 2, 240, {
      color: '#8aa0b8',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Press Space to begin', WORLD_WIDTH / 2, 300, {
      color: '#7afc6c',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }

  renderServeHint(ctx) {
    drawText(ctx, 'Move to aim • Press Space to launch', WORLD_WIDTH / 2, this.paddle.y - 36, {
      color: '#8aa0b8',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
  }

  renderLevelComplete(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 16, 0.75)';
    ctx.fillRect(120, 160, WORLD_WIDTH - 240, 160);
    const nextLevel = LEVELS[this.levelIndex % LEVELS.length];
    drawText(ctx, 'Wave cleared!', WORLD_WIDTH / 2, 190, {
      color: '#ffda6a',
      font: '28px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, `Next: ${nextLevel.name}`, WORLD_WIDTH / 2, 226, {
      color: '#d6e1ff',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Space to continue', WORLD_WIDTH / 2, 264, {
      color: '#8aa0b8',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }

  renderGameOver(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 12, 18, 0.85)';
    ctx.fillRect(110, 160, WORLD_WIDTH - 220, 200);
    drawText(ctx, 'Game Over', WORLD_WIDTH / 2, 190, {
      color: '#ff6d8a',
      font: '32px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, `Score ${this.score}`, WORLD_WIDTH / 2, 232, {
      color: '#f2f8ff',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, `Best ${this.highScore}`, WORLD_WIDTH / 2, 260, {
      color: '#7886a0',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Space to retry', WORLD_WIDTH / 2, 300, {
      color: '#7afc6c',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }
}

export function startBreakoutGame() {
  const viewport = createViewport('#game', WORLD_WIDTH, WORLD_HEIGHT);
  const input = createKeyTracker();
  const game = new BreakoutGame(viewport, input);
  game.start();
}
