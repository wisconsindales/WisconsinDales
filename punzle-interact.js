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

// ── Solutions & hints — matching solver page exactly ──────────────────────────
let _allSolutions   = [];
let _hintSolution   = null; // single solution used for all hints this session
let _hintSolIndex   = 0;
let _revealedHints  = new Set(); // piece names that have been hinted
let _peekPieceName  = null; // piece name currently being peeked on board

function _initSolutions() {
  setTimeout(() => {
    _allSolutions = solve(MONTH, DAY, true);
    _updateSolBadge();
  }, 100);
}

// ── Hint: pick compatible solution, reveal piece orientation ──────────────────
function pzShowHint() {
  if (!_allSolutions.length) return;

  // Lock in a solution compatible with current board state
  if (!_hintSolution) {
    const compatible = _allSolutions.filter(sol =>
      placedPieces.every(p => {
        const sp = sol.find(s => s.piece === p.name);
        if (!sp) return false;
        const spKeys = new Set(sp.cells.map(([r,c]) => cellKey(r,c)));
        return p.cells.every(([r,c]) => spKeys.has(cellKey(r,c))) &&
               p.cells.length === sp.cells.length;
      })
    );
    if (!compatible.length) {
      _setSarcasm("No compatible hints — your placement has no solution. Try removing a piece.");
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
    _setSarcasm("All hints shown! You got this. Maybe. 😄");
    return;
  }

  // Pick random piece and reveal it
  const piece = unplaced[Math.floor(Math.random() * unplaced.length)];
  _revealedHints.add(piece.name);

  _playHint();
  const msgs = [
    `★ Press and hold piece ${piece.name} to see where it goes.`,
    `★ Piece ${piece.name} is starred. Hold it to peek at its position.`,
    `★ ${piece.name} has been hinted. Hold the card to see where it belongs.`
  ];
  _setSarcasm(msgs[Math.floor(Math.random() * msgs.length)]);

  refresh();
}

// ── Peek: show piece position on board while holding card ─────────────────────
function _startPeek(pieceName) {
  if (!_revealedHints.has(pieceName)) return;
  if (!_hintSolution) return;
  _peekPieceName = pieceName;
  renderPunzleBoard(); // board renders with peek overlay
}

function _endPeek() {
  if (!_peekPieceName) return;
  _peekPieceName = null;
  renderPunzleBoard();
}

// ── Get hint shape for mini piece display — exactly like solver's getCurrentHintShape
function _getHintShape(piece) {
  if (!_hintSolution || !_revealedHints.has(piece.name)) {
    return normalize(piece.cells);
  }
  const placement = _hintSolution.find(p => p.piece === piece.name);
  // normalize the actual solution cells — same as solver page
  return placement ? normalize(placement.cells) : normalize(piece.cells);
}

// ── Next Solution ─────────────────────────────────────────────────────────────
function pzNextSolution() {
  if (!_allSolutions.length) return;
  _hintSolIndex  = (_hintSolIndex + 1) % _allSolutions.length;
  _hintSolution  = _allSolutions[_hintSolIndex];
  // Full reset
  placedPieces   = [];
  selectedPiece  = null;
  selectedCells  = [];
  currentRot     = 0;
  currentFlip    = false;
  _revealedHints = new Set();
  _peekPieceName = null;
  const win = document.getElementById("punzle-win");
  if (win) win.style.display = "none";
  _playNext();
  _setSarcasm(`Solution ${_hintSolIndex + 1} of ${_allSolutions.length} — give it a shot! 😄`);
  _updateSolBadge();
  refresh();
}

// ── Solution badge ────────────────────────────────────────────────────────────
function _updateSolBadge() {
  const badge = document.getElementById("pz-sol-badge");
  const numEl = document.getElementById("pz-sol-num");
  const lblEl = document.getElementById("pz-sol-lbl");
  if (!numEl) return;

  const compat = _allSolutions.filter(sol =>
    placedPieces.every(p => {
      const sp = sol.find(s => s.piece === p.name);
      if (!sp) return false;
      const spKeys = new Set(sp.cells.map(([r,c]) => cellKey(r,c)));
      return p.cells.every(([r,c]) => spKeys.has(cellKey(r,c))) &&
             p.cells.length === sp.cells.length;
    })
  );

  const n = placedPieces.length === 0 ? _allSolutions.length : compat.length;
  numEl.textContent = n;
  if (lblEl) lblEl.textContent = placedPieces.length === 0 ? "solutions" : "possible";

  if (badge) {
    const color = n === 0 ? "#ef4444" : n <= 3 ? "#f97316" : n <= 10 ? "#eab308" : "#22c55e";
    badge.style.borderColor = color;
    numEl.style.color = color;
  }
}

function _setSarcasm(msg) {
  const el = document.getElementById("pz-sarcasm");
  if (el) el.textContent = msg;
}

// ── Apply hint shape if available, else reset to default ─────────────────────
function _applyHintShape(piece) {
  if (_hintSolution && _revealedHints.has(piece.name)) {
    // Use exact cells from solution — same as _getHintShape
    const placement = _hintSolution.find(p => p.piece === piece.name);
    if (placement) {
      selectedCells = normalize(placement.cells);
      currentRot    = 0;
      currentFlip   = false;
      return;
    }
  }
  currentRot   = 0;
  currentFlip  = false;
  _rebuild();
}

// ── Piece transform ───────────────────────────────────────────────────────────
function _rebuild() {
  if (!selectedPiece) { selectedCells = []; return; }
  let cells = selectedPiece.cells.map(([r,c]) => [r,c]);
  const turns = (((currentRot % 360) + 360) % 360) / 90;
  for (let i = 0; i < turns; i++) cells = rotate(cells);
  if (currentFlip) cells = flip(cells);
  selectedCells = normalize(cells);
}

function doSelect(piece) {
  if (placedPieces.some(p => p.name === piece.name))
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  if (selectedPiece && selectedPiece.name === piece.name) {
    selectedPiece = null; selectedCells = [];
  } else {
    selectedPiece = piece;
    _applyHintShape(piece);
  }
  refresh();
}

function doFlip(piece) {
  if (placedPieces.some(p => p.name === piece.name))
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  if (!selectedPiece || selectedPiece.name !== piece.name) {
    selectedPiece = piece;
    _applyHintShape(piece);
  }
  currentFlip = !currentFlip;
  _rebuild(); refresh();
}

function doRotate(piece) {
  if (placedPieces.some(p => p.name === piece.name))
    placedPieces = placedPieces.filter(p => p.name !== piece.name);
  if (!selectedPiece || selectedPiece.name !== piece.name) {
    selectedPiece = piece;
    _applyHintShape(piece);
  }
  currentRot = (currentRot + 90) % 360;
  _rebuild(); refresh();
}

// ── Cell click ────────────────────────────────────────────────────────────────
function onCellClick(e) {
  const r   = parseInt(e.currentTarget.dataset.r);
  const c   = parseInt(e.currentTarget.dataset.c);
  const key = cellKey(r, c);
  const existing = placedPieces.find(p => p.cells.some(([pr,pc]) => pr===r && pc===c));
  if (existing) {
    _playRemove();
    placedPieces   = placedPieces.filter(p => p.name !== existing.name);
    _updateSolBadge();
    refresh(); return;
  }
  if (!selectedPiece || blocked.has(key)) return;
  const shifted = selectedCells.map(([sr,sc]) => [r+sr, c+sc]);
  if (_valid(shifted)) _place(shifted);
}

// ── Mouse drag ────────────────────────────────────────────────────────────────
let _dragPiece  = null;
let _dragging   = false;
let _startX     = 0;
let _startY     = 0;
let _floatEl    = null;
const THR       = 8;

function onCardMouseDown(e, piece) {
  if (placedPieces.some(p => p.name === piece.name)) return;
  e.preventDefault();
  _dragPiece = piece; _dragging = false;
  _startX = e.clientX; _startY = e.clientY;
}

function _onMouseMove(e) {
  if (!_dragPiece) return;
  const dx = e.clientX - _startX;
  const dy = e.clientY - _startY;
  if (!_dragging && (Math.abs(dx) > THR || Math.abs(dy) > THR)) {
    _dragging = true;
    if (!selectedPiece || selectedPiece.name !== _dragPiece.name) {
      selectedPiece = _dragPiece;
      _applyHintShape(_dragPiece);
    }
    refresh(); _makeFloat();
  }
  if (_dragging) {
    _moveFloat(e.clientX, e.clientY);
    _clearPreview();
    const t = _cellAt(e.clientX, e.clientY);
    if (t) _showPreview(parseInt(t.dataset.r), parseInt(t.dataset.c));
  }
}

function _onMouseUp(e) {
  if (!_dragPiece) return;
  if (_dragging && selectedPiece) {
    const t = _cellAt(e.clientX, e.clientY);
    if (t) {
      const r = parseInt(t.dataset.r), c = parseInt(t.dataset.c);
      const shifted = selectedCells.map(([sr,sc]) => [r+sr, c+sc]);
      if (_valid(shifted)) _place(shifted);
    }
  }
  _killFloat(); _clearPreview();
  _dragPiece = null; _dragging = false;
}

// ── Touch drag ────────────────────────────────────────────────────────────────
let _touchPiece   = null;
let _touchDragging = false;
let _touchStartX  = 0;
let _touchStartY  = 0;

function onCardTouchStart(e, piece) {
  if (placedPieces.some(p => p.name === piece.name)) return;
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
  if (!_touchDragging && (Math.abs(dx) > THR || Math.abs(dy) > THR)) {
    _touchDragging = true;
    if (!selectedPiece || selectedPiece.name !== _touchPiece.name) {
      selectedPiece = _touchPiece;
      _applyHintShape(_touchPiece);
    }
    refresh(); _makeFloat();
  }
  if (_touchDragging) {
    e.preventDefault();
    _moveFloat(t.clientX, t.clientY);
    _clearPreview();
    const target = _cellAt(t.clientX, t.clientY);
    if (target) _showPreview(parseInt(target.dataset.r), parseInt(target.dataset.c));
  }
}

function _onTouchEnd(e) {
  if (_touchDragging && _touchPiece && selectedPiece) {
    const t = e.changedTouches[0];
    const target = _cellAt(t.clientX, t.clientY);
    if (target) {
      const r = parseInt(target.dataset.r), c = parseInt(target.dataset.c);
      const shifted = selectedCells.map(([sr,sc]) => [r+sr, c+sc]);
      if (_valid(shifted)) _place(shifted);
    }
  }
  _killFloat(); _clearPreview();
  _touchPiece = null; _touchDragging = false;
}

// ── Float ghost ───────────────────────────────────────────────────────────────
function _makeFloat() {
  _killFloat();
  if (!selectedPiece || !selectedCells.length) return;
  _floatEl = document.createElement("div");
  _floatEl.style.cssText = "position:fixed;pointer-events:none;z-index:9999;display:grid;gap:2px;opacity:0.88;will-change:left,top;";
  const SZ = 36;
  const maxR = Math.max(...selectedCells.map(([r])=>r));
  const maxC = Math.max(...selectedCells.map(([,c])=>c));
  _floatEl.style.gridTemplateColumns = `repeat(${maxC+1},${SZ}px)`;
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const on = selectedCells.some(([sr,sc])=>sr===r&&sc===c);
      const cell = document.createElement("div");
      cell.style.cssText = `width:${SZ}px;height:${SZ}px;border-radius:6px;background:${on?selectedPiece.color:"transparent"};${on?"border:2px solid rgba(255,255,255,0.4);":""}`;
      _floatEl.appendChild(cell);
    }
  }
  document.body.appendChild(_floatEl);
}

