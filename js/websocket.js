import { state } from './state.js';

// ── Callbacks (set dari luar untuk hindari circular dependency) ───────
let _log = () => {};
let _setWS = () => {};
let _updStatus = () => {};
let _updPose = () => {};
let _updScan = () => {};

export function setWsCallbacks({ log, setWS, updStatus, updPose, updScan }) {
  _log = log;
  _setWS = setWS;
  _updStatus = updStatus;
  _updPose = updPose;
  _updScan = updScan;
}

export function toggleConn() {
  if (state.ws && state.ws.readyState === WebSocket.OPEN) { state.ws.close(); return; }
  const url = document.getElementById('wsUrl').value.trim();
  _log(`Menghubungkan ke ${url}...`, 'in');
  state.ws = new WebSocket(url);
  state.ws.onopen = () => { _setWS(true); _log('Terhubung.', 'ok'); };
  state.ws.onmessage = e => {
    try {
      const d = JSON.parse(e.data);
      if (d.state !== undefined) _updStatus(d);
      if (d.type === 'robot_pose') _updPose(d);
      if (d.type === 'path_ack') _log(d.data.status === 'ok' ? `✓ ${d.data.message}` : `✗ ${d.data.message}`, d.data.status === 'ok' ? 'ok' : 'er');
      if (d.type === 'scan') _updScan(d.points);
    } catch (err) { }
  };
  state.ws.onclose = () => { _setWS(false); _log('Terputus.', 'er'); };
  state.ws.onerror = () => { _log('Error koneksi.', 'er'); };
}

export function sw(o) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) { _log('Belum terhubung.', 'er'); return false; }
  state.ws.send(JSON.stringify(o)); return true;
}
