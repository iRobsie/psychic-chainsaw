import { initCanvas, drawCircle, drawText, resizeCanvasToDisplaySize } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { initKeyboard, isKeyDown } from '../../game-lib/input/keyboard.js';

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 540;
const LOCAL_STORAGE_KEY = 'bullet-hell-best-v2';

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
  player: {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT * 0.75,
    radius: 11,
    speed: 260,
    dashSpeed: 620,
    dashTime: 0,
    dashDir: { x: 0, y: -1 },
  },
  bullets: [],
  telegraphs: [],
  energyOrbs: [],
  particles: [],
  floatingText: [],
  survivalTime: 0,
  highScore: Number(localStorage.getItem(LOCAL_STORAGE_KEY)) || 0,
  difficultyTier: 0,
  gameOver: false,
  invulnerableTime: 0,
  dashCharges: 2,
  dashMax: 3,
  dashRechargeTimer: 0,
  stageTimer: 0,
  stageBannerTimer: 0,
  stageIndex: 0,
  score: 0,
  energyCollected: 0,
  inputVector: { x: 0, y: 0 },
  lastMoveVector: { x: 0, y: -1 },
  ringTimer: 0,
  spiralTimer: 0,
  edgeTimer: 0,
  sweepTimer: 0,
  orbTimer: 5,
};

function resetGame() {
  state.player.x = WORLD_WIDTH / 2;
  state.player.y = WORLD_HEIGHT * 0.75;
  state.player.dashTime = 0;
  state.bullets.length = 0;
  state.telegraphs.length = 0;
  state.energyOrbs.length = 0;
  state.particles.length = 0;
  state.floatingText.length = 0;
  state.survivalTime = 0;
  state.score = 0;
  state.energyCollected = 0;
  state.difficultyTier = 0;
  state.gameOver = false;
  state.invulnerableTime = 1.2;
  state.dashCharges = 2;
  state.dashRechargeTimer = 0;
  state.stageTimer = 0;
  state.stageBannerTimer = 2.5;
  state.stageIndex = 0;
  state.ringTimer = 0;
  state.spiralTimer = 0;
  state.edgeTimer = 0;
  state.sweepTimer = 0;
  state.orbTimer = 4;
}

resetGame();

function spawnFloatingText(text, x, y, color = '#bfdbfe') {
  state.floatingText.push({ text, x, y, life: 1.2, color });
}

function attemptDash() {
  if (state.dashCharges <= 0 || state.player.dashTime > 0 || state.gameOver) return;
  const dir = { ...state.lastMoveVector };
  if (dir.x === 0 && dir.y === 0) {
    dir.y = -1;
  }
  const length = Math.hypot(dir.x, dir.y) || 1;
  state.player.dashDir = { x: dir.x / length, y: dir.y / length };
  state.player.dashTime = 0.22;
  state.invulnerableTime = Math.max(state.invulnerableTime, 0.3);
  state.dashCharges -= 1;
  state.dashRechargeTimer = 0;
  spawnFloatingText('DASH', state.player.x, state.player.y - 28, '#bae6fd');
}

window.addEventListener('keydown', (event) => {
  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'Space') {
    attemptDash();
  }
  if (event.code === 'KeyR' && state.gameOver) {
    resetGame();
  }
});

function spawnBullet(properties) {
  state.bullets.push({
    x: properties.x,
    y: properties.y,
    vx: properties.vx ?? 0,
    vy: properties.vy ?? 0,
    radius: properties.radius ?? 6,
    color: properties.color ?? '#f87171',
    life: properties.life ?? 10,
    behaviour: properties.behaviour ?? 'linear',
    data: properties.data ?? {},
  });
}

function spawnRingTelegraph(delay, segments, gapAngle = 0) {
  state.telegraphs.push({
    type: 'ring',
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    delay,
    segments,
    gapAngle,
    life: delay,
  });
}

function spawnEdgeTelegraph(delay, origin) {
  state.telegraphs.push({
    type: 'edge',
    origin,
    delay,
    life: delay,
  });
}

