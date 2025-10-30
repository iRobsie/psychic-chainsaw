export const ALIEN_TYPES = {
  A: { hp: 1, score: 40, color: '#f97316', fireRate: 0.08 },
  B: { hp: 2, score: 80, color: '#facc15', fireRate: 0.1 },
  C: { hp: 3, score: 120, color: '#38bdf8', fireRate: 0.12 },
  D: { hp: 4, score: 180, color: '#c084fc', fireRate: 0.14 },
  E: { hp: 5, score: 260, color: '#ef4444', fireRate: 0.18 },
};

export const FORMATIONS = [
  {
    name: 'Vanguard',
    pattern: [
      '...AAAAAA...',
      '..ABBBBBBA..',
      '.ABBCCCCBBA.',
      '.ABBCCCCBBA.',
      '..ABBBBBBA..',
      '...AAAAAA...'
    ],
  },
  {
    name: 'Nebula Bloom',
    pattern: [
      '..BBCCCCBB..',
      '.BCCDDEEBCC.',
      'ACDDEEEEEDCA',
      'ACDDEEEEEDCA',
      '.BCCDDEEBCC.',
      '..BBCCCCBB..'
    ],
  },
  {
    name: 'Binary Lance',
    pattern: [
      '...CCC...',
      '..CDDDC..',
      '.CDDEEDC.',
      'CDDEEEEDC',
      '.CDDEEDC.',
      '..CDDDC..',
      '...CCC...'
    ],
  },
  {
    name: 'Solar Net',
    pattern: [
      'AABBBBAA',
      'ABBCCBBA',
      'BCCDCCCB',
      'CCDDEDDC',
      'DDEEEEDD',
    ],
  },
];

export function createFormation(waveIndex, worldWidth) {
  const blueprint = FORMATIONS[waveIndex % FORMATIONS.length];
  const cols = Math.max(...blueprint.pattern.map((row) => row.length));
  const rows = blueprint.pattern.length;
  const marginX = 70;
  const marginTop = 60;
  const hSpacing = 46;
  const vSpacing = 36;
  const offsetX = (worldWidth - (cols - 1) * hSpacing) / 2 - 18;
  const aliens = [];
  for (let r = 0; r < rows; r++) {
    const row = blueprint.pattern[r];
    for (let c = 0; c < row.length; c++) {
      const char = row[c];
      if (char === '.' || !ALIEN_TYPES[char]) continue;
      const def = ALIEN_TYPES[char];
      aliens.push({
        x: offsetX + c * hSpacing,
        y: marginTop + r * vSpacing,
        w: 32,
        h: 24,
        type: char,
        hp: def.hp,
        maxHp: def.hp,
        score: def.score,
        color: def.color,
        fireRate: def.fireRate,
      });
    }
  }
  return { aliens, blueprint };
}
