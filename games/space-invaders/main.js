import { clear, drawRect, drawText } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { createViewport } from '../shared/viewport.js';
import { createKeyTracker } from '../shared/key-tracker.js';
import { choose } from '../shared/random.js';

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 540;
const LOCAL_STORAGE_KEY = 'psychic-invaders-high-score-v2';

const ALIEN_TYPES = {
  s: { label: 'Scout', hp: 1, points: 80, color: '#7afc6c', fireRate: 2.4, bullet: 'bolt' },
  b: { label: 'Bomber', hp: 2, points: 120, color: '#ffda6a', fireRate: 3.2, bullet: 'bomb' },
  g: { label: 'Guardian', hp: 3, points: 180, color: '#ff7aa9', fireRate: 3.6, bullet: 'bolt' },
  r: { label: 'Ranger', hp: 2, points: 150, color: '#6cc4ff', fireRate: 2.8, bullet: 'zig' },
};

const WAVE_PATTERNS = [
  ['   ssssss   ', '  bbbbbbbb  ', '  gggggggg  '],
  [' rrrrrrrr ', '  bbbbbb  ', '  gggggg  ', '   ssss   '],
  ['  ggggggg  ', ' rrrrrrrr ', ' bbbbbb ', ' ssssssss '],
];

const POWER_UP_TYPES = ['rapid', 'shield', 'super', 'slow'];

function loadHighScore() {
  const raw = window.localStorage?.getItem(LOCAL_STORAGE_KEY);
  return raw ? Number(raw) : 0;
}

function saveHighScore(score) {
  try {
    window.localStorage?.setItem(LOCAL_STORAGE_KEY, String(score));
  } catch (err) {
    console.warn('Unable to save invaders high score', err);
  }
}

function createShieldCluster(x, y) {
  const blocks = [];
  const pattern = [' #### ', '######', '######', ' #### '];
  const size = 12;
  for (let r = 0; r < pattern.length; r++) {
    for (let c = 0; c < pattern[r].length; c++) {
      if (pattern[r][c] === '#') {
        blocks.push({ x: x + c * size, y: y + r * size, w: size - 2, h: size - 2, hp: 3 });
      }
    }
  }
  return blocks;
}

