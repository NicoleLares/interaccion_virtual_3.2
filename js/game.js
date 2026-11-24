
import {
  CATEGORIES,
  TABLES,
  TABLE_TOP
} from './config.js';

export function createGame(lab) {
  const { pieces, bins, hud } = lab;

  const counts = Object.fromEntries(
    CATEGORIES.map(c => [c.id, 0])
  );

  const times = Object.fromEntries(
    CATEGORIES.map(c => [c.id, null])
  );

  let phase = 'pending';
  let hits = 0;
  let errors = 0;
  let attempts = 0;

  let elapsed = 0;
  let runStart = 0;

  let message = 'Pulsa COMENZAR dentro del laboratorio';
  let noticeUntil = 0;
  let audioContext = null;
  let lastHudAt = 0;

  const nowMs = () => performance.now();

  function elapsedSeconds(now = nowMs()) {
    return elapsed + (
      phase === 'active'
        ? (now - runStart) / 1000
        : 0
    );
  }

  function notify(text, duration = 1700) {
    message = text;
    noticeUntil = nowMs() + duration;
    lastHudAt = 0;
  }

  function unlockAudio() {
    try {
      const Audio =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!Audio) return;

      if (!audioContext) {
        audioContext = new Audio();
      }

      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
    } catch (e) {
      console.warn('Audio no disponible', e);
    }
  }

  function tone(frequency, delay = 0, duration = 0.13) {
    if (
      !audioContext ||
      audioContext.state !== 'running'
    ) return;

    const when = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(
      0.06,
      when + 0.014
    );
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      when + duration
    );

    oscillator.start(when);
    oscillator.stop(when + duration + 0.01);

    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  function sound(type) {
    if (type === 'success') {
      tone(630);
      tone(840, 0.10);
    }

    if (type === 'error') {
      tone(240, 0, 0.22);
    }

    if (type === 'complete') {
      tone(530);
      tone(680, 0.14);
      tone(890, 0.29, 0.24);
    }
  }

  function start() {
    if (phase !== 'pending') return;

    unlockAudio();
    phase = 'active';
    runStart = nowMs();

    notify(
      'Clasifica las veinte figuras en sus botes',
      2500
    );
  }

  function pause() {
    if (phase !== 'active') return;

    elapsed = elapsedSeconds();
    phase = 'paused';

    notify('Pausa: sesión VR cerrada');
  }

  function resume() {
    if (phase !== 'paused') return;

    phase = 'active';
    runStart = nowMs();

    notify('Partida reanudada');
  }

  function canGrab(piece) {
    return phase === 'active' &&
      ![
        'held',
        'classified',
        'error',
        'recovering'
      ].includes(piece.state);
  }

  function onGrab(piece) {
    if (!canGrab(piece)) return false;

    piece.state = 'held';
    piece.stillFor = 0;
    piece.enteredFromTop = false;
    piece.recoveryAt = null;
    piece.floorSince = null;

    piece.mesh.material.emissiveIntensity = 0.35;

    return true;
  }

  function onRelease(piece) {
    if (piece.state !== 'held') return;

    piece.state = 'released';
    piece.releaseId++;
    piece.stillFor = 0;
    piece.releasedAt = nowMs();
    piece.floorSince = null;

    piece.mesh.material.emissiveIntensity = 0.07;
  }

  // Buscar un lugar libre en la mesa original.
  function findRecoveryPosition(piece) {
    const table = TABLES[piece.tableIndex];

    const options = [
      [-0.36, -0.14],
      [0, -0.14],
      [0.36, -0.14],
      [-0.18, 0.15],
      [0.18, 0.15],
      [-0.37, 0.16],
      [0.37, 0.16],
      [0, 0.16]
    ];

    for (const [dx, dz] of options) {
      const x = table.x + dx;
      const z = table.z + dz;

      const free = pieces.every(other =>
        other === piece ||
        (
          Math.hypot(
            other.body.position.x - x,
            other.body.position.z - z
          ) > 0.255 ||
          Math.abs(
            other.body.position.y - TABLE_TOP
          ) > 0.65
        )
      );

      if (free) {
        return {
          x,
          y: TABLE_TOP + 0.17,
          z
        };
      }
    }

    return {
      ...piece.home,
      y: TABLE_TOP + 0.33
    };
  }

  function restore(piece) {
    lab.restore(
      piece,
      findRecoveryPosition(piece)
    );

    piece.floorSince = null;
  }

  function reset() {
    hits = 0;
    errors = 0;
    attempts = 0;
    elapsed = 0;
    runStart = 0;
    phase = 'pending';

    for (const c of CATEGORIES) {
      counts[c.id] = 0;
      times[c.id] = null;
    }

    lab.resetPositions();

    pieces.forEach(piece => {
      piece.floorSince = null;
    });

    lab.physics.resetClock();

    notify(
      'Nueva distribución. Pulsa COMENZAR.',
      2800
    );

    updateHUD(true);
  }

  function isHorizontallyInside(piece, bin) {
    const p = piece.body.position;

    return (
      Math.abs(p.x - bin.x) <=
        bin.width / 2 - 0.075 &&
      Math.abs(p.z - bin.z) <=
        bin.depth / 2 - 0.075
    );
  }

  function isContained(piece, bin) {
    const p = piece.body.position;

    return isHorizontallyInside(piece, bin) &&
      p.y >= bin.floor + 0.068 &&
      p.y <= bin.rim - 0.027;
  }

  function isStable(piece) {
    const body = piece.body;
    const v = body.velocity;
    const av = body.angularVelocity;

    return (
      Math.hypot(v.x, v.y, v.z) < 0.19 &&
      Math.hypot(av.x, av.y, av.z) < 0.8
    );
  }

  function registerAttempt(piece, bin) {
    if (
      piece.countedReleaseId === piece.releaseId
    ) return;

    piece.countedReleaseId = piece.releaseId;

    attempts++;

    if (piece.category === bin.id) {
      hits++;
      counts[bin.id]++;

      piece.state = 'classified';
      piece.mesh.material.emissiveIntensity = 0.23;

      sound('success');

      notify(
        `¡Correcto! ${piece.categoryName}: ${counts[bin.id]}/5`,
        2000
      );

      if (counts[bin.id] === 5) {
        times[bin.id] = elapsedSeconds();
      }

      if (hits === 20) {
        elapsed = elapsedSeconds();
        phase = 'completed';

        notify(
          `¡Laboratorio completado! Precisión: ${(100 * hits / attempts).toFixed(1)}%`,
          14000
        );

        sound('complete');
      }
    } else {
      errors++;

      piece.state = 'error';
      piece.recoveryAt = nowMs() + 1800;

      piece.mesh.material.emissive.setHex(
        0xff3535
      );

      piece.mesh.material.emissiveIntensity = 0.60;

      sound('error');

      notify(
        `Bote equivocado. ${piece.categoryName} no va aquí.`,
        2400
      );
    }

    updateHUD(true);
  }

  // ========================================
  // RECUPERACIÓN AUTOMÁTICA DEL SUELO
  // ========================================

  const FLOOR_THRESHOLD = 0.33;
  const FLOOR_CONFIRM_MS = 350;
  const RETURN_DELAY_MS = 950;

  function updatePhysicsRules(dt) {
    if (phase !== 'active') return;

    const now = nowMs();

    for (const piece of pieces) {

      // Recuperación de error o caída.
      if (
        piece.state === 'error' ||
        piece.state === 'recovering'
      ) {
        if (now >= piece.recoveryAt) {
          restore(piece);
        }

        continue;
      }

      // No mover figuras ya clasificadas
      // ni las que están sujetas por una mano.
      if (
        piece.state === 'classified' ||
        piece.state === 'held'
      ) {
        continue;
      }

      const p = piece.body.position;

      // Detectar una figura caída al piso.
      if (p.y < FLOOR_THRESHOLD) {
        if (piece.floorSince == null) {
          piece.floorSince = now;
        }

        if (
          now - piece.floorSince >=
          FLOOR_CONFIRM_MS
        ) {
          piece.state = 'recovering';

          piece.recoveryAt =
            now + RETURN_DELAY_MS;

          piece.body.velocity.setZero();
          piece.body.angularVelocity.setZero();

          piece.mesh.material.emissive.setHex(
            0xffd166
          );

          piece.mesh.material.emissiveIntensity =
            0.42;

          notify(
            `${piece.categoryName}: vuelve a su mesa.`,
            1900
          );
        }

        continue;
      }

      piece.floorSince = null;

      // ====================================
      // VALIDACIÓN EN RECIPIENTES
      // ====================================

      if (
        piece.state === 'released' ||
        piece.state === 'stabilizing'
      ) {
        let inside = null;

        for (const bin of bins) {
          if (
            isHorizontallyInside(piece, bin) &&
            p.y >= bin.rim - 0.04
          ) {
            piece.enteredFromTop = true;
          }

          if (isContained(piece, bin)) {
            inside = bin;
            break;
          }
        }

        if (
          inside &&
          piece.enteredFromTop
        ) {
          if (isStable(piece)) {
            piece.stillFor += Math.min(
              dt,
              0.065
            );

            piece.state = 'stabilizing';

            if (piece.stillFor >= 0.64) {
              registerAttempt(piece, inside);
            }
          } else {
            piece.stillFor = 0;
            piece.state = 'released';
          }
        } else {
          piece.stillFor = 0;
          piece.state = 'released';
        }
      }

      // Recuperación fuera del escenario.
      if (
        Math.abs(p.x) > 4 ||
        p.z > 2 ||
        p.z < -4.5 ||
        p.y < -0.9
      ) {
        restore(piece);

        notify(
          'Pieza recuperada de los límites del laboratorio.'
        );
      }
    }
  }

  // ========================================
  // MARCADOR VR
  // ========================================

  function updateHUD(force = false) {
    const now = nowMs();

    if (
      !force &&
      now - lastHudAt < 180
    ) {
      return;
    }

    lastHudAt = now;

    if (
      noticeUntil &&
      now > noticeUntil
    ) {
      noticeUntil = 0;

      if (phase === 'pending') {
        message = 'Pulsa COMENZAR para iniciar';
      } else if (phase === 'completed') {
        message = '¡Todos los recipientes completos!';
      } else if (phase === 'paused') {
        message = 'Partida pausada';
      } else {
        message =
          'Selecciona, suelta y deja estabilizar la figura';
      }
    }

    hud.update({
      phase,
      hits,
      errors,
      attempts,
      precision: attempts
        ? (hits / attempts) * 100
        : 0,
      elapsed: elapsedSeconds(now),
      counts,
      times,
      message
    });

    const progress =
      document.getElementById('preview-progress');

    if (progress) {
      progress.textContent =
        `${hits}/20 · ${errors} errores · ${elapsedSeconds(now).toFixed(0)} s`;
    }
  }

  function update(dt) {
    updatePhysicsRules(dt);
    updateHUD();
  }

  updateHUD(true);

  return {
    start,
    pause,
    resume,
    reset,
    onGrab,
    onRelease,
    canGrab,
    unlockAudio,
    update,

    get phase() {
      return phase;
    },

    getStats: () => ({
      phase,
      hits,
      errors,
      attempts,
      elapsed: elapsedSeconds(),
      counts: { ...counts },
      times: { ...times }
    })
  };
}
