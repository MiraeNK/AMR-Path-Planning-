import { state } from './state.js';
import { updStatus, updPose, updScan, log, setWS } from './ui.js';

function toggleConn() {
      if (state.ws && state.ws.readyState === WebSocket.OPEN) { state.ws.close(); return; }
      const url = document.getElementById('wsUrl').value.trim();
      log(`Menghubungkan ke ${url}...`, 'in');
      state.ws = new WebSocket(url);
      state.ws.onopen = () => { setWS(true); log('Terhubung.', 'ok'); };
      state.ws.onmessage = e => {
        try {
          const d = JSON.parse(e.data);
          if (d.state !== undefined) updStatus(d);
          if (d.type === 'robot_pose') updPose(d);
          if (d.type === 'path_ack') log(d.data.status === 'ok' ? `✓ ${d.data.message}` : `✗ ${d.data.message}`, d.data.status === 'ok' ? 'ok' : 'er');
          if (d.type === 'state.scan') updScan(d.points);
        } catch (err) { }
      };
      state.ws.onclose = () => { setWS(false); log('Terputus.', 'er'); };
      state.ws.onerror = () => { log('Error koneksi.', 'er'); };
    }
    function sw(o) {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) { log('Belum terhubung.', 'er'); return false; }
      state.ws.send(JSON.stringify(o)); return true;
    }


export { toggleConn, sw };