class SpaceInvadersGame {
  constructor(viewport, input) {
    this.viewport = viewport;
    this.input = input;

    this.state = 'menu';
    this.waveIndex = 0;
    this.aliens = [];
    this.alienDirection = 1;
    this.alienSpeed = 40;
    this.slowEffect = 0;
    this.enemyBullets = [];
    this.playerBullets = [];
    this.powerUps = [];
    this.shields = [];
    this.stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      speed: 20 + Math.random() * 40,
      size: 1 + Math.random() * 2,
    }));
    this.score = 0;
    this.highScore = loadHighScore();
    this.player = {
      x: WORLD_WIDTH / 2 - 28,
      y: WORLD_HEIGHT - 70,
      w: 56,
      h: 24,
      speed: 360,
      cooldown: 0,
      rapidTimer: 0,
      lives: 3,
      superCharge: 0,
      invuln: 0,
    };
    this.mothership = null;
    this.mothershipTimer = 12;
    this.waveIntroTimer = 0;
  }

  start() {
    startGameLoop((dt) => this.update(dt), () => this.render());
  }

  resetGame() {
    this.waveIndex = 0;
    this.score = 0;
    this.player.lives = 3;
    this.player.superCharge = 0;
    this.player.invuln = 0;
    this.player.rapidTimer = 0;
    this.powerUps = [];
    this.enemyBullets = [];
    this.playerBullets = [];
    this.createShields();
    this.spawnWave();
    this.state = 'waveIntro';
  }

  createShields() {
    this.shields = [];
    const spacing = WORLD_WIDTH / 4;
    for (let i = 1; i <= 3; i++) {
      this.shields.push(...createShieldCluster(spacing * i - 70, WORLD_HEIGHT - 170));
    }
  }

  spawnWave() {
    const pattern = WAVE_PATTERNS[this.waveIndex % WAVE_PATTERNS.length];
    const cols = pattern[0].length;
    const spacingX = 48;
    const spacingY = 38;
    const offsetX = (WORLD_WIDTH - cols * spacingX) / 2;
    const startY = 80;
    this.aliens = [];
    for (let r = 0; r < pattern.length; r++) {
      for (let c = 0; c < pattern[r].length; c++) {
        const code = pattern[r][c];
        if (code === ' ' || !ALIEN_TYPES[code]) continue;
        const def = ALIEN_TYPES[code];
        this.aliens.push({
          x: offsetX + c * spacingX,
          y: startY + r * spacingY,
          w: 32,
          h: 24,
          type: code,
          hp: def.hp + Math.floor(this.waveIndex / 2),
          points: def.points + this.waveIndex * 10,
          cooldown: def.fireRate + Math.random(),
        });
      }
    }
    this.alienDirection = 1;
    this.alienSpeed = 40 + this.waveIndex * 8;
    this.slowEffect = 0;
    this.waveIntroTimer = 2.2;
  }

  update(dt) {
    switch (this.state) {
      case 'menu':
        this.updateMenu();
        break;
      case 'waveIntro':
        this.updateWaveIntro(dt);
        break;
      case 'playing':
        this.updatePlaying(dt);
        break;
      case 'gameover':
        this.updateGameOver();
        break;
    }
    this.updateStars(dt);
    this.input.nextFrame();
  }

  updateMenu() {
    if (this.input.consume('Space') || this.input.consume('Enter')) {
      this.resetGame();
    }
  }

  updateWaveIntro(dt) {
    if (this.input.consume('Space')) {
      this.waveIntroTimer = 0;
    }
    this.waveIntroTimer -= dt;
    if (this.waveIntroTimer <= 0) {
      this.state = 'playing';
    }
  }

  updatePlaying(dt) {
    const player = this.player;
    const moveSpeed = player.speed * (this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight') ? 0.6 : 1);
    if (this.input.isDown('ArrowLeft') || this.input.isDown('KeyA')) {
      player.x -= moveSpeed * dt;
    }
    if (this.input.isDown('ArrowRight') || this.input.isDown('KeyD')) {
      player.x += moveSpeed * dt;
    }
    player.x = Math.max(20, Math.min(WORLD_WIDTH - player.w - 20, player.x));

    player.cooldown = Math.max(0, player.cooldown - dt);
    player.rapidTimer = Math.max(0, player.rapidTimer - dt);
    player.invuln = Math.max(0, player.invuln - dt);

    const fireInterval = player.rapidTimer > 0 ? 0.1 : 0.25;
    if ((this.input.isDown('Space') || this.input.isDown('KeyW')) && player.cooldown <= 0) {
      this.playerBullets.push({ x: player.x + player.w / 2 - 2, y: player.y, w: 4, h: 16, vy: -520, type: 'normal' });
      player.cooldown = fireInterval;
    }
    if ((this.input.consume('KeyE') || this.input.consume('KeyF')) && player.superCharge >= 1) {
      this.playerBullets.push({ x: player.x + player.w / 2 - 6, y: player.y - 10, w: 12, h: 26, vy: -640, type: 'super' });
      player.superCharge = 0;
    }

    const slowFactor = this.slowEffect > 0 ? 0.6 : 1;
    this.slowEffect = Math.max(0, this.slowEffect - dt);

    this.updateAliens(dt, slowFactor);
    this.updatePlayerBullets(dt);
    this.updateEnemyBullets(dt, slowFactor);
    this.updatePowerUps(dt);
    this.updateMothership(dt, slowFactor);

    if (player.lives <= 0) {
      this.endGame();
    }
  }

  updateGameOver() {
    if (this.input.consume('Space') || this.input.consume('Enter')) {
      this.resetGame();
    }
  }

  updateStars(dt) {
    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > WORLD_HEIGHT) {
        star.y = -10;
        star.x = Math.random() * WORLD_WIDTH;
      }
    }
  }

  updateAliens(dt, slowFactor) {
    if (this.aliens.length === 0) {
      this.waveIndex += 1;
      this.spawnWave();
      this.state = 'waveIntro';
      return;
    }

    let needDrop = false;
    const speed = this.alienSpeed * slowFactor;
    for (const alien of this.aliens) {
      alien.x += this.alienDirection * speed * dt;
      alien.cooldown -= dt * slowFactor;
      if (alien.x < 20 || alien.x + alien.w > WORLD_WIDTH - 20) {
        needDrop = true;
      }
      if (alien.cooldown <= 0) {
        this.fireAlienBullet(alien);
        const def = ALIEN_TYPES[alien.type];
        alien.cooldown = Math.max(1.2, def.fireRate - this.waveIndex * 0.1) + Math.random() * 0.5;
      }
    }
    if (needDrop) {
      this.alienDirection *= -1;
      for (const alien of this.aliens) {
        alien.y += 24;
      }
      this.alienSpeed += 6;
    }

    const deepest = this.aliens.reduce((max, alien) => Math.max(max, alien.y + alien.h), 0);
    if (deepest >= this.player.y - 10) {
      this.endGame();
    }
  }

  fireAlienBullet(alien) {
    const def = ALIEN_TYPES[alien.type];
    const x = alien.x + alien.w / 2 - 3;
    const y = alien.y + alien.h;
    switch (def.bullet) {
      case 'bolt':
        this.enemyBullets.push({ x, y, w: 6, h: 16, vy: 260 + this.waveIndex * 10, type: 'bolt' });
        break;
      case 'bomb':
        this.enemyBullets.push({ x, y, w: 12, h: 16, vy: 140 + this.waveIndex * 8, type: 'bomb', timer: 1.2 });
        break;
      case 'zig':
        this.enemyBullets.push({ x, y, w: 8, h: 16, vy: 220 + this.waveIndex * 12, type: 'zig', phase: Math.random() * Math.PI * 2 });
        break;
      default:
        this.enemyBullets.push({ x, y, w: 6, h: 16, vy: 250, type: 'bolt' });
        break;
    }
  }

  updatePlayerBullets(dt) {
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const bullet = this.playerBullets[i];
      bullet.y += bullet.vy * dt;
      if (bullet.y + bullet.h < 0) {
        this.playerBullets.splice(i, 1);
        continue;
      }
      if (this.checkBulletAlienCollisions(bullet)) {
        if (bullet.type === 'normal') {
          this.playerBullets.splice(i, 1);
        }
        continue;
      }
      for (const block of this.shields) {
        if (block.hp > 0 && this.rectsOverlap(bullet, block)) {
          block.hp -= bullet.type === 'super' ? 2 : 1;
          this.playerBullets.splice(i, 1);
          break;
        }
      }
    }
  }

  checkBulletAlienCollisions(bullet) {
    for (let j = this.aliens.length - 1; j >= 0; j--) {
      const alien = this.aliens[j];
      if (this.rectsOverlap(bullet, alien)) {
        alien.hp -= bullet.type === 'super' ? 2 : 1;
        if (alien.hp <= 0) {
          this.aliens.splice(j, 1);
          this.handleAlienDestroyed(alien);
        }
        return true;
      }
    }
    if (this.mothership && this.rectsOverlap(bullet, this.mothership)) {
      this.mothership.hp -= bullet.type === 'super' ? 4 : 1;
      if (this.mothership.hp <= 0) {
        this.score += 500;
        this.player.superCharge = Math.min(1, this.player.superCharge + 0.4);
        this.mothership = null;
      }
      return true;
    }
    return false;
  }

  handleAlienDestroyed(alien) {
    const def = ALIEN_TYPES[alien.type];
    this.score += def.points + this.waveIndex * 8;
    this.player.superCharge = Math.min(1, this.player.superCharge + 0.08);
    if (Math.random() < 0.18) {
      const type = Math.random() < 0.35 && def.bullet === 'bomb' ? 'shield' : choose(POWER_UP_TYPES);
      this.powerUps.push({ x: alien.x + alien.w / 2 - 12, y: alien.y, w: 24, h: 16, vy: 120, type });
    }
  }

  updateEnemyBullets(dt, slowFactor) {
    const player = this.player;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = this.enemyBullets[i];
      if (bullet.type === 'bomb') {
        bullet.y += bullet.vy * dt * slowFactor;
        bullet.vy += 120 * dt;
        bullet.timer -= dt;
        if (bullet.timer <= 0) {
          this.enemyBullets.splice(i, 1);
          this.spawnBombFragments(bullet);
          continue;
        }
      } else if (bullet.type === 'zig') {
        bullet.phase += dt * 6;
        bullet.y += bullet.vy * dt * slowFactor;
        bullet.x += Math.sin(bullet.phase) * 80 * dt;
      } else if (bullet.type === 'fragment') {
        bullet.y += bullet.vy * dt * slowFactor;
        bullet.x += (bullet.vx || 0) * dt;
      } else {
        bullet.y += bullet.vy * dt * slowFactor;
      }

      if (bullet.y > WORLD_HEIGHT + 30 || bullet.x < -40 || bullet.x > WORLD_WIDTH + 40) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      let blocked = false;
      for (const shield of this.shields) {
        if (shield.hp > 0 && this.rectsOverlap(bullet, shield)) {
          shield.hp -= bullet.type === 'bomb' ? 2 : 1;
          blocked = true;
          break;
        }
      }
      if (blocked) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (player.invuln <= 0 && this.rectsOverlap(bullet, player)) {
        this.enemyBullets.splice(i, 1);
        player.lives -= 1;
        player.invuln = 2;
        player.superCharge = Math.max(0, player.superCharge - 0.2);
      }
    }
  }

  spawnBombFragments(bullet) {
    for (let i = -1; i <= 1; i++) {
      this.enemyBullets.push({
        x: bullet.x,
        y: bullet.y,
        w: 6,
        h: 14,
        vy: 240 + Math.random() * 40,
        vx: i * 90,
        type: 'fragment',
      });
    }
  }

  updatePowerUps(dt) {
    const player = this.player;
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      p.y += p.vy * dt;
      if (p.y > WORLD_HEIGHT + 20) {
        this.powerUps.splice(i, 1);
        continue;
      }
      if (this.rectsOverlap(p, player)) {
        this.applyPowerUp(p.type);
        this.powerUps.splice(i, 1);
      }
    }
  }

  applyPowerUp(type) {
    switch (type) {
      case 'rapid':
        this.player.rapidTimer = Math.max(this.player.rapidTimer, 8);
        break;
      case 'shield':
        for (const block of this.shields) {
          if (block.hp > 0) block.hp = Math.min(4, block.hp + 1);
        }
        break;
      case 'super':
        this.player.superCharge = Math.min(1, this.player.superCharge + 0.4);
        break;
      case 'slow':
        this.slowEffect = Math.max(this.slowEffect, 5);
        break;
    }
  }

  updateMothership(dt, slowFactor) {
    this.mothershipTimer -= dt * slowFactor;
    if (this.mothership) {
      this.mothership.x += this.mothership.vx * dt;
      if (this.mothership.x < -80 || this.mothership.x > WORLD_WIDTH + 80) {
        this.mothership = null;
        this.mothershipTimer = 10 + Math.random() * 6;
      }
    } else if (this.mothershipTimer <= 0) {
      const direction = Math.random() < 0.5 ? 1 : -1;
      this.mothership = {
        x: direction === 1 ? -60 : WORLD_WIDTH + 60,
        y: 60,
        w: 60,
        h: 24,
        vx: direction * (80 + this.waveIndex * 5),
        hp: 6,
      };
      this.mothershipTimer = 18 + Math.random() * 8;
    }
  }

  endGame() {
    this.highScore = Math.max(this.highScore, this.score);
    saveHighScore(this.highScore);
    this.state = 'gameover';
  }

  rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  render() {
    this.viewport.withContext((ctx) => {
      clear(ctx, '#04060c');
      this.renderBackground(ctx);
      this.renderShields(ctx);
      this.renderAliens(ctx);
      this.renderPlayer(ctx);
      this.renderBullets(ctx);
      this.renderPowerUps(ctx);
      this.renderUI(ctx);
      if (this.mothership) {
        drawRect(ctx, this.mothership.x, this.mothership.y, this.mothership.w, this.mothership.h, '#ff7aa9');
      }
      switch (this.state) {
        case 'menu':
          this.renderMenu(ctx);
          break;
        case 'waveIntro':
          this.renderWaveIntro(ctx);
          break;
        case 'gameover':
          this.renderGameOver(ctx);
          break;
      }
    });
  }

  renderBackground(ctx) {
    ctx.save();
    ctx.fillStyle = '#04060c';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const star of this.stars) {
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.restore();
  }

  renderAliens(ctx) {
    for (const alien of this.aliens) {
      const def = ALIEN_TYPES[alien.type];
      const color = def.color;
      drawRect(ctx, alien.x, alien.y, alien.w, alien.h, color);
    }
  }

  renderPlayer(ctx) {
    const color = this.player.invuln > 0 ? '#7d92ff' : '#6de0ff';
    drawRect(ctx, this.player.x, this.player.y, this.player.w, this.player.h, color);
  }

  renderBullets(ctx) {
    for (const bullet of this.playerBullets) {
      drawRect(ctx, bullet.x, bullet.y, bullet.w, bullet.h, bullet.type === 'super' ? '#ff6db2' : '#f4f8ff');
    }
    for (const bullet of this.enemyBullets) {
      let color = '#ffda6a';
      if (bullet.type === 'bomb') color = '#ff926a';
      if (bullet.type === 'zig' || bullet.type === 'fragment') color = '#6cc4ff';
      drawRect(ctx, bullet.x, bullet.y, bullet.w, bullet.h, color);
    }
  }

  renderShields(ctx) {
    for (const block of this.shields) {
      if (block.hp <= 0) continue;
      const alpha = 0.25 + block.hp * 0.2;
      drawRect(ctx, block.x, block.y, block.w, block.h, `rgba(122, 252, 108, ${alpha})`);
    }
  }

  renderPowerUps(ctx) {
    for (const p of this.powerUps) {
      let color = '#fff';
      let label = '?';
      switch (p.type) {
        case 'rapid':
          color = '#6cc4ff';
          label = 'R';
          break;
        case 'shield':
          color = '#7afc6c';
          label = 'S';
          break;
        case 'super':
          color = '#ff89c2';
          label = '!';
          break;
        case 'slow':
          color = '#ffda6a';
          label = 'T';
          break;
      }
      drawRect(ctx, p.x, p.y, p.w, p.h, color);
      drawText(ctx, label, p.x + p.w / 2, p.y + 2, {
        color: '#06101b',
        font: '12px "JetBrains Mono"',
        textAlign: 'center',
      });
    }
  }

  renderUI(ctx) {
    drawText(ctx, `Score ${this.score}`, 16, 12, {
      color: '#f2f8ff',
      font: '16px "JetBrains Mono", monospace',
    });
    drawText(ctx, `Best ${this.highScore}`, 16, 32, {
      color: '#7886a0',
      font: '14px "JetBrains Mono", monospace',
    });
    drawText(ctx, `Lives ${this.player.lives}`, WORLD_WIDTH - 16, 12, {
      color: '#f2f8ff',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'right',
    });
    drawText(ctx, `Wave ${this.waveIndex + 1}`, WORLD_WIDTH - 16, 32, {
      color: '#8aa0b8',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'right',
    });
    const chargeWidth = 160;
    const charge = Math.max(0, Math.min(1, this.player.superCharge));
    ctx.save();
    ctx.fillStyle = 'rgba(20, 28, 44, 0.8)';
    ctx.fillRect(WORLD_WIDTH / 2 - chargeWidth / 2, WORLD_HEIGHT - 26, chargeWidth, 12);
    ctx.fillStyle = '#ff6db2';
    ctx.fillRect(WORLD_WIDTH / 2 - chargeWidth / 2 + 2, WORLD_HEIGHT - 24, (chargeWidth - 4) * charge, 8);
    drawText(ctx, 'Super', WORLD_WIDTH / 2, WORLD_HEIGHT - 40, {
      color: '#8aa0b8',
      font: '12px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }

  renderMenu(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 18, 0.85)';
    ctx.fillRect(100, 100, WORLD_WIDTH - 200, WORLD_HEIGHT - 200);
    drawText(ctx, 'Vanguard Orbit', WORLD_WIDTH / 2, 150, {
      color: '#6cc4ff',
      font: '36px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, 'Defend the last line with rechargeable super shots, reactive shields, and alien power cores.', WORLD_WIDTH / 2, 200, {
      color: '#d6e1ff',
      font: '16px "Inter", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, 'Move with ←/→ or A/D • Hold Shift to focus • Space fires • E unleashes the charged super beam', WORLD_WIDTH / 2, 240, {
      color: '#8aa0b8',
      font: '14px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Press Space to engage', WORLD_WIDTH / 2, 300, {
      color: '#7afc6c',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }

  renderWaveIntro(ctx) {
    drawText(ctx, `Wave ${this.waveIndex + 1}`, WORLD_WIDTH / 2, 200, {
      color: '#ffda6a',
      font: '32px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, 'Get ready…', WORLD_WIDTH / 2, 240, {
      color: '#8aa0b8',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
  }

  renderGameOver(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(20, 12, 18, 0.85)';
    ctx.fillRect(120, 160, WORLD_WIDTH - 240, 200);
    drawText(ctx, 'Defense Breached', WORLD_WIDTH / 2, 190, {
      color: '#ff7aa9',
      font: '30px "Rajdhani", sans-serif',
      textAlign: 'center',
    });
    drawText(ctx, `Score ${this.score}`, WORLD_WIDTH / 2, 230, {
      color: '#f2f8ff',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, `Best ${this.highScore}`, WORLD_WIDTH / 2, 258, {
      color: '#7886a0',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    drawText(ctx, 'Space to retry', WORLD_WIDTH / 2, 298, {
      color: '#7afc6c',
      font: '18px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
    ctx.restore();
  }
}

export function startSpaceInvaders() {
  const viewport = createViewport('#game', WORLD_WIDTH, WORLD_HEIGHT);
  const input = createKeyTracker();
  const game = new SpaceInvadersGame(viewport, input);
  game.start();
}
