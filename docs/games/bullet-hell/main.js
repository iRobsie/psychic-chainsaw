import { clear, drawCircle, drawText } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { createViewport } from '../shared/viewport.js';
import { createKeyTracker } from '../shared/key-tracker.js';

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 540;
const LOCAL_STORAGE_KEY = 'psychic-bullet-hell-best';

const PHASES = [
  { name: 'Spiral Bloom', duration: 18, pattern: 'spiral' },
  { name: 'Lattice Rings', duration: 22, pattern: 'rings' },
  { name: 'Aimed Barrage', duration: 18, pattern: 'aimed' },
  { name: 'Orbital Storm', duration: 24, pattern: 'orbit' },
];

function loadBest() {
  const raw = window.localStorage?.getItem(LOCAL_STORAGE_KEY);
  return raw ? Number(raw) : 0;
}

function saveBest(value) {
  try {
    window.localStorage?.setItem(LOCAL_STORAGE_KEY, String(value));
  } catch (err) {
    console.warn('Unable to persist bullet hell best score', err);
  }
}

class BulletHellGame {
  constructor(viewport, input) {
    this.viewport = viewport;
    this.input = input;

    this.state = 'menu';
    this.boss = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT * 0.32, radius: 26 };
    this.player = {
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT - 80,
      radius: 7,
      hitRadius: 5,
      speed: 260,
      bombs: 3,
      invuln: 0,
      graze: 0,
      score: 0,
    };
    this.highScore = loadBest();
    this.timeSurvived = 0;
    this.bullets = [];
    this.phaseIndex = 0;
    this.phaseTimer = 0;
    this.phaseState = {};
    this.phaseOverlay = 0;
    this.comboTimer = 0;
    this.grazeChain = 0;
    this.countdown = 0;
    this.bombTimer = 0;
    this.bombRadius = 0;
    this.bombCooldown = 0;
    this.trails = [];
  }

  start() {
    startGameLoop((dt) => this.update(dt), () => this.render());
  }

  resetRun() {
    this.player.x = WORLD_WIDTH / 2;
    this.player.y = WORLD_HEIGHT - 80;
    this.player.bombs = 3;
    this.player.invuln = 0;
    this.player.graze = 0;
    this.player.score = 0;
    this.timeSurvived = 0;
    this.bullets = [];
    this.phaseIndex = 0;
    this.phaseTimer = 0;
    this.phaseOverlay = 2.5;
    this.phaseState = {};
    this.comboTimer = 0;
    this.grazeChain = 0;
    this.bombTimer = 0;
    this.bombRadius = 0;
    this.bombCooldown = 0;
    this.countdown = 2.5;
    this.state = 'countdown';
    this.startPhase(PHASES[0]);
  }

  startPhase(phase) {
    this.phaseTimer = 0;
    this.phaseState = {
      spiralAngle: 0,
      spiralDir: 1,
      spiralTimer: 0,
      ringTimer: 0,
      gapAngle: Math.random() * Math.PI * 2,
      aimedTimer: 0,
      orbitTimer: 0,
      orbitAngle: 0,
    };
    this.phaseOverlay = 2;
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
      case 'gameover':
        this.updateGameOver();
        break;
    }
    this.updateTrails(dt);
    this.input.nextFrame();
  }

  updateMenu() {
    if (this.input.consume('Space') || this.input.consume('Enter')) {
      this.resetRun();
    }
  }

  updateCountdown(dt) {
    this.countdown -= dt;
    if (this.countdown <= 0) {
      this.state = 'playing';
    }
  }

  updatePlaying(dt) {
    this.bombCooldown = Math.max(0, this.bombCooldown - dt);
    if (this.input.consume('Space') && this.player.bombs > 0 && this.bombCooldown <= 0) {
      this.triggerBomb();
    }

    const focus = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
    const speed = this.player.speed * (focus ? 0.45 : 1);
    let moveX = 0;
    let moveY = 0;
    if (this.input.isDown('ArrowLeft') || this.input.isDown('KeyA')) moveX -= 1;
    if (this.input.isDown('ArrowRight') || this.input.isDown('KeyD')) moveX += 1;
    if (this.input.isDown('ArrowUp') || this.input.isDown('KeyW')) moveY -= 1;
    if (this.input.isDown('ArrowDown') || this.input.isDown('KeyS')) moveY += 1;
    if (moveX !== 0 || moveY !== 0) {
      const len = Math.hypot(moveX, moveY);
      moveX /= len;
      moveY /= len;
    }
    this.player.x += moveX * speed * dt;
    this.player.y += moveY * speed * dt;
    this.player.x = Math.max(40, Math.min(WORLD_WIDTH - 40, this.player.x));
    this.player.y = Math.max(80, Math.min(WORLD_HEIGHT - 30, this.player.y));

    this.player.invuln = Math.max(0, this.player.invuln - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.grazeChain = 0;

    this.phaseTimer += dt;
    const phase = PHASES[this.phaseIndex % PHASES.length];
    this.phaseOverlay = Math.max(0, this.phaseOverlay - dt);
    this.spawnPattern(phase, dt);
    if (this.phaseTimer >= phase.duration) {
      this.phaseIndex += 1;
      this.startPhase(PHASES[this.phaseIndex % PHASES.length]);
    }

    this.updateBullets(dt);
    this.timeSurvived += dt;
    this.player.score += dt * 40;

    if (this.checkPlayerHit()) {
      this.endRun();
    }
  }

  updateGameOver() {
    if (this.input.consume('Space') || this.input.consume('Enter')) {
      this.resetRun();
    }
  }

  triggerBomb() {
    this.player.bombs -= 1;
    this.bombTimer = 0.65;
    this.bombRadius = 40;
    this.bombCooldown = 1.2;
    this.player.invuln = Math.max(this.player.invuln, 1.2);
  }

  spawnPattern(phase, dt) {
    const state = this.phaseState;
    switch (phase.pattern) {
      case 'spiral':
        state.spiralTimer += dt;
        if (state.spiralTimer >= 0.06) {
          state.spiralTimer -= 0.06;
          for (let i = 0; i < 2; i++) {
            const angle = state.spiralAngle + (i * Math.PI);
            const speed = 160 + this.phaseIndex * 12;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            this.spawnBullet(this.boss.x, this.boss.y, vx, vy, 5, '#ff89c2', { type: 'normal' });
          }
          state.spiralAngle += 0.23 * state.spiralDir;
          if (state.spiralAngle > Math.PI * 1.5 || state.spiralAngle < -Math.PI * 1.5) {
            state.spiralDir *= -1;
          }
        }
        break;
      case 'rings':
        state.ringTimer += dt;
        if (state.ringTimer >= 1.6) {
          state.ringTimer -= 1.6;
          const count = 26;
          const speed = 150 + this.phaseIndex * 10;
          const gap = state.gapAngle;
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            if (Math.abs(Math.atan2(Math.sin(angle - gap), Math.cos(angle - gap))) < 0.2) continue;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            this.spawnBullet(this.boss.x, this.boss.y, vx, vy, 4, '#6cc4ff', { type: 'normal' });
          }
          state.gapAngle += Math.PI / 8;
        }
        break;
      case 'aimed':
        state.aimedTimer += dt;
        if (state.aimedTimer >= 0.9) {
          state.aimedTimer -= 0.9;
          const volley = 6;
          for (let i = 0; i < volley; i++) {
            const targetAngle = Math.atan2(this.player.y - this.boss.y, this.player.x - this.boss.x);
            const spread = (i - (volley - 1) / 2) * 0.08;
            const speed = 200 + Math.random() * 40;
            const vx = Math.cos(targetAngle + spread) * speed;
            const vy = Math.sin(targetAngle + spread) * speed;
            this.spawnBullet(this.boss.x, this.boss.y, vx, vy, 4.5, '#ffda6a', { type: 'curve', angularVelocity: spread * 0.7 });
          }
        }
        break;
      case 'orbit':
        state.orbitTimer += dt;
        if (state.orbitTimer >= 1.8) {
          state.orbitTimer -= 1.8;
          const orbitCount = 10;
          const baseRadius = 40 + this.phaseIndex * 4;
          state.orbitAngle += Math.PI / 6;
          for (let i = 0; i < orbitCount; i++) {
            const angle = state.orbitAngle + (i / orbitCount) * Math.PI * 2;
            const bullet = {
              x: this.boss.x + Math.cos(angle) * baseRadius,
              y: this.boss.y + Math.sin(angle) * baseRadius,
              vx: 0,
              vy: 0,
              radius: 5,
              color: '#7afc6c',
              type: 'orbit',
              age: 0,
              orbitAngle: angle,
              orbitRadius: baseRadius,
              orbitTime: 1.1,
              angularVelocity: 1.8,
            };
            this.bullets.push(bullet);
          }
        }
        break;
    }
  }

  spawnBullet(x, y, vx, vy, radius, color, extra) {
    this.bullets.push({ x, y, vx, vy, radius, color, age: 0, ...extra });
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      bullet.age += dt;
      if (bullet.type === 'curve') {
        const speed = Math.hypot(bullet.vx, bullet.vy);
        const angle = Math.atan2(bullet.vy, bullet.vx) + bullet.angularVelocity * dt;
        bullet.vx = Math.cos(angle) * speed;
        bullet.vy = Math.sin(angle) * speed;
      } else if (bullet.type === 'orbit') {
        if (bullet.age < bullet.orbitTime) {
          bullet.orbitAngle += bullet.angularVelocity * dt;
          bullet.x = this.boss.x + Math.cos(bullet.orbitAngle) * bullet.orbitRadius;
          bullet.y = this.boss.y + Math.sin(bullet.orbitAngle) * bullet.orbitRadius;
          continue;
        }
        if (!bullet.released) {
          bullet.released = true;
          const angle = Math.atan2(bullet.y - this.boss.y, bullet.x - this.boss.x);
          const speed = 210 + this.phaseIndex * 12;
          bullet.vx = Math.cos(angle) * speed;
          bullet.vy = Math.sin(angle) * speed;
        }
      }

      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;

      if (this.bombTimer > 0 && Math.hypot(bullet.x - this.player.x, bullet.y - this.player.y) < this.bombRadius) {
        this.player.score += 5;
        this.bullets.splice(i, 1);
        continue;
      }

      if (
        bullet.x < -80 ||
        bullet.x > WORLD_WIDTH + 80 ||
        bullet.y < -80 ||
        bullet.y > WORLD_HEIGHT + 80
      ) {
        this.bullets.splice(i, 1);
        continue;
      }
    }

    if (this.bombTimer > 0) {
      this.bombTimer -= dt;
      this.bombRadius += 600 * dt;
    }
  }

  checkPlayerHit() {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      const dist = Math.hypot(bullet.x - this.player.x, bullet.y - this.player.y);
      const grazeRange = this.player.hitRadius + bullet.radius + 18;
      if (dist < this.player.hitRadius + bullet.radius) {
        if (this.player.invuln <= 0) {
          return true;
        }
        continue;
      }
      if (dist < grazeRange) {
        if (!bullet.grazed) {
          bullet.grazed = true;
          this.player.graze += 1;
          this.grazeChain += 1;
          this.comboTimer = 2.5;
          const multiplier = 1 + Math.min(5, Math.floor(this.grazeChain / 5)) * 0.2;
          this.player.score += 40 * multiplier;
          this.trails.push({ x: this.player.x, y: this.player.y, life: 0.4 });
        }
      }
    }
    return false;
  }

  endRun() {
    this.state = 'gameover';
    this.highScore = Math.max(this.highScore, this.player.score);
    saveBest(this.highScore);
  }

  updateTrails(dt) {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const t = this.trails[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.trails.splice(i, 1);
      }
    }
  }

  render() {
    this.viewport.withContext((ctx) => {
      clear(ctx, '#05050d');
      this.renderBackground(ctx);
      this.renderBoss(ctx);
      this.renderBullets(ctx);
      this.renderPlayer(ctx);
      this.renderUI(ctx);
      switch (this.state) {
        case 'menu':
          this.renderMenu(ctx);
          break;
        case 'countdown':
          this.renderCountdown(ctx);
          break;
        case 'gameover':
          this.renderGameOver(ctx);
          break;
      }
    });
  }

  renderBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    gradient.addColorStop(0, '#090d22');
    gradient.addColorStop(1, '#03050d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }

  renderBoss(ctx) {
    drawCircle(ctx, this.boss.x, this.boss.y, this.boss.radius, '#ff6db2');
    drawCircle(ctx, this.boss.x, this.boss.y, this.boss.radius - 8, '#05050d');
  }

  renderBullets(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bullet of this.bullets) {
      const color = bullet.color;
      drawCircle(ctx, bullet.x, bullet.y, bullet.radius, color);
    }
    ctx.restore();
    if (this.bombTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, this.bombRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  renderPlayer(ctx) {
    for (const trail of this.trails) {
      const alpha = Math.max(0, trail.life / 0.4);
      drawCircle(ctx, trail.x, trail.y, 12 * alpha, `rgba(124, 255, 195, ${alpha * 0.3})`);
    }
    drawCircle(ctx, this.player.x, this.player.y, 10, '#7afc6c');
    drawCircle(ctx, this.player.x, this.player.y, this.player.hitRadius, '#f2f8ff');
  }

  renderUI(ctx) {
    drawText(ctx, `Score ${Math.floor(this.player.score)}`, 16, 12, {
      color: '#f2f8ff',
      font: '16px "JetBrains Mono", monospace',
    });
    drawText(ctx, `Best ${Math.floor(this.highScore)}`, 16, 32, {
      color: '#7886a0',
      font: '14px "JetBrains Mono", monospace',
    });
    drawText(ctx, `Time ${(this.timeSurvived).toFixed(1)}s`, WORLD_WIDTH - 16, 12, {
      color: '#f2f8ff',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'right',
    });
    drawText(ctx, `Grazes ${this.player.graze}`, WORLD_WIDTH - 16, 32, {
      color: '#8aa0b8',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'right',
    });
    drawText(ctx, `Bombs ${this.player.bombs}`, WORLD_WIDTH - 16, 52, {
      color: this.player.bombs > 0 ? '#ffda6a' : '#5d6b82',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'right',
    });
    const phase = PHASES[this.phaseIndex % PHASES.length];
    if (this.phaseOverlay > 0 && this.state === 'playing') {
      drawText(ctx, phase.name, WORLD_WIDTH / 2, 110, {
        color: '#ff89c2',
        font: '24px "Rajdhani", sans-serif',
        textAlign: 'center',
      });
    }
  }

  renderMenu(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 18, 0.85)';
    ctx.fillRect(120, 110, WORLD_WIDTH - 240, WORLD_HEIGHT - 220);
    drawText(ctx, 'Celestial Flux', WORLD_WIDTH / 2, 150, {
      color: '#7afc6c',
      font: '34px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, 'Graze dense bullet curtains, trigger kinetic bombs, and chase an endless score climb.', WORLD_WIDTH / 2, 200, {
      color: '#d6e1ff',
      font: '16px "Inter", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, 'Move with WASD / Arrows • Hold Shift to focus • Space drops a bomb', WORLD_WIDTH / 2, 240, {
      color: '#8aa0b8',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Press Space to begin', WORLD_WIDTH / 2, 290, {
      color: '#ffda6a',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }

  renderCountdown(ctx) {
    const value = Math.ceil(this.countdown);
    drawText(ctx, value > 0 ? String(value) : 'Go!', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 20, {
      color: '#f2f8ff',
      font: '44px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
  }

  renderGameOver(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(18, 8, 18, 0.85)';
    ctx.fillRect(140, 160, WORLD_WIDTH - 280, 200);
    drawText(ctx, 'Run Terminated', WORLD_WIDTH / 2, 190, {
      color: '#ff6db2',
      font: '30px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, `Score ${Math.floor(this.player.score)}`, WORLD_WIDTH / 2, 232, {
      color: '#f2f8ff',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, `Best ${Math.floor(this.highScore)}`, WORLD_WIDTH / 2, 260, {
      color: '#7886a0',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Space to retry', WORLD_WIDTH / 2, 300, {
      color: '#7afc6c',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }
}

export function startBulletHell() {
  const viewport = createViewport('#game', WORLD_WIDTH, WORLD_HEIGHT);
  const input = createKeyTracker();
  const game = new BulletHellGame(viewport, input);
  game.start();
}
