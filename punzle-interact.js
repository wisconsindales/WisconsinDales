// punzle-interact.js — Game state, interactions, drag (touch + mouse)

// ── State ─────────────────────────────────────────────────────────────────────
let placedPieces  = [];
let selectedPiece = null;
let selectedCells = [];
let currentRot    = 0;
let currentFlip   = false;

const _today  = new Date();
const MONTH   = _today.getMonth() + 1;
const DAY     = _today.getDate();
const blocked = getBlockedCells(MONTH, DAY);

// ── Audio ────────────────────────────────────────────────────────────────────
let _audioCtx = null;

function _getCtx() {
  if (!_audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) _audioCtx = new Ctx();
  }
  if (_audioCtx && _audioCtx.state === "suspended") _audioCtx.resume();
  return _audioCtx;
}

function _playPlace() {
  const ctx = _getCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc1.type = "triangle"; osc2.type = "sine";
  osc1.frequency.setValueAtTime(720, now);
  osc1.frequency.exponentialRampToValueAtTime(240, now + 0.22);
  osc2.frequency.setValueAtTime(380, now);
  osc2.frequency.exponentialRampToValueAtTime(120, now + 0.22);
  filter.type = "lowpass"; filter.frequency.setValueAtTime(1400, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.10, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  osc1.connect(filter); osc2.connect(filter);
  filter.connect(gain); gain.connect(ctx.destination);
  osc1.start(now); osc2.start(now);
  osc1.stop(now + 0.22); osc2.stop(now + 0.22);
}

function _playRemove() {
  const ctx = _getCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.15);
}

function _playHint() {
  const ctx = _getCtx(); if (!ctx) return;
  const now   = ctx.currentTime;
  const freqs = [400, 600, 520, 480, 700];
  freqs.forEach((f, fi) => {
    const delay = fi * 0.03;
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, now + delay);
    gain.gain.setValueAtTime(0.0001, now + delay);
    gain.gain.exponentialRampToValueAtTime(0.07, now + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.18);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now + delay); osc.stop(now + delay + 0.2);
  });
}

function _playWin() {
  const ctx = _getCtx(); if (!ctx) return;
  const now   = ctx.currentTime;
  const notes = [523, 659, 784, 1047, 784, 1047, 1319];
  notes.forEach((f, ni) => {
    const start = now + 0.1 + ni * 0.13;
    const end   = start + 0.2;
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(f, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.04);
    gain.gain.linearRampToValueAtTime(0.0001, end);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(start); osc.stop(end + 0.05);
  });
}

function _playNext() {
  const ctx = _getCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.2);
}

// ── Helper: apply hint orientation if available, else reset ─────────────────
function _applyHintOrient(piece) {
  if (_hintOrientations && _hintOrientations[piece.name]) {
    const ho  = _hintOrientations[piece.name];
    currentRot  = ho.rot;
    currentFlip = ho.flip;
  } else {
    currentRot  = 0;
    currentFlip = false;
  }
}

// ── Solutions & hints ────────────────────────────────────────────────────────
let _allSolutions    = [];
let _revealedHints   = new Set(); // piece names with correct orientation shown
let _hintOrientations = {}; // { pieceName: { rot, flip } }

function _initSolutions() {
  // Run solver for today
  const month = _today.getMonth() + 1;
  const day   = _today.getDate();
  setTimeout(() => {
    _allSolutions = solve(month, day, true);
    _updateSolBadge();
  }, 100);
}

