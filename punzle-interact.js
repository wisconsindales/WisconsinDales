// punzle-interact.js — Drag, click, snap, win detection (touch + mouse)

// ── Game state ────────────────────────────────────────────────────────────────
let placedPieces  = [];
let selectedPiece = null;
let selectedCells = [];
let currentRot    = 0;
let currentFlip   = false;

const today   = new Date();
const MONTH   = today.getMonth() + 1;
const DAY     = today.getDate();
const blocked = getBlockedCells(MONTH, DAY);

// ── Touch drag state ──────────────────────────────────────────────────────────
let touchDragging = false;
let touchPiece    = null;
let floatEl       = null;
let touchStartX   = 0;
let touchStartY   = 0;
const DRAG_THR    = 8;

// ── Card zone tap — separate listeners per zone ───────────────────────────────
function onCardTap(e, piece, zone) {
  e.stopPropagation();
  if (placedPieces.some(p => p.name === piece.name)) {
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  }
  if (zone === "flip") {
    if (selectedPiece && selectedPiece.name === piece.name) {
      currentFlip = !currentFlip;
    } else { selectPiece(piece); currentFlip = !currentFlip; }
  } else if (zone === "rotate") {
    if (selectedPiece && selectedPiece.name === piece.name) {
      currentRot = (currentRot + 90) % 360;
    } else { selectPiece(piece); currentRot = (currentRot + 90) % 360; }
  } else {
    if (selectedPiece && selectedPiece.name === piece.name) {
      selectedPiece = null; selectedCells = [];
    } else { selectPiece(piece); }
  }
  updateSelectedCells();
  refresh();
}

function selectPiece(piece) {
  selectedPiece = piece;
  currentRot    = 0;
  currentFlip   = false;
  updateSelectedCells();
}

function updateSelectedCells() {
  if (!selectedPiece) { selectedCells = []; return; }
  let cells = selectedPiece.cells.map(([r,c]) => [r,c]);
  if (currentFlip) cells = flip(cells);
  const turns = (((currentRot % 360) + 360) % 360) / 90;
  for (let i = 0; i < turns; i++) cells = rotate(cells);
  selectedCells = normalize(cells);
}

// ── Touch drag from tray ──────────────────────────────────────────────────────
function onCardTouchStart(e, piece) {
  if (placedPieces.some(p => p.name === piece.name)) return;
  const t   = e.touches[0];
  touchStartX   = t.clientX;
  touchStartY   = t.clientY;
  touchPiece    = piece;
  touchDragging = false;
}

function onCardTouchMove(e) {
  if (!touchPiece) return;
  const t  = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;

  if (!touchDragging && (Math.abs(dx) > DRAG_THR || Math.abs(dy) > DRAG_THR)) {
    touchDragging = true;
    if (!selectedPiece || selectedPiece.name !== touchPiece.name) {
      selectPiece(touchPiece);
      updateSelectedCells();
      refresh();
    }
    createFloatEl(t.clientX, t.clientY);
  }

  if (touchDragging) {
    e.preventDefault();
    moveFloatEl(t.clientX, t.clientY);
    highlightDropTarget(t.clientX, t.clientY);
  }
}

function onCardTouchEnd(e) {
  if (touchDragging && touchPiece) {
    const t = e.changedTouches[0];
    dropAtPoint(t.clientX, t.clientY);
  }
  clearFloatEl();
  clearPreview();
  touchPiece    = null;
  touchDragging = false;
}

// ── Floating ghost ────────────────────────────────────────────────────────────
function createFloatEl(x, y) {
  clearFloatEl();
  floatEl = document.createElement("div");
  floatEl.style.cssText = "position:fixed;pointer-events:none;z-index:9999;display:grid;gap:2px;opacity:0.85;transform:translate(-50%,-120%);";
  const CELL_PX = 36;
  const cells   = selectedCells.length ? selectedCells : normalize(touchPiece.cells);
  const maxR    = Math.max(...cells.map(([r])=>r));
  const maxC    = Math.max(...cells.map(([,c])=>c));
  floatEl.style.gridTemplateColumns = `repeat(${maxC+1},${CELL_PX}px)`;
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const cell = document.createElement("div");
      const on   = cells.some(([sr,sc])=>sr===r&&sc===c);
      cell.style.cssText = `width:${CELL_PX}px;height:${CELL_PX}px;border-radius:5px;background:${on?selectedPiece.color:"transparent"};border:${on?"1.5px solid rgba(255,255,255,0.3)":"none"};`;
      floatEl.appendChild(cell);
    }
  }
  document.body.appendChild(floatEl);
  moveFloatEl(x, y);
}

function moveFloatEl(x, y) {
  if (!floatEl) return;
  floatEl.style.left = x + "px";
  floatEl.style.top  = y + "px";
}

function clearFloatEl() {
  if (floatEl) { floatEl.remove(); floatEl = null; }
}

