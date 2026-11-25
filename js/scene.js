
import * as THREE from 'three';

import { createPhysics } from './physics.js';
import { createPieces } from './objects.js';
import { createHUD } from './hud.js';
import { createAulaEnvironment } from './aula.js';

import {
  AULA,
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
// TEXTURA DE ROTULOS
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
// BUSCAR EL PIZARRON DEL GLB
// ==========================================

function findWhiteboard(model) {
  model.updateMatrixWorld(true);

  const named = [];
  const fallback = [];

  model.traverseVisible(object => {
    if (!object.isMesh) return;

    const box = new THREE.Box3()
      .setFromObject(object);

    if (box.isEmpty()) return;

    const size = box.getSize(
      new THREE.Vector3()
    );

    const width = Math.max(size.x, size.z);
    const thickness = Math.min(size.x, size.z);

    const names = [];
    let current = object;

    while (current) {
      names.push(current.name || '');
      current = current.parent;
    }

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    names.push(
      ...materials.map(m => m?.name || '')
    );

    const description = names.join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    const namedBoard =
      /pizarron|pizarra|whiteboard/.test(description);

    // Aceptar la geometria del tablero
    // y sus marcos, sin unir toda una pared.
    if (namedBoard) {
      named.push(box);
    }

    // Alternativa por dimensiones.
    if (
      width >= 3.5 &&
      width <= 5.3 &&
      size.y >= .90 &&
      size.y <= 1.50 &&
      thickness <= .20
    ) {
      fallback.push({
        box,
        score:
          Math.abs(width - 4.8) +
          Math.abs(size.y - 1.2) +
          thickness
      });
    }
  });

  if (named.length > 0) {
    const combined = new THREE.Box3();

    named.forEach(box => combined.union(box));

    const size = combined.getSize(
      new THREE.Vector3()
    );

    if (
      Math.max(size.x, size.z) <= 5.8 &&
      size.y <= 1.8
    ) {
      return combined;
    }
  }

  fallback.sort((a, b) => a.score - b.score);

  if (fallback.length > 0) {
    console.warn(
      '[HUD] Pizarron localizado por dimensiones.'
    );

    return fallback[0].box;
  }

  return null;
}

// ==========================================
// PONER EL MARCADOR EN EL PIZARRON
// ==========================================

function placeHUDOnWhiteboard(model, hud) {
  const board = findWhiteboard(model);

  if (!board) {
    console.warn(
      '[HUD] No se encontro el pizarron. ' +
      'Se conserva la posicion original.'
    );

    return false;
  }

  const center = board.getCenter(
    new THREE.Vector3()
  );

  const size = board.getSize(
    new THREE.Vector3()
  );

  const boardDepth = Math.min(
    size.x,
    size.z
  );

  const facing = new THREE.Vector3();

  // Determinar si el pizarron esta orientado
  // sobre el eje X o el eje Z.
  if (size.x >= size.z) {
    facing.set(
      0,
      0,
      Math.sign(AULA.offsetZ - center.z) || 1
    );
  } else {
    facing.set(
      Math.sign(AULA.offsetX - center.x) || 1,
      0,
      0
    );
  }

  // ========================================
  // TAMAÑO ORIGINAL DEL MARCADOR
  // ========================================

  // No reducir ni deformar el HUD.
  // Puede sobresalir del pizarron.
  const scale = 1;

  // Separacion para evitar parpadeo
  // entre la pantalla y el pizarron.
  const distance = boardDepth / 2 + .045;

  // El panel llega hasta +0.775,
  // y los botones hasta -1.02.
  const upper = .775;
  const lower = -1.02;

  const contentCenter = (upper + lower) / 2;

  hud.group.position.copy(center);

  hud.group.position.addScaledVector(
    facing,
    distance
  );

  // Centrar todo el conjunto:
  // panel + botones.
  hud.group.position.y -= contentCenter * scale;

  hud.group.rotation.set(
    0,
    Math.atan2(facing.x, facing.z),
    0
  );

  hud.group.scale.setScalar(scale);
  hud.group.visible = true;

  hud.group.updateMatrixWorld(true);

  console.info(
    '[HUD] Marcador colocado en pizarron',
    {
      position: hud.group.position.toArray(),
      rotationY: hud.group.rotation.y,
      scale: hud.group.scale.x,
      boardSize: size.toArray()
    }
  );

  return true;
}

// ==========================================
// ESCENA PRINCIPAL
// ==========================================

export function createLaboratoryScene() {
  const scene = new THREE.Scene();

  scene.background = new THREE.Color(0x08101e);
  scene.fog = new THREE.Fog(0x08101e, 16, 32);

  const camera = new THREE.PerspectiveCamera(
    67, 1, .05, 55
  );

  // Vista previa desde escritorio.
  camera.position.set(2.20, 2.15, 2.65);
  camera.lookAt(0, .99, -.43);

  const physics = createPhysics();

  // ========================================
  // ILUMINACION
  // ========================================

  scene.add(
    new THREE.HemisphereLight(
      0xcce6ff,
      0x253247,
      2.3
    )
  );

  const sun = new THREE.DirectionalLight(
    0xffffff, 2.4
  );

  sun.position.set(-1.2, 4.1, 1.9);
  scene.add(sun);

  const violet = new THREE.PointLight(
    0x7a69ff, 10, 6
  );

  violet.position.set(1.6, 2.5, -2.0);
  scene.add(violet);

  // ========================================
  // PISO DE RESPALDO
  // ========================================

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x101b2b,
    roughness: .92
  });

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    floorMat
  );

  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -.003;

  scene.add(floorMesh);

  const grid = new THREE.GridHelper(
    12, 40, 0x345675, 0x1b3047
  );

  grid.position.y = .005;
  scene.add(grid);

  // ========================================
  // MARCA DEL SUELO
  // ========================================

  const positionRing = new THREE.Mesh(
    new THREE.RingGeometry(.22, .25, 48),
    new THREE.MeshBasicMaterial({
      color: 0x4cd9f4,
      transparent: true,
      opacity: .54,
      side: THREE.DoubleSide
    })
  );

  positionRing.rotation.x = -Math.PI / 2;
  positionRing.position.set(0, .012, 0);

  scene.add(positionRing);

  // ========================================
  // MATERIALES
  // ========================================

  const boardMaterial = new THREE.MeshStandardMaterial({
    color: 0x233951,
    roughness: .48,
    metalness: .22
  });

  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x18263a,
    roughness: .6,
    metalness: .16
  });

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x4cd9f4
  });

  // ========================================
  // CREAR CAJAS FISICAS
  // ========================================

  function solidBox(x, y, z, w, h, d, material) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material
    );

    mesh.position.set(x, y, z);
    scene.add(mesh);

    physics.staticBox(x, y, z, w, h, d);

    return mesh;
  }

  // ========================================
  // CUATRO MESAS
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

    const legHeight =
      TABLE.centerY - TABLE.thick / 2;

    const legX =
      TABLE.width / 2 - .105;

    const legZ =
      TABLE.depth / 2 - .085;

    for (const dx of [-legX, legX]) {
      for (const dz of [-legZ, legZ]) {
        solidBox(
          t.x + dx,
          legHeight / 2,
          t.z + dz,
          .060,
          legHeight,
          .060,
          legMaterial
        );
      }
    }

    const nameTex = labelTexture(
      `MESA ${i + 1}`,
      '#b8efff'
    );

    const namePlate = new THREE.Mesh(
      new THREE.PlaneGeometry(.45, .14),
      new THREE.MeshBasicMaterial({
        map: nameTex,
        transparent: true,
        side: THREE.DoubleSide
      })
    );

    const frontEdge = t.z > 0 ? -1 : 1;

    namePlate.position.set(
      t.x,
      TABLE_TOP + .062,
      t.z + frontEdge * (TABLE.depth / 2 + .012)
    );

    namePlate.rotation.x = frontEdge * Math.PI / 3;
    scene.add(namePlate);
  }

  // ========================================
  // PLATAFORMA PARA RECIPIENTES
  // ========================================

  solidBox(
    0, .55, BIN_Z,
    3.08, .14, .67,
    boardMaterial
  );

  for (const x of [-1.39, 1.39]) {
    solidBox(
      x, .24, BIN_Z,
      .075, .48, .08,
      legMaterial
    );
  }

  // ========================================
  // CUATRO RECIPIENTES
  // ========================================

  const bins = CATEGORIES.map((category, index) => {
    const x = BIN_X[index];

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: category.color,
      roughness: .52,
      metalness: .12,
      transparent: true,
      opacity: .61,
      side: THREE.DoubleSide,
      depthWrite: true
    });

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x18354a,
      roughness: .68
    });

    const t = BIN.wallThick;
    const w = BIN.width;
    const d = BIN.depth;

    solidBox(
      x, BIN.baseY, BIN_Z,
      w, BIN.baseThick, d, baseMat
    );

    const y = BIN_FLOOR + BIN.wallHeight / 2;

    // Pared izquierda.
    solidBox(
      x - (w - t) / 2, y, BIN_Z,
      t, BIN.wallHeight, d, wallMaterial
    );

    // Pared derecha.
    solidBox(
      x + (w - t) / 2, y, BIN_Z,
      t, BIN.wallHeight, d, wallMaterial
    );

    // Pared posterior.
    solidBox(
      x, y, BIN_Z - (d - t) / 2,
      w - 2 * t, BIN.wallHeight, t,
      wallMaterial
    );

    // Pared frontal.
    solidBox(
      x, y, BIN_Z + (d - t) / 2,
      w - 2 * t, BIN.wallHeight, t,
      wallMaterial
    );

    // ======================================
    // MARCO SUPERIOR
    // ======================================

    const frameMaterial = new THREE.MeshBasicMaterial({
      color: category.color,
      toneMapped: false
    });

    const frameY = BIN_RIM + .012;

    function frameSegment(width, depth, px, pz) {
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(
          width, .023, depth
        ),
        frameMaterial
      );

      segment.position.set(px, frameY, pz);
      scene.add(segment);
    }

    frameSegment(
      w + .025, .024,
      x, BIN_Z - d / 2
    );

    frameSegment(
      w + .025, .024,
      x, BIN_Z + d / 2
    );

    frameSegment(
      .024, d + .025,
      x - w / 2, BIN_Z
    );

    frameSegment(
      .024, d + .025,
      x + w / 2, BIN_Z
    );

    // ======================================
    // ROTULOS
    // ======================================

    const normalLabel = labelTexture(
      category.name,
      category.css
    );

    const completedLabel = labelTexture(
      category.name + ' ✓',
      '#59e3aa'
    );

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(.49, .15),
      new THREE.MeshBasicMaterial({
        map: normalLabel,
        side: THREE.DoubleSide
      })
    );

    sign.position.set(
      x,
      BIN_RIM + .11,
      BIN_Z + d / 2 + .025
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
      color: category.color,
      frameMaterial,
      sign,
      normalLabel,
      completedLabel
    };
  });

  // ========================================
  // MARCO VERDE DE CAJA COMPLETA
  // ========================================

  function markBinComplete(categoryId, complete) {
    const bin = bins.find(
      item => item.id === categoryId
    );

    if (!bin) return;

    bin.frameMaterial.color.setHex(
      complete ? 0x59e3aa : bin.color
    );

    bin.sign.material.map = complete
      ? bin.completedLabel
      : bin.normalLabel;

    bin.sign.material.needsUpdate = true;
  }

  // ========================================
  // CARGAR EL AULA Y LAS FIGURAS
  // ========================================

  const aula = createAulaEnvironment({
    scene,
    physics,
    floorMesh,
    grid
  });

  const objectSet = createPieces(scene, physics);

  const hud = createHUD();
  scene.add(hud.group);

  const statusLamp = new THREE.Mesh(
    new THREE.SphereGeometry(.035, 10, 8),
    new THREE.MeshBasicMaterial({
      color: 0x59e3aa
    })
  );

  statusLamp.position.set(0, 2.85, -3.05);
  scene.add(statusLamp);

  // ========================================
  // MARCADOR SOBRE EL PIZARRON
  // ========================================

  async function loadAula() {
    const result = await aula.load();

    if (result.loaded && aula.model) {
      const placed = placeHUDOnWhiteboard(
        aula.model,
        hud
      );

      if (placed) {
        statusLamp.visible = false;
      }
    }

    return result;
  }

  // ========================================
  // ANIMACIONES DE ESCENA
  // ========================================

  function update(t) {
    if (!statusLamp.visible) return;

    statusLamp.material.transparent = true;
    statusLamp.material.opacity =
      .88 + .12 * Math.sin(t * 2.5);
  }

  // ========================================
  // API PUBLICA DE ESCENA
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

    markBinComplete,
    loadAula,
    getAulaStatus: aula.getStatus
  };
}
