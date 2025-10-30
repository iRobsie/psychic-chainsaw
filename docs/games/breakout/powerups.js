export const POWER_UP_DEFS = {
  expand: {
    label: 'Expand',
    color: '#4ade80',
    duration: 12,
  },
  slow: {
    label: 'Stasis',
    color: '#60a5fa',
    duration: 8,
  },
  multiball: {
    label: 'Multi',
    color: '#f97316',
    duration: 0,
  },
  shield: {
    label: 'Shield',
    color: '#c084fc',
    duration: 20,
  },
};

const POWER_UP_TYPES = Object.keys(POWER_UP_DEFS);

export function rollPowerUp(brick, baseChance, bonus) {
  if (brick.unbreakable) return null;
  const chance = baseChance + (brick.dropBias ?? 0) + bonus;
  if (Math.random() > chance) return null;
  const type = POWER_UP_TYPES[Math.floor(Math.random() * POWER_UP_TYPES.length)];
  return type;
}

export function createPowerUp(x, y, type) {
  return {
    x,
    y,
    w: 26,
    h: 12,
    vy: 120,
    type,
    active: true,
  };
}

export function updatePowerUps(powerUps, dt, worldHeight) {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    p.y += p.vy * dt;
    if (p.y > worldHeight + p.h) {
      powerUps.splice(i, 1);
    }
  }
}

export function drawPowerUps(ctx, powerUps) {
  for (const p of powerUps) {
    const def = POWER_UP_DEFS[p.type];
    ctx.fillStyle = def?.color ?? '#fff';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def?.label?.slice(0, 3) ?? p.type.slice(0, 3), p.x + p.w / 2, p.y + p.h / 2 + 1);
    ctx.restore();
  }
}

export function powerUpIntersects(p, rect) {
  return (
    p.x < rect.x + rect.w &&
    p.x + p.w > rect.x &&
    p.y < rect.y + rect.h &&
    p.y + p.h > rect.y
  );
}
