// punzle-interact.js — Game state, interactions, drag

// ── State ─────────────────────────────────────────────────────────────────────
let placedPieces  = [];
let selectedPiece = null;
let selectedCells = [];
let currentRot    = 0;
let currentFlip   = false;

const _today   = new Date();
const MONTH    = _today.getMonth() + 1;
const DAY      = _today.getDate();
const blocked  = getBlockedCells(MONTH, DAY);

// ── Piece actions — called directly from render ───────────────────────────────
function doSelect(piece) {
  if (placedPieces.some(p => p.name === piece.name)) {
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  }
  if (selectedPiece && selectedPiece.name === piece.name) {
    selectedPiece = null; selectedCells = [];
  } else {
    selectedPiece = piece;
    currentRot    = 0;
    currentFlip   = false;
    _rebuildCells();
  }
  refresh();
}

function doFlip(piece) {
  if (placedPieces.some(p => p.name === piece.name)) {
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  }
  if (!selectedPiece || selectedPiece.name !== piece.name) {
    selectedPiece = piece; currentRot = 0; currentFlip = false;
  }
  currentFlip = !currentFlip;
  _rebuildCells();
  refresh();
}

function doRotate(piece) {
  if (placedPieces.some(p => p.name === piece.name)) {
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  }
  if (!selectedPiece || selectedPiece.name !== piece.name) {
    selectedPiece = piece; currentRot = 0; currentFlip = false;
  }
  currentRot = (currentRot + 90) % 360;
  _rebuildCells();
  refresh();
}

function _rebuildCells() {
  if (!selectedPiece) { selectedCells = []; return; }
  let cells = selectedPiece.cells.map(([r,c]) => [r,c]);
  if (currentFlip) cells = flip(cells);
  const turns = (((currentRot % 360) + 360) % 360) / 90;
  for (let i = 0; i < turns; i++) cells = rotate(cells);
  selectedCells = normalize(cells);
}

// ── Cell click — place or remove ──────────────────────────────────────────────
function onCellClick(e) {
  const r   = parseInt(e.currentTarget.dataset.r);
  const c   = parseInt(e.currentTarget.dataset.c);
  const key = cellKey(r, c);

  // Remove placed piece
  const existing = placedPieces.find(p =>
    p.cells.some(([pr,pc]) => pr===r && pc===c)
  );
  if (existing) {
    placedPieces = placedPieces.filter(p => p.name !== existing.name);
    refresh(); return;
  }

  // Place selected piece
  if (!selectedPiece || blocked.has(key)) return;
  const anchor  = _anchor(selectedCells);
  const shifted = selectedCells.map(([sr,sc]) => [r+sr-anchor[0], c+sc-anchor[1]]);
  if (_validPlacement(shifted)) _place(shifted);
}

// ── Mouse drag ────────────────────────────────────────────────────────────────
function onCardDragStart(e, piece) {
  if (placedPieces.some(p => p.name === piece.name)) { e.preventDefault(); return; }
  selectedPiece = piece; currentRot = 0; currentFlip = false; _rebuildCells();
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", piece.name);
  refresh();
}

function onCellDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  _clearPreview();
  if (!selectedPiece) return;
  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  _showPreview(r, c);
}

function onCellDrop(e) {
  e.preventDefault();
  _clearPreview();
  if (!selectedPiece) return;
  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  const anchor  = _anchor(selectedCells);
  const shifted = selectedCells.map(([sr,sc]) => [r+sr-anchor[0], c+sc-anchor[1]]);
  if (_validPlacement(shifted)) _place(shifted);
}

// ── Touch drag ────────────────────────────────────────────────────────────────
let _touchPiece    = null;
let _touchDragging = false;
let _touchStartX   = 0;
let _touchStartY   = 0;
let _floatEl       = null;
const DRAG_THR     = 10;

function onCardTouchStart(e, piece) {
  if (placedPieces.some(p => p.name === piece.name)) return;
  e.preventDefault(); // claim the gesture immediately
  _touchPiece    = piece;
  _touchDragging = false;
  _touchStartX   = e.touches[0].clientX;
  _touchStartY   = e.touches[0].clientY;
}

function _onTouchMove(e) {
  if (!_touchPiece) return;
  const t  = e.touches[0];
  const dx = t.clientX - _touchStartX;
  const dy = t.clientY - _touchStartY;

  if (!_touchDragging && (Math.abs(dx) > DRAG_THR || Math.abs(dy) > DRAG_THR)) {
    _touchDragging = true;
    selectedPiece = _touchPiece;
    currentRot    = 0;
    currentFlip   = false;
    _rebuildCells();
    refresh();
    _createFloat(t.clientX, t.clientY);
  }

  if (_touchDragging) {
    e.preventDefault();
    _moveFloat(t.clientX, t.clientY);
    _clearPreview();
    const target = _cellAtPoint(t.clientX, t.clientY);
    if (target) _showPreview(parseInt(target.dataset.r), parseInt(target.dataset.c));
  }
}