function _updateSolBadge() {
  const badge  = document.getElementById("pz-sol-badge");
  const numEl  = document.getElementById("pz-sol-num");
  if (!numEl) return;

  // Filter solutions compatible with current placed pieces
  const compat = _allSolutions.filter(sol => {
    return placedPieces.every(p => {
      const sp = sol.find(s => s.piece === p.name);
      if (!sp) return false;
      const spKeys = new Set(sp.cells.map(([r,c]) => cellKey(r,c)));
      const pKeys  = p.cells.map(([r,c]) => cellKey(r,c));
      return pKeys.length === sp.cells.length &&
             pKeys.every(k => spKeys.has(k));
    });
  });

  const n = placedPieces.length === 0 ? _allSolutions.length : compat.length;
  numEl.textContent = n;
  const lblEl = document.getElementById("pz-sol-lbl");
  if (lblEl) lblEl.textContent = placedPieces.length === 0 ? "solutions" : "possible";

  if (badge) {
    if (n === 0) {
      badge.style.borderColor = "#ef4444";
      numEl.style.color = "#ef4444";
    } else if (n <= 3) {
      badge.style.borderColor = "#f97316";
      numEl.style.color = "#f97316";
    } else if (n <= 10) {
      badge.style.borderColor = "#eab308";
      numEl.style.color = "#eab308";
    } else {
      badge.style.borderColor = "#22c55e";
      numEl.style.color = "#22c55e";
    }
  }
}

// Pick or reuse a single solution for all hints this session
let _hintSolution = null;
let _hintSolIndex = 0;

function pzShowHint() {
  if (!_allSolutions.length) return;

  // Lock in one solution — must be compatible with currently placed pieces
  if (!_hintSolution) {
    // Find solutions compatible with ALL currently placed pieces
    const compatible = _allSolutions.filter(sol => {
      return placedPieces.every(p => {
        const sp = sol.find(s => s.piece === p.name);
        if (!sp) return false;
        // Exact cell match — every placed cell must match solution cell
        const spKeys = new Set(sp.cells.map(([r,c]) => cellKey(r,c)));
        const pKeys  = p.cells.map(([r,c]) => cellKey(r,c));
        return pKeys.length === sp.cells.length &&
               pKeys.every(k => spKeys.has(k));
      });
    });
    if (!compatible.length) {
      const sarcasm = document.getElementById("pz-sarcasm");
      if (sarcasm) sarcasm.textContent = "No hints available — current placement has no solutions!";
      return;
    }
    _hintSolution = compatible[Math.floor(Math.random() * compatible.length)];
  }

  // Find unplaced, un-hinted pieces
  const unplaced = PIECES.filter(p =>
    !placedPieces.some(pp => pp.name === p.name) &&
    !_revealedHints.has(p.name)
  );

  if (!unplaced.length) {
    document.getElementById("pz-sarcasm").textContent = "All hints shown! You got this. Maybe.";
    return;
  }

  // Pick random unplaced piece
  const piece    = unplaced[Math.floor(Math.random() * unplaced.length)];
  const solPiece = _hintSolution.find(s => s.piece === piece.name);
  if (!solPiece) return;

  // Build normalized solution shape using same normalize() as _rebuild
  const solCells = solPiece.cells;
  const solNormKey = normalize(solCells).map(([r,c]) => `${r},${c}`).join("|");

  // Find rotation/flip — apply rot first then flip (same as _rebuild)
  // Use normalize() for comparison — exactly matching _rebuild
  let hintRot = 0, hintFlip = false, found = false;
  outerLoop:
  for (let rot = 0; rot < 360; rot += 90) {
    for (const flipped of [false, true]) {
      let cells = piece.cells.map(([r,c]) => [r,c]);
      const turns = rot / 90;
      for (let i = 0; i < turns; i++) cells = rotate(cells);
      if (flipped) cells = flip(cells);
      const normKey = normalize(cells).map(([r,c]) => `${r},${c}`).join("|");
      if (normKey === solNormKey) {
        hintRot  = rot;
        hintFlip = flipped;
        found    = true;
        break outerLoop;
      }
    }
  }

  if (!found) return;

  _revealedHints.add(piece.name);
  _hintOrientations[piece.name] = { rot: hintRot, flip: hintFlip };

  // If this piece is selected, update its orientation
  if (selectedPiece && selectedPiece.name === piece.name) {
    currentRot  = hintRot;
    currentFlip = hintFlip;
    _rebuild();
  }

  const sarcasm = document.getElementById("pz-sarcasm");
  _playHint();
  if (sarcasm) sarcasm.textContent = `★ Piece ${piece.name} oriented correctly. Try not to waste it.`;

  refresh();
}

