import * as CANNON from 'cannon-es';
import { FIXED_STEP } from './config.js';

// El motor físico es la fuente de verdad de posición/rotación.
export function createPhysics() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.allowSleep = true;
  world.solver.iterations = 14;
  world.solver.tolerance = 0.0008;
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.defaultContactMaterial.friction = 0.57;
  world.defaultContactMaterial.restitution = 0.10;
  world.defaultContactMaterial.contactEquationStiffness = 1e7;
  world.defaultContactMaterial.contactEquationRelaxation = 4;
  world.defaultContactMaterial.frictionEquationStiffness = 1e7;
  const obstacles = [];
  let accumulator = 0;

  function staticBox(x, y, z, width, height, depth) {
    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
    body.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)));
    body.position.set(x, y, z);
    world.addBody(body);
    obstacles.push({ x, y, z, width, height, depth });
    return body;
  }

  const floor = new CANNON.Body({ mass: 0 });
  floor.addShape(new CANNON.Plane());
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  function step(delta) {
    accumulator += Math.min(Math.max(delta, 0), 0.055);
    let substeps = 0;
    while (accumulator >= FIXED_STEP && substeps < 4) {
      world.step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      substeps++;
    }
    if (substeps === 4) accumulator = 0; // evita espiral de muerte tras pausa del visor
  }

  function resetClock() { accumulator = 0; }

  // Prueba conservadora de AABB para evitar desplazar un cuerpo cinemático
  // a través del suelo, mesas o paredes de recipientes con movimientos rápidos.
  function safeForHeld(x, y, z, radius = 0.105) {
    if (y < radius + 0.035) return false;
    if (x < -1.85 || x > 1.85 || z > 0.35 || z < -2.82 || y > 2.45) return false;
    return !obstacles.some(b => (
      Math.abs(x - b.x) < b.width / 2 + radius &&
      Math.abs(y - b.y) < b.height / 2 + radius &&
      Math.abs(z - b.z) < b.depth / 2 + radius
    ));
  }

  return { world, obstacles, staticBox, step, resetClock, safeForHeld };
}
