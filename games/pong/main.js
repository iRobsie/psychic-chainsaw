import { initCanvas, drawRect, drawText, resizeCanvasToDisplaySize } from '../../game-lib/render/canvas.js';
import { startGameLoop } from '../../game-lib/core/loop.js';
import { initKeyboard, isKeyDown } from '../../game-lib/input/keyboard.js';

const WORLD_WIDTH = 720;
const WORLD_HEIGHT = 540;
const LOCAL_STORAGE_KEY = 'pong-best-streak-v2';

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
  stretch: { color: '#38bdf8', label: 'Stretch', duration: 8 },
  slow: { color: '#f97316', label: 'Slow', duration: 6 },
  multiball: { color: '#facc15', label: 'Twin', duration: 0 },
};

const state = {
  player: { x: 30, y: WORLD_HEIGHT / 2 - 50, width: 14, height: 110, baseHeight: 110, speed: 360, slowTimer: 0, stretchTimer: 0 },
  ai: { x: WORLD_WIDTH - 44, y: WORLD_HEIGHT / 2 - 60, width: 14, height: 110, baseHeight: 110, speed: 340, slowTimer: 0, stretchTimer: 0, error: 0 },
  balls: [],
  score: { player: 0, ai: 0 },
  rally: 0,
  bestRally: Number(localStorage.getItem(LOCAL_STORAGE_KEY)) || 0,
  effects: { player: new Map(), ai: new Map() },
  powerUps: [],
  powerTimer: 4,
  floatingText: [],
  serveToPlayer: true,
  phase: 'serve',
  matchPoint: false,
};

function resetMatch() {
  state.player.y = WORLD_HEIGHT / 2 - state.player.height / 2;
  state.ai.y = WORLD_HEIGHT / 2 - state.ai.height / 2;
  state.balls = [];
  state.score.player = 0;
  state.score.ai = 0;
  state.rally = 0;
  state.powerUps = [];
  state.powerTimer = 3;
  state.effects.player.clear();
  state.effects.ai.clear();
  state.phase = 'serve';
  state.serveToPlayer = true;
  spawnBall(true);
}

function spawnBall(sticky) {
  const direction = sticky ? (state.serveToPlayer ? 1 : -1) : Math.random() < 0.5 ? 1 : -1;
  const speed = 260 + state.score.player * 8 + state.score.ai * 8;
  const ball = {
    x: WORLD_WIDTH / 2 - 10,
    y: WORLD_HEIGHT / 2 - 10,
    width: 12,
    height: 12,
    vx: direction * speed,
    vy: (Math.random() * 2 - 1) * 160,
    sticky,
  };
  state.balls.push(ball);
}

function spawnFloatingText(text, x, y, color = '#f8fafc') {
  state.floatingText.push({ text, x, y, life: 1, color });
}

function spawnPowerUp() {
  const keys = Object.keys(POWER_UPS);
  const type = keys[Math.floor(Math.random() * keys.length)];
  const def = POWER_UPS[type];
  state.powerUps.push({
    x: WORLD_WIDTH / 2 - 16 + (Math.random() * 200 - 100),
    y: WORLD_HEIGHT / 2 - 16 + (Math.random() * 200 - 100),
    width: 32,
    height: 18,
    type,
    color: def.color,
  });
}

function updatePowerTimers(dt) {
  state.powerTimer -= dt;
  if (state.powerTimer <= 0 && state.powerUps.length < 2) {
    spawnPowerUp();
    state.powerTimer = 6 + Math.random() * 4;
  }
}

