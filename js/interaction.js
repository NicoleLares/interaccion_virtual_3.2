import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Conserva raycasting y gesto de pinza de la práctica 3.1.
// El movimiento ahora controla el CUERPO RÍGIDO, nunca solo la malla.
export function createInteraction(lab, hands, game, options = {}) {
  const raycaster = new THREE.Raycaster();
  raycaster.near = .03; raycaster.far = 3.6;
  const rayOrigin = new THREE.Vector3();
  const rayDirection = new THREE.Vector3();
  const target = new THREE.Vector3();
  const current = new THREE.Vector3();
  const stepVec = new THREE.Vector3();
  const lastNow = performance.now();
  const grabs = new Map();
  const claimed = new Set();
  const pieceByMesh = new Map(lab.pieces.map(p => [p.mesh, p]));
  const meshes = lab.pieces.map(p => p.mesh);
  let previousTime = lastNow;

  function updateRay(slot) {
    slot.controller.updateMatrixWorld(true);
    rayOrigin.setFromMatrixPosition(slot.controller.matrixWorld);
    rayDirection.set(0, 0, -1).transformDirection(slot.controller.matrixWorld).normalize();
    raycaster.set(rayOrigin, rayDirection);
  }
  function nearestPiece() {
    const hit = raycaster.intersectObjects(meshes, false)
      .find(h => game.canGrab(pieceByMesh.get(h.object)) && !claimed.has(pieceByMesh.get(h.object).id));
    if (hit) return { piece: pieceByMesh.get(hit.object), distance: hit.distance };
    return null;
  }
  function nearestButton() {
    const hit = raycaster.intersectObjects(lab.hud.buttons, false)[0];
    return hit ? { button: hit.object, distance: hit.distance } : null;
  }
  function grab(slot, selected) {
    const piece = selected.piece;
    if (!piece || claimed.has(piece.id) || !game.onGrab(piece)) return;
    const body = piece.body;
    const offset = new THREE.Vector3().copy(body.position).sub(rayOrigin.clone().addScaledVector(rayDirection, selected.distance));
    body.type = CANNON.Body.KINEMATIC;
    body.mass = 0;
    body.updateMassProperties();
    body.velocity.setZero(); body.angularVelocity.setZero();
    body.wakeUp();
    grabs.set(slot.index, { piece, distance: Math.max(.20, selected.distance), offset,
      previous: new THREE.Vector3().copy(body.position), velocity: new THREE.Vector3() });
    claimed.add(piece.id);
  }
  function move(slot, dt) {
    const held = grabs.get(slot.index);
    if (!held) return;
    const p = held.piece;
    const body = p.body;
    target.copy(rayOrigin).addScaledVector(rayDirection, held.distance).add(held.offset);
    target.x = THREE.MathUtils.clamp(target.x, -1.85, 1.85);
    target.y = THREE.MathUtils.clamp(target.y, .16, 2.4);
    target.z = THREE.MathUtils.clamp(target.z, -2.80, .30);
    current.copy(body.position);
    stepVec.copy(target).sub(current);
    const distance = stepVec.length();
    if (distance > .0001) {
      stepVec.multiplyScalar(Math.min(1, (.045 + dt * 1.1) / distance));
      target.copy(current).add(stepVec);
      // Barrera conservadora contra atravesar volúmenes estáticos.
      if (lab.physics.safeForHeld(target.x, target.y, target.z)) {
        body.position.set(target.x, target.y, target.z);
        // Marca el acceso por la boca incluso si se baja el objeto estando sujeto.
        for (const bin of lab.bins) {
          const insideOpening = Math.abs(target.x - bin.x) < bin.width / 2 - .075 &&
            Math.abs(target.z - bin.z) < bin.depth / 2 - .075;
          if (insideOpening && target.y >= bin.rim - .035) p.enteredFromTop = true;
        }
        // La pose cinemática se actualiza aquí; velocidad del cuerpo = 0 para evitar doble integración.
        body.velocity.setZero();
        const velocity = new THREE.Vector3().subVectors(target, held.previous).divideScalar(dt);
        held.velocity.lerp(velocity, .3);
        if (held.velocity.length() > 1.6) held.velocity.setLength(1.6);
        held.previous.copy(target);
        body.aabbNeedsUpdate = true;
        body.wakeUp();
      } else {
        body.velocity.setZero();
      }
    } else body.velocity.setZero();
  }
  function release(index) {
    const held = grabs.get(index);
    if (!held) return;
    const body = held.piece.body;
    body.type = CANNON.Body.DYNAMIC;
    body.mass = .38;
    body.updateMassProperties();
    const v = held.velocity;
    body.velocity.set(v.x, v.y, v.z);
    body.angularVelocity.setZero();
    body.wakeUp();
    game.onRelease(held.piece);
    claimed.delete(held.piece.id);
    grabs.delete(index);
  }
  function releaseAll() { for (const idx of [...grabs.keys()]) release(idx); }
  function activate(button) {
    const action = button?.userData?.action;
    if (action === 'start') game.start();
    if (action === 'reset') { releaseAll(); game.reset(); }
    if (action === 'exit') options.onExitVR?.();
  }
  function update() {
    hands.update();
    const now = performance.now();
    const dt = Math.max(.009, Math.min((now - previousTime) / 1000, .055));
    previousTime = now;
    let chosenButton = null;
    for (const slot of hands.slots) {
      if (!slot.tracking) {
        if (grabs.has(slot.index)) release(slot.index);
        slot.laser.visible = false; slot.cursor.visible = false;
        continue;
      }
      updateRay(slot);
      if (grabs.has(slot.index)) {
        if (slot.justReleased || !slot.pressed) release(slot.index);
        else move(slot, dt);
        slot.setRayDistance(.8);
        continue;
      }
      const buttonHit = nearestButton();
      const pieceHit = game.phase === 'active' ? nearestPiece() : null;
      const hitButton = buttonHit && (!pieceHit || buttonHit.distance < pieceHit.distance);
      const targetDistance = hitButton ? buttonHit.distance : (pieceHit?.distance || 2.0);
      slot.setRayDistance(targetDistance);
      if (hitButton) chosenButton = buttonHit.button;
      if (slot.justPressed) {
        if (hitButton) activate(buttonHit.button);
        else if (pieceHit) grab(slot, pieceHit);
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
  function resume() { game.resume(); previousTime = performance.now(); }
  return { update, stop, resume, releaseAll };
}