function pzNextSolution() {
  if (!_allSolutions.length) return;
  // Advance to next solution
  _hintSolIndex = (_hintSolIndex + 1) % _allSolutions.length;
  _hintSolution = _allSolutions[_hintSolIndex];
  // Full reset — clear board, hints, stars
  placedPieces      = [];
  selectedPiece     = null;
  selectedCells     = [];
  currentRot        = 0;
  currentFlip       = false;
  _revealedHints    = new Set();
  _hintOrientations = {};
  const win = document.getElementById("punzle-win");
  if (win) win.style.display = "none";
  _updateSolBadge();
  const sarcasm = document.getElementById("pz-sarcasm");
  _playNext();
  if (sarcasm) sarcasm.textContent = `Solution ${_hintSolIndex + 1} of ${_allSolutions.length} loaded. Good luck! 😄`;
  refresh();
}

// ── Piece actions ─────────────────────────────────────────────────────────────
function doSelect(piece) {
  if (placedPieces.some(p => p.name === piece.name))
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  if (selectedPiece && selectedPiece.name === piece.name) {
    selectedPiece = null; selectedCells = [];
  } else {
    selectedPiece = piece;
    _applyHintOrient(piece);
    _rebuild();
  }
  refresh();
}

function doFlip(piece) {
  if (placedPieces.some(p => p.name === piece.name))
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  if (!selectedPiece || selectedPiece.name !== piece.name) {
    selectedPiece = piece;
    _applyHintOrient(piece);
  }
  currentFlip = !currentFlip;
  _rebuild(); refresh();
}

function doRotate(piece) {
  if (placedPieces.some(p => p.name === piece.name))
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  if (!selectedPiece || selectedPiece.name !== piece.name) {
    selectedPiece = piece;
    _applyHintOrient(piece);
  }
  currentRot = (currentRot + 90) % 360;
  _rebuild(); refresh();
}

function _rebuild() {
  if (!selectedPiece) { selectedCells = []; return; }
  let cells = selectedPiece.cells.map(([r,c]) => [r,c]);
  // rotate first, then flip — same order as hint finder and app
  const turns = (((currentRot % 360) + 360) % 360) / 90;
  for (let i = 0; i < turns; i++) cells = rotate(cells);
  if (currentFlip) cells = flip(cells);
  selectedCells = normalize(cells);
}

// ── Cell click ────────────────────────────────────────────────────────────────
function onCellClick(e) {
  const r   = parseInt(e.currentTarget.dataset.r);
  const c   = parseInt(e.currentTarget.dataset.c);
  const key = cellKey(r, c);
  const existing = placedPieces.find(p => p.cells.some(([pr,pc]) => pr===r && pc===c));
  if (existing) {
    _playRemove();
    placedPieces = placedPieces.filter(p => p.name !== existing.name);
    _hintSolution = null; // recalculate hint solution after removal
    _updateSolBadge();
    refresh(); return;
  }
  if (!selectedPiece || blocked.has(key)) return;
  const shifted = selectedCells.map(([sr,sc]) => [r+sr, c+sc]);
  if (_valid(shifted)) _place(shifted);
}

// ── Drag state ────────────────────────────────────────────────────────────────
let _dragPiece   = null;
let _dragging    = false;
let _startX      = 0;
let _startY      = 0;
let _floatEl     = null;
let _isTouch     = false;
const THR        = 8;

// ── Shared drag start ─────────────────────────────────────────────────────────
function _dragStart(piece, x, y, isTouch) {
  if (placedPieces.some(p => p.name === piece.name)) return;
  _dragPiece = piece;
  _dragging  = false;
  _startX    = x;
  _startY    = y;
  _isTouch   = isTouch;
}

