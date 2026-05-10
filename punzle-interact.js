// punzle-interact.js — Drag, click, snap, and win detection

// ── Game state ────────────────────────────────────────────────────────────────
let placedPieces  = [];   // { name, color, cells }
let selectedPiece = null; // piece def being held
let selectedCells = [];   // current transformed cells
let currentRot    = 0;    // rotation in degrees
let currentFlip   = false;

const today   = new Date();
const MONTH   = today.getMonth() + 1;
const DAY     = today.getDate();
const blocked = getBlockedCells(MONTH, DAY);

// ── Card interactions ─────────────────────────────────────────────────────────
function onCardClick(e, piece) {
  const card   = e.currentTarget;
  const rect   = card.getBoundingClientRect();
  const yRatio = (e.clientY - rect.top) / rect.height;
  const ZONE   = 0.30;

  // Remove from board if already placed
  if (placedPieces.some(p => p.name === piece.name)) {
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  }

  if (yRatio < ZONE) {
    // Flip zone
    if (selectedPiece && selectedPiece.name === piece.name) {
      currentFlip = !currentFlip;
    } else {
      selectPiece(piece);
      currentFlip = !currentFlip;
    }
  } else if (yRatio > 1 - ZONE) {
    // Rotate zone
    if (selectedPiece && selectedPiece.name === piece.name) {
      currentRot = (currentRot + 90) % 360;
    } else {
      selectPiece(piece);
      currentRot = (currentRot + 90) % 360;
    }
  } else {
    // Center — select or deselect
    if (selectedPiece && selectedPiece.name === piece.name) {
      selectedPiece = null;
      selectedCells = [];
    } else {
      selectPiece(piece);
    }
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

// ── Cell click (tap to place) ─────────────────────────────────────────────────
function onCellClick(e) {
  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  const key = cellKey(r, c);

  // Tap placed piece to remove
  const existing = placedPieces.find(p =>
    p.cells.some(([pr,pc]) => pr===r && pc===c)
  );
  if (existing) {
    placedPieces = placedPieces.filter(p => p.name !== existing.name);
    refresh();
    return;
  }

  // Place selected piece
  if (!selectedPiece || blocked.has(key)) return;

  const anchor = getAnchor(selectedCells);
  const shifted = selectedCells.map(([sr,sc]) => [r + sr - anchor[0], c + sc - anchor[1]]);

  if (isValidPlacement(shifted)) {
    place(shifted);
  }
}

// ── Drag from tray ────────────────────────────────────────────────────────────
function onCardDragStart(e, piece) {
  if (placedPieces.some(p => p.name === piece.name)) {
    e.preventDefault(); return;
  }
  selectPiece(piece);
  updateSelectedCells();
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", piece.name);
  refresh();
}

function onCardDragEnd() {
  // Nothing needed — drop handled by cell
}

function onCellDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";

  // Highlight preview
  document.querySelectorAll(".pz-cell.pz-preview").forEach(el => {
    el.classList.remove("pz-preview", "pz-preview-bad");
  });

  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  if (!selectedPiece) return;

  const anchor   = getAnchor(selectedCells);
  const shifted  = selectedCells.map(([sr,sc]) => [r+sr-anchor[0], c+sc-anchor[1]]);
  const valid    = isValidPlacement(shifted);

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
  e.preventDefault();
  document.querySelectorAll(".pz-cell.pz-preview").forEach(el => {
    el.classList.remove("pz-preview", "pz-preview-bad");
    el.style.background = "";
  });

  const r = parseInt(e.currentTarget.dataset.r);
  const c = parseInt(e.currentTarget.dataset.c);
  if (!selectedPiece) return;

  const anchor  = getAnchor(selectedCells);
  const shifted = selectedCells.map(([sr,sc]) => [r+sr-anchor[0], c+sc-anchor[1]]);

  if (isValidPlacement(shifted)) {
    place(shifted);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getAnchor(cells) {
  if (!cells.length) return [0,0];
  const ar = cells.reduce((s,[r])=>s+r,0)/cells.length;
  const ac = cells.reduce((s,[,c])=>s+c,0)/cells.length;
  let best = cells[0], bd = Infinity;
  for (const cell of cells) {
    const d = (cell[0]-ar)**2 + (cell[1]-ac)**2;
    if (d < bd) { best = cell; bd = d; }
  }
  return best;
}

function isValidPlacement(cells) {
  const occupiedKeys = new Set(
    placedPieces.flatMap(p => p.cells.map(([r,c])=>cellKey(r,c)))
  );
  return cells.every(([r,c]) => {
    const k = cellKey(r,c);
    return isValidCell(r,c) && !blocked.has(k) && !occupiedKeys.has(k);
  });
}

function place(cells) {
  placedPieces.push({
    name:  selectedPiece.name,
    color: selectedPiece.color,
    cells
  });
  selectedPiece = null;
  selectedCells = [];
  currentRot    = 0;
  currentFlip   = false;
  refresh();
  checkWin();
}

function checkWin() {
  const needed = BOARD_CELLS.filter(([r,c]) => !blocked.has(cellKey(r,c)));
  const occupied = new Set(
    placedPieces.flatMap(p => p.cells.map(([r,c])=>cellKey(r,c)))
  );
  if (needed.every(([r,c]) => occupied.has(cellKey(r,c)))) {
    setTimeout(renderWin, 300);
  }
}

function resetPunzle() {
  placedPieces  = [];
  selectedPiece = null;
  selectedCells = [];
  currentRot    = 0;
  currentFlip   = false;
  const win = document.getElementById("punzle-win");
  if (win) win.style.display = "none";
  refresh();
}

function refresh() {
  renderPunzleBoard();
  renderPunzleTray();
}

// ── Board drag clear on leave ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const boardEl = document.getElementById("punzle-board");
  if (boardEl) {
    boardEl.addEventListener("dragleave", (e) => {
      if (!boardEl.contains(e.relatedTarget)) {
        document.querySelectorAll(".pz-cell.pz-preview").forEach(el => {
          el.classList.remove("pz-preview","pz-preview-bad");
          el.style.background = "";
        });
      }
    });
  }
  refresh();
});
