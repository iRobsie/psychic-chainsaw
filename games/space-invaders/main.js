import { initCanvas, drawRect, drawText, resizeCanvasToDisplaySize } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { initKeyboard, isKeyDown } from '../../game-lib/input/keyboard.js';
import { aabbIntersect } from '../../game-lib/physics/collision.js';
import { createFormation, FORMATIONS } from './formations.js';

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 540;
const LOCAL_STORAGE_KEY = 'space-invaders-best-v2';

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

const POWER_UPS = {
  rapid: { color: '#38bdf8', label: 'Rapid', duration: 8 },
  spread: { color: '#fbbf24', label: 'Spread', duration: 10 },
  pierce: { color: '#f472b6', label: 'Pierce', duration: 8 },
  shield: { color: '#22c55e', label: 'Shield', duration: 0 },
  bomb: { color: '#f87171', label: 'Nova', duration: 0 },
};

function createBunkers() {
  const bunkers = [];
  const layout = [
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
  ];
  const cellSize = 8;
  const bunkerCount = 3;
  const spacing = (WORLD_WIDTH - bunkerCount * 80) / (bunkerCount + 1);
  for (let i = 0; i < bunkerCount; i++) {
    const x = spacing + i * (spacing + 80);
    const y = WORLD_HEIGHT - 160;
    const cells = [];
    for (let r = 0; r < layout.length; r++) {
      for (let c = 0; c < layout[r].length; c++) {
        if (!layout[r][c]) continue;
        cells.push({
          x: x + c * cellSize,
          y: y + r * cellSize,
          size: cellSize,
          hp: 4,
        });
      }
    }
    bunkers.push({ x, y, cells });
  }
  return bunkers;
}

const state = {
  player: {
    x: WORLD_WIDTH / 2 - 24,
    y: WORLD_HEIGHT - 60,
    width: 48,
    height: 20,
    speed: 340,
    cooldownTimer: 0,
    rapidTimer: 0,
    spreadTimer: 0,
    pierceTimer: 0,
  },
  bullets: [],
  alienBullets: [],
  aliens: [],
  bunkers: createBunkers(),
  powerUps: [],
  wave: 0,
  score: 0,
  highScore: Number(localStorage.getItem(LOCAL_STORAGE_KEY)) || 0,
  lives: 2,
  gamePhase: 'intro',
  messageTimer: 0,
  fleetDirection: 1,
  mothership: null,
  mothershipTimer: 12,
  floatingText: [],
  invulnerableTimer: 0,
};

function spawnFloatingText(text, x, y, color = '#f8fafc') {
  state.floatingText.push({ text, x, y, life: 1.2, color });
}

function startWave() {
  const { aliens } = createFormation(state.wave, WORLD_WIDTH);
  state.aliens = aliens;
  state.bullets = [];
  state.alienBullets = [];
  state.fleetDirection = 1;
  state.gamePhase = 'playing';
  state.messageTimer = 0;
  state.mothershipTimer = Math.max(8 - state.wave * 0.3, 4);
  spawnFloatingText(`Wave ${state.wave + 1}: ${FORMATIONS[state.wave % FORMATIONS.length].name}`, WORLD_WIDTH / 2, 80, '#38bdf8');
}

function resetGame() {
  state.wave = 0;
  state.score = 0;
  state.lives = 2;
  state.powerUps = [];
  state.bunkers = createBunkers();
  state.player.rapidTimer = 0;
  state.player.spreadTimer = 0;
  state.player.pierceTimer = 0;
  state.player.cooldownTimer = 0;
  state.invulnerableTimer = 2;
  startWave();
}

resetGame();