function _dragMove(x, y) {
  if (!_dragPiece) return;
  const dx = x - _startX;
  const dy = y - _startY;

  if (!_dragging && (Math.abs(dx) > THR || Math.abs(dy) > THR)) {
    _dragging = true;
    if (!selectedPiece || selectedPiece.name !== _dragPiece.name) {
      // Piece wasn't selected — apply hint orient if available, else default
      selectedPiece = _dragPiece;
      _applyHintOrient(_dragPiece);
      _rebuild();
    }
    // If already selected — keep currentRot/currentFlip exactly as user set them
    refresh();
    _makeFloat();
  }

  if (_dragging) {
    _moveFloat(x, y);
    _clearPreview();
    const target = _cellAt(x, y);
    if (target) _showPreview(parseInt(target.dataset.r), parseInt(target.dataset.c));
  }
}

function _dragEnd(x, y) {
  if (_dragging && _dragPiece && selectedPiece) {
    const target = _cellAt(x, y);
    if (target) {
      const r       = parseInt(target.dataset.r);
      const c       = parseInt(target.dataset.c);
      const shifted = selectedCells.map(([sr,sc]) => [r+sr, c+sc]);
      if (_valid(shifted)) _place(shifted);
    }
  }
  _killFloat();
  _clearPreview();
  _dragPiece = null;
  _dragging  = false;
}

// ── Touch handlers ────────────────────────────────────────────────────────────
function onCardTouchStart(e, piece) {
  if (placedPieces.some(p => p.name === piece.name)) return;
  const t = e.touches[0];
  _dragStart(piece, t.clientX, t.clientY, true);
}

function _onTouchMove(e) {
  if (!_dragPiece) return;
  const t = e.touches[0];
  _dragMove(t.clientX, t.clientY);
  if (_dragging) e.preventDefault();
}

function _onTouchEnd(e) {
  if (!_dragPiece) return;
  const t = e.changedTouches[0];
  _dragEnd(t.clientX, t.clientY);
}

// ── Mouse handlers ────────────────────────────────────────────────────────────
function onCardMouseDown(e, piece) {
  if (placedPieces.some(p => p.name === piece.name)) return;
  e.preventDefault();
  _dragStart(piece, e.clientX, e.clientY, false);
}

function _onMouseMove(e) {
  if (!_dragPiece) return;
  _dragMove(e.clientX, e.clientY);
}

function _onMouseUp(e) {
  if (!_dragPiece) return;
  _dragEnd(e.clientX, e.clientY);
}

// ── Float ghost ───────────────────────────────────────────────────────────────
function _makeFloat() {
  _killFloat();
  if (!selectedPiece || !selectedCells.length) return;
  _floatEl = document.createElement("div");
  _floatEl.style.cssText = "position:fixed;pointer-events:none;z-index:9999;display:grid;gap:2px;opacity:0.88;will-change:left,top;";
  const SZ   = 36;
  const maxR = Math.max(...selectedCells.map(([r])=>r));
  const maxC = Math.max(...selectedCells.map(([,c])=>c));
  _floatEl.style.gridTemplateColumns = `repeat(${maxC+1},${SZ}px)`;
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const on   = selectedCells.some(([sr,sc])=>sr===r&&sc===c);
      const cell = document.createElement("div");
      cell.style.cssText = `width:${SZ}px;height:${SZ}px;border-radius:6px;background:${on?selectedPiece.color:"transparent"};${on?"border:2px solid rgba(255,255,255,0.4);box-shadow:0 4px 12px rgba(0,0,0,0.4);":""}`;
      _floatEl.appendChild(cell);
    }
  }
  document.body.appendChild(_floatEl);
}

function _moveFloat(x, y) {
  if (!_floatEl) return;
  requestAnimationFrame(() => {
    if (!_floatEl) return;
    _floatEl.style.left = x + "px";
    _floatEl.style.top  = y + "px";
  });
}

