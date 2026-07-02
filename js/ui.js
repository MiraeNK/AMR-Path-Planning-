import { state } from './state.js';
import { sw } from './websocket.js';
import { inverseApplyOffset, canvasToMap, mapToCanvas, applyOffset, recomputeOffset } from './math.js';
import { sampleCurve, pathLengthM, buildDense } from './bezier.js';
import { draw, clearMeasure, animZ } from './renderer.js';

// ── UI helpers ────────────────────────────────────────────────────────
export function tc(id) { document.getElementById(id).classList.toggle('col'); }

// ── Control ───────────────────────────────────────────────────────────
export function closeLoop() {
  if (state.anchors.length < 3) {
    alert("Minimal butuh 3 titik untuk membuat loop.");
    return;
  }

  const first = state.anchors[0];

  // Ubah titik pertama menjadi rounded agar transisi putaran mulus
  first.type = 'rounded';
  first.round = true;

  // Push titik terakhir
  state.anchors.push({ x: first.x, y: first.y, hIn: null, hOut: null, type: 'rounded', round: true });

  buildDense();
  draw();
  updAnchorList();

  // ─── FITUR POPUP CONTINUOUS LOOP ───
  const isContinuous = confirm("Jalur telah terhubung!\n\nApakah Anda ingin mengatur rute ini menjadi CONTINUOUS (Robot akan terus berputar tanpa henti)?");

  if (isContinuous) {
    // Kirim perintah aktifkan loop ke ROS
    sw({ cmd: 'enable_loop' });
    console.log("Continuous Loop Aktif");
    log("Jalur Loop + Patroli Continuous AKTIF", "ok");
  } else {
    // Kirim perintah nonaktifkan loop ke ROS (hanya 1 putaran)
    sw({ cmd: 'disable_loop' });
    console.log("Single Loop Aktif");
    log("Jalur Loop (Hanya 1 Putaran)", "in");
  }
}

export function sendPath() {
  if (state.anchors.length < 2) { log('Minimal 2 anchor.', 'er'); return; }
  const dense = sampleCurve(state.sampleStepM);
  const pts = dense.map(p => { const raw = inverseApplyOffset(p.x, p.y); return { x: +raw.x.toFixed(4), y: +raw.y.toFixed(4) }; });
  if (sw({ type: 'set_path', points: pts }))
    log(`Mengirim ${pts.length} titik (${state.anchors.length} anchor · sampling ${(state.sampleStepM * 100).toFixed(0)}cm · ${pathLengthM().toFixed(2)}m)...`, 'in');
}

export function cmd(c) {
  if (c === 'rerun') { if (sw({ type: 'rerun' })) log('Ulangi jalur terakhir.', 'in'); }
  else { if (sw({ cmd: c })) log(`Perintah: ${c}`, 'in'); }
}

export function onSpd(v) {
  document.getElementById('spdV').textContent = parseFloat(v).toFixed(2);
  if (state.ws && state.ws.readyState === WebSocket.OPEN) sw({ cmd: 'set_speed', value: parseFloat(v) });
}

export function onSmp(v) {
  state.sampleStepM = parseFloat(v);
  document.getElementById('smpV').textContent = (state.sampleStepM * 100).toFixed(0) + 'cm';
}

export function onCornerRound(v) {
  state.cornerRound = v;
  state.anchors.forEach((a, i) => { if (!a.hIn && !a.hOut && i > 0 && i < state.anchors.length - 1) a.round = v; });
  updAnchorList(); draw();
}

export function onCornerRadius(v) {
  state.cornerRadiusM = parseFloat(v);
  document.getElementById('cradV').textContent = state.cornerRadiusM.toFixed(2);
  draw();
}

export function toggleRound(i) {
  const a = state.anchors[i];
  if (a && !a.hIn && !a.hOut) { a.round = !a.round; updAnchorList(); draw(); }
}

