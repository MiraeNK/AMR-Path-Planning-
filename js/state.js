// ── Konstanta fisik robot ───────────────────────────────────────────────
export const ROBOT_LEN_M = 0.25;
export const ROBOT_WIDTH_M = 0.24;

// ── State global ───────────────────────────────────────────────────────
// cvEl dan ctx di-init lazy agar DOM sudah siap saat diakses
export const state = {
  ws: null, tool: 'pen', anchors: [], robot: null, scan: [], scanT: 0,
  mapImg: null, meta: null, vx: 0, vy: 0, vs: 1, ts: 1, pan: false, ps: { x: 0, y: 0 },
  poseArr: null, za: { x: 0, y: 0 }, zraf: null, mapRot: 0, measPts: [], measHover: null,
  suppressNextClick: false, poseSendLock: false, penDrag: null, sampleStepM: 0.05,
  cornerRound: false, cornerRadiusM: 0.50, poseOffset: null, lastRawStatus: null,
  poseJustSet: false, poseJustSetTimer: null,
  cvEl: null,
  ctx: null
};

// Panggil ini sekali setelah DOM ready
export function initCanvas() {
  state.cvEl = document.getElementById('cv');
  state.ctx = state.cvEl.getContext('2d');
}