function applyPowerUp(side, type) {
  const def = POWER_UPS[type];
  const target = side === 'player' ? state.player : state.ai;
  const opponent = side === 'player' ? state.ai : state.player;
  switch (type) {
    case 'stretch':
      if (side === 'player') state.effects.player.set('stretch', def.duration);
      else state.effects.ai.set('stretch', def.duration);
      spawnFloatingText('Stretch!', target.x + target.width / 2, target.y - 20, def.color);
      break;
    case 'slow':
      if (side === 'player') state.effects.ai.set('slow', def.duration);
      else state.effects.player.set('slow', def.duration);
      spawnFloatingText('Slowed!', opponent.x + opponent.width / 2, opponent.y - 20, def.color);
      break;
    case 'multiball':
      if (state.balls.length < 3) {
        const clones = state.balls.map((ball) => ({
          ...ball,
          vx: ball.vx * (Math.random() < 0.5 ? -1 : 1),
          vy: ball.vy + (Math.random() * 120 - 60),
          sticky: false,
        }));
        state.balls.push(...clones);
        spawnFloatingText('Multiball!', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, '#facc15');
      }
      break;
  }
}

function updateEffects(dt) {
  for (const [key, time] of state.effects.player.entries()) {
    const newTime = time - dt;
    if (newTime <= 0) {
      state.effects.player.delete(key);
    } else {
      state.effects.player.set(key, newTime);
    }
  }
  for (const [key, time] of state.effects.ai.entries()) {
    const newTime = time - dt;
    if (newTime <= 0) {
      state.effects.ai.delete(key);
    } else {
      state.effects.ai.set(key, newTime);
    }
  }
  state.player.height += ((state.effects.player.has('stretch') ? state.player.baseHeight * 1.5 : state.player.baseHeight) - state.player.height) * 0.2;
  state.ai.height += ((state.effects.ai.has('stretch') ? state.ai.baseHeight * 1.4 : state.ai.baseHeight) - state.ai.height) * 0.2;
}

function updatePaddles(dt) {
  let input = 0;
  if (isKeyDown('ArrowUp') || isKeyDown('KeyW')) input -= 1;
  if (isKeyDown('ArrowDown') || isKeyDown('KeyS')) input += 1;
  let playerSpeed = state.player.speed;
  if (state.effects.player.has('slow')) playerSpeed *= 0.6;
  if (isKeyDown('ShiftLeft') || isKeyDown('ShiftRight')) playerSpeed *= 1.25;
  state.player.y += input * playerSpeed * dt;
  state.player.y = Math.max(10, Math.min(WORLD_HEIGHT - state.player.height - 10, state.player.y));

  // AI prediction with reaction error
  const targetBall = state.balls.reduce((closest, ball) => {
    if (!closest) return ball;
    const isApproaching = ball.vx > 0;
    const currentApproaching = closest.vx > 0;
    if (isApproaching && !currentApproaching) return ball;
    if (!isApproaching && currentApproaching) return closest;
    const distance = Math.abs(ball.x - state.ai.x);
    const closestDistance = Math.abs(closest.x - state.ai.x);
    return distance < closestDistance ? ball : closest;
  }, null);

  if (targetBall) {
    const predictionTime = Math.abs((state.ai.x - targetBall.x) / (targetBall.vx || 1));
    const predictedY = targetBall.y + targetBall.vy * predictionTime + state.ai.error;
    const center = state.ai.y + state.ai.height / 2;
    const diff = predictedY - center;
    let aiSpeed = state.ai.speed;
    if (state.effects.ai.has('slow')) aiSpeed *= 0.6;
    state.ai.y += Math.sign(diff) * aiSpeed * dt;
    state.ai.error += (Math.random() - 0.5) * 60 * dt;
    state.ai.y = Math.max(10, Math.min(WORLD_HEIGHT - state.ai.height - 10, state.ai.y));
  }
}

function handleServeInput() {
  if (state.phase === 'serve' && (isKeyDown('Space') || isKeyDown('Enter'))) {
    for (const ball of state.balls) {
      ball.sticky = false;
    }
    state.phase = 'rally';
  }
}