function firePlayer() {
  if (state.player.cooldownTimer > 0 || state.gamePhase !== 'playing') return;
  const centerX = state.player.x + state.player.width / 2;
  const baseBullet = {
    x: centerX - 3,
    y: state.player.y - 12,
    width: 6,
    height: 14,
    vx: 0,
    vy: -420,
    pierce: state.player.pierceTimer > 0,
  };
  state.bullets.push({ ...baseBullet });
  if (state.player.spreadTimer > 0) {
    state.bullets.push({ ...baseBullet, vx: -160 });
    state.bullets.push({ ...baseBullet, vx: 160 });
  }
  state.player.cooldownTimer = state.player.rapidTimer > 0 ? 0.12 : 0.26;
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'KeyW') {
    if (state.gamePhase === 'wave-clear') {
      state.wave += 1;
      startWave();
    } else if (state.gamePhase === 'game-over') {
      resetGame();
    } else {
      firePlayer();
    }
  }
  if (event.code === 'KeyR' && state.gamePhase === 'game-over') {
    resetGame();
  }
});

function spawnAlienBullet(alien) {
  const speed = 180 + state.wave * 14;
  state.alienBullets.push({
    x: alien.x + alien.w / 2 - 3,
    y: alien.y + alien.h,
    width: 6,
    height: 14,
    vx: 0,
    vy: speed,
    color: '#f87171',
  });
  if (state.wave >= 2 && Math.random() < 0.2) {
    state.alienBullets.push({
      x: alien.x + alien.w / 2 - 3,
      y: alien.y + alien.h,
      width: 6,
      height: 14,
      vx: Math.random() < 0.5 ? -120 : 120,
      vy: speed * 0.8,
      color: '#38bdf8',
    });
  }
}

function spawnPowerUp(x, y) {
  const keys = Object.keys(POWER_UPS);
  const type = keys[Math.floor(Math.random() * keys.length)];
  const def = POWER_UPS[type];
  state.powerUps.push({ x, y, width: 26, height: 14, vy: 90, type, color: def.color });
}

function applyPowerUp(type) {
  const def = POWER_UPS[type];
  if (!def) return;
  switch (type) {
    case 'rapid':
      state.player.rapidTimer = def.duration;
      spawnFloatingText('Rapid fire!', state.player.x + state.player.width / 2, state.player.y - 24, def.color);
      break;
    case 'spread':
      state.player.spreadTimer = def.duration;
      spawnFloatingText('Spread!', state.player.x + state.player.width / 2, state.player.y - 24, def.color);
      break;
    case 'pierce':
      state.player.pierceTimer = def.duration;
      spawnFloatingText('Pierce!', state.player.x + state.player.width / 2, state.player.y - 24, def.color);
      break;
    case 'shield':
      for (const bunker of state.bunkers) {
        for (const cell of bunker.cells) {
          cell.hp = Math.min(cell.hp + 1, 4);
        }
      }
      spawnFloatingText('Bunkers repaired!', WORLD_WIDTH / 2, WORLD_HEIGHT - 190, def.color);
      break;
    case 'bomb':
      if (state.aliens.length > 0) {
        const columnX = state.aliens[Math.floor(Math.random() * state.aliens.length)].x;
        for (let i = state.aliens.length - 1; i >= 0; i--) {
          const alien = state.aliens[i];
          if (Math.abs(alien.x - columnX) < 5) {
            state.score += alien.score;
            state.aliens.splice(i, 1);
            spawnFloatingText('+BONUS', alien.x + alien.w / 2, alien.y, '#f87171');
          }
        }
      }
      break;
  }
}

function loseLife() {
  state.lives -= 1;
  if (state.lives < 0) {
    state.gamePhase = 'game-over';
    spawnFloatingText('Defeat!', WORLD_WIDTH / 2, WORLD_HEIGHT / 2, '#f87171');
    return;
  }
  state.player.x = WORLD_WIDTH / 2 - state.player.width / 2;
  state.bullets = [];
  state.alienBullets = [];
  state.invulnerableTimer = 2;
}

function updateBunkersWithBullet(bullet) {
  for (const bunker of state.bunkers) {
    for (let i = bunker.cells.length - 1; i >= 0; i--) {
      const cell = bunker.cells[i];
      const rect = { x: cell.x, y: cell.y, width: cell.size, height: cell.size };
      if (aabbIntersect(bullet, rect)) {
        cell.hp -= 1;
        if (cell.hp <= 0) bunker.cells.splice(i, 1);
        return true;
      }
    }
  }
  return false;
}

