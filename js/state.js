export const state = {
  ws: null, tool: 'pen', anchors: [], robot: null, scan: [], scanT: 0,
  mapImg: null, meta: null, vx: 0, vy: 0, vs: 1, ts: 1, pan: false, ps: { x: 0, y: 0 },
  poseArr: null, za: { x: 0, y: 0 }, zraf: null, mapRot: 0, measPts: [], measHover: null,
  suppressNextClick: false, poseSendLock: false, penDrag: null, sampleStepM: 0.05,
  cornerRound: false, cornerRadiusM: 0.50, poseOffset: null, lastRawStatus: null,
  poseJustSet: false, poseJustSetTimer: null,
  cvEl: document.getElementById('cv'),
  ctx: document.getElementById('cv').getContext('2d')
};

export const ROBOT_LEN_M = 0.25;
export const ROBOT_WIDTH_M = 0.24;
