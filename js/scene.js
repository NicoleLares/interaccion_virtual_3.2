
import * as THREE from 'three';

import { createPhysics } from './physics.js';
import { createPieces } from './objects.js';
import { createHUD } from './hud.js';
import { createAulaEnvironment } from './aula.js';

import {
  CATEGORIES,
  TABLES,
  TABLE,
  TABLE_TOP,
  BIN_X,
  BIN_Z,
  BIN,
  BIN_FLOOR,
  BIN_RIM
} from './config.js';

// ==========================================
// TEXTURAS PARA ETIQUETAS
// ==========================================

function labelTexture(
  text,
  accent = '#ffffff',
  width = 512,
  height = 160
) {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0c1b2c';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  ctx.font = 'bold 57px Arial';
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText(
    text,
    width / 2,
    height / 2,
    width - 32
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

// ==========================================
// CREAR ESCENARIO DEL LABORATORIO
// ==========================================

export function createLaboratoryScene() {
  const scene = new THREE.Scene();

  scene.background = new THREE.Color(0x08101e);

  // Mayor distancia de visibilidad para Aula Y9.
  scene.fog = new THREE.Fog(0x08101e, 16, 32);

  // Cámara para previsualización de escritorio.
  const camera = new THREE.PerspectiveCamera(
    67,
    1,
    0.05,
    55
  );

  camera.position.set(2.20, 2.15, 2.65);
  camera.lookAt(0, 0.99, -0.43);

  // ========================================
  // MOTOR DE FÍSICA
  // ========================================

  const physics = createPhysics();

  // ========================================
  // ILUMINACIÓN
  // ========================================

  scene.add(
    new THREE.HemisphereLight(
      0xcce6ff,
      0x253247,
      2.3
    )
  );

  const sun = new THREE.DirectionalLight(
    0xffffff,
    2.4
  );

  sun.position.set(-1.2, 4.1, 1.9);
  scene.add(sun);

  const violet = new THREE.PointLight(
    0x7a69ff,
    10,
    6
  );

  violet.position.set(1.6, 2.5, -2.0);
  scene.add(violet);

  // ========================================
  // PISO ORIGINAL DEL LABORATORIO
  // ========================================

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x101b2b,
    roughness: 0.92
  });

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    floorMat
  );

  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -0.003;

  scene.add(floorMesh);

  const grid = new THREE.GridHelper(
    12,
    40,
    0x345675,
    0x1b3047
  );

  grid.position.y = 0.005;
  scene.add(grid);

  // Marca central del usuario.
  const positionRing = new THREE.Mesh(
    new THREE.RingGeometry(0.22, 0.25, 48),
    new THREE.MeshBasicMaterial({
      color: 0x4cd9f4,
      transparent: true,
      opacity: 0.54,
      side: THREE.DoubleSide
    })
  );

  positionRing.rotation.x = -Math.PI / 2;
  positionRing.position.set(0, 0.012, 0);

  scene.add(positionRing);

  // ========================================
  // MATERIALES DE MESAS
  // ========================================

  const boardMaterial = new THREE.MeshStandardMaterial({
    color: 0x233951,
    roughness: 0.48,
    metalness: 0.22
  });

  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x18263a,
    roughness: 0.6,
    metalness: 0.16
  });

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x4cd9f4
  });

  // Crear caja visual con cuerpo físico.
  function solidBox(
    x, y, z,
    w, h, d,
    material
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material
    );

    mesh.position.set(x, y, z);
    scene.add(mesh);

    physics.staticBox(
      x, y, z,
      w, h, d
    );

    return mesh;
  }

  // ========================================
  // CUATRO MESAS ALREDEDOR DEL USUARIO
  // ========================================

  for (const [i, t] of TABLES.entries()) {
    const top = solidBox(
      t.x,
      TABLE.centerY,
      t.z,
      TABLE.width,
      TABLE.thick,
      TABLE.depth,
      boardMaterial
    );

    top.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(top.geometry),
        edgeMaterial
      )
    );

    // Crear las cuatro patas.
    const legHeight =
      TABLE.centerY - TABLE.thick / 2;

    const legX = TABLE.width / 2 - 0.105;
    const legZ = TABLE.depth / 2 - 0.085;

    for (const dx of [-legX, legX]) {
      for (const dz of [-legZ, legZ]) {
        solidBox(
          t.x + dx,
          legHeight / 2,
          t.z + dz,
          0.060,
          legHeight,
          0.060,
          legMaterial
        );
      }
    }

    // Etiqueta de cada mesa.
    const nameTex = labelTexture(
      `MESA ${i + 1}`,
      '#b8efff'
    );

    const namePlate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.14),
      new THREE.MeshBasicMaterial({
        map: nameTex,
        transparent: true,
        side: THREE.DoubleSide
      })
    );

    const frontEdge = t.z > 0 ? -1 : 1;

    namePlate.position.set(
      t.x,
      TABLE_TOP + 0.062,
      t.z + frontEdge * (
        TABLE.depth / 2 + 0.012
      )
    );

    namePlate.rotation.x =
      frontEdge * Math.PI / 3;

    scene.add(namePlate);
  }

  // ========================================
  // ESTACIÓN DE CLASIFICACIÓN
  // ========================================

  solidBox(
    0,
    0.55,
    BIN_Z,
    3.08,
    0.14,
    0.67,
    boardMaterial
  );

  for (const x of [-1.39, 1.39]) {
    solidBox(
      x,
      0.24,
      BIN_Z,
      0.075,
      0.48,
      0.08,
      legMaterial
    );
  }

  // ========================================
  // CUATRO RECIPIENTES ABIERTOS
  // ========================================

  const bins = CATEGORIES.map(
    (category, index) => {
      const x = BIN_X[index];

      const wallMaterial =
        new THREE.MeshStandardMaterial({
          color: category.color,
          roughness: 0.52,
          metalness: 0.12,
          transparent: true,
          opacity: 0.61,
          side: THREE.DoubleSide,
          depthWrite: true
        });

      const baseMat =
        new THREE.MeshStandardMaterial({
          color: 0x18354a,
          roughness: 0.68
        });

      const t = BIN.wallThick;
      const w = BIN.width;
      const d = BIN.depth;

      // Base del recipiente.
      solidBox(
        x,
        BIN.baseY,
        BIN_Z,
        w,
        BIN.baseThick,
        d,
        baseMat
      );

      const y =
        BIN_FLOOR + BIN.wallHeight / 2;

      // Pared izquierda.
      solidBox(
        x - (w - t) / 2,
        y,
        BIN_Z,
        t,
        BIN.wallHeight,
        d,
        wallMaterial
      );

      // Pared derecha.
      solidBox(
        x + (w - t) / 2,
        y,
        BIN_Z,
        t,
        BIN.wallHeight,
        d,
        wallMaterial
      );

      // Pared trasera.
      solidBox(
        x,
        y,
        BIN_Z - (d - t) / 2,
        w - 2 * t,
        BIN.wallHeight,
        t,
        wallMaterial
      );

      // Pared delantera.
      solidBox(
        x,
        y,
        BIN_Z + (d - t) / 2,
        w - 2 * t,
        BIN.wallHeight,
        t,
        wallMaterial
      );

      // Etiqueta de categoría.
      const label = labelTexture(
        category.name,
        category.css
      );

      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(0.49, 0.15),
        new THREE.MeshBasicMaterial({
          map: label,
          side: THREE.DoubleSide
        })
      );

      sign.position.set(
        x,
        BIN_RIM + 0.11,
        BIN_Z + d / 2 + 0.025
      );

      scene.add(sign);

      return {
        id: category.id,
        name: category.name,
        x,
        z: BIN_Z,
        width: w,
        depth: d,
        floor: BIN_FLOOR,
        rim: BIN_RIM,
        color: category.color
      };
    }
  );

  // ========================================
  // INTEGRACIÓN DEL AULA Y9
  // ========================================

  // Se carga el aula sin detener el juego.
  const aula = createAulaEnvironment({
    scene,
    physics,
    floorMesh,
    grid
  });

  // ========================================
  // CREACIÓN DE LOS 20 OBJETOS
  // ========================================

  const objectSet = createPieces(
    scene,
    physics
  );

  // ========================================
  // PANEL DE PUNTUACIÓN VR
  // ========================================

  const hud = createHUD();
  scene.add(hud.group);

  // Luz de estado decorativa.
  const statusLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0x59e3aa
    })
  );

  statusLamp.position.set(
    0,
    2.85,
    -3.05
  );

  scene.add(statusLamp);

  function update(t) {
    statusLamp.material.opacity =
      0.88 + 0.12 * Math.sin(t * 2.5);

    statusLamp.material.transparent = true;
  }

  // ========================================
  // DATOS DEL LABORATORIO
  // ========================================

  return {
    scene,
    camera,
    physics,

    pieces: objectSet.pieces,
    bins,
    hud,

    sync: objectSet.sync,

    resetPositions: objectSet.resetPositions,

    restore: objectSet.restore,

    update,

    tables: TABLES,

    // Nuevas funciones del Aula Y9.
    loadAula: aula.load,
    getAulaStatus: aula.getStatus
  };
}
