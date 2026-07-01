import { state, ROBOT_LEN_M, ROBOT_WIDTH_M } from './state.js';
import { niceGridStep, mapToImgPx, imgPxToMap, rotateImgPx, mapToCanvas, canvasToMap, pxPerMetre } from './math.js';
import { densePath, sampleCurve, pathLengthM } from './bezier.js';
import { showFrd, hideFrd } from './ui.js';

function resizeCv() {
      const cw = document.getElementById('cw');
      const W = cw.offsetWidth, H = cw.offsetHeight;
      if (W > 0 && H > 0) { state.cvEl.width = W; state.cvEl.height = H; } draw();
    }

    function draw() {
      const W = state.cvEl.width, H = state.cvEl.height; if (!W || !H) return;
      state.ctx.clearRect(0, 0, W, H);
      const showGrid = document.getElementById('tgG').checked;
      const showRuler = document.getElementById('tgRl').checked;
      const RULER_H = showRuler ? 22 : 0;

      // Grid
      if (showGrid) {
        const stepM = niceGridStep(), stepPx = stepM / (state.meta ? state.meta.resolution : 1 / 50);
        if (stepPx * state.vs > 3) {
          state.ctx.save(); state.ctx.translate(state.vx, state.vy); state.ctx.scale(state.vs, state.vs);
          if (state.mapImg) { const cx = state.mapImg.naturalWidth / 2, cy = state.mapImg.naturalHeight / 2; state.ctx.translate(cx, cy); state.ctx.rotate(state.mapRot * Math.PI / 180); state.ctx.translate(-cx, -cy); }
          const half = Math.max(W, H) * 1.8 / state.vs;
          const ocx = state.mapImg ? state.mapImg.naturalWidth / 2 : 0, ocy = state.mapImg ? state.mapImg.naturalHeight / 2 : 0;
          state.ctx.strokeStyle = '#e2e6ec'; state.ctx.lineWidth = 1 / state.vs;
          const x0 = ocx - half, x1 = ocx + half, y0 = ocy - half, y1 = ocy + half;
          for (let x = Math.floor(x0 / stepPx) * stepPx; x < x1; x += stepPx) { state.ctx.beginPath(); state.ctx.moveTo(x, y0); state.ctx.lineTo(x, y1); state.ctx.stroke(); }
          for (let y = Math.floor(y0 / stepPx) * stepPx; y < y1; y += stepPx) { state.ctx.beginPath(); state.ctx.moveTo(x0, y); state.ctx.lineTo(x1, y); state.ctx.stroke(); }
          state.ctx.restore();
        }
      }

      state.ctx.save();
      state.ctx.translate(state.vx, state.vy); state.ctx.scale(state.vs, state.vs);
      if (state.mapImg) { const cx = state.mapImg.naturalWidth / 2, cy = state.mapImg.naturalHeight / 2; state.ctx.translate(cx, cy); state.ctx.rotate(state.mapRot * Math.PI / 180); state.ctx.translate(-cx, -cy); }
      if (state.mapImg) { state.ctx.globalAlpha = 0.92; state.ctx.drawImage(state.mapImg, 0, 0); state.ctx.globalAlpha = 1; }

      // Lidar state.scan
      if (document.getElementById('tgL').checked && state.scan.length && state.mapImg && state.meta && state.robot && (Date.now() - state.scanT < 2000)) {
        const dr = 3.2 / state.vs;
        const ryaw = (state.robot.yaw_deg || 0) * Math.PI / 180, cosY = Math.cos(ryaw), sinY = Math.sin(ryaw);
        state.scan.forEach(p => {
          const mapX = state.robot.x + (p.x * cosY - p.y * sinY), mapY = state.robot.y + (p.x * sinY + p.y * cosY);
          const ip = mapToImgPx(mapX, mapY);
          const d = Math.hypot(p.x, p.y);
          state.ctx.fillStyle = d < 1 ? '#e3433f' : d < 2.5 ? '#f0a31c' : '#f6c945';
          state.ctx.beginPath(); state.ctx.arc(ip.px, ip.py, dr, 0, Math.PI * 2); state.ctx.fill();
        });
      }

      const showP = document.getElementById('tgP').checked;
      const showW = document.getElementById('tgW').checked;

      // Bezier path
      if (showP && state.anchors.length >= 2) {
        const dense = densePath();
        if (dense.length >= 2) {
          state.ctx.beginPath(); state.ctx.strokeStyle = '#f0a31c'; state.ctx.lineWidth = 3 / state.vs; state.ctx.lineCap = 'round'; state.ctx.lineJoin = 'round';
          const i0 = mapToImgPx(dense[0].x, dense[0].y); state.ctx.moveTo(i0.px, i0.py);
          for (let i = 1; i < dense.length; i++) { const p = mapToImgPx(dense[i].x, dense[i].y); state.ctx.lineTo(p.px, p.py); }
          state.ctx.stroke();
        }
        const samp = sampleCurve(0.30);
        for (let i = 2; i < samp.length - 1; i += 6) {
          const a = mapToImgPx(samp[i].x, samp[i].y), b = mapToImgPx(samp[i + 1].x, samp[i + 1].y);
          const ang = Math.atan2(b.py - a.py, b.px - a.px), as = 7 / state.vs;
          state.ctx.save(); state.ctx.translate(a.px, a.py); state.ctx.rotate(ang);
          state.ctx.fillStyle = '#f0a31c'; state.ctx.beginPath(); state.ctx.moveTo(as, 0); state.ctx.lineTo(-as * .6, as * .5); state.ctx.lineTo(-as * .6, -as * .5); state.ctx.closePath(); state.ctx.fill(); state.ctx.restore();
        }
      }

      // Handles
      if (state.tool === 'pen' && showW && state.anchors.length) {
        state.anchors.forEach(a => {
          const p = mapToImgPx(a.x, a.y);
          ['hIn', 'hOut'].forEach(side => {
            if (a[side]) {
              const h = mapToImgPx(a[side].x, a[side].y);
              state.ctx.strokeStyle = '#4f8ef0'; state.ctx.lineWidth = 1.2 / state.vs;
              state.ctx.beginPath(); state.ctx.moveTo(p.px, p.py); state.ctx.lineTo(h.px, h.py); state.ctx.stroke();
              state.ctx.beginPath(); state.ctx.arc(h.px, h.py, 3.6 / state.vs, 0, Math.PI * 2);
              state.ctx.fillStyle = '#fff'; state.ctx.fill(); state.ctx.strokeStyle = '#4f8ef0'; state.ctx.lineWidth = 1.5 / state.vs; state.ctx.stroke();
            }
          });
        });
      }

      // Anchor dots
      if (showW && state.anchors.length) {
        state.anchors.forEach((a, i) => {
          const { px, py } = mapToImgPx(a.x, a.y), r = 6 / state.vs;
          const isCorner = !a.hIn && !a.hOut;
          const fill = i === 0 ? '#4caf50' : i === state.anchors.length - 1 ? '#4f8ef0' : '#f0a31c';
          const halo = i === 0 ? 'rgba(76,175,80,.18)' : i === state.anchors.length - 1 ? 'rgba(79,142,240,.18)' : 'rgba(240,163,28,.18)';
          state.ctx.beginPath(); state.ctx.arc(px, py, r + 2 / state.vs, 0, Math.PI * 2); state.ctx.fillStyle = halo; state.ctx.fill();
          state.ctx.fillStyle = fill; state.ctx.strokeStyle = '#fff'; state.ctx.lineWidth = 1.5 / state.vs;
          const intC = isCorner && i > 0 && i < state.anchors.length - 1;
          if (isCorner && intC && a.round) { state.ctx.beginPath(); rrPath(px - r, py - r, 2 * r, 2 * r, r * .9); state.ctx.fill(); state.ctx.stroke(); }
          else if (isCorner) { state.ctx.fillRect(px - r, py - r, 2 * r, 2 * r); state.ctx.strokeRect(px - r, py - r, 2 * r, 2 * r); }
          else { state.ctx.beginPath(); state.ctx.arc(px, py, r, 0, Math.PI * 2); state.ctx.fill(); state.ctx.stroke(); }
          state.ctx.save(); state.ctx.translate(px, py); state.ctx.rotate(-state.mapRot * Math.PI / 180);
          state.ctx.fillStyle = '#fff'; state.ctx.font = `bold ${Math.max(8, 10 / state.vs)}px Segoe UI`;
          state.ctx.textAlign = 'center'; state.ctx.textBaseline = 'middle'; state.ctx.fillText(i + 1, 0, 0); state.ctx.restore();
        });
      }

      // Digital twin
      if (document.getElementById('tgR').checked && state.robot && state.mapImg && state.meta) {
        const { px, py } = mapToImgPx(state.robot.x, state.robot.y);
        const yaw = (state.robot.yaw_deg || 0) * Math.PI / 180;
        const Lpx = ROBOT_LEN_M / state.meta.resolution, Wpx = ROBOT_WIDTH_M / state.meta.resolution;
        state.ctx.save(); state.ctx.translate(px, py); state.ctx.rotate(-yaw);
        state.ctx.fillStyle = 'rgba(240,163,28,.10)'; state.ctx.beginPath(); state.ctx.moveTo(0, 0); state.ctx.arc(0, 0, Lpx * 1.4, -0.5, 0.5); state.ctx.closePath(); state.ctx.fill();
        const rr = Math.min(Lpx, Wpx) * 0.16;
        state.ctx.beginPath(); rrPath(-Lpx / 2, -Wpx / 2, Lpx, Wpx, rr);
        state.ctx.fillStyle = 'rgba(29,37,48,.88)'; state.ctx.fill(); state.ctx.strokeStyle = '#f0a31c'; state.ctx.lineWidth = Math.max(0.8, 1.6 / state.vs); state.ctx.stroke();
        state.ctx.strokeStyle = 'rgba(255,255,255,.35)'; state.ctx.lineWidth = 1 / state.vs;
        state.ctx.beginPath(); state.ctx.moveTo(-Lpx / 2, 0); state.ctx.lineTo(Lpx / 2, 0); state.ctx.stroke();
        const ah = Math.min(Wpx, Lpx) * 0.32;
        state.ctx.fillStyle = '#f0a31c'; state.ctx.beginPath(); state.ctx.moveTo(Lpx / 2, 0); state.ctx.lineTo(Lpx / 2 - ah, ah * .7); state.ctx.lineTo(Lpx / 2 - ah, -ah * .7); state.ctx.closePath(); state.ctx.fill();
        state.ctx.restore();
      }

      // Pose arrow preview
      if (state.tool === 'pose' && state.poseArr && state.poseArr.end) {
        const ai = mapToImgPx(state.poseArr.sm.x, state.poseArr.sm.y), bi = mapToImgPx(state.poseArr.em.x, state.poseArr.em.y);
        const ang = Math.atan2(bi.py - ai.py, bi.px - ai.px), as = 14 / state.vs;
        state.ctx.save(); state.ctx.strokeStyle = '#4f8ef0'; state.ctx.lineWidth = 2.5 / state.vs;
        state.ctx.beginPath(); state.ctx.moveTo(ai.px, ai.py); state.ctx.lineTo(bi.px, bi.py); state.ctx.stroke();
        [ai, bi].forEach(p => { state.ctx.beginPath(); state.ctx.arc(p.px, p.py, 4 / state.vs, 0, Math.PI * 2); state.ctx.fillStyle = '#4f8ef0'; state.ctx.fill(); });
        state.ctx.translate(bi.px, bi.py); state.ctx.rotate(ang);
        state.ctx.fillStyle = '#4f8ef0'; state.ctx.beginPath(); state.ctx.moveTo(as, 0); state.ctx.lineTo(-as * .6, as * .5); state.ctx.lineTo(-as * .6, -as * .5); state.ctx.closePath(); state.ctx.fill(); state.ctx.restore();
        const dist = Math.hypot(state.poseArr.em.x - state.poseArr.sm.x, state.poseArr.em.y - state.poseArr.sm.y);
        const yd = (Math.atan2(state.poseArr.em.y - state.poseArr.sm.y, state.poseArr.em.x - state.poseArr.sm.x) * 180 / Math.PI).toFixed(1);
        showFrd(`${dist.toFixed(3)} m / ${yd}°`);
      } else if (state.tool === 'measure' && (state.measPts.length || state.measHover)) {
        drawMeasurement();
      } else if (state.tool === 'pen' && state.anchors.length >= 2) {
        showFrd(`${state.anchors.length} anchor · ${pathLengthM().toFixed(2)} m`);
      } else { hideFrd(); }

      state.ctx.restore();
      if (showRuler) drawRulers(W, H, RULER_H);
      document.getElementById('zd').textContent = Math.round(state.vs * 100) + '%';
    }

    function rrPath(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      state.ctx.moveTo(x + r, y); state.ctx.arcTo(x + w, y, x + w, y + h, r); state.ctx.arcTo(x + w, y + h, x, y + h, r); state.ctx.arcTo(x, y + h, x, y, r); state.ctx.arcTo(x, y, x + w, y, r);
    }

