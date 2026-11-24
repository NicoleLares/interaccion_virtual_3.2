
import * as CANNON from 'cannon-es';
import { FIXED_STEP, WORKSPACE } from './config.js';

export function createPhysics() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
  });

  world.allowSleep = true;
  world.solver.iterations = 18;
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
    const body = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.STATIC
    });

    body.addShape(
      new CANNON.Box(
        new CANNON.Vec3(
          width / 2,
          height / 2,
          depth / 2
        )
      )
    );

    body.position.set(x, y, z);
    world.addBody(body);

    obstacles.push({
      x, y, z, width, height, depth
    });

    return body;
  }

  const floor = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.STATIC
  });

  floor.addShape(new CANNON.Plane());
  floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floor);

  function step(delta) {
    accumulator += Math.min(
      Math.max(delta, 0), 0.055
    );

    let substeps = 0;

    while (
      accumulator >= FIXED_STEP &&
      substeps < 4
    ) {
      world.step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      substeps++;
    }

    if (substeps === 4) accumulator = 0;
  }

  function resetClock() {
    accumulator = 0;
  }

  const candidatePosition = new CANNON.Vec3();
  const candidateMin = new CANNON.Vec3();
  const candidateMax = new CANNON.Vec3();

  const clearance = 0.005;

  function intersects(aMin, aMax, bMin, bMax) {
    return (
      aMin.x < bMax.x - clearance &&
      aMax.x > bMin.x + clearance &&
      aMin.y < bMax.y - clearance &&
      aMax.y > bMin.y + clearance &&
      aMin.z < bMax.z - clearance &&
      aMax.z > bMin.z + clearance
    );
  }

  // Valida la posición de una figura sostenida.
  function safeForHeld(x, y, z, heldBody) {
    if (!heldBody?.shapes?.length) {
      return false;
    }

    if (
      x < WORKSPACE.minX ||
      x > WORKSPACE.maxX ||
      z < WORKSPACE.minZ ||
      z > WORKSPACE.maxZ ||
      y < WORKSPACE.minY ||
      y > WORKSPACE.maxY
    ) {
      return false;
    }

    candidatePosition.set(x, y, z);

    heldBody.shapes[0].calculateWorldAABB(
      candidatePosition,
      heldBody.quaternion,
      candidateMin,
      candidateMax
    );

    if (candidateMin.y < 0.015) {
      return false;
    }

    // Comprobar mesas, recipientes y paredes.
    for (const b of obstacles) {
      const bMin = {
        x: b.x - b.width / 2,
        y: b.y - b.height / 2,
        z: b.z - b.depth / 2
      };

      const bMax = {
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
        z: b.z + b.depth / 2
      };

      if (
        intersects(
          candidateMin,
          candidateMax,
          bMin,
          bMax
        )
      ) {
        return false;
      }
    }

    // Comprobar colisiones contra otras figuras.
    for (const other of world.bodies) {
      if (
        other === heldBody ||
        (
          other.type !== CANNON.Body.DYNAMIC &&
          other.type !== CANNON.Body.KINEMATIC
        )
      ) {
        continue;
      }

      if (other.aabbNeedsUpdate) {
        other.updateAABB();
      }

      if (
        intersects(
          candidateMin,
          candidateMax,
          other.aabb.lowerBound,
          other.aabb.upperBound
        )
      ) {
        return false;
      }
    }

    return true;
  }

  return {
    world,
    obstacles,
    staticBox,
    step,
    resetClock,
    safeForHeld
  };
}
