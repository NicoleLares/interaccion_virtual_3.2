
import * as THREE from 'three';
import {
  GLTFLoader
} from 'three/addons/loaders/GLTFLoader.js';

import { AULA } from './config.js';

const AULA_URL = new URL(
  '../assets/models/AulaY9.glb',
  import.meta.url
);

// Activar solo para diagnosticar la puerta.
const DEBUG_PUERTA = false;

// ==========================================
// UTILIDADES
// ==========================================

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function materialNames(mesh) {
  const mats = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];

  return mats.map(m => m?.name || '').join(' ');
}

function hierarchyNames(object) {
  const names = [];
  let current = object;

  while (current) {
    names.push(current.name || '');
    current = current.parent;
  }

  return names.join(' / ');
}

function isReference(object) {
  let current = object;

  while (current) {
    if (/^ThomThom(?:_|$)/i.test(current.name || '')) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function isDoorMesh(object) {
  if (!object.isMesh) return false;

  const text = normalizeText(
    hierarchyNames(object) +
    ' ' +
    materialNames(object)
  );

  return /puerta|door/.test(text);
}

// ==========================================
// MATERIAL DE LA PUERTA
// ==========================================

function fixDoorMaterial(original) {
  if (!original) return original;

  const mat = original.clone();
  const name = normalizeText(mat.name);

  const glass =
    /vidrio|cristal|glass/.test(name);

  mat.side = THREE.DoubleSide;

  if (glass) {
    mat.transparent = true;
    mat.opacity = 0.55;
    mat.depthWrite = false;
    mat.depthTest = true;

    if (!mat.map && mat.color) {
      mat.color.set(0xc5e3ef);
    }
  } else {
    // Evitar que una madera de la puerta
    // quede invisible por transparencia.
    mat.transparent = false;
    mat.opacity = 1;
    mat.depthWrite = true;
    mat.depthTest = true;
  }

  if (DEBUG_PUERTA) {
    mat.color?.set(0xffff00);
    mat.transparent = false;
    mat.opacity = 1;
    mat.depthWrite = true;
  }

  mat.needsUpdate = true;
  return mat;
}

// ==========================================
// HACER VISIBLE LA PUERTA
// ==========================================

function fixDoorVisibility(root) {
  const meshes = [];

  root.traverse(object => {
    if (!isDoorMesh(object)) return;
    if (isReference(object)) return;

    meshes.push(object);

    // Mostrar objeto y padres.
    let current = object;

    while (current) {
      current.visible = true;
      current = current.parent;
    }

    object.frustumCulled = false;
    object.castShadow = false;
    object.receiveShadow = false;

    if (Array.isArray(object.material)) {
      object.material = object.material.map(
        fixDoorMaterial
      );
    } else {
      object.material = fixDoorMaterial(
        object.material
      );
    }

    console.info(
      '[PUERTA] Elemento detectado:',
      object.name,
      materialNames(object)
    );
  });

  return meshes;
}

// ==========================================
// ANALIZAR GEOMETRIA DE PUERTA
// ==========================================

function diagnoseDoor(meshes) {
  const box = new THREE.Box3();

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);

    box.union(
      new THREE.Box3().setFromObject(mesh)
    );
  }

  if (meshes.length === 0 || box.isEmpty()) {
    console.warn(
      '[PUERTA] No se encontraron mallas con nombre de puerta.'
    );

    return {
      doorFound: false,
      doorMeshes: 0,
      box: null
    };
  }

  const center = box.getCenter(
    new THREE.Vector3()
  );

  const size = box.getSize(
    new THREE.Vector3()
  );

  console.info('[PUERTA] Geometria:', {
    position: center.toArray(),
    dimensions: size.toArray()
  });

  return {
    doorFound: true,
    doorMeshes: meshes.length,
    box,
    center,
    size
  };
}

// ==========================================
// LOCALIZAR PISO DEL SALON
// ==========================================

function floorBounds(root) {
  const floors = new THREE.Box3();
  let found = false;

  root.traverseVisible(object => {
    if (!object.isMesh) return;

    const description =
      `${object.name} ${materialNames(object)}`;

    if (!/(loseta|piso|suelo|floor|tile)/i.test(
      description
    )) return;

    const box = new THREE.Box3()
      .setFromObject(object);

    const size = box.getSize(
      new THREE.Vector3()
    );

    if (
      box.isEmpty() ||
      size.x * size.z < .02
    ) return;

    floors.union(box);
    found = true;
  });

  if (!found) {
    throw new Error(
      'No se encontro el piso de AulaY9.glb'
    );
  }

  return floors;
}