function _moveFloat(x, y) {
  if (!_floatEl) return;
  requestAnimationFrame(() => {
    if (_floatEl) { _floatEl.style.left = x+"px"; _floatEl.style.top = y+"px"; }
  });
}

function _killFloat() {
  if (_floatEl) { _floatEl.remove(); _floatEl = null; }
}

// ── Preview ───────────────────────────────────────────────────────────────────
function _showPreview(r, c) {
  if (!selectedPiece || !selectedCells.length) return;
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
  return document.elementsFromPoint(x, y)
    .find(el => el.classList && el.classList.contains("pz-cell") && el.dataset.r !== undefined);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  // Only reset hint solution if placed piece is incompatible with it
  if (_hintSolution) {
    const sp = _hintSolution.find(s => s.piece === selectedPiece.name);
    const spKeys = sp ? new Set(sp.cells.map(([r,c]) => cellKey(r,c))) : null;
    const compatible = spKeys && cells.every(([r,c]) => spKeys.has(cellKey(r,c)));
    if (!compatible) _hintSolution = null;
  }
  refresh();
  _updateSolBadge();
  const needed = BOARD_CELLS.filter(([r,c])=>!blocked.has(cellKey(r,c)));
  const occ    = new Set(placedPieces.flatMap(p=>p.cells.map(([r,c])=>cellKey(r,c))));
  if (needed.every(([r,c])=>occ.has(cellKey(r,c)))) { _playWin(); setTimeout(renderWin, 300); }
}

