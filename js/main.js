import { state } from './state.js';
import { resizeCv } from './renderer.js';
import { updAnchorList, log, setWS, toggleConn, sendPath, closeLoop, cmd, onSpd, onSmp, onCornerRound, onCornerRadius, toggleRound, rotStep, rotReset, clearAll, resetView, undoLast, zoomStep } from './ui.js';
import './events.js'; // initialize event listeners

// Make UI functions globally accessible for inline HTML onclick attributes
Object.assign(window, { tc: (id) => document.getElementById(id).classList.toggle('col'), toggleConn, sendPath, closeLoop, cmd, onSpd, onSmp, onCornerRound, onCornerRadius, toggleRound, rotStep, rotReset, clearAll, resetView, undoLast, zoomStep });

const ro = new ResizeObserver(() => resizeCv());
    ro.observe(document.getElementById('cw'));
    resizeCv(); updAnchorList();
    log('Path Editor Bezier siap. Drag &amp; drop peta.png + peta.yaml ke canvas.', 'in');
    log('Ctrl+O = buka file · D = pen · P = pose · M = ukur · Spasi = state.pan · [ ] = rotasi', 'in');

import { setTool, onRot } from './ui.js';
import { draw } from './renderer.js';
Object.assign(window, { setTool, draw, onRot });