// ==========================================
// DIMENSIONES DEL ESCENARIO
// ==========================================

function architectureBounds(root) {
  const box = new THREE.Box3();

  root.traverseVisible(object => {
    if (!object.isMesh) return;

    box.union(
      new THREE.Box3().setFromObject(object)
    );
  });

  return box;
}

// ==========================================
// COLISIONADORES DE PAREDES
// ==========================================

function addWallColliders(physics, floor, doorInfo) {
  if (!AULA.collisionWalls) {
    return {
      count: 0,
      doorOpeningApplied: false,
      doorWall: null
    };
  }

  const size = floor.getSize(
    new THREE.Vector3()
  );

  if (
    size.x < 3 ||
    size.z < 3 ||
    size.x > 20 ||
    size.z > 20
  ) {
    console.warn(
      '[AULA] Dimensiones de piso inesperadas.'
    );

    return {
      count: 0,
      doorOpeningApplied: false,
      doorWall: null
    };
  }

  const height = AULA.height * AULA.scale;
  const thickness = AULA.wallThickness;

  const walls = [
    {
      name: 'Oeste',
      axis: 'x',
      pos: floor.min.x,
      min: floor.min.z,
      max: floor.max.z
    },
    {
      name: 'Este',
      axis: 'x',
      pos: floor.max.x,
      min: floor.min.z,
      max: floor.max.z
    },
    {
      name: 'Norte',
      axis: 'z',
      pos: floor.min.z,
      min: floor.min.x,
      max: floor.max.x
    },
    {
      name: 'Sur',
      axis: 'z',
      pos: floor.max.z,
      min: floor.min.x,
      max: floor.max.x
    }
  ];

  let count = 0;
  let doorWall = null;
  let openingApplied = false;

  function segment(
    wall,
    start,
    end,
    bottom = 0,
    top = height
  ) {
    const length = end - start;
    const h = top - bottom;

    if (length <= .025 || h <= .025) return;

    if (wall.axis === 'x') {
      physics.staticBox(
        wall.pos,
        (bottom + top) / 2,
        (start + end) / 2,
        thickness,
        h,
        length
      );
    } else {
      physics.staticBox(
        (start + end) / 2,
        (bottom + top) / 2,
        wall.pos,
        length,
        h,
        thickness
      );
    }

    count++;
  }

  // ========================================
  // IDENTIFICAR LA PARED DE LA PUERTA
  // ========================================

  let selectedWall = null;
  let openingStart = 0;
  let openingEnd = 0;
  let openingTop = 0;

  if (doorInfo.doorFound && doorInfo.box) {
    const nearest = walls.map(wall => ({
      wall,
      distance: wall.axis === 'x'
        ? Math.abs(doorInfo.center.x - wall.pos)
        : Math.abs(doorInfo.center.z - wall.pos)
    })).sort(
      (a, b) => a.distance - b.distance
    )[0];

    if (nearest && nearest.distance < .45) {
      const wall = nearest.wall;
      const box = doorInfo.box;

      const low = wall.axis === 'x'
        ? box.min.z
        : box.min.x;

      const high = wall.axis === 'x'
        ? box.max.z
        : box.max.x;

      const span = high - low;
      const doorHeight = box.max.y - box.min.y;

      // Evitar abrir accidentalmente una pared
      // por detectar un objeto que no es puerta.
      if (
        span >= .65 &&
        span <= 1.60 &&
        doorHeight >= 1.80 &&
        doorHeight <= 3.10 &&
        box.min.y >= -.10 &&
        box.min.y <= .25
      ) {
        selectedWall = wall;

        openingStart = Math.max(
          wall.min,
          low - .025
        );

        openingEnd = Math.min(
          wall.max,
          high + .025
        );

        openingTop = Math.min(
          height,
          box.max.y + .015
        );

        doorWall = wall.name;
      }
    }
  }

  // ========================================
  // GENERAR PAREDES Y ABERTURA
  // ========================================

  for (const wall of walls) {
    if (wall !== selectedWall) {
      segment(wall, wall.min, wall.max);
      continue;
    }

    // Tramo antes de puerta.
    segment(
      wall,
      wall.min,
      openingStart
    );

    // Tramo despues de puerta.
    segment(
      wall,
      openingEnd,
      wall.max
    );

    // Dintel superior.
    if (openingTop < height) {
      segment(
        wall,
        openingStart,
        openingEnd,
        openingTop,
        height
      );
    }

    openingApplied = true;
  }

  if (!openingApplied) {
    console.warn(
      '[PUERTA] No se aplico abertura fisica. Revisar el GLB.'
    );
  }

  return {
    count,
    doorOpeningApplied: openingApplied,
    doorWall
  };
}

