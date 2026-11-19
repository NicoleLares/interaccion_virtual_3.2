
 // Escala: una unidad de Three.js equivale a un metro.
 // El usuario VR se encuentra aproximadamente en (0, 0, 0) y mira hacia -Z.
 export const CATEGORIES = [
   { id: 'cubo', name: 'CUBOS', color: 0x4aa3ff, css: '#4aa3ff' },
   { id: 'esfera', name: 'ESFERAS', color: 0x59e3aa, css: '#59e3aa' },
   { id: 'piramide', name: 'PIRÁMIDES', color: 0xffaa66, css: '#ffaa66' },
   { id: 'prisma', name: 'PRISMAS', color: 0xb08aff, css: '#b08aff' }
 ];
 
 // Dos mesas a la izquierda y dos a la derecha. Centro libre para el usuario;
 // los recipientes quedan al frente, sin mesas que tapen el trayecto.
 export const TABLES = [
   { id: 'mesa-1', x: -1.01, z:  0.64 }, // izquierda, ligeramente atrás
   { id: 'mesa-2', x:  1.01, z:  0.64 }, // derecha, ligeramente atrás
   { id: 'mesa-3', x: -1.01, z: -0.17 }, // izquierda, lateral-frontal
   { id: 'mesa-4', x:  1.01, z: -0.17 }  // derecha, lateral-frontal
 ];
 
 // Altura anterior de la mesa: 0.87 m; ahora ~0.68 m.
 // Posiciones físicas y visuales derivan de los mismos parámetros.
 export const TABLE = { width: 1.10, depth: 0.65, centerY: 0.635, thick: 0.085 };
 export const TABLE_TOP = TABLE.centerY + TABLE.thick / 2;
 
 // Estación de clasificación al frente, más baja y separada de las mesas.
 export const BIN_X = [-1.08, -0.36, 0.36, 1.08];
 export const BIN_Z = -1.08;
 export const BIN = { width: 0.60, depth: 0.58, baseY: 0.65, baseThick: 0.06,
   wallHeight: 0.40, wallThick: 0.035 };
 export const BIN_FLOOR = BIN.baseY + BIN.baseThick / 2;
 export const BIN_RIM = BIN_FLOOR + BIN.wallHeight;
 
 // Zona segura: incluye las mesas laterales y las mesas ligeramente traseras.
 // Compartida por interacción y física, para no bloquear el agarre de esas piezas.
 export const WORKSPACE = { minX: -2.05, maxX: 2.05, minZ: -2.25, maxZ: 1.20,
   minY: 0.16, maxY: 2.40 };
 
 export const FIXED_STEP = 1 / 60;
