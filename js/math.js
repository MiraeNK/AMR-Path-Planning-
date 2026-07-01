import { state } from './state.js';



function mapToImgPx(mx, my) {
      if (!state.mapImg || !state.meta) return { px: mx * 50, py: -my * 50 };
      return { px: (mx - state.meta.ox) / state.meta.resolution, py: state.mapImg.naturalHeight - (my - state.meta.oy) / state.meta.resolution };
    }
    function imgPxToMap(px, py) {
      if (!state.mapImg || !state.meta) return { x: px / 50, y: -py / 50 };
      return { x: px * state.meta.resolution + state.meta.ox, y: (state.mapImg.naturalHeight - py) * state.meta.resolution + state.meta.oy };
    }
    function rotateImgPx(px, py, deg) {
      if (!state.mapImg) return { px, py };
      const cx = state.mapImg.naturalWidth / 2, cy = state.mapImg.naturalHeight / 2;
      const rad = deg * Math.PI / 180, dx = px - cx, dy = py - cy;
      return { px: cx + dx * Math.cos(rad) - dy * Math.sin(rad), py: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
    }
    function mapToCanvas(mx, my) {
      const ip = mapToImgPx(mx, my), rp = rotateImgPx(ip.px, ip.py, state.mapRot);
      return { px: rp.px * state.vs + state.vx, py: rp.py * state.vs + state.vy };
    }
    function canvasToMap(cx2, cy2) {
      const ipx = (cx2 - state.vx) / state.vs, ipy = (cy2 - state.vy) / state.vs;
      const un = rotateImgPx(ipx, ipy, -state.mapRot);
      return imgPxToMap(un.px, un.py);
    }
    function pxPerMetre() { return (!state.meta) ? state.vs * 50 : state.vs / state.meta.resolution; }

function niceGridStep() {
      const ppm = pxPerMetre(); if (ppm <= 0) return 1;
      const rawM = 80 / ppm, pow = Math.pow(10, Math.floor(Math.log10(rawM)));
      let best = pow, bestDiff = Infinity;
      [1, 2, 5, 10].forEach(c => { const v = c * pow, d = Math.abs(v - rawM); if (d < bestDiff) { bestDiff = d; best = v; } });
      return best;
    }


export { mapToImgPx, imgPxToMap, rotateImgPx, mapToCanvas, canvasToMap, pxPerMetre, niceGridStep };