function _onTouchEnd(e) {
  if (_touchDragging && _touchPiece) {
    const t      = e.changedTouches[0];
    const target = _cellAtPoint(t.clientX, t.clientY);
    if (target && selectedPiece) {
      const r       = parseInt(target.dataset.r);
      const c       = parseInt(target.dataset.c);
      const anchor  = _anchor(selectedCells);
      const shifted = selectedCells.map(([sr,sc]) => [r+sr-anchor[0], c+sc-anchor[1]]);
      if (_validPlacement(shifted)) _place(shifted);
    }
  }
  _destroyFloat();
  _clearPreview();
  _touchPiece    = null;
  _touchDragging = false;
}

function _createFloat(x, y) {
  _destroyFloat();
  _floatEl = document.createElement("div");
  _floatEl.style.cssText = "position:fixed;pointer-events:none;z-index:9999;display:grid;gap:2px;opacity:0.9;transform:translate(-50%,-120%);";
  const SZ   = 34;
  const cells = selectedCells.length ? selectedCells : normalize(_touchPiece.cells);
  const maxR  = Math.max(...cells.map(([r])=>r));
  const maxC  = Math.max(...cells.map(([,c])=>c));
  _floatEl.style.gridTemplateColumns = `repeat(${maxC+1},${SZ}px)`;
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const cell = document.createElement("div");
      const on   = cells.some(([sr,sc]) => sr===r && sc===c);
      cell.style.cssText = `width:${SZ}px;height:${SZ}px;border-radius:5px;background:${on ? selectedPiece.color : "transparent"};${on ? "border:1.5px solid rgba(255,255,255,0.3);" : ""}`;
      _floatEl.appendChild(cell);
    }
  }
  document.body.appendChild(_floatEl);
  _moveFloat(x, y);
}

function _moveFloat(x, y) {
  if (_floatEl) { _floatEl.style.left = x+"px"; _floatEl.style.top = y+"px"; }
}

function _destroyFloat() {
  if (_floatEl) { _floatEl.remove(); _floatEl = null; }
}

function _cellAtPoint(x, y) {
  return document.elementsFromPoint(x, y)
    .find(el => el.classList && el.classList.contains("pz-cell") && el.dataset.r !== undefined);
}

// ── Preview highlight ─────────────────────────────────────────────────────────
function _showPreview(r, c) {
  if (!selectedPiece) return;
  const anchor  = _anchor(selectedCells);
  const shifted = selectedCells.map(([sr,sc]) => [r+sr-anchor[0], c+sc-anchor[1]]);
  const valid   = _validPlacement(shifted);
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

function _validPlacement(cells) {
  if (!cells.length) return false;
  const occ = new Set(placedPieces.flatMap(p => p.cells.map(([r,c])=>cellKey(r,c))));
  return cells.every(([r,c]) => {
    const k = cellKey(r,c);
    return isValidCell(r,c) && !blocked.has(k) && !occ.has(k);
  });
}

function _place(cells) {
  placedPieces.push({ name:selectedPiece.name, color:selectedPiece.color, cells });
  selectedPiece = null; selectedCells = []; currentRot = 0; currentFlip = false;
  refresh();
  // Check win
  const needed = BOARD_CELLS.filter(([r,c]) => !blocked.has(cellKey(r,c)));
  const occ    = new Set(placedPieces.flatMap(p => p.cells.map(([r,c])=>cellKey(r,c))));
  if (needed.every(([r,c]) => occ.has(cellKey(r,c)))) setTimeout(renderWin, 300);
}

function resetPunzle() {
  placedPieces  = []; selectedPiece = null; selectedCells = [];
  currentRot    = 0;  currentFlip   = false;
  const win = document.getElementById("punzle-win");
  if (win) win.style.display = "none";
  refresh();
}

function refresh() { renderPunzleBoard(); renderPunzleTray(); }

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const boardEl = document.getElementById("punzle-board");
  if (boardEl) {
    boardEl.addEventListener("dragleave", e => {
      if (!boardEl.contains(e.relatedTarget)) _clearPreview();
    });
  }
  document.addEventListener("touchmove",   _onTouchMove,  { passive: false });
  document.addEventListener("touchend",    _onTouchEnd);
  document.addEventListener("touchcancel", _onTouchEnd);
  refresh();
});