function drawRulers(W, H, rh) {
      const stepM = niceGridStep(), ppm = pxPerMetre(), stepPx = stepM * ppm;
      if (stepPx < 4) return;
      state.ctx.save();
      state.ctx.fillStyle = 'rgba(255,255,255,.94)'; state.ctx.fillRect(0, 0, W, rh); state.ctx.fillRect(0, 0, rh, H);
      state.ctx.strokeStyle = '#d6dadf'; state.ctx.lineWidth = 1;
      state.ctx.beginPath(); state.ctx.moveTo(0, rh); state.ctx.lineTo(W, rh); state.ctx.stroke();
      state.ctx.beginPath(); state.ctx.moveTo(rh, 0); state.ctx.lineTo(rh, H); state.ctx.stroke();
      state.ctx.fillStyle = '#6b7280'; state.ctx.font = '9.5px Consolas,monospace'; state.ctx.textBaseline = 'middle';
      const refC0 = mapToCanvas(0, 0);
      const phaseX = ((refC0.px % stepPx) + stepPx) % stepPx;
      state.ctx.textAlign = 'center';
      for (let sx = phaseX; sx < W; sx += stepPx) {
        if (sx < rh) continue;
        const mapPt = canvasToMap(sx, H / 2);
        state.ctx.beginPath(); state.ctx.moveTo(sx, rh - 6); state.ctx.lineTo(sx, rh); state.ctx.strokeStyle = '#9aa1ab'; state.ctx.stroke();
        state.ctx.fillStyle = '#6b7280'; state.ctx.fillText(fmtM(snapLabel(mapPt.x, stepM)), sx, rh / 2 + 1);
      }
      const phaseY = ((refC0.py % stepPx) + stepPx) % stepPx;
      state.ctx.textAlign = 'left';
      for (let sy = phaseY; sy < H; sy += stepPx) {
        if (sy < rh) continue;
        const mapPt = canvasToMap(W / 2, sy);
        state.ctx.beginPath(); state.ctx.moveTo(rh - 6, sy); state.ctx.lineTo(rh, sy); state.ctx.strokeStyle = '#9aa1ab'; state.ctx.stroke();
        state.ctx.fillStyle = '#6b7280'; state.ctx.save(); state.ctx.translate(2, sy); state.ctx.fillText(fmtM(snapLabel(mapPt.y, stepM)), 2, 0); state.ctx.restore();
      }
      state.ctx.fillStyle = '#1d2530'; state.ctx.font = 'bold 9.5px Consolas,monospace'; state.ctx.textAlign = 'left';
      state.ctx.fillText(fmtM(stepM), 4, rh / 2 + 1);
      state.ctx.restore();
    }
    function snapLabel(val, stepM) { return Math.round(val / stepM) * stepM; }
    function fmtM(v) {
      if (Math.abs(v) < 1e-9) return '0';
      if (Number.isInteger(v) || Math.abs(v) >= 10) return v.toFixed(0);
      if (Math.abs(v) >= 1) return v.toFixed(1);
      return v.toFixed(2);
    }
    function showFrd(t) { const e = document.getElementById('frd'); e.textContent = t; e.style.display = 'block'; }
    function hideFrd() { document.getElementById('frd').style.display = 'none'; }