function spawnSweepTelegraph(delay, angleStart, angleEnd) {
  state.telegraphs.push({
    type: 'sweep',
    delay,
    life: delay,
    angleStart,
    angleEnd,
  });
}

function updateTelegraphs(dt) {
  for (let i = state.telegraphs.length - 1; i >= 0; i--) {
    const tele = state.telegraphs[i];
    tele.life -= dt;
    if (tele.life <= 0) {
      if (tele.type === 'ring') {
        const centerX = WORLD_WIDTH / 2;
        const centerY = WORLD_HEIGHT / 2;
        const bulletCount = tele.segments;
        const speed = 140 + state.difficultyTier * 30;
        const gap = tele.gapAngle;
        for (let j = 0; j < bulletCount; j++) {
          const angle = (j / bulletCount) * Math.PI * 2;
          if (gap && Math.abs(Math.atan2(Math.sin(angle - gap), Math.cos(angle - gap))) < (Math.PI / bulletCount) * 1.5) continue;
          spawnBullet({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 5,
            color: '#fb7185',
          });
        }
      } else if (tele.type === 'edge') {
        const speed = 200 + state.difficultyTier * 25;
        const origin = tele.origin;
        const emitPoints = {
          top: { x: WORLD_WIDTH / 2, y: -20, angleBase: Math.PI / 2 },
          bottom: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT + 20, angleBase: -Math.PI / 2 },
          left: { x: -20, y: WORLD_HEIGHT / 2, angleBase: 0 },
          right: { x: WORLD_WIDTH + 20, y: WORLD_HEIGHT / 2, angleBase: Math.PI },
        };
        const { x, y, angleBase } = emitPoints[origin];
        const waves = 7 + state.difficultyTier * 2;
        for (let k = 0; k < waves; k++) {
          const offset = (k / waves - 0.5) * 0.7;
          const angle = angleBase + offset;
          spawnBullet({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 5,
            color: '#38bdf8',
          });
        }
      } else if (tele.type === 'sweep') {
        const bullets = 60;
        const center = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 };
        const baseSpeed = 120 + state.difficultyTier * 30;
        for (let b = 0; b < bullets; b++) {
          const t = b / (bullets - 1);
          const angle = tele.angleStart + (tele.angleEnd - tele.angleStart) * t;
          spawnBullet({
            x: center.x + Math.cos(angle) * 40,
            y: center.y + Math.sin(angle) * 40,
            vx: Math.cos(angle) * baseSpeed,
            vy: Math.sin(angle) * baseSpeed,
            radius: 5,
            color: '#facc15',
          });
        }
      }
      state.telegraphs.splice(i, 1);
    }
  }
}

function updateBullets(dt) {
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.life -= dt;
    if (b.life <= 0) {
      state.bullets.splice(i, 1);
      continue;
    }
    if (b.behaviour === 'orbit') {
      b.data.angle += b.data.angularSpeed * dt;
      b.data.radius += b.data.radialSpeed * dt;
      b.x = b.data.centerX + Math.cos(b.data.angle) * b.data.radius;
      b.y = b.data.centerY + Math.sin(b.data.angle) * b.data.radius;
    } else if (b.behaviour === 'sine') {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.data.phase += dt * b.data.frequency;
      b.x += Math.sin(b.data.phase) * b.data.amplitude * dt;
    } else {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    if (b.x < -80 || b.x > WORLD_WIDTH + 80 || b.y < -80 || b.y > WORLD_HEIGHT + 80) {
      state.bullets.splice(i, 1);
      continue;
    }

    if (state.gameOver) continue;
    if (state.invulnerableTime > 0) continue;
    const dx = b.x - state.player.x;
    const dy = b.y - state.player.y;
    const distSq = dx * dx + dy * dy;
    const rad = b.radius + state.player.radius * 0.85;
    if (distSq < rad * rad) {
      state.gameOver = true;
      spawnFloatingText('HIT!', state.player.x, state.player.y - 32, '#f87171');
    }
  }
}