function updateBalls(dt) {
  for (let i = state.balls.length - 1; i >= 0; i--) {
    const ball = state.balls[i];
    if (ball.sticky) {
      ball.x = state.serveToPlayer ? state.player.x + state.player.width + 6 : state.ai.x - ball.width - 6;
      ball.y = (state.serveToPlayer ? state.player.y : state.ai.y) + (state.serveToPlayer ? state.player.height : state.ai.height) / 2 - ball.height / 2;
      continue;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy *= -1;
    } else if (ball.y + ball.height >= WORLD_HEIGHT) {
      ball.y = WORLD_HEIGHT - ball.height;
      ball.vy *= -1;
    }

    const playerRect = { x: state.player.x, y: state.player.y, width: state.player.width, height: state.player.height };
    const aiRect = { x: state.ai.x, y: state.ai.y, width: state.ai.width, height: state.ai.height };

    if (
      ball.x <= playerRect.x + playerRect.width &&
      ball.x >= playerRect.x &&
      ball.y + ball.height > playerRect.y &&
      ball.y < playerRect.y + playerRect.height &&
      ball.vx < 0
    ) {
      ball.x = playerRect.x + playerRect.width;
      const relative = (ball.y + ball.height / 2 - (playerRect.y + playerRect.height / 2)) / (playerRect.height / 2);
      const bounceAngle = relative * (Math.PI / 3);
      const speed = Math.min(520, Math.hypot(ball.vx, ball.vy) * 1.05 + Math.abs(relative) * 40);
      ball.vx = Math.cos(bounceAngle) * speed;
      ball.vy = Math.sin(bounceAngle) * speed;
      state.rally += 1;
      spawnFloatingText('Ping!', ball.x + ball.width / 2, ball.y - 16, '#38bdf8');
    } else if (
      ball.x + ball.width >= aiRect.x &&
      ball.x + ball.width <= aiRect.x + aiRect.width &&
      ball.y + ball.height > aiRect.y &&
      ball.y < aiRect.y + aiRect.height &&
      ball.vx > 0
    ) {
      ball.x = aiRect.x - ball.width;
      const relative = (ball.y + ball.height / 2 - (aiRect.y + aiRect.height / 2)) / (aiRect.height / 2);
      const bounceAngle = relative * (Math.PI / 3);
      const speed = Math.min(520, Math.hypot(ball.vx, ball.vy) * 1.05 + Math.abs(relative) * 40);
      ball.vx = -Math.cos(bounceAngle) * speed;
      ball.vy = Math.sin(bounceAngle) * speed;
      state.rally += 1;
      spawnFloatingText('Pong!', ball.x + ball.width / 2, ball.y - 16, '#f97316');
    }

    for (let p = state.powerUps.length - 1; p >= 0; p--) {
      const power = state.powerUps[p];
      if (
        ball.x < power.x + power.width &&
        ball.x + ball.width > power.x &&
        ball.y < power.y + power.height &&
        ball.y + ball.height > power.y
      ) {
        const side = ball.vx > 0 ? 'ai' : 'player';
        state.powerUps.splice(p, 1);
        applyPowerUp(side, power.type);
      }
    }

    if (ball.x + ball.width < 0) {
      state.balls.splice(i, 1);
      scorePoint('ai');
    } else if (ball.x > WORLD_WIDTH) {
      state.balls.splice(i, 1);
      scorePoint('player');
    }
  }
}

function scorePoint(side) {
  if (state.balls.length > 0) return; // wait until all multiballs resolve
  if (state.rally > state.bestRally) {
    state.bestRally = state.rally;
    localStorage.setItem(LOCAL_STORAGE_KEY, String(state.bestRally));
  }
  if (side === 'player') state.score.player += 1; else state.score.ai += 1;
  const servePlayer = side === 'ai';
  state.serveToPlayer = servePlayer;
  state.rally = 0;
  state.powerUps = [];
  state.powerTimer = 4;
  state.effects.player.delete('slow');
  state.effects.ai.delete('slow');
  state.phase = 'serve';
  spawnBall(true);
  checkMatchPoint();
  if (state.phase === 'match-over') {
    state.balls = [];
  }
}

