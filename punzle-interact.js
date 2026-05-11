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
    for (const p of placedPieces) {
      const sp = sol.find(s => s.piece === p.name);
      if (!sp) return false;
      const sk = new Set(sp.cells.map(([r,c]) => cellKey(r,c)));
      if (!p.cells.every(([r,c]) => sk.has(cellKey(r,c)))) return false;
    }
    return true;
  });

  const n = placedPieces.length === 0 ? _allSolutions.length : compat.length;
  numEl.textContent = n;

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

function pzShowHint() {
  if (!_allSolutions.length) return;
  // Pick a solution to base hints on
  const sol = _allSolutions[0];

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
  const solPiece = sol.find(s => s.piece === piece.name);
  if (!solPiece) return;

  // Find the rotation/flip that produces solution shape
  let hintRot = 0, hintFlip = false;
  outer:
  for (const flipped of [false, true]) {
    for (let rot = 0; rot < 360; rot += 90) {
      let cells = piece.cells.map(([r,c]) => [r,c]);
      if (flipped) cells = flip(cells);
      const turns = rot / 90;
      for (let i = 0; i < turns; i++) cells = rotate(cells);
      const norm = normalize(cells);
      const solCells = solPiece.cells;
      const srMin = Math.min(...solCells.map(([r])=>r));
      const scMin = Math.min(...solCells.map(([,c])=>c));
      const solNorm = normalize(solCells.map(([r,c])=>[r-srMin,c-scMin]));
      if (norm.map(([r,c])=>`${r},${c}`).join("|") === solNorm.map(([r,c])=>`${r},${c}`).join("|")) {
        hintRot  = rot;
        hintFlip = flipped;
        break outer;
      }
    }
  }

  _revealedHints.add(piece.name);
  _hintOrientations[piece.name] = { rot: hintRot, flip: hintFlip };

  // If this piece is selected, update its orientation
  if (selectedPiece && selectedPiece.name === piece.name) {
    currentRot  = hintRot;
    currentFlip = hintFlip;
    _rebuild();
  }

  const sarcasm = document.getElementById("pz-sarcasm");
  if (sarcasm) sarcasm.textContent = `★ Piece ${piece.name} oriented correctly. Try not to waste it.`;

  refresh();
}

// ── Piece actions ─────────────────────────────────────────────────────────────
function doSelect(piece) {
  if (placedPieces.some(p => p.name === piece.name))
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  if (selectedPiece && selectedPiece.name === piece.name) {
    selectedPiece = null; selectedCells = [];
  } else {
    selectedPiece = piece; currentRot = 0; currentFlip = false; _rebuild();
  }
  refresh();
}

function doFlip(piece) {
  if (placedPieces.some(p => p.name === piece.name))
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  if (!selectedPiece || selectedPiece.name !== piece.name) {
    selectedPiece = piece; currentRot = 0; currentFlip = false;
  }
  currentFlip = !currentFlip;
  _rebuild(); refresh();
}

function doRotate(piece) {
  if (placedPieces.some(p => p.name === piece.name))
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  if (!selectedPiece || selectedPiece.name !== piece.name) {
    selectedPiece = piece; currentRot = 0; currentFlip = false;
  }
  currentRot = (currentRot + 90) % 360;
  _rebuild(); refresh();
}

function _rebuild() {
  if (!selectedPiece) { selectedCells = []; return; }
  let cells = selectedPiece.cells.map(([r,c]) => [r,c]);
  if (currentFlip) cells = flip(cells);
  const turns = (((currentRot % 360) + 360) % 360) / 90;
  for (let i = 0; i < turns; i++) cells = rotate(cells);
  selectedCells = normalize(cells);
}

// ── Cell click ────────────────────────────────────────────────────────────────
function onCellClick(e) {
  const r   = parseInt(e.currentTarget.dataset.r);
  const c   = parseInt(e.currentTarget.dataset.c);
  const key = cellKey(r, c);
  const existing = placedPieces.find(p => p.cells.some(([pr,pc]) => pr===r && pc===c));
  if (existing) {
    placedPieces = placedPieces.filter(p => p.name !== existing.name);
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
    _dragging     = true;
    selectedPiece = _dragPiece;
    currentRot    = 0;
    currentFlip   = false;
    _rebuild();
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
  e.preventDefault();
  const t = e.touches[0];
  _dragStart(piece, t.clientX, t.clientY, true);
}

function _onTouchMove(e) {
  if (!_dragPiece) return;
  const t = e.touches[0];
  if (_dragging) e.preventDefault();
  _dragMove(t.clientX, t.clientY);
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
  _floatEl.style.left = x + "px";
  _floatEl.style.top  = y + "px";
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
  placedPieces.push({ name:selectedPiece.name, color:selectedPiece.color, cells });
  selectedPiece = null; selectedCells = []; currentRot = 0; currentFlip = false;
  refresh();
  _updateSolBadge();
  const needed = BOARD_CELLS.filter(([r,c])=>!blocked.has(cellKey(r,c)));
  const occ    = new Set(placedPieces.flatMap(p=>p.cells.map(([r,c])=>cellKey(r,c))));
  if (needed.every(([r,c])=>occ.has(cellKey(r,c)))) setTimeout(renderWin, 300);
}

function resetPunzle() {
  placedPieces = []; selectedPiece = null; selectedCells = [];
  currentRot = 0; currentFlip = false;
  _revealedHints = new Set();
  _hintOrientations = {};
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