function spawnEnergyOrb() {
  const angle = Math.random() * Math.PI * 2;
  const radius = 160 + Math.random() * 120;
  const centerX = WORLD_WIDTH / 2;
  const centerY = WORLD_HEIGHT / 2;
  const x = centerX + Math.cos(angle) * radius;
  const y = centerY + Math.sin(angle) * radius;
  state.energyOrbs.push({
    x,
    y,
    radius: 8,
    pulse: 0,
    life: 10,
  });
}

function updateEnergyOrbs(dt) {
  state.orbTimer -= dt;
  if (state.orbTimer <= 0) {
    spawnEnergyOrb();
    state.orbTimer = 6 - Math.min(state.difficultyTier, 4);
  }
  for (let i = state.energyOrbs.length - 1; i >= 0; i--) {
    const orb = state.energyOrbs[i];
    orb.life -= dt;
    orb.pulse += dt * 4;
    if (orb.life <= 0) {
      state.energyOrbs.splice(i, 1);
      continue;
    }
    const dx = orb.x - state.player.x;
    const dy = orb.y - state.player.y;
    const distSq = dx * dx + dy * dy;
    const radius = orb.radius + state.player.radius;
    if (distSq < radius * radius) {
      state.energyOrbs.splice(i, 1);
      state.energyCollected += 1;
      state.score += 80;
      state.dashCharges = Math.min(state.dashMax, state.dashCharges + 1);
      state.invulnerableTime = Math.max(state.invulnerableTime, 0.2);
      spawnFloatingText('ENERGY +', state.player.x, state.player.y - 20, '#fbbf24');
    }
  }
}

function emitSpiral(dt) {
  state.spiralTimer += dt;
  const interval = 0.06 - Math.min(state.difficultyTier * 0.005, 0.03);
  while (state.spiralTimer >= interval) {
    state.spiralTimer -= interval;
    const angle = (state.survivalTime * 1.5 + state.spiralTimer * 6) % (Math.PI * 2);
    const speed = 130 + state.difficultyTier * 24;
    spawnBullet({
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 4,
      color: '#38bdf8',
      behaviour: 'sine',
      data: { phase: angle, amplitude: 26 + state.difficultyTier * 4, frequency: 3 + state.difficultyTier * 0.4 },
    });
  }
}

function emitRings(dt) {
  state.ringTimer += dt;
  const cadence = Math.max(3.8 - state.difficultyTier * 0.4, 2.2);
  if (state.ringTimer >= cadence) {
    state.ringTimer = 0;
    const gap = Math.random() * Math.PI * 2;
    spawnRingTelegraph(0.8, 36 + state.difficultyTier * 4, gap);
  }
}

function emitEdgeBursts(dt) {
  state.edgeTimer += dt;
  const cadence = Math.max(5 - state.difficultyTier * 0.5, 2.5);
  if (state.edgeTimer >= cadence) {
    state.edgeTimer = 0;
    const origins = ['top', 'bottom', 'left', 'right'];
    const count = 1 + Math.min(state.difficultyTier, 3);
    for (let i = 0; i < count; i++) {
      spawnEdgeTelegraph(0.6 + i * 0.15, origins[(state.stageIndex + i) % origins.length]);
    }
  }
}

function emitSweeps(dt) {
  state.sweepTimer += dt;
  const cadence = Math.max(7 - state.difficultyTier * 0.6, 3.6);
  if (state.sweepTimer >= cadence) {
    state.sweepTimer = 0;
    const angle = Math.random() * Math.PI * 2;
    const direction = Math.random() < 0.5 ? 1 : -1;
    spawnSweepTelegraph(0.9, angle, angle + direction * (Math.PI * 1.2));
  }
}

function updateDifficulty(dt) {
  const thresholds = [0, 18, 40, 70, 110];
  let tier = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (state.survivalTime >= thresholds[i]) tier = i;
  }
  if (tier !== state.difficultyTier) {
    state.difficultyTier = tier;
    state.stageBannerTimer = 3;
    state.stageIndex += 1;
    spawnFloatingText(`WAVE ${tier + 1}`, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, '#f8fafc');
  }
}

