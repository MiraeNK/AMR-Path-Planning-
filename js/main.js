import { state, initCanvas } from './state.js';
import { resizeCv, draw } from './renderer.js';
import { setWsCallbacks, toggleConn } from './websocket.js';
import {
  tc, updAnchorList, log, setWS, sendPath, closeLoop, cmd,
  onSpd, onSmp, onCornerRound, onCornerRadius, toggleRound,
  onRot, rotStep, rotReset, clearAll, resetView, undoLast,
  zoomStep, setTool, delAnchor, sendPose,
  updStatus, updPose, updScan
} from './ui.js';

// ── 1. Init canvas (DOM sudah ready karena module script defer) ──────
initCanvas();

// ── 2. Register websocket callbacks (pecah circular dependency) ──────
setWsCallbacks({ log, setWS, updStatus, updPose, updScan });

// ── 3. Import events (harus setelah initCanvas karena pakai state.cvEl)
import('./events.js');

// ── 4. Expose ke global window untuk inline onclick di HTML ──────────
Object.assign(window, {
  tc, toggleConn, sendPath, closeLoop, cmd,
  onSpd, onSmp, onCornerRound, onCornerRadius, toggleRound,
  rotStep, rotReset, clearAll, resetView, undoLast, zoomStep,
  setTool, draw, onRot, delAnchor
});

// ── 5. Init UI ───────────────────────────────────────────────────────
const ro = new ResizeObserver(() => resizeCv());
ro.observe(document.getElementById('cw'));
resizeCv();
updAnchorList();
log('Path Editor Bezier siap. Drag &amp; drop peta.png + peta.yaml ke canvas.', 'in');
log('Ctrl+O = buka file · D = pen · P = pose · M = ukur · Spasi = pan · [ ] = rotasi', 'in');