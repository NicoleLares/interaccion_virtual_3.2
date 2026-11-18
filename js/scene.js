import * as THREE from 'three';
import { createPhysics } from './physics.js';
import { createPieces } from './objects.js';
import { createHUD } from './hud.js';
import { CATEGORIES, TABLES, TABLE, TABLE_TOP, BIN_X, BIN_Z, BIN, BIN_FLOOR, BIN_RIM } from './config.js';

function labelTexture(text, accent = '#ffffff', width = 512, height = 160) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0c1b2c'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = accent; ctx.lineWidth = 8; ctx.strokeRect(6, 6, width - 12, height - 12);
  ctx.font = 'bold 57px Arial'; ctx.fillStyle = accent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2, width - 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createLaboratoryScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08101e);
  scene.fog = new THREE.Fog(0x08101e, 6.5, 15);
  const camera = new THREE.PerspectiveCamera(67, 1, 0.05, 55);
  camera.position.set(0, 1.62, 0.60); // escritorio; local-floor controla la pose en VR
  camera.lookAt(0, 1.02, -1.65);
  const physics = createPhysics();
  scene.add(new THREE.HemisphereLight(0xcce6ff, 0x253247, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-1.2, 4.1, 1.9); scene.add(sun);
  const violet = new THREE.PointLight(0x7a69ff, 10, 6);
  violet.position.set(1.6, 2.5, -2.0); scene.add(violet);

  const floorMat = new THREE.MeshStandardMaterial({ color: 0x101b2b, roughness: .92 });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = -.003;
  scene.add(floorMesh);
  const grid = new THREE.GridHelper(12, 40, 0x345675, 0x1b3047);
  grid.position.y = .005; scene.add(grid);

  const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x233951, roughness: .48, metalness: .22 });
  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x18263a, roughness: .6, metalness: .16 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x4cd9f4 });
  function solidBox(x, y, z, w, h, d, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); scene.add(mesh);
    physics.staticBox(x, y, z, w, h, d);
    return mesh;
  }
  for (const [i, t] of TABLES.entries()) {
    const top = solidBox(t.x, TABLE.centerY, t.z, TABLE.width, TABLE.thick, TABLE.depth, boardMaterial);
    top.add(new THREE.LineSegments(new THREE.EdgesGeometry(top.geometry), edgeMaterial));
    for (const dx of [-.54, .54]) for (const dz of [-.26, .26]) {
      solidBox(t.x + dx, .385, t.z + dz, .065, .77, .065, legMaterial);
    }
    const nameTex = labelTexture(`MESA ${i + 1}`, '#b8efff');
    const namePlate = new THREE.Mesh(new THREE.PlaneGeometry(.45, .14), new THREE.MeshBasicMaterial({ map: nameTex, transparent: true, side: THREE.DoubleSide }));
    namePlate.position.set(t.x, TABLE_TOP + .045, t.z - TABLE.depth / 2 + .002);
    namePlate.rotation.x = -Math.PI / 3; scene.add(namePlate);
  }

  // Plataforma física que sostiene los cuatro botes.
  solidBox(0, .71, BIN_Z, 3.17, .18, .77, boardMaterial);
  for (const x of [-1.42, 1.42]) solidBox(x, .32, BIN_Z, .075, .64, .08, legMaterial);

  const bins = CATEGORIES.map((category, index) => {
    const x = BIN_X[index];
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: category.color, roughness: .52, metalness: .12, transparent: true, opacity: .61,
      side: THREE.DoubleSide, depthWrite: true
    });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x18354a, roughness: .68 });
    const t = BIN.wallThick, w = BIN.width, d = BIN.depth;
    solidBox(x, BIN.baseY, BIN_Z, w, BIN.baseThick, d, baseMat);
    const y = BIN_FLOOR + BIN.wallHeight / 2;
    // Cuatro paredes físicas independientes: la abertura superior está libre.
    solidBox(x - (w - t) / 2, y, BIN_Z, t, BIN.wallHeight, d, wallMaterial);
    solidBox(x + (w - t) / 2, y, BIN_Z, t, BIN.wallHeight, d, wallMaterial);
    solidBox(x, y, BIN_Z - (d - t) / 2, w - 2*t, BIN.wallHeight, t, wallMaterial);
    solidBox(x, y, BIN_Z + (d - t) / 2, w - 2*t, BIN.wallHeight, t, wallMaterial);
    const label = labelTexture(category.name, category.css);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(.49, .15), new THREE.MeshBasicMaterial({ map: label, side: THREE.DoubleSide }));
    sign.position.set(x, BIN_RIM + .11, BIN_Z + d/2 + .025);
    scene.add(sign);
    return { id: category.id, name: category.name, x, z: BIN_Z,
      width: w, depth: d, floor: BIN_FLOOR, rim: BIN_RIM, color: category.color };
  });

  const objectSet = createPieces(scene, physics);
  const hud = createHUD();
  scene.add(hud.group);
  const statusLamp = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0x59e3aa }));
  statusLamp.position.set(0, 2.85, -3.05); scene.add(statusLamp);

  function update(t) {
    statusLamp.material.opacity = .88 + .12 * Math.sin(t * 2.5);
    statusLamp.material.transparent = true;
  }
  return { scene, camera, physics, pieces: objectSet.pieces, bins, hud,
    sync: objectSet.sync, resetPositions: objectSet.resetPositions,
    restore: objectSet.restore, update, tables: TABLES };
}