// ── Drop target highlight ─────────────────────────────────────────────────────
function highlightDropTarget(x, y) {
  clearPreview();
  const target = getCellAtPoint(x, y);
  if (!target || !selectedPiece) return;
  const r = parseInt(target.dataset.r);
  const c = parseInt(target.dataset.c);
  const anchor  = getAnchor(selectedCells);
  const shifted = selectedCells.map(([sr,sc])=>[r+sr-anchor[0],c+sc-anchor[1]]);
  const valid   = isValidPlacement(shifted);
  shifted.forEach(([pr,pc]) => {
    const el = document.querySelector(`.pz-cell[data-r="${pr}"][data-c="${pc}"]`);
    if (el) {
      el.classList.add("pz-preview");
      if (!valid) el.classList.add("pz-preview-bad");
      else el.style.background = selectedPiece.color + "99";
    }
  });
}

function getCellAtPoint(x, y) {
  const els = document.elementsFromPoint(x, y);
  return els.find(el => el.classList && el.classList.contains("pz-cell") && el.dataset.r !== undefined);
}

function clearPreview() {
  document.querySelectorAll(".pz-cell.pz-preview").forEach(el => {
    el.classList.remove("pz-preview","pz-preview-bad");
    el.style.background = "";
  });
}

function dropAtPoint(x, y) {
  const target = getCellAtPoint(x, y);
  if (!target || !selectedPiece) return;
  const r = parseInt(target.dataset.r);
  const c = parseInt(target.dataset.c);
  const anchor  = getAnchor(selectedCells);
  const shifted = selectedCells.map(([sr,sc])=>[r+sr-anchor[0],c+sc-anchor[1]]);
  if (isValidPlacement(shifted)) place(shifted);
}

// ── Cell click ────────────────────────────────────────────────────────────────
function onCellClick(e) {
  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  const key = cellKey(r, c);
  const existing = placedPieces.find(p=>p.cells.some(([pr,pc])=>pr===r&&pc===c));
  if (existing) {
    placedPieces = placedPieces.filter(p=>p.name!==existing.name);
    refresh(); return;
  }
  if (!selectedPiece || blocked.has(key)) return;
  const anchor  = getAnchor(selectedCells);
  const shifted = selectedCells.map(([sr,sc])=>[r+sr-anchor[0],c+sc-anchor[1]]);
  if (isValidPlacement(shifted)) place(shifted);
}

// ── Mouse drag ────────────────────────────────────────────────────────────────
function onCellDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  clearPreview();
  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  if (!selectedPiece) return;
  const anchor  = getAnchor(selectedCells);
  const shifted = selectedCells.map(([sr,sc])=>[r+sr-anchor[0],c+sc-anchor[1]]);
  const valid   = isValidPlacement(shifted);
  shifted.forEach(([pr,pc]) => {
    const el = document.querySelector(`.pz-cell[data-r="${pr}"][data-c="${pc}"]`);
    if (el) {
      el.classList.add("pz-preview");
      if (!valid) el.classList.add("pz-preview-bad");
      else el.style.background = selectedPiece.color + "99";
    }
  });
}

function onCellDrop(e) {
  e.preventDefault(); clearPreview();
  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  if (!selectedPiece) return;
  const anchor  = getAnchor(selectedCells);
  const shifted = selectedCells.map(([sr,sc])=>[r+sr-anchor[0],c+sc-anchor[1]]);
  if (isValidPlacement(shifted)) place(shifted);
}

function onCardDragStart(e, piece) {
  if (placedPieces.some(p=>p.name===piece.name)) { e.preventDefault(); return; }
  selectPiece(piece); updateSelectedCells();
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", piece.name);
  refresh();
}

// ── Core helpers ──────────────────────────────────────────────────────────────
function getAnchor(cells) {
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

function isValidPlacement(cells) {
  const occ = new Set(placedPieces.flatMap(p=>p.cells.map(([r,c])=>cellKey(r,c))));
  return cells.length > 0 && cells.every(([r,c]) => {
    const k = cellKey(r,c);
    return isValidCell(r,c) && !blocked.has(k) && !occ.has(k);
  });
}

function place(cells) {
  placedPieces.push({ name:selectedPiece.name, color:selectedPiece.color, cells });
  selectedPiece = null; selectedCells = []; currentRot = 0; currentFlip = false;
  refresh(); checkWin();
}

function checkWin() {
  const needed = BOARD_CELLS.filter(([r,c])=>!blocked.has(cellKey(r,c)));
  const occ    = new Set(placedPieces.flatMap(p=>p.cells.map(([r,c])=>cellKey(r,c))));
  if (needed.every(([r,c])=>occ.has(cellKey(r,c)))) setTimeout(renderWin, 300);
}

function resetPunzle() {
  placedPieces = []; selectedPiece = null; selectedCells = [];
  currentRot = 0; currentFlip = false;
  const win = document.getElementById("punzle-win");
  if (win) win.style.display = "none";
  refresh();
}

function refresh() { renderPunzleBoard(); renderPunzleTray(); }

document.addEventListener("DOMContentLoaded", () => {
  const boardEl = document.getElementById("punzle-board");
  if (boardEl) {
    boardEl.addEventListener("dragleave", e => {
      if (!boardEl.contains(e.relatedTarget)) clearPreview();
    });
  }
  document.addEventListener("touchmove",   onCardTouchMove, { passive: false });
  document.addEventListener("touchend",    onCardTouchEnd);
  document.addEventListener("touchcancel", onCardTouchEnd);
  refresh();
});