function _killFloat() {
  if (_floatEl) { _floatEl.remove(); _floatEl = null; }
}

// ── Preview ───────────────────────────────────────────────────────────────────
function _showPreview(r, c) {
  if (!selectedPiece || !selectedCells.length) return;
  // Use top-left cell (0,0) as anchor so cursor cell = top-left of piece
  const shifted = selectedCells.map(([sr,sc]) => [r+sr, c+sc]);
  const valid   = _valid(shifted);
  shifted.forEach(([pr,pc]) => {
    const el = document.querySelector(`.pz-cell[data-r="${pr}"][data-c="${pc}"]`);
    if (el) {
      el.classList.add("pz-preview");
      if (!valid) el.classList.add("pz-preview-bad");
      else el.style.background = selectedPiece.color + "aa";
    }
  });
}

function _clearPreview() {
  document.querySelectorAll(".pz-cell.pz-preview").forEach(el => {
    el.classList.remove("pz-preview","pz-preview-bad");
    el.style.background = "";
  });
}

function _cellAt(x, y) {
  const els = document.elementsFromPoint(x, y);
  return els.find(el => el.classList && el.classList.contains("pz-cell") && el.dataset.r !== undefined);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _anchor(cells) {
  if (!cells.length) return [0,0];
  const ar = cells.reduce((s,[r])=>s+r,0)/cells.length;
  const ac = cells.reduce((s,[,c])=>s+c,0)/cells.length;
  let best = cells[0], bd = Infinity;
  for (const cell of cells) {
    const d = (cell[0]-ar)**2+(cell[1]-ac)**2;
    if (d < bd) { best = cell; bd = d; }
  }
  return best;
}

function _valid(cells) {
  if (!cells.length) return false;
  const occ = new Set(placedPieces.flatMap(p=>p.cells.map(([r,c])=>cellKey(r,c))));
  return cells.every(([r,c]) => {
    const k = cellKey(r,c);
    return isValidCell(r,c) && !blocked.has(k) && !occ.has(k);
  });
}

function _place(cells) {
  _playPlace();
  placedPieces.push({ name:selectedPiece.name, color:selectedPiece.color, cells });
  selectedPiece = null; selectedCells = []; currentRot = 0; currentFlip = false;
  _hintSolution = null; // recalculate hint solution after placement
  refresh();
  _updateSolBadge();
  const needed = BOARD_CELLS.filter(([r,c])=>!blocked.has(cellKey(r,c)));
  const occ    = new Set(placedPieces.flatMap(p=>p.cells.map(([r,c])=>cellKey(r,c))));
  if (needed.every(([r,c])=>occ.has(cellKey(r,c)))) { _playWin(); setTimeout(renderWin, 300); }
}

function resetPunzle() {
  placedPieces = []; selectedPiece = null; selectedCells = [];
  currentRot = 0; currentFlip = false;
  _revealedHints = new Set();
  _hintOrientations = {};
  _hintSolution = null;
  _hintSolIndex = 0;

  const win = document.getElementById("punzle-win");
  if (win) win.style.display = "none";
  _updateSolBadge();
  refresh();
}

function refresh() { renderPunzleBoard(); renderPunzleTray(); }

// ── Cell drag events (mouse only — touch handled globally) ────────────────────
function onCellDragOver(e) { e.preventDefault(); }
function onCellDrop(e)     { e.preventDefault(); }
function onCardDragStart(e) { e.preventDefault(); } // disable HTML5 drag

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Touch
  _initSolutions();
  document.addEventListener("touchmove",   _onTouchMove,  { passive: false });
  document.addEventListener("touchend",    _onTouchEnd,   { passive: true });
  document.addEventListener("touchcancel", _onTouchEnd,   { passive: true });
  // Mouse
  document.addEventListener("mousemove",   _onMouseMove);
  document.addEventListener("mouseup",     _onMouseUp);
  refresh();
});
