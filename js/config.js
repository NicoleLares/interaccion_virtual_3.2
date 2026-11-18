// Escala: una unidad de Three.js = un metro.
export const CATEGORIES = [
  { id: 'cubo', name: 'CUBOS', color: 0x4aa3ff, css: '#4aa3ff' },
  { id: 'esfera', name: 'ESFERAS', color: 0x59e3aa, css: '#59e3aa' },
  { id: 'piramide', name: 'PIRÁMIDES', color: 0xffaa66, css: '#ffaa66' },
  { id: 'prisma', name: 'PRISMAS', color: 0xb08aff, css: '#b08aff' }
];

export const TABLES = [
  { id: 'mesa-1', x: -0.73, z: -1.32 },
  { id: 'mesa-2', x: 0.73, z: -1.32 },
  { id: 'mesa-3', x: -0.73, z: -2.15 },
  { id: 'mesa-4', x: 0.73, z: -2.15 }
];

export const TABLE = { width: 1.30, depth: 0.69, centerY: 0.82, thick: 0.10 };
export const TABLE_TOP = TABLE.centerY + TABLE.thick / 2;
export const BIN_X = [-1.08, -0.36, 0.36, 1.08];
export const BIN_Z = -0.47;
export const BIN = { width: 0.60, depth: 0.58, baseY: 0.83, baseThick: 0.06,
  wallHeight: 0.43, wallThick: 0.035 };
export const BIN_FLOOR = BIN.baseY + BIN.baseThick / 2;
export const BIN_RIM = BIN_FLOOR + BIN.wallHeight;
export const FIXED_STEP = 1 / 60;