function drawMeasurement() {
      const allPts = state.measHover ? [...measPts, state.measHover] : state.measPts;
      if (!allPts.length) return;
      const imgPts = allPts.map(p => mapToImgPx(p.x, p.y));
      state.ctx.save(); state.ctx.strokeStyle = '#0066cc'; state.ctx.lineWidth = 2 / state.vs; state.ctx.setLineDash([6 / state.vs, 4 / state.vs]);
      state.ctx.beginPath(); state.ctx.moveTo(imgPts[0].px, imgPts[0].py); imgPts.slice(1).forEach(p => state.ctx.lineTo(p.px, p.py)); state.ctx.stroke(); state.ctx.setLineDash([]);
      imgPts.forEach(p => { state.ctx.beginPath(); state.ctx.arc(p.px, p.py, 4 / state.vs, 0, Math.PI * 2); state.ctx.fillStyle = '#fff'; state.ctx.fill(); state.ctx.strokeStyle = '#0066cc'; state.ctx.lineWidth = 2 / state.vs; state.ctx.stroke(); });
      let total = 0;
      for (let i = 0; i < allPts.length - 1; i++) {
        const a = allPts[i], b = allPts[i + 1], d = Math.hypot(b.x - a.x, b.y - a.y); total += d;
        const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        const ia = imgPts[i], ib = imgPts[i + 1], mx = (ia.px + ib.px) / 2, my = (ia.py + ib.py) / 2;
        state.ctx.save(); state.ctx.translate(mx, my); state.ctx.rotate(-state.mapRot * Math.PI / 180);
        state.ctx.font = `bold ${Math.max(9, 11 / state.vs)}px Consolas,monospace`;
        const txt = `${d.toFixed(3)} m · ${ang.toFixed(1)}°`, tw = state.ctx.measureText(txt).width;
        state.ctx.fillStyle = 'rgba(255,255,255,.92)'; state.ctx.fillRect(-tw / 2 - 5 / state.vs, -9 / state.vs, tw + 10 / state.vs, 18 / state.vs);
        state.ctx.fillStyle = '#004f9e'; state.ctx.textAlign = 'center'; state.ctx.textBaseline = 'middle'; state.ctx.fillText(txt, 0, 0); state.ctx.restore();
      }
      state.ctx.restore();
      if (allPts.length > 2) showFrd(`Total: ${total.toFixed(3)} m · ${allPts.length - 1} segmen`);
      else if (allPts.length === 2) showFrd(`${total.toFixed(3)} m`);
      else hideFrd();
    }
    function clearMeasure() { state.measPts = []; state.measHover = null; draw(); }


export { resizeCv, draw, rrPath, drawRulers, snapLabel, fmtM, showFrd, hideFrd, drawMeasurement, clearMeasure };
