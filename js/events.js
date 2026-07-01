import { state } from './state.js';
import { canvasToMap } from './math.js';
import { draw, animZ } from './renderer.js';
import { sendPose, setTool, undoLast, clearMeasure, clearAll, rotStep, loadYaml, loadMap, penDelete, penDown, penMove, penUp } from './ui.js';

state.cvEl.addEventListener('click', e => { if (state.suppressNextClick) { state.suppressNextClick = false; return; } if (state.tool === 'measure' && !state.pan) { state.measPts.push(canvasToMap(e.offsetX, e.offsetY)); draw(); } });
    state.cvEl.addEventListener('contextmenu', e => { e.preventDefault(); if (state.tool === 'measure') { if (state.measPts.length) { state.measPts.pop(); draw(); } } else if (state.tool === 'pen') { penDelete(e); } else undoLast(); });
    state.cvEl.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (state.tool === 'state.pan') { state.pan = true; state.ps = { x: e.offsetX - state.vx, y: e.offsetY - state.vy }; state.cvEl.style.cursor = 'grabbing'; }
      if (state.tool === 'pose') { const m = canvasToMap(e.offsetX, e.offsetY); state.poseArr = { sm: m, em: m, end: false }; state.suppressNextClick = true; }
      if (state.tool === 'pen') { penDown(e); }
    });
    state.cvEl.addEventListener('mousemove', e => {
      const { x, y } = canvasToMap(e.offsetX, e.offsetY);
      document.getElementById('coord').textContent = `x: ${x.toFixed(3)} · y: ${y.toFixed(3)}`;
      if (state.pan) { state.vx = e.offsetX - state.ps.x; state.vy = e.offsetY - state.ps.y; draw(); }
      if (state.tool === 'pose' && state.poseArr) { state.poseArr.em = canvasToMap(e.offsetX, e.offsetY); state.poseArr.end = true; draw(); }
      if (state.tool === 'pen' && state.penDrag) { penMove(e); }
      if (state.tool === 'measure' && state.measPts.length) { state.measHover = { x, y }; draw(); }
    });
    state.cvEl.addEventListener('mouseup', e => {
      if (state.pan) { state.pan = false; if (state.tool === 'state.pan') state.cvEl.style.cursor = 'grab'; }
      if (state.tool === 'pen' && state.penDrag) { penUp(); return; }
      if (state.tool === 'pose' && state.poseArr) {
        if (state.poseArr.end && !state.poseSendLock) {
          state.poseSendLock = true;
          const { x: sx, y: sy } = state.poseArr.sm, { x: ex, y: ey } = state.poseArr.em;
          state.poseArr = null;
          sendPose(sx, sy, Math.atan2(ey - sy, ex - sx));
          draw(); setTool('pen');
          setTimeout(() => { state.poseSendLock = false; }, 250);
        } else { state.poseArr = null; state.suppressNextClick = false; }
      }
    });

document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => { e.preventDefault();[...e.dataTransfer.files].forEach(f => { if (f.name.endsWith('.yaml')) loadYaml(f); else if (f.name.match(/\.(pgm|png|jpg|jpeg)$/i)) loadMap(f); }); });
    document.addEventListener('keydown', e => {
      if (e.key === 'o' && e.ctrlKey) { const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.pgm,.png,.jpg,.jpeg,.yaml'; inp.onchange = () => [...inp.files].forEach(f => { if (f.name.endsWith('.yaml')) loadYaml(f); else loadMap(f); }); inp.click(); e.preventDefault(); }
      if (e.key === 'z' && e.ctrlKey) undoLast();
      if (e.key === 'Escape') { if (state.tool === 'measure') clearMeasure(); else { clearAll(); setTool('pen'); } }
      if (e.key === 'd') setTool('pen'); if (e.key === 'p') setTool('pose'); if (e.key === 'm') setTool('measure');
      if (e.key === '[') rotStep(-5); if (e.key === ']') rotStep(5);
      if (e.key === ' ') { setTool(state.tool === 'state.pan' ? 'pen' : 'state.pan'); e.preventDefault(); }
    });