export function sendPose(x, y, yaw) {
  if (sw({ type: 'pose_estimate', x, y, yaw })) {
    log(`Pose: (${x.toFixed(2)},${y.toFixed(2)}) ${(yaw * 180 / Math.PI).toFixed(0)}°`, 'ok');
  }
  // Update robot langsung tanpa tunggu AMCL
  if (!state.robot) state.robot = { x: 0, y: 0, yaw_deg: 0 };
  state.robot.x = x; state.robot.y = y; state.robot.yaw_deg = yaw * 180 / Math.PI;
  // Hitung offset baru berdasarkan posisi odometry terakhir
  recomputeOffset(x, y, yaw * 180 / Math.PI);
  // Bekukan updStatus 3 detik agar tidak override posisi baru
  state.poseJustSet = true;
  if (state.poseJustSetTimer) clearTimeout(state.poseJustSetTimer);
  state.poseJustSetTimer = setTimeout(() => { state.poseJustSet = false; }, 3000);
  document.getElementById('sX').textContent = x.toFixed(2);
  document.getElementById('sY').textContent = y.toFixed(2);
  document.getElementById('sH').textContent = (yaw * 180 / Math.PI).toFixed(0) + '°';
  draw();
}

// ── Status callbacks ──────────────────────────────────────────────────
export function updStatus(s) {
  state.lastRawStatus = { x: s.x, y: s.y, yaw_deg: s.yaw_deg };
  const c = applyOffset(s.x, s.y, s.yaw_deg);
  document.getElementById('sX').textContent = s.x !== undefined ? c.x.toFixed(2) : '—';
  document.getElementById('sY').textContent = s.y !== undefined ? c.y.toFixed(2) : '—';
  document.getElementById('sH').textContent = s.yaw_deg !== undefined ? c.yaw_deg.toFixed(0) + '°' : '—';
  document.getElementById('sW').textContent = (s.waypoint !== undefined && s.total_wp !== undefined) ? `${s.waypoint}/${s.total_wp}` : '—';
  const b = document.getElementById('sBadge');
  b.className = 'pill ' + (s.state || '');
  b.innerHTML = '<span class="d"></span>' + (s.state || 'IDLE');
  const ph = document.getElementById('sPhase');
  if (s.phase === 'PIVOT') { ph.textContent = '↻ Memutar di tempat menuju arah waypoint'; ph.style.display = 'block'; }
  else if (s.phase === 'FORWARD') { ph.textContent = '↑ Maju lurus menuju waypoint'; ph.style.display = 'block'; }
  else { ph.style.display = 'none'; }
  document.getElementById('obsWarn').style.display = s.obstacle ? 'flex' : 'none';

  // Jangan update posisi di canvas kalau pose baru saja di-set manual
  if (!state.poseJustSet) {
    if (!state.robot) state.robot = { x: 0, y: 0, yaw_deg: 0 };
    state.robot.x = c.x; state.robot.y = c.y; state.robot.yaw_deg = c.yaw_deg;
  }
  draw();
}

export function updPose(d) {
  // source='amcl' → recompute offset (lokalisasi terkoreksi)
  // source='odom' → hanya update posisi di canvas, jangan ubah offset
  if (d.source === 'amcl') {
    recomputeOffset(d.x, d.y, d.yaw_deg);
    if (!state.robot) state.robot = { x: 0, y: 0, yaw_deg: 0 };
    state.robot.x = d.x; state.robot.y = d.y; state.robot.yaw_deg = d.yaw_deg;
    document.getElementById('sX').textContent = d.x.toFixed(2);
    document.getElementById('sY').textContent = d.y.toFixed(2);
    document.getElementById('sH').textContent = d.yaw_deg.toFixed(0) + '°';
  }
  // source='odom' → diabaikan di sini, sudah ditangani updStatus
  draw();
}

export function updScan(p) { state.scan = p || []; state.scanT = Date.now(); draw(); }

// ── Map load ──────────────────────────────────────────────────────────
export function loadMap(f) {
  const r = new FileReader();
  r.onload = e => { const img = new Image(); img.onload = () => { state.mapImg = img; resetView(); log('Peta dimuat.', 'ok'); }; img.src = e.target.result; };
  r.readAsDataURL(f);
}

export function loadYaml(f) {
  const r = new FileReader();
  r.onload = e => {
    const t = e.target.result;
    const res = parseFloat((t.match(/resolution:\s*([\d.eE+-]+)/) || [])[1] || 0.05);
    const orig = (t.match(/origin:\s*\[([^\]]+)\]/) || ['', '0,0,0'])[1].split(',').map(Number);
    state.meta = { resolution: res, ox: orig[0], oy: orig[1] };
    log(`YAML: res=${res} m/px · origin=(${orig[0].toFixed(2)}, ${orig[1].toFixed(2)})`, 'ok');
    draw();
  };
  r.readAsText(f);
}