// ==========================================
// CREAR ENTORNO AULA
// ==========================================

export function createAulaEnvironment({
  scene,
  physics,
  floorMesh,
  grid
}) {
  let root = null;
  let loaded = false;

  let diagnostics = {
    loaded: false,
    url: AULA_URL.href,
    message: 'Carga pendiente'
  };

  const loader = new GLTFLoader();

  async function load() {
    try {
      const gltf = await loader.loadAsync(
        AULA_URL.href
      );

      if (!gltf.scene) {
        throw new Error(
          'El GLB no contiene una escena'
        );
      }

      root = gltf.scene;
      root.name = 'AulaY9-SketchUp';

      // ====================================
      // OCULTAR FIGURA HUMANA DE REFERENCIA
      // ====================================

      let hiddenReference = false;

      root.traverse(object => {
        if (/^ThomThom(?:_|$)/i.test(
          object.name || ''
        )) {
          object.visible = false;
          hiddenReference = true;
        }
      });

      // ====================================
      // ESCALA Y ROTACION
      // ====================================

      root.rotation.y = AULA.rotationY;
      root.scale.setScalar(AULA.scale);

      root.updateMatrixWorld(true);

      // ====================================
      // CENTRAR SALON CON SU PISO
      // ====================================

      const originalFloor = floorBounds(root);

      const center = originalFloor.getCenter(
        new THREE.Vector3()
      );

      root.position.set(
        AULA.offsetX - center.x,
        -originalFloor.min.y,
        AULA.offsetZ - center.z
      );

      root.updateMatrixWorld(true);

      // ====================================
      // MATERIALES GENERALES
      // ====================================

      root.traverseVisible(object => {
        if (!object.isMesh) return;

        object.castShadow = false;
        object.receiveShadow = false;

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];

        materials.forEach(mat => {
          if (!mat) return;

          mat.side = THREE.DoubleSide;
          mat.needsUpdate = true;
        });
      });

      // ====================================
      // PUERTA
      // ====================================

      const doorMeshes = fixDoorVisibility(root);

      root.updateMatrixWorld(true);

      const doorInfo = diagnoseDoor(
        doorMeshes
      );

      // ====================================
      // AGREGAR SALON A LA ESCENA
      // ====================================

      scene.add(root);

      floorMesh.visible = false;
      grid.visible = false;

      const placedFloor = floorBounds(root);

      const roomSize = placedFloor.getSize(
        new THREE.Vector3()
      );

      const building = architectureBounds(root);

      const buildingSize = building.getSize(
        new THREE.Vector3()
      );

      // ====================================
      // COLISIONES
      // ====================================

      const colliders = addWallColliders(
        physics,
        placedFloor,
        doorInfo
      );

      loaded = true;

      diagnostics = {
        loaded: true,
        url: AULA_URL.href,

        width: Number(
          roomSize.x.toFixed(2)
        ),

        depth: Number(
          roomSize.z.toFixed(2)
        ),

        height: Number(
          buildingSize.y.toFixed(2)
        ),

        wallColliders: colliders.count,

        doorFound: doorInfo.doorFound,
        doorMeshes: doorInfo.doorMeshes,

        doorOpeningApplied:
          colliders.doorOpeningApplied,

        doorWall: colliders.doorWall,

        hiddenReference,

        scale: AULA.scale,
        rotationY: AULA.rotationY
      };

      console.info(
        'AulaY9 integrada:',
        diagnostics
      );

      return { ...diagnostics };

    } catch (error) {
      console.error(
        '[AULA] Error al cargar:',
        error
      );

      if (root?.parent) {
        root.parent.remove(root);
      }

      root = null;
      loaded = false;

      diagnostics = {
        loaded: false,
        url: AULA_URL.href,
        message: error.message
      };

      return { ...diagnostics };
    }
  }

  return {
    load,

    getStatus: () => ({
      ...diagnostics
    }),

    get model() {
      return root;
    },

    get loaded() {
      return loaded;
    }
  };
}
