import { CATEGORIES, TABLES, TABLE_TOP } from './config.js';

export function createGame(lab) {
  const { pieces, bins, hud } = lab;
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, 0]));
  const times = Object.fromEntries(CATEGORIES.map(c => [c.id, null]));
  let phase = 'pending';
  let hits = 0, errors = 0, attempts = 0;
  let elapsed = 0, runStart = 0;
  let message = 'Pulsa COMENZAR dentro del laboratorio';
  let noticeUntil = 0;
  let audioContext = null;
  let lastHudAt = 0;
  const nowMs = () => performance.now();

  function elapsedSeconds(now = nowMs()) {
    return elapsed + (phase === 'active' ? (now - runStart) / 1000 : 0);
  }
  function notify(text, duration = 1700) {
    message = text;
    noticeUntil = nowMs() + duration;
    lastHudAt = 0;
  }
  function unlockAudio() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audioContext) audioContext = new Audio();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    } catch (e) { console.warn('Audio no disponible', e); }
  }
  function tone(frequency, delay = 0, duration = .13) {
    if (!audioContext || audioContext.state !== 'running') return;
    const when = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency;
    oscillator.connect(gain); gain.connect(audioContext.destination);
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(.06, when + .014);
    gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    oscillator.start(when); oscillator.stop(when + duration + .01);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function sound(type) {
    if (type === 'success') { tone(630); tone(840, .10); }
    if (type === 'error') tone(240, 0, .22);
    if (type === 'complete') { tone(530); tone(680, .14); tone(890, .29, .24); }
  }

  function start() {
    if (phase !== 'pending') return;
    unlockAudio();
    phase = 'active'; runStart = nowMs();
    notify('Clasifica las veinte figuras en sus botes', 2500);
  }
  function pause() {
    if (phase !== 'active') return;
    elapsed = elapsedSeconds();
    phase = 'paused';
    notify('Pausa: sesión VR cerrada');
  }
  function resume() {
    if (phase !== 'paused') return;
    phase = 'active'; runStart = nowMs();
    notify('Partida reanudada');
  }
  function canGrab(piece) {
    return phase === 'active' && !['held', 'classified', 'error'].includes(piece.state);
  }
  function onGrab(piece) {
    if (!canGrab(piece)) return false;
    piece.state = 'held';
    piece.stillFor = 0;
    piece.enteredFromTop = false;
    piece.recoveryAt = null;
    piece.mesh.material.emissiveIntensity = .35;
    return true;
  }
  function onRelease(piece) {
    if (piece.state !== 'held') return;
    piece.state = 'released';
    piece.releaseId++;
    // Conserva si durante el agarre pasó por encima de la abertura.
    piece.stillFor = 0;
    piece.releasedAt = nowMs();
    piece.mesh.material.emissiveIntensity = .07;
  }
  function findRecoveryPosition(piece) {
    const t = TABLES[piece.tableIndex];
    const options = [
      [-.36, -.14], [0, -.14], [.36, -.14], [-.18, .15], [.18, .15],
      [-.37, .16], [.37, .16], [0, .16]
    ];
    for (const [dx, dz] of options) {
      const x = t.x + dx, z = t.z + dz;
      const free = pieces.every(other => other === piece ||
        (Math.hypot(other.body.position.x - x, other.body.position.z - z) > .255 ||
         Math.abs(other.body.position.y - TABLE_TOP) > .65));
      if (free) return { x, y: TABLE_TOP + .17, z };
    }
    return { ...piece.home, y: TABLE_TOP + .33 };
  }
  function restore(piece) {
    lab.restore(piece, findRecoveryPosition(piece));
  }
  function reset() {
    hits = 0; errors = 0; attempts = 0;
    elapsed = 0; runStart = 0; phase = 'pending';
    for (const c of CATEGORIES) { counts[c.id] = 0; times[c.id] = null; }
    lab.resetPositions();
    lab.physics.resetClock();
    notify('Nueva distribución. Pulsa COMENZAR.', 2800);
    updateHUD(true);
  }

  function isHorizontallyInside(piece, bin) {
    const p = piece.body.position;
    return Math.abs(p.x - bin.x) <= bin.width / 2 - .075 &&
      Math.abs(p.z - bin.z) <= bin.depth / 2 - .075;
  }
  function isContained(piece, bin) {
    const p = piece.body.position;
    return isHorizontallyInside(piece, bin) &&
      p.y >= bin.floor + .068 && p.y <= bin.rim - .027;
  }
  function isStable(piece) {
    const body = piece.body;
    const v = body.velocity, av = body.angularVelocity;
    return Math.hypot(v.x, v.y, v.z) < .19 && Math.hypot(av.x, av.y, av.z) < .8;
  }
  function registerAttempt(piece, bin) {
    if (piece.countedReleaseId === piece.releaseId) return;
    piece.countedReleaseId = piece.releaseId;
    attempts++;
    if (piece.category === bin.id) {
      hits++;
      counts[bin.id]++;
      piece.state = 'classified';
      piece.mesh.material.emissiveIntensity = .23;
      sound('success');
      notify(`¡Correcto! ${piece.categoryName}: ${counts[bin.id]}/5`, 2000);
      if (counts[bin.id] === 5) times[bin.id] = elapsedSeconds();
      if (hits === 20) {
        elapsed = elapsedSeconds();
        phase = 'completed';
        notify(`¡Laboratorio completado! Precisión: ${(100 * hits / attempts).toFixed(1)}%`, 14000);
        sound('complete');
      }
    } else {
      errors++;
      piece.state = 'error';
      piece.recoveryAt = nowMs() + 1800;
      piece.mesh.material.emissive.setHex(0xff3535);
      piece.mesh.material.emissiveIntensity = .60;
      sound('error');
      notify(`Bote equivocado. ${piece.categoryName} no va aquí.`, 2400);
    }
    updateHUD(true);
  }
  function updatePhysicsRules(dt) {
    if (phase !== 'active') return;
    const now = nowMs();
    for (const piece of pieces) {
      if (piece.state === 'error') {
        if (now >= piece.recoveryAt) restore(piece);
        continue;
      }
      if (piece.state === 'classified' || piece.state === 'held') continue;
      if (piece.state === 'released' || piece.state === 'stabilizing') {
        let inside = null;
        for (const bin of bins) {
          if (isHorizontallyInside(piece, bin) && piece.body.position.y >= bin.rim - .04) {
            piece.enteredFromTop = true;
          }
          if (isContained(piece, bin)) { inside = bin; break; }
        }
        if (inside && piece.enteredFromTop) {
          if (isStable(piece)) {
            piece.stillFor += Math.min(dt, .065);
            piece.state = 'stabilizing';
            if (piece.stillFor >= .64) registerAttempt(piece, inside);
          } else {
            piece.stillFor = 0;
            piece.state = 'released';
          }
        } else {
          piece.stillFor = 0;
          piece.state = 'released';
        }
        if (now - piece.releasedAt > 3500 && piece.body.position.y < .30) {
          piece.state = 'recoverable';
          notify('Pieza en el suelo: puedes agarrarla con la pinza.');
        }
      }
      if (piece.state === 'recoverable' && piece.body.position.y > .35) piece.state = 'available';
      // Fuera del área de trabajo: restauración controlada (no cuenta un intento).
      const p = piece.body.position;
      if (Math.abs(p.x) > 4 || p.z > 2 || p.z < -4.5 || p.y < -.9) {
        restore(piece);
        notify('Pieza recuperada de los límites del laboratorio.');
      }
    }
  }
  function updateHUD(force = false) {
    const now = nowMs();
    if (!force && now - lastHudAt < 180) return;
    lastHudAt = now;
    if (noticeUntil && now > noticeUntil) {
      noticeUntil = 0;
      if (phase === 'pending') message = 'Pulsa COMENZAR para iniciar';
      else if (phase === 'completed') message = '¡Todos los recipientes completos!';
      else if (phase === 'paused') message = 'Partida pausada';
      else message = 'Selecciona, suelta y deja estabilizar la figura';
    }
    hud.update({ phase, hits, errors, attempts,
      precision: attempts ? (hits / attempts) * 100 : 0,
      elapsed: elapsedSeconds(now), counts, times, message });
    const progress = document.getElementById('preview-progress');
    if (progress) progress.textContent = `${hits}/20 · ${errors} errores · ${elapsedSeconds(now).toFixed(0)} s`;
  }
  function update(dt) { updatePhysicsRules(dt); updateHUD(); }
  updateHUD(true);
  return { start, pause, resume, reset, onGrab, onRelease, canGrab,
    unlockAudio, update, get phase() { return phase; },
    getStats: () => ({ phase, hits, errors, attempts, elapsed: elapsedSeconds(), counts: { ...counts }, times: { ...times } }) };
}