function checkMatchPoint() {
  const maxScore = Math.max(state.score.player, state.score.ai);
  const leading = state.score.player === maxScore ? 'player' : 'ai';
  const trailing = leading === 'player' ? state.score.ai : state.score.player;
  state.matchPoint = maxScore >= 10 && maxScore - trailing >= 1;
  if (maxScore >= 11 && Math.abs(state.score.player - state.score.ai) >= 2) {
    state.phase = 'match-over';
    spawnFloatingText('Match over!', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, '#f8fafc');
  }
}

function updateFloatingText(dt) {
  for (let i = state.floatingText.length - 1; i >= 0; i--) {
    const ft = state.floatingText[i];
    ft.y -= dt * 30;
    ft.life -= dt;
    if (ft.life <= 0) state.floatingText.splice(i, 1);
  }
}

function update(dt) {
  if (state.phase === 'match-over') {
    updateFloatingText(dt);
    if (isKeyDown('KeyR')) {
      resetMatch();
    }
    return;
  }

  updateEffects(dt);
  updatePowerTimers(dt);
  updatePaddles(dt);
  handleServeInput();
  updateBalls(dt);
  updateFloatingText(dt);
}

function drawBackground() {
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.strokeStyle = 'rgba(148,163,184,0.4)';
  ctx.setLineDash([12, 12]);
  ctx.beginPath();
  ctx.moveTo(WORLD_WIDTH / 2, 0);
  ctx.lineTo(WORLD_WIDTH / 2, WORLD_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);
}

function renderPaddles() {
  drawRect(ctx, state.player.x, state.player.y, state.player.width, state.player.height, state.effects.player.has('slow') ? '#475569' : '#22d3ee');
  drawRect(ctx, state.ai.x, state.ai.y, state.ai.width, state.ai.height, state.effects.ai.has('slow') ? '#7f1d1d' : '#f97316');
}

function renderBalls() {
  for (const ball of state.balls) {
    drawRect(ctx, ball.x, ball.y, ball.width, ball.height, '#f8fafc');
  }
}

function renderPowerUps() {
  for (const power of state.powerUps) {
    drawRect(ctx, power.x, power.y, power.width, power.height, power.color);
    drawText(ctx, POWER_UPS[power.type].label, power.x + power.width / 2, power.y + 2, {
      color: '#0f172a',
      font: '12px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
  }
}

function renderHUD() {
  drawText(ctx, `${state.score.player}`, WORLD_WIDTH / 2 - 60, 20, { color: '#22d3ee', font: '32px "JetBrains Mono", monospace', textAlign: 'right' });
  drawText(ctx, `${state.score.ai}`, WORLD_WIDTH / 2 + 60, 20, { color: '#f97316', font: '32px "JetBrains Mono", monospace' });
  drawText(ctx, `Best rally ${state.bestRally}`, WORLD_WIDTH / 2, 60, { color: '#facc15', font: '14px "JetBrains Mono", monospace', textAlign: 'center' });
  if (state.matchPoint && state.phase !== 'match-over') {
    drawText(ctx, 'Match point!', WORLD_WIDTH / 2, 80, { color: '#f87171', font: '16px "JetBrains Mono", monospace', textAlign: 'center' });
  }
  if (state.phase === 'serve') {
    drawText(ctx, state.serveToPlayer ? 'Your serve - press Space' : 'AI serve - get ready', WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 30, {
      color: '#94a3b8',
      font: '16px "JetBrains Mono", monospace',
      textAlign: 'center',
    });
  }
  if (state.phase === 'match-over') {
    const winner = state.score.player > state.score.ai ? 'You win!' : 'AI wins';
    drawText(ctx, winner, WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, { color: '#f8fafc', font: '28px "JetBrains Mono", monospace', textAlign: 'center' });
    drawText(ctx, 'Press R to restart', WORLD_WIDTH / 2, WORLD_HEIGHT / 2, { color: '#94a3b8', font: '16px "JetBrains Mono", monospace', textAlign: 'center' });
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
  renderPaddles();
  renderBalls();
  renderPowerUps();
  renderFloatingText();
  renderHUD();
  ctx.restore();
}

resetMatch();
startGameLoop(update, render);
