
export const CATEGORIES = [
  { id: 'cubo', name: 'CUBOS', color: 0x4aa3ff, css: '#4aa3ff' },
  { id: 'esfera', name: 'ESFERAS', color: 0x59e3aa, css: '#59e3aa' },
  { id: 'piramide', name: 'PIRÁMIDES', color: 0xffaa66, css: '#ffaa66' },
  { id: 'prisma', name: 'PRISMAS', color: 0xb08aff, css: '#b08aff' }
];

export const TABLES = [
  { id: 'mesa-1', x: -1.01, z: 0.64 },
  { id: 'mesa-2', x: 1.01, z: 0.64 },
  { id: 'mesa-3', x: -1.01, z: -0.17 },
  { id: 'mesa-4', x: 1.01, z: -0.17 }
];

export const TABLE = {
  width: 1.10,
  depth: 0.65,
  centerY: 0.635,
  thick: 0.085
};

export const TABLE_TOP = TABLE.centerY + TABLE.thick / 2;

// Recipientes ampliados y separados.
export const BIN_X = [-1.14, -0.38, 0.38, 1.14];
export const BIN_Z = -1.08;

export const BIN = {
  width: 0.69,
  depth: 0.66,
  baseY: 0.65,
  baseThick: 0.06,
  wallHeight: 0.40,
  wallThick: 0.035
};

export const BIN_FLOOR = BIN.baseY + BIN.baseThick / 2;
export const BIN_RIM = BIN_FLOOR + BIN.wallHeight;

export const WORKSPACE = {
  minX: -2.05,
  maxX: 2.05,
  minZ: -2.25,
  maxZ: 1.20,
  minY: 0.16,
  maxY: 2.40
};

export const FIXED_STEP = 1 / 60;

// Configuración Aula Y9.
export const AULA = {
  width: 7.5,
  depth: 8.6,
  height: 3.2,
  wallThickness: 0.20,
  rotationY: 0,
  scale: 1,
  offsetX: 0,
  offsetZ: 0,
  collisionWalls: true
};