// ── Map rotation ──────────────────────────────────────────────────────
export function onRot(v) {
  state.mapRot = parseFloat(v);
  document.getElementById('rotV').textContent = Math.round(state.mapRot) + '°';
  draw();
}

export function rotStep(d) {
  state.mapRot = (state.mapRot + d + 360) % 360;
  document.getElementById('rot').value = state.mapRot;
  document.getElementById('rotV').textContent = Math.round(state.mapRot) + '°';
  draw();
}

export function rotReset() {
  state.mapRot = 0;
  document.getElementById('rot').value = 0;
  document.getElementById('rotV').textContent = '0°';
  draw();
}

// ── Anchors ───────────────────────────────────────────────────────────
export function undoLast() { if (state.anchors.length) { state.anchors.pop(); updAnchorList(); draw(); } }
export function clearAll() { state.anchors = []; updAnchorList(); draw(); }
export function delAnchor(i) { state.anchors.splice(i, 1); updAnchorList(); draw(); }

export function updAnchorList() {
  document.getElementById('wpN').textContent = state.anchors.length;
  const l = document.getElementById('wpL');
  if (!state.anchors.length) { l.innerHTML = '<div class="we">Belum ada titik. Pilih Pen, klik untuk corner, klik-drag untuk kurva.</div>'; return; }
  l.innerHTML = state.anchors.map((a, i) => {
    const isCorner = (!a.hIn && !a.hOut), interior = i > 0 && i < state.anchors.length - 1;
    let typeHtml;
    if (!isCorner) { typeHtml = `<span style="font-size:9px;color:var(--ink-faint);margin-left:4px">kurva</span>`; }
    else if (interior) { const on = !!a.round; typeHtml = `<span onclick="toggleRound(${i})" style="cursor:pointer;font-size:9px;margin-left:4px;font-weight:${on ? '700' : '400'};color:${on ? 'var(--blue-dk)' : 'var(--ink-faint)'}">${on ? 'rounded' : 'corner'}</span>`; }
    else { typeHtml = `<span style="font-size:9px;color:var(--ink-faint);margin-left:4px">corner</span>`; }
    return `<div class="wi${i === 0 ? ' act' : ''}">` +
      `<span class="wn">${i + 1}</span>` +
      `<span class="wc">(${a.x.toFixed(2)}, ${a.y.toFixed(2)})</span>` +
      typeHtml +
      `<span class="wd" onclick="delAnchor(${i})">✕</span></div>`;
  }).join('');
  l.scrollTop = l.scrollHeight;
}

export function hitAnchor(sx, sy) {
  for (let i = state.anchors.length - 1; i >= 0; i--) { const s = mapToCanvas(state.anchors[i].x, state.anchors[i].y); if (Math.hypot(s.px - sx, s.py - sy) < 11) return i; } return -1;
}

export function hitHandle(sx, sy) {
  for (let i = state.anchors.length - 1; i >= 0; i--) { const a = state.anchors[i]; for (const side of ['hIn', 'hOut']) { if (a[side]) { const s = mapToCanvas(a[side].x, a[side].y); if (Math.hypot(s.px - sx, s.py - sy) < 9) return { i, side }; } } } return null;
}

export function penDown(e) {
  const sx = e.offsetX, sy = e.offsetY;
  const h = hitHandle(sx, sy); if (h) { state.penDrag = { mode: 'handle', i: h.i, side: h.side }; state.suppressNextClick = true; return; }
  const ai = hitAnchor(sx, sy); if (ai >= 0) { state.penDrag = { mode: 'anchor', i: ai }; state.suppressNextClick = true; return; }
  const m = canvasToMap(sx, sy);
  state.anchors.push({ x: m.x, y: m.y, hIn: null, hOut: null, round: state.cornerRound });
  state.penDrag = { mode: 'new', i: state.anchors.length - 1, start: { x: m.x, y: m.y } }; state.suppressNextClick = true;
  updAnchorList(); draw();
}

