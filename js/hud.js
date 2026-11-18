import * as THREE from 'three';
import { CATEGORIES } from './config.js';

function panelTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture };
}
function rect(ctx, x, y, w, h, color, radius = 18) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
}
function button(label, action, x, color = '#54dfff') {
  const { canvas, ctx, texture } = panelTexture(512, 164);
  rect(ctx, 7, 7, 498, 150, '#11263b', 24);
  ctx.strokeStyle = color; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.roundRect(7, 7, 498, 150, 24); ctx.stroke();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 52px Arial'; ctx.fillStyle = '#fff'; ctx.fillText(label, 256, 84);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.68, .22),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true }));
  mesh.position.set(x, -.91, .10);
  mesh.userData.action = action;
  mesh.userData.type = 'vr-button';
  mesh.userData.texture = texture;
  return mesh;
}
const fmt = seconds => {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

export function createHUD() {
  const { ctx, texture } = panelTexture(1400, 760);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.86, 1.55),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
  const group = new THREE.Group();
  group.position.set(0, 2.15, -3.0);
  group.add(panel);
  const buttons = [button('COMENZAR', 'start', -.79, '#59e3aa'),
    button('REINICIAR', 'reset', 0), button('SALIR VR', 'exit', .79, '#ff8b96')];
  buttons.forEach(b => group.add(b));
  let lastKey = '';

  function update(data = {}) {
    const d = { phase: 'pending', hits: 0, errors: 0, attempts: 0,
      precision: 0, elapsed: 0, counts: {}, times: {}, message: 'Pulsa COMENZAR para iniciar', ...data };
    const key = JSON.stringify({ ...d, elapsed: Math.floor(d.elapsed * 2) / 2 });
    if (key === lastKey) return;
    lastKey = key;
    ctx.clearRect(0, 0, 1400, 760);
    rect(ctx, 7, 7, 1386, 746, '#0b1c30', 32);
    ctx.lineWidth = 7; ctx.strokeStyle = '#4dcbe4';
    ctx.beginPath(); ctx.roundRect(7, 7, 1386, 746, 32); ctx.stroke();
    ctx.fillStyle = '#54dfff'; ctx.font = 'bold 66px Arial'; ctx.fillText('NEXUS VR · 3.2', 55, 94);
    ctx.fillStyle = '#afbed4'; ctx.font = 'bold 34px Arial'; ctx.fillText('CLASIFICACIÓN FÍSICA', 820, 89);
    rect(ctx, 45, 130, 1310, 152, '#132d45', 18);
    ctx.fillStyle = '#a9b9d0'; ctx.font = 'bold 36px Arial'; ctx.fillText('ACIERTOS', 75, 181);
    ctx.fillText('TIEMPO', 570, 181); ctx.fillText('ERRORES', 960, 181);
    ctx.font = 'bold 71px Arial'; ctx.fillStyle = '#fff';
    ctx.fillText(`${d.hits}/20`, 75, 258); ctx.fillText(fmt(d.elapsed), 570, 258);
    ctx.fillStyle = '#ff9ca4'; ctx.fillText(String(d.errors), 960, 258);
    CATEGORIES.forEach((c, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 45 + col * 668, y = 305 + row * 130;
      rect(ctx, x, y, 638, 115, '#142a40', 17);
      ctx.fillStyle = c.css; ctx.font = 'bold 38px Arial'; ctx.fillText(c.name, x + 23, y + 48);
      ctx.fillStyle = '#fff'; ctx.fillText(`${d.counts[c.id] || 0}/5`, x + 510, y + 48);
      ctx.fillStyle = '#b8c6d9'; ctx.font = '29px Arial';
      ctx.fillText(`Bote completo: ${d.times[c.id] == null ? 'pendiente' : fmt(d.times[c.id])}`, x + 23, y + 88);
    });
    ctx.fillStyle = '#e3edff'; ctx.font = 'bold 32px Arial';
    ctx.fillText(`INTENTOS: ${d.attempts}   |   PRECISIÓN: ${d.precision.toFixed(1)}%`, 55, 612);
    ctx.fillStyle = d.phase === 'completed' ? '#59e3aa' : '#54dfff';
    ctx.font = 'bold 29px Arial';
    ctx.fillText(d.message.slice(0, 70), 55, 659, 1280);
    ctx.fillStyle = '#b8c6d9'; ctx.font = 'bold 27px Arial';
    const phaseNames = { pending: 'ESPERANDO INICIO', active: 'EN PROGRESO', paused: 'EN PAUSA', completed: 'COMPLETADO' };
    ctx.fillText(`ESTADO: ${phaseNames[d.phase] || d.phase}`, 55, 709);
    texture.needsUpdate = true;
  }
  function setHoveredButton(chosen) {
    for (const b of buttons) b.material.color.setHex(chosen === b ? 0xbde9ff : 0xffffff);
  }
  update();
  return { group, buttons, update, setHoveredButton };
}