function updateAliens(dt) {
  if (state.aliens.length === 0) {
    if (state.gamePhase === 'playing') {
      state.gamePhase = 'wave-clear';
      spawnFloatingText('Wave Cleared!', WORLD_WIDTH / 2, 120, '#facc15');
    }
    return;
  }

  const speed = 36 + state.wave * 12 + Math.max(0, 50 - state.aliens.length);
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const alien of state.aliens) {
    alien.x += state.fleetDirection * speed * dt;
    minX = Math.min(minX, alien.x);
    maxX = Math.max(maxX, alien.x + alien.w);
    maxY = Math.max(maxY, alien.y + alien.h);
    alien.fireTimer = (alien.fireTimer || Math.random() * 2);
    alien.fireTimer -= dt;
    if (alien.fireTimer <= 0) {
      if (Math.random() < 0.4) {
        spawnAlienBullet(alien);
      }
      alien.fireTimer = 1.6 - Math.min(1, state.wave * 0.08) + Math.random() * 0.6;
    }
  }

  if (minX <= 20 || maxX >= WORLD_WIDTH - 20) {
    state.fleetDirection *= -1;
    for (const alien of state.aliens) {
      alien.y += 22;
    }
  }

  if (maxY >= state.player.y - 20 && state.gamePhase === 'playing') {
    loseLife();
  }
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    bullet.x += (bullet.vx || 0) * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.y + bullet.height < 0 || bullet.x < -20 || bullet.x > WORLD_WIDTH + 20) {
      state.bullets.splice(i, 1);
      continue;
    }
    let hit = false;
    for (let j = state.aliens.length - 1; j >= 0; j--) {
      const alien = state.aliens[j];
      const rect = { x: alien.x, y: alien.y, width: alien.w, height: alien.h };
      if (aabbIntersect(bullet, rect)) {
        alien.hp -= 1;
        if (alien.hp <= 0) {
          state.score += alien.score;
          spawnFloatingText(`+${alien.score}`, alien.x + alien.w / 2, alien.y, '#facc15');
          if (Math.random() < 0.08 + state.wave * 0.01) {
            spawnPowerUp(alien.x + alien.w / 2 - 13, alien.y + alien.h / 2);
          }
          state.aliens.splice(j, 1);
        }
        hit = true;
        break;
      }
    }
    if (hit && !bullet.pierce) {
      state.bullets.splice(i, 1);
      continue;
    }
    if (!hit) {
      if (updateBunkersWithBullet(bullet)) {
        state.bullets.splice(i, 1);
      }
    }
  }
}

function updateAlienBullets(dt) {
  for (let i = state.alienBullets.length - 1; i >= 0; i--) {
    const bullet = state.alienBullets[i];
    bullet.x += (bullet.vx || 0) * dt;
    bullet.y += bullet.vy * dt;
    if (bullet.y > WORLD_HEIGHT + 20 || bullet.x < -40 || bullet.x > WORLD_WIDTH + 40) {
      state.alienBullets.splice(i, 1);
      continue;
    }
    if (updateBunkersWithBullet(bullet)) {
      state.alienBullets.splice(i, 1);
      continue;
    }
    if (state.invulnerableTimer <= 0) {
      const playerRect = { x: state.player.x, y: state.player.y, width: state.player.width, height: state.player.height };
      if (aabbIntersect(bullet, playerRect)) {
        state.alienBullets.splice(i, 1);
        loseLife();
        continue;
      }
    }
  }
}

function updatePowerUps(dt) {
  for (let i = state.powerUps.length - 1; i >= 0; i--) {
    const p = state.powerUps[i];
    p.y += p.vy * dt;
    if (p.y > WORLD_HEIGHT) {
      state.powerUps.splice(i, 1);
      continue;
    }
    const rect = { x: p.x, y: p.y, width: p.width, height: p.height };
    const playerRect = { x: state.player.x, y: state.player.y, width: state.player.width, height: state.player.height };
    if (aabbIntersect(rect, playerRect)) {
      state.powerUps.splice(i, 1);
      applyPowerUp(p.type);
    }
  }
}