export function penMove(e) {
  if (!state.penDrag) return; const m = canvasToMap(e.offsetX, e.offsetY); const a = state.anchors[state.penDrag.i]; if (!a) { state.penDrag = null; return; }
  if (state.penDrag.mode === 'new') {
    const dx = m.x - state.penDrag.start.x, dy = m.y - state.penDrag.start.y;
    const thresh = state.meta ? state.meta.resolution * 3 : 0.02;
    if (Math.hypot(dx, dy) > thresh) { a.hOut = { x: a.x + dx, y: a.y + dy }; a.hIn = { x: a.x - dx, y: a.y - dy }; }
    else { a.hOut = null; a.hIn = null; }
  } else if (state.penDrag.mode === 'anchor') {
    const dx = m.x - a.x, dy = m.y - a.y; a.x = m.x; a.y = m.y;
    if (a.hIn) { a.hIn.x += dx; a.hIn.y += dy; } if (a.hOut) { a.hOut.x += dx; a.hOut.y += dy; }
  } else if (state.penDrag.mode === 'handle') {
    a[state.penDrag.side] = { x: m.x, y: m.y };
    const other = state.penDrag.side === 'hIn' ? 'hOut' : 'hIn';
    if (!e.altKey) a[other] = { x: 2 * a.x - m.x, y: 2 * a.y - m.y };
  }
  updAnchorList(); draw();
}

export function penUp() { state.penDrag = null; }

export function penDelete(e) {
  const ai = hitAnchor(e.offsetX, e.offsetY);
  if (ai >= 0) state.anchors.splice(ai, 1); else state.anchors.pop();
  updAnchorList(); draw();
}

// ── Tool & view ───────────────────────────────────────────────────────
export function setTool(t) {
  state.tool = t;
  const map = { pen: 'tDraw', pose: 'tPose', measure: 'tMeas', pan: 'tPan' };
  Object.entries(map).forEach(([key, id]) => { const el = document.getElementById(id); if (!el) return; el.classList.toggle('act', key === t); if (id === 'tPose') el.classList.toggle('pose', key === t); });
  state.cvEl.style.cursor = { pen: 'crosshair', pose: 'crosshair', measure: 'crosshair', pan: 'grab' }[t] || 'crosshair';
  document.getElementById('hint').textContent = {
    pen: 'Klik = corner · Klik-drag = kurva · Tarik handle = atur lengkung · Alt+handle = patahkan · Klik kanan = hapus',
    pose: 'Klik tahan + drag = set posisi & arah robot',
    measure: 'Klik = tambah titik ukur · Klik kanan = hapus titik terakhir · Esc = bersihkan',
    pan: 'Klik tahan + drag = geser peta · Scroll = zoom'
  }[t];
  if (t !== 'measure') state.measHover = null; draw();
}

export function resetView() {
  if (state.mapImg) {
    const cw = document.getElementById('cw');
    const sx = cw.clientWidth / state.mapImg.naturalWidth;
    const sy = cw.clientHeight / state.mapImg.naturalHeight;
    state.vs = Math.min(sx, sy) * .9; state.ts = state.vs;
    state.vx = (cw.clientWidth - state.mapImg.naturalWidth * state.vs) / 2;
    state.vy = (cw.clientHeight - state.mapImg.naturalHeight * state.vs) / 2;
  } else { state.vx = 0; state.vy = 0; state.vs = 1; state.ts = 1; }
  draw();
}

export function zoomStep(d) {
  const f = d > 0 ? 1.25 : .8;
  state.ts = Math.max(.05, Math.min(50, state.ts * f));
  state.za = { x: state.cvEl.width / 2, y: state.cvEl.height / 2 };
  if (!state.zraf) animZ();
}

// ── Log ───────────────────────────────────────────────────────────────
export function log(msg, type = 'in') {
  const b = document.getElementById('lb');
  const cls = type === 'ok' ? 'ok' : type === 'er' ? 'er' : 'in';
  const ts = new Date().toLocaleTimeString('id', { hour12: false });
  b.innerHTML += `<div class="${cls}"><span class="lts">[${ts}]</span> ${msg}</div>`;
  b.scrollTop = b.scrollHeight; while (b.children.length > 60) b.removeChild(b.firstChild);
}

export function setWS(c) {
  document.getElementById('wsDot').className = 'ws-dot' + (c ? ' on' : '');
  document.getElementById('wsLabel').textContent = c ? 'Terhubung' : 'Tidak terhubung';
}

// Re-export clearMeasure from renderer so events.js can import from one place
export { clearMeasure };