function updatePlayer(dt) {
  state.inputVector.x = 0;
  state.inputVector.y = 0;
  if (isKeyDown('ArrowLeft') || isKeyDown('KeyA')) state.inputVector.x -= 1;
  if (isKeyDown('ArrowRight') || isKeyDown('KeyD')) state.inputVector.x += 1;
  if (isKeyDown('ArrowUp') || isKeyDown('KeyW')) state.inputVector.y -= 1;
  if (isKeyDown('ArrowDown') || isKeyDown('KeyS')) state.inputVector.y += 1;

  let length = Math.hypot(state.inputVector.x, state.inputVector.y);
  if (length > 0) {
    state.lastMoveVector.x = state.inputVector.x;
    state.lastMoveVector.y = state.inputVector.y;
    state.inputVector.x /= length;
    state.inputVector.y /= length;
  }

  if (state.player.dashTime > 0) {
    const delta = Math.min(state.player.dashTime, dt);
    state.player.x += state.player.dashDir.x * state.player.dashSpeed * delta;
    state.player.y += state.player.dashDir.y * state.player.dashSpeed * delta;
    state.player.dashTime -= dt;
    // Add dash particles
    state.particles.push({ x: state.player.x, y: state.player.y, life: 0.3, radius: 5, color: '#bae6fd' });
  } else {
    const speed = state.player.speed * (isKeyDown('KeyZ') ? 0.6 : 1);
    state.player.x += state.inputVector.x * speed * dt;
    state.player.y += state.inputVector.y * speed * dt;
  }

  state.player.x = Math.max(state.player.radius, Math.min(WORLD_WIDTH - state.player.radius, state.player.x));
  state.player.y = Math.max(state.player.radius, Math.min(WORLD_HEIGHT - state.player.radius, state.player.y));
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.radius += dt * 24;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

function update(dt) {
  if (state.gameOver) {
    return;
  }
  state.survivalTime += dt;
  state.stageTimer += dt;
  state.score = Math.floor(state.survivalTime * 15 + state.energyCollected * 150);
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem(LOCAL_STORAGE_KEY, String(state.highScore));
  }
  state.invulnerableTime = Math.max(0, state.invulnerableTime - dt);
  state.dashRechargeTimer += dt;
  if (state.dashRechargeTimer >= 5.5) {
    state.dashRechargeTimer = 0;
    state.dashCharges = Math.min(state.dashMax, state.dashCharges + 1);
    spawnFloatingText('Dash +', state.player.x, state.player.y - 18, '#34d399');
  }

  updatePlayer(dt);
  emitSpiral(dt);
  emitRings(dt);
  if (state.difficultyTier >= 1) emitEdgeBursts(dt);
  if (state.difficultyTier >= 2) emitSweeps(dt);

  updateTelegraphs(dt);
  updateBullets(dt);
  updateEnergyOrbs(dt);
  updateParticles(dt);
  updateDifficulty(dt);

  for (let i = state.floatingText.length - 1; i >= 0; i--) {
    const ft = state.floatingText[i];
    ft.y -= dt * 24;
    ft.life -= dt;
    if (ft.life <= 0) state.floatingText.splice(i, 1);
  }
}