function updateMothership(dt) {
  state.mothershipTimer -= dt;
  if (state.mothershipTimer <= 0 && !state.mothership) {
    const fromLeft = Math.random() < 0.5;
    state.mothership = {
      x: fromLeft ? -60 : WORLD_WIDTH + 60,
      y: 48,
      width: 64,
      height: 28,
      vx: fromLeft ? 120 : -120,
      hp: 3,
    };
    state.mothershipTimer = 18 - Math.min(8, state.wave * 1.2);
  }
  if (state.mothership) {
    state.mothership.x += state.mothership.vx * dt;
    if (state.mothership.x < -120 || state.mothership.x > WORLD_WIDTH + 120) {
      state.mothership = null;
    }
  }
}

function updatePlayer(dt) {
  let move = 0;
  if (isKeyDown('ArrowLeft') || isKeyDown('KeyA')) move -= 1;
  if (isKeyDown('ArrowRight') || isKeyDown('KeyD')) move += 1;
  state.player.x += move * state.player.speed * dt;
  state.player.x = Math.max(20, Math.min(WORLD_WIDTH - state.player.width - 20, state.player.x));
  if (isKeyDown('Space') || isKeyDown('KeyW')) {
    firePlayer();
  }
  state.player.cooldownTimer = Math.max(0, state.player.cooldownTimer - dt);
  state.player.rapidTimer = Math.max(0, state.player.rapidTimer - dt);
  state.player.spreadTimer = Math.max(0, state.player.spreadTimer - dt);
  state.player.pierceTimer = Math.max(0, state.player.pierceTimer - dt);
  state.invulnerableTimer = Math.max(0, state.invulnerableTimer - dt);
}

function update(dt) {
  if (state.gamePhase === 'game-over') {
    for (let i = state.floatingText.length - 1; i >= 0; i--) {
      const ft = state.floatingText[i];
      ft.y -= dt * 10;
      ft.life -= dt;
      if (ft.life <= 0) state.floatingText.splice(i, 1);
    }
    return;
  }
  if (state.gamePhase === 'wave-clear') {
    for (let i = state.floatingText.length - 1; i >= 0; i--) {
      const ft = state.floatingText[i];
      ft.y -= dt * 10;
      ft.life -= dt;
      if (ft.life <= 0) state.floatingText.splice(i, 1);
    }
    return;
  }

  updatePlayer(dt);
  updateAliens(dt);
  updateBullets(dt);
  updateAlienBullets(dt);
  updatePowerUps(dt);
  updateMothership(dt);

  if (state.mothership) {
    const rect = { x: state.mothership.x, y: state.mothership.y, width: state.mothership.width, height: state.mothership.height };
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const bullet = state.bullets[i];
      if (aabbIntersect(bullet, rect)) {
        state.mothership.hp -= 1;
        state.bullets.splice(i, 1);
        if (state.mothership.hp <= 0) {
          state.score += 400;
          spawnFloatingText('+400', state.mothership.x + state.mothership.width / 2, state.mothership.y, '#f472b6');
          spawnPowerUp(state.mothership.x + state.mothership.width / 2 - 13, state.mothership.y + state.mothership.height);
          state.mothership = null;
        }
        break;
      }
    }
  }

  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem(LOCAL_STORAGE_KEY, String(state.highScore));
  }

  for (let i = state.floatingText.length - 1; i >= 0; i--) {
    const ft = state.floatingText[i];
    ft.y -= dt * 20;
    ft.life -= dt;
    if (ft.life <= 0) state.floatingText.splice(i, 1);
  }
}

function drawBackground() {
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = '#0f172a';
  for (let i = 0; i < 80; i++) {
    const x = (i * 91) % WORLD_WIDTH;
    const y = (i * 173) % WORLD_HEIGHT;
    ctx.fillRect(x, y, 2, 2);
  }
}

function renderAliens() {
  for (const alien of state.aliens) {
    drawRect(ctx, alien.x, alien.y, alien.w, alien.h, alien.color);
    if (alien.hp > 1) {
      drawRect(ctx, alien.x + 4, alien.y + alien.h - 4, alien.w - 8, 3, '#0f172a');
    }
  }
}