function resetPunzle() {
  placedPieces   = []; selectedPiece = null; selectedCells = [];
  currentRot     = 0;  currentFlip   = false;
  _revealedHints = new Set(); _hintSolution = null; _hintSolIndex = 0; _peekPieceName = null;
  const win = document.getElementById("punzle-win");
  if (win) win.style.display = "none";
  _setSarcasm("Fit the pieces. Puns included. 😄");
  _updateSolBadge();
  refresh();
}

function refresh() { renderPunzleBoard(); renderPunzleTray(); }

// ── Stub events for board (touch handled globally) ────────────────────────────
function onCellDragOver(e) { e.preventDefault(); }
function onCellDrop(e)     { e.preventDefault(); }
function onCardDragStart(e){ e.preventDefault(); }

// ── Audio ─────────────────────────────────────────────────────────────────────
let _audioCtx = null;
function _getCtx() {
  if (!_audioCtx) { const C = window.AudioContext||window.webkitAudioContext; if(C) _audioCtx=new C(); }
  if (_audioCtx && _audioCtx.state==="suspended") _audioCtx.resume();
  return _audioCtx;
}
function _playPlace() {
  const ctx=_getCtx(); if(!ctx) return; const now=ctx.currentTime;
  const o1=ctx.createOscillator(),o2=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();
  o1.type="triangle"; o2.type="sine"; f.type="lowpass"; f.frequency.setValueAtTime(1400,now);
  o1.frequency.setValueAtTime(720,now); o1.frequency.exponentialRampToValueAtTime(240,now+0.22);
  o2.frequency.setValueAtTime(380,now); o2.frequency.exponentialRampToValueAtTime(120,now+0.22);
  g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.10,now+0.02); g.gain.exponentialRampToValueAtTime(0.0001,now+0.22);
  o1.connect(f); o2.connect(f); f.connect(g); g.connect(ctx.destination);
  o1.start(now); o2.start(now); o1.stop(now+0.22); o2.stop(now+0.22);
}
function _playRemove() {
  const ctx=_getCtx(); if(!ctx) return; const now=ctx.currentTime;
  const o=ctx.createOscillator(),g=ctx.createGain(); o.type="sine";
  o.frequency.setValueAtTime(400,now); o.frequency.exponentialRampToValueAtTime(180,now+0.15);
  g.gain.setValueAtTime(0.08,now); g.gain.exponentialRampToValueAtTime(0.0001,now+0.15);
  o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now+0.15);
}
function _playHint() {
  const ctx=_getCtx(); if(!ctx) return; const now=ctx.currentTime;
  [400,600,520,480,700].forEach((f,i)=>{
    const d=i*0.03,o=ctx.createOscillator(),g=ctx.createGain(); o.type="sine";
    o.frequency.setValueAtTime(f,now+d);
    g.gain.setValueAtTime(0.0001,now+d); g.gain.exponentialRampToValueAtTime(0.07,now+d+0.02); g.gain.exponentialRampToValueAtTime(0.0001,now+d+0.18);
    o.connect(g); g.connect(ctx.destination); o.start(now+d); o.stop(now+d+0.2);
  });
}
function _playWin() {
  const ctx=_getCtx(); if(!ctx) return; const now=ctx.currentTime;
  [523,659,784,1047,784,1047,1319].forEach((f,i)=>{
    const s=now+0.1+i*0.13,o=ctx.createOscillator(),g=ctx.createGain(); o.type="triangle";
    o.frequency.setValueAtTime(f,s);
    g.gain.setValueAtTime(0.0001,s); g.gain.linearRampToValueAtTime(0.12,s+0.04); g.gain.linearRampToValueAtTime(0.0001,s+0.2);
    o.connect(g); g.connect(ctx.destination); o.start(s); o.stop(s+0.25);
  });
}
function _playNext() {
  const ctx=_getCtx(); if(!ctx) return; const now=ctx.currentTime;
  const o=ctx.createOscillator(),g=ctx.createGain(); o.type="triangle";
  o.frequency.setValueAtTime(300,now); o.frequency.exponentialRampToValueAtTime(600,now+0.12);
  g.gain.setValueAtTime(0.0001,now); g.gain.exponentialRampToValueAtTime(0.08,now+0.03); g.gain.exponentialRampToValueAtTime(0.0001,now+0.18);
  o.connect(g); g.connect(ctx.destination); o.start(now); o.stop(now+0.2);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  _initSolutions();
  document.addEventListener("touchmove",   _onTouchMove,  { passive: false });
  document.addEventListener("touchend",    _onTouchEnd,   { passive: true });
  document.addEventListener("touchcancel", _onTouchEnd,   { passive: true });
  document.addEventListener("mousemove",   _onMouseMove);
  document.addEventListener("mouseup",     _onMouseUp);
  refresh();
});
