import { state } from './state.js';
import { mapToImgPx, rotateImgPx } from './math.js';

function segCtrl(a, b) {
      const p0 = { x: a.x, y: a.y }, p3 = { x: b.x, y: b.y };
      return [p0, a.hOut ? { x: a.hOut.x, y: a.hOut.y } : p0, b.hIn ? { x: b.hIn.x, y: b.hIn.y } : p3, p3];
    }
    function isCornerA(a) { return !a.hIn && !a.hOut; }
    function computeFillet(i) {
      if (state.anchors.length < 3) return null;
      const isLoop = Math.hypot(state.anchors[0].x - state.anchors[state.anchors.length-1].x, state.anchors[0].y - state.anchors[state.anchors.length-1].y) < 1e-5;
      if (!isLoop && (i <= 0 || i >= state.anchors.length - 1)) return null;
      
      const V = state.anchors[i];
      let P, N;
      if (isLoop && (i === 0 || i === state.anchors.length - 1)) {
        P = state.anchors[state.anchors.length - 2];
        N = state.anchors[1];
      } else {
        P = state.anchors[i - 1];
        N = state.anchors[i + 1];
      }
      
      if (!isCornerA(V) || !V.round || P.hOut || N.hIn) return null;
      let aDx = P.x - V.x, aDy = P.y - V.y; const aLen = Math.hypot(aDx, aDy);
      let bDx = N.x - V.x, bDy = N.y - V.y; const bLen = Math.hypot(bDx, bDy);
      if (aLen < 1e-6 || bLen < 1e-6) return null;
      aDx /= aLen; aDy /= aLen; bDx /= bLen; bDy /= bLen;
      const dot = Math.max(-1, Math.min(1, aDx * bDx + aDy * bDy));
      const ang = Math.acos(dot);
      if (ang < 1e-3 || Math.PI - ang < 1e-3) return null;
      const half = ang / 2;
      let r = state.cornerRadiusM, d = r / Math.tan(half);
      const maxD = 0.49 * Math.min(aLen, bLen);
      if (d > maxD) { d = maxD; r = d * Math.tan(half); }
      const tA = { x: V.x + aDx * d, y: V.y + aDy * d }, tB = { x: V.x + bDx * d, y: V.y + bDy * d };
      let biX = aDx + bDx, biY = aDy + bDy; const biLen = Math.hypot(biX, biY);
      if (biLen < 1e-6) return null;
      biX /= biLen; biY /= biLen;
      const C = { x: V.x + biX * (r / Math.sin(half)), y: V.y + biY * (r / Math.sin(half)) };
      let a0 = Math.atan2(tA.y - C.y, tA.x - C.x), a1 = Math.atan2(tB.y - C.y, tB.x - C.x);
      let da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const steps = Math.max(4, Math.ceil(Math.abs(da) / 0.18));
      const arcPts = [];
      for (let k = 0; k <= steps; k++) { const t = a0 + da * k / steps; arcPts.push({ x: C.x + r * Math.cos(t), y: C.y + r * Math.sin(t) }); }
      return { tA, tB, arcPts, r };
    }
    function buildDense() {
      if (state.anchors.length < 2) return [];
      const fil = state.anchors.map((_, i) => computeFillet(i));
      const out = [];
      const push = p => { const L = out[out.length - 1]; if (!L || Math.hypot(L.x - p.x, L.y - p.y) > 1e-7) out.push(p); };
      
      if (fil[0]) {
        push({ x: fil[0].tB.x, y: fil[0].tB.y });
      } else {
        push({ x: state.anchors[0].x, y: state.anchors[0].y });
      }
      for (let i = 0; i < state.anchors.length - 1; i++) {
        const A = state.anchors[i], B = state.anchors[i + 1];
        if (!A.hOut && !B.hIn) {
          push(fil[i] ? fil[i].tB : { x: A.x, y: A.y });
          push(fil[i + 1] ? fil[i + 1].tA : { x: B.x, y: B.y });
        } else {
          const [p0, p1, p2, p3] = segCtrl(A, B);
          const approx = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.hypot(p3.x - p2.x, p3.y - p2.y);
          const Nn = Math.max(16, Math.ceil(approx / 0.03));
          for (let k = 0; k <= Nn; k++) {
            const t = k / Nn, mt = 1 - t, Aa = mt * mt * mt, Bb = 3 * mt * mt * t, Cc = 3 * mt * t * t, Dd = t * t * t;
            push({ x: Aa * p0.x + Bb * p1.x + Cc * p2.x + Dd * p3.x, y: Aa * p0.y + Bb * p1.y + Cc * p2.y + Dd * p3.y });
          }
        }
        if (fil[i + 1]) fil[i + 1].arcPts.forEach(push);
      }
      return out;
    }
    function densePath() { return buildDense(); }
    function resample(poly, stepM) {
      if (poly.length < 2) return poly.slice();
      const out = [poly[0]]; let acc = 0;
      for (let i = 1; i < poly.length; i++) {
        let a = poly[i - 1], b = poly[i], segLen = Math.hypot(b.x - a.x, b.y - a.y);
        while (acc + segLen >= stepM) {
          const t = (stepM - acc) / segLen, np = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
          out.push(np); a = np; segLen = Math.hypot(b.x - a.x, b.y - a.y); acc = 0;
        }
        acc += segLen;
      }
      const last = poly[poly.length - 1];
      if (Math.hypot(out[out.length - 1].x - last.x, out[out.length - 1].y - last.y) > 1e-6) out.push(last);
      return out;
    }
    function sampleCurve(stepM) { return resample(buildDense(), stepM); }
    function pathLengthM() {
      const d = sampleCurve(Math.max(0.05, state.sampleStepM));
      let L = 0; for (let i = 1; i < d.length; i++)L += Math.hypot(d[i].x - d[i - 1].x, d[i].y - d[i - 1].y);
      return L;
    }


export { segCtrl, isCornerA, computeFillet, buildDense, densePath, resample, sampleCurve, pathLengthM };