function drawBackground() {
  const gradient = ctx.createRadialGradient(
    WORLD_WIDTH / 2,
    WORLD_HEIGHT / 2,
    40,
    WORLD_WIDTH / 2,
    WORLD_HEIGHT / 2,
    WORLD_WIDTH / 1.2
  );
  gradient.addColorStop(0, '#020617');
  gradient.addColorStop(1, '#0f172a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function renderTelegraphs() {
  for (const tele of state.telegraphs) {
    const alpha = Math.max(0, tele.life / Math.max(tele.delay, 0.0001));
    if (tele.type === 'ring') {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(248,113,113,${alpha})`;
      ctx.lineWidth = 3;
      ctx.arc(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 60 + (1 - alpha) * 140, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tele.type === 'edge') {
      ctx.strokeStyle = `rgba(56,189,248,${alpha})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      if (tele.origin === 'top') {
        ctx.moveTo(0, 20);
        ctx.lineTo(WORLD_WIDTH, 20);
      } else if (tele.origin === 'bottom') {
        ctx.moveTo(0, WORLD_HEIGHT - 20);
        ctx.lineTo(WORLD_WIDTH, WORLD_HEIGHT - 20);
      } else if (tele.origin === 'left') {
        ctx.moveTo(20, 0);
        ctx.lineTo(20, WORLD_HEIGHT);
      } else if (tele.origin === 'right') {
        ctx.moveTo(WORLD_WIDTH - 20, 0);
        ctx.lineTo(WORLD_WIDTH - 20, WORLD_HEIGHT);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (tele.type === 'sweep') {
      ctx.strokeStyle = `rgba(250,204,21,${alpha})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 140, tele.angleStart, tele.angleEnd);
      ctx.stroke();
    }
  }
}

function renderBullets() {
  for (const b of state.bullets) {
    drawCircle(ctx, b.x, b.y, b.radius, b.color);
  }
}

function renderEnergyOrbs() {
  for (const orb of state.energyOrbs) {
    const alpha = 0.5 + Math.sin(orb.pulse) * 0.3;
    drawCircle(ctx, orb.x, orb.y, orb.radius + Math.sin(orb.pulse) * 2, `rgba(251,191,36,${alpha})`);
  }
}

function renderParticles() {
  for (const p of state.particles) {
    drawCircle(ctx, p.x, p.y, p.radius, `rgba(186,230,253,${Math.max(p.life / 0.3, 0)})`);
  }
}

function renderPlayer() {
  const invulnerable = state.invulnerableTime > 0;
  drawCircle(ctx, state.player.x, state.player.y, state.player.radius + (invulnerable ? 2 : 0), invulnerable ? 'rgba(96,165,250,0.5)' : 'rgba(148,163,184,0.3)');
  drawCircle(ctx, state.player.x, state.player.y, state.player.radius, '#f8fafc');
}

function renderHUD() {
  drawText(ctx, `Time ${state.survivalTime.toFixed(1)}s`, 16, 12, { color: '#e2e8f0', font: '16px "JetBrains Mono", monospace' });
  drawText(ctx, `Score ${state.score}`, 16, 32, { color: '#94a3b8', font: '14px "JetBrains Mono", monospace' });
  drawText(ctx, `Best ${state.highScore}`, 16, 50, { color: '#64748b', font: '12px "JetBrains Mono", monospace' });
  drawText(ctx, `Energy ${state.energyCollected}`, WORLD_WIDTH - 16, 12, { color: '#fbbf24', font: '16px "JetBrains Mono", monospace', textAlign: 'right' });
  drawText(ctx, `Dash ${state.dashCharges}/${state.dashMax}`, WORLD_WIDTH - 16, 32, { color: '#34d399', font: '14px "JetBrains Mono", monospace', textAlign: 'right' });
  if (state.stageBannerTimer > 0) {
    drawText(ctx, `Wave ${state.difficultyTier + 1}`, WORLD_WIDTH / 2, 18, { color: '#38bdf8', font: '18px "JetBrains Mono", monospace', textAlign: 'center' });
    state.stageBannerTimer -= 0.016;
  }
}

function renderFloatingText() {
  for (const ft of state.floatingText) {
    drawText(ctx, ft.text, ft.x, ft.y, { color: ft.color, font: '14px "JetBrains Mono", monospace', textAlign: 'center' });
  }
}

function render() {
  const scaleX = displayWidth / WORLD_WIDTH;
  const scaleY = displayHeight / WORLD_HEIGHT;
  ctx.save();
  ctx.scale(scaleX, scaleY);
  drawBackground();
  renderTelegraphs();
  renderBullets();
  renderEnergyOrbs();
  renderParticles();
  renderPlayer();
  renderFloatingText();
  renderHUD();

  if (state.gameOver) {
    drawText(ctx, 'Game Over', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 32, { color: '#f87171', font: '32px "JetBrains Mono", monospace', textAlign: 'center' });
    drawText(ctx, 'Press R to restart', WORLD_WIDTH / 2, WORLD_HEIGHT / 2, { color: '#e2e8f0', font: '18px "JetBrains Mono", monospace', textAlign: 'center' });
  }

  ctx.restore();
}

startGameLoop(update, render);