function renderBunkers() {
  for (const bunker of state.bunkers) {
    for (const cell of bunker.cells) {
      const shade = 0.4 + cell.hp * 0.12;
      drawRect(ctx, cell.x, cell.y, cell.size, cell.size, `rgba(148,163,184,${shade})`);
    }
  }
}

function renderBullets() {
  for (const bullet of state.bullets) {
    drawRect(ctx, bullet.x, bullet.y, bullet.width, bullet.height, '#f8fafc');
  }
  for (const bullet of state.alienBullets) {
    drawRect(ctx, bullet.x, bullet.y, bullet.width, bullet.height, bullet.color ?? '#f87171');
  }
}

function renderPowerUps() {
  for (const power of state.powerUps) {
    drawRect(ctx, power.x, power.y, power.width, power.height, power.color);
    drawText(ctx, POWER_UPS[power.type].label, power.x + power.width / 2, power.y + 2, {
      color: '#0f172a',
      font: '10px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
  }
}

function renderMothership() {
  if (!state.mothership) return;
  drawRect(ctx, state.mothership.x, state.mothership.y, state.mothership.width, state.mothership.height, '#f472b6');
  drawRect(ctx, state.mothership.x + 6, state.mothership.y + 6, state.mothership.width - 12, 4, '#be123c');
}

function renderHUD() {
  drawText(ctx, `Score ${state.score}`, 16, 12, { color: '#e2e8f0', font: '16px "JetBrains Mono", monospace' });
  drawText(ctx, `High ${state.highScore}`, 16, 30, { color: '#64748b', font: '12px "JetBrains Mono", monospace' });
  drawText(ctx, `Lives ${Math.max(0, state.lives + 1)}`, WORLD_WIDTH - 16, 12, { color: '#f87171', font: '16px "JetBrains Mono", monospace', textAlign: 'right' });
  drawText(ctx, `Wave ${state.wave + 1}`, WORLD_WIDTH / 2, 12, { color: '#38bdf8', font: '14px "JetBrains Mono", monospace', textAlign: 'center' });
  let offset = 0;
  if (state.player.rapidTimer > 0) {
    drawText(ctx, `Rapid ${state.player.rapidTimer.toFixed(1)}s`, WORLD_WIDTH - 16, 32 + offset, { color: '#38bdf8', font: '12px "JetBrains Mono", monospace', textAlign: 'right' });
    offset += 16;
  }
  if (state.player.spreadTimer > 0) {
    drawText(ctx, `Spread ${state.player.spreadTimer.toFixed(1)}s`, WORLD_WIDTH - 16, 32 + offset, { color: '#fbbf24', font: '12px "JetBrains Mono", monospace', textAlign: 'right' });
    offset += 16;
  }
  if (state.player.pierceTimer > 0) {
    drawText(ctx, `Pierce ${state.player.pierceTimer.toFixed(1)}s`, WORLD_WIDTH - 16, 32 + offset, { color: '#f472b6', font: '12px "JetBrains Mono", monospace', textAlign: 'right' });
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
  renderAliens();
  renderBunkers();
  renderMothership();
  renderBullets();
  renderPowerUps();
  renderFloatingText();

  drawRect(ctx, state.player.x, state.player.y, state.player.width, state.player.height, state.invulnerableTimer > 0 ? '#38bdf8' : '#22d3ee');

  renderHUD();

  if (state.gamePhase === 'wave-clear') {
    drawText(ctx, 'Wave Cleared!', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, { color: '#facc15', font: '32px "JetBrains Mono", monospace', textAlign: 'center' });
    drawText(ctx, 'Press Space to launch the next fleet', WORLD_WIDTH / 2, WORLD_HEIGHT / 2, { color: '#94a3b8', font: '16px "JetBrains Mono", monospace', textAlign: 'center' });
  }

  if (state.gamePhase === 'game-over') {
    drawText(ctx, 'Game Over', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, { color: '#f87171', font: '32px "JetBrains Mono", monospace', textAlign: 'center' });
    drawText(ctx, 'Press R to restart', WORLD_WIDTH / 2, WORLD_HEIGHT / 2, { color: '#e2e8f0', font: '16px "JetBrains Mono", monospace', textAlign: 'center' });
  }

  ctx.restore();
}

startGameLoop(update, render);
