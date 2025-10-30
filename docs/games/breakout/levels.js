const DEFAULT_PALETTE = ['#6ad7ff', '#7ee6b7', '#f9f871', '#ff9ec7'];

const DIGIT_MAP = {
  '1': { hitPoints: 1, score: 60, dropBias: 0.0 },
  '2': { hitPoints: 2, score: 90, dropBias: 0.05 },
  '3': { hitPoints: 3, score: 140, dropBias: 0.08 },
  '4': { hitPoints: 4, score: 220, dropBias: 0.12 },
  '5': { hitPoints: 5, score: 320, dropBias: 0.18 },
};

const SPECIAL_MAP = {
  'P': { hitPoints: 1, score: 80, dropBias: 0.6 },
  'S': { hitPoints: 2, score: 120, dropBias: 0.35 },
  'B': { hitPoints: 3, score: 160, dropBias: 0, unbreakable: true },
  'H': { hitPoints: 4, score: 260, dropBias: 0.2 },
};

export const LEVELS = [
  {
    name: 'Neon Garden',
    palette: ['#52d9ff', '#3bccff', '#6cffa6', '#f5f26d'],
    pattern: [
      '...1122211...',
      '..122333221..',
      '.12234543221.',
      '.12234543221.',
      '..122333221..',
      '...1122211...'
    ],
    speedBoost: 1,
    dropBoost: 0.05,
  },
  {
    name: 'Chromatic Canyons',
    palette: ['#ff9de2', '#ffa45b', '#ffd166', '#60d394'],
    pattern: [
      '.1111PP1111.',
      '122233333221',
      '133344543331',
      '13334B543331',
      '122233333221',
      '.1111PP1111.'
    ],
    speedBoost: 1.1,
    dropBoost: 0.08,
  },
  {
    name: 'Lumina Core',
    palette: ['#67e8f9', '#5eead4', '#fca5a5', '#f97316'],
    pattern: [
      'S22233333322S',
      '2333444443332',
      '3344555554433',
      '2333444443332',
      'S22233333322S'
    ],
    speedBoost: 1.2,
    dropBoost: 0.12,
  },
  {
    name: 'Ascendant Prism',
    palette: ['#c084fc', '#a855f7', '#6366f1', '#38bdf8'],
    pattern: [
      '..1234554321..',
      '.1234555554321.',
      '123455B55B54321',
      '.1234555554321.',
      '..1234554321..'
    ],
    speedBoost: 1.35,
    dropBoost: 0.15,
  }
];

function resolveCell(cell) {
  if (cell === '.' || cell === '0') {
    return null;
  }
  if (DIGIT_MAP[cell]) {
    return DIGIT_MAP[cell];
  }
  if (SPECIAL_MAP[cell]) {
    return SPECIAL_MAP[cell];
  }
  // Default fallback for any unknown symbol: treat as normal brick.
  return DIGIT_MAP['1'];
}

export function buildLevel(levelIndex, worldWidth) {
  const level = LEVELS[levelIndex % LEVELS.length];
  const rows = level.pattern.length;
  const cols = Math.max(...level.pattern.map((row) => row.length));
  const paddingX = 32;
  const brickGap = 4;
  const usableWidth = worldWidth - paddingX * 2;
  const brickWidth = usableWidth / cols - brickGap;
  const brickHeight = 20;
  const offsetY = 70;

  const bricks = [];
  for (let r = 0; r < rows; r++) {
    const row = level.pattern[r];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const data = resolveCell(cell);
      if (!data) continue;
      const x = paddingX + c * (brickWidth + brickGap);
      const y = offsetY + r * (brickHeight + brickGap);
      bricks.push({
        x,
        y,
        w: brickWidth,
        h: brickHeight,
        hitPoints: data.hitPoints,
        maxHitPoints: data.hitPoints,
        score: data.score,
        unbreakable: Boolean(data.unbreakable),
        dropBias: data.dropBias ?? 0,
        colorIndex: Math.min(data.hitPoints - 1, (level.palette?.length ?? DEFAULT_PALETTE.length) - 1),
      });
    }
  }

  return {
    bricks,
    level,
    rows,
    cols,
  };
}

export function getBrickColor(brick, palette) {
  const colors = palette?.length ? palette : DEFAULT_PALETTE;
  const index = Math.min(brick.colorIndex ?? (brick.hitPoints - 1), colors.length - 1);
  return colors[index];
}

