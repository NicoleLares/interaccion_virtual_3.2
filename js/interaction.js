
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { WORKSPACE } from './config.js';

export function createInteraction(lab, hands, game, options = {}) {
  const raycaster = new THREE.Raycaster();

  raycaster.near = 0.03;
  raycaster.far = 3.6;

  const rayOrigin = new THREE.Vector3();
  const rayDirection = new THREE.Vector3();
  const target = new THREE.Vector3();
  const current = new THREE.Vector3();
  const stepVec = new THREE.Vector3();

  const grabs = new Map();
  const claimed = new Set();

  const pieceByMesh = new Map(
    lab.pieces.map(p => [p.mesh, p])
  );

  const meshes = lab.pieces.map(p => p.mesh);

  let previousTime = performance.now();

  function updateRay(slot) {
    slot.controller.updateMatrixWorld(true);

    rayOrigin.setFromMatrixPosition(
      slot.controller.matrixWorld
    );

    rayDirection.set(0, 0, -1)
      .transformDirection(slot.controller.matrixWorld)
      .normalize();

    raycaster.set(rayOrigin, rayDirection);
  }

  function nearestPiece() {
    const hit = raycaster
      .intersectObjects(meshes, false)
      .find(h => {
        const piece = pieceByMesh.get(h.object);

        return game.canGrab(piece) &&
          !claimed.has(piece.id);
      });

    if (hit) {
      return {
        piece: pieceByMesh.get(hit.object),
        distance: hit.distance
      };
    }

    return null;
  }

  function nearestButton() {
    const hit = raycaster.intersectObjects(
      lab.hud.buttons,
      false
    )[0];

    return hit
      ? { button: hit.object, distance: hit.distance }
      : null;
  }

  function grab(slot, selected) {
    const piece = selected.piece;

    if (
      !piece ||
      claimed.has(piece.id) ||
      !game.onGrab(piece)
    ) {
      return;
    }

    const body = piece.body;

    const offset = new THREE.Vector3()
      .copy(body.position)
      .sub(
        rayOrigin.clone().addScaledVector(
          rayDirection,
          selected.distance
        )
      );

    body.type = CANNON.Body.KINEMATIC;
    body.mass = 0;
    body.updateMassProperties();

    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.wakeUp();

    grabs.set(slot.index, {
      piece,
      distance: Math.max(0.20, selected.distance),
      offset,
      previous: new THREE.Vector3().copy(body.position),
      velocity: new THREE.Vector3()
    });

    claimed.add(piece.id);
  }

  function move(slot, dt) {
    const held = grabs.get(slot.index);

    if (!held) return;

    const piece = held.piece;
    const body = piece.body;

    target.copy(rayOrigin)
      .addScaledVector(rayDirection, held.distance)
      .add(held.offset);

    target.x = THREE.MathUtils.clamp(
      target.x,
      WORKSPACE.minX,
      WORKSPACE.maxX
    );

    target.y = THREE.MathUtils.clamp(
      target.y,
      WORKSPACE.minY,
      WORKSPACE.maxY
    );

    target.z = THREE.MathUtils.clamp(
      target.z,
      WORKSPACE.minZ,
      WORKSPACE.maxZ
    );

    current.copy(body.position);
    stepVec.copy(target).sub(current);

    const distance = stepVec.length();

    if (distance <= 0.0001) {
      body.velocity.setZero();
      return;
    }

    stepVec.multiplyScalar(
      Math.min(1, (0.045 + dt * 1.1) / distance)
    );

    target.copy(current).add(stepVec);

    // Verificar recorrido cada 2 cm.
    const travel = current.distanceTo(target);

    const segments = Math.max(
      1,
      Math.ceil(travel / 0.02)
    );

    const allowed = current.clone();
    const candidate = new THREE.Vector3();

    let moved = false;

    for (let i = 1; i <= segments; i++) {
      candidate.lerpVectors(
        current,
        target,
        i / segments
      );

      if (
        !lab.physics.safeForHeld(
          candidate.x,
          candidate.y,
          candidate.z,
          body
        )
      ) {
        break;
      }

      allowed.copy(candidate);
      moved = true;
    }

    if (!moved) {
      body.velocity.setZero();
      held.velocity.set(0, 0, 0);
      return;
    }

    body.position.set(
      allowed.x,
      allowed.y,
      allowed.z
    );

    body.aabbNeedsUpdate = true;
    body.wakeUp();

    // Conservar el registro del acceso por
    // la parte superior del recipiente.
    for (const bin of lab.bins) {
      const insideOpening =
        Math.abs(allowed.x - bin.x) <
          bin.width / 2 - 0.075 &&
        Math.abs(allowed.z - bin.z) <
          bin.depth / 2 - 0.075;

      if (
        insideOpening &&
        allowed.y >= bin.rim - 0.035
      ) {
        piece.enteredFromTop = true;
      }
    }

    // Velocidad controlada al soltar.
    const velocity = allowed.clone()
      .sub(held.previous)
      .divideScalar(Math.max(dt, 0.009));

    held.velocity.lerp(velocity, 0.3);

    if (held.velocity.length() > 1.4) {
      held.velocity.setLength(1.4);
    }

    held.previous.copy(allowed);
    body.velocity.setZero();
  }

  function release(index) {
    const held = grabs.get(index);

    if (!held) return;

    const body = held.piece.body;

    body.type = CANNON.Body.DYNAMIC;
    body.mass = 0.38;
    body.updateMassProperties();

    const v = held.velocity;

    body.velocity.set(v.x, v.y, v.z);
    body.angularVelocity.setZero();
    body.wakeUp();

    game.onRelease(held.piece);

    claimed.delete(held.piece.id);
    grabs.delete(index);
  }

  function releaseAll() {
    for (const index of [...grabs.keys()]) {
      release(index);
    }
  }

  function activate(button) {
    const action = button?.userData?.action;

    if (action === 'start') {
      game.start();
    }

    if (action === 'reset') {
      releaseAll();
      game.reset();
    }

    if (action === 'exit') {
      options.onExitVR?.();
    }
  }

  function update() {
    hands.update();

    const now = performance.now();

    const dt = Math.max(
      0.009,
      Math.min(
        (now - previousTime) / 1000,
        0.055
      )
    );

    previousTime = now;

    let chosenButton = null;

    for (const slot of hands.slots) {
      if (!slot.tracking) {
        if (grabs.has(slot.index)) {
          release(slot.index);
        }

        slot.laser.visible = false;
        slot.cursor.visible = false;
        continue;
      }

      updateRay(slot);

      if (grabs.has(slot.index)) {
        if (slot.justReleased || !slot.pressed) {
          release(slot.index);
        } else {
          move(slot, dt);
        }

        slot.setRayDistance(0.8);
        continue;
      }

      const buttonHit = nearestButton();

      const pieceHit = game.phase === 'active'
        ? nearestPiece()
        : null;

      const hitButton =
        buttonHit &&
        (
          !pieceHit ||
          buttonHit.distance < pieceHit.distance
        );

      const targetDistance = hitButton
        ? buttonHit.distance
        : (pieceHit?.distance || 2.0);

      slot.setRayDistance(targetDistance);

      if (hitButton) {
        chosenButton = buttonHit.button;
      }

      if (slot.justPressed) {
        if (hitButton) {
          activate(buttonHit.button);
        } else if (pieceHit) {
          grab(slot, pieceHit);
        }
      }
    }

    lab.hud.setHoveredButton(chosenButton);
  }

  function stop() {
    releaseAll();
    hands.resetAll();
    lab.hud.setHoveredButton(null);
    game.pause();
  }

  function resume() {
    game.resume();
    previousTime = performance.now();
  }

  return {
    update,
    stop,
    resume,
    releaseAll
  };
}
