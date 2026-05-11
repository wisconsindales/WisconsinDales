// punzle-render.js — Board and tray rendering with solver-exact peek

function renderPunzleBoard() {
  const boardEl = document.getElementById("punzle-board");
  if (!boardEl) return;
  boardEl.innerHTML = "";

  // Build peek map if a piece is being held
  const peekMap = new Map();
  if (_peekPieceName && _hintSolution) {
    const placement = _hintSolution.find(p => p.piece === _peekPieceName);
    if (placement) {
      placement.cells.forEach(([r,c]) => {
        peekMap.set(cellKey(r,c), placement);
      });
    }
  }

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const el    = document.createElement("div");
      const key   = cellKey(r, c);
      const valid = isValidCell(r, c);

      if (!valid) {
        el.className = "pz-cell pz-off";
        boardEl.appendChild(el);
        continue;
      }

      el.dataset.r   = r;
      el.dataset.c   = c;
      el.textContent = LABELS.get(key) || "";

      if (blocked.has(key)) {
        el.className = "pz-cell pz-blocked";
      } else {
        const placed = placedPieces.find(p =>
          p.cells.some(([pr,pc]) => pr===r && pc===c)
        );
        if (placed) {
          el.className        = "pz-cell pz-placed";
          el.style.background = placed.color;
          el.dataset.piece    = placed.name;
        } else if (peekMap.has(key)) {
          // Peek preview — show where hinted piece goes
          const p = peekMap.get(key);
          el.className        = "pz-cell pz-peek";
          el.style.background = p.color + "cc";
          el.style.border     = `2px solid ${p.color}`;
        } else {
          el.className = "pz-cell pz-empty";
        }
      }

      el.addEventListener("dragover", onCellDragOver);
      el.addEventListener("drop",     onCellDrop);
      el.addEventListener("click",    onCellClick);
      boardEl.appendChild(el);
    }
  }
}

function renderPunzleTray() {
  const trayEl = document.getElementById("punzle-tray");
  if (!trayEl) return;
  trayEl.innerHTML = "";

  PIECES.forEach(piece => {
    const isPlaced   = placedPieces.some(p => p.name === piece.name);
    const isSelected = selectedPiece && selectedPiece.name === piece.name;
    const isHinted   = _revealedHints && _revealedHints.has(piece.name);
    const isPeeking  = _peekPieceName === piece.name;

    // Get display shape — use solver's exact approach for hinted pieces
    const displayCells = isSelected ? selectedCells : _getHintShape(piece);

    // Star shows when hinted and not rotated away (selected pieces lose star if orientation changed)
    const showStar = isHinted && !isPlaced;

    const card = document.createElement("div");
    card.className = `pz-card${isPlaced?" pz-card-done":""}${isSelected?" pz-card-sel":""}${isPeeking?" pz-card-peek":""}`;
    card.style.borderColor = isPeeking ? "#22d3ee" : isSelected ? "#22d3ee" : isHinted ? "rgba(253,230,138,0.6)" : isPlaced ? piece.color+"66" : "#1e1030";

    if (!isPlaced) {
      card.draggable = true;
      card.addEventListener("mousedown", e => onCardMouseDown(e, piece));
    }

    // Color bar
    const bar = document.createElement("div");
    bar.className        = "pz-card-bar";
    bar.style.background = isPlaced ? piece.color+"66" : piece.color;
    card.appendChild(bar);

    if (isPlaced) {
      const check = document.createElement("div");
      check.className   = "pz-card-check";
      check.textContent = "✓";
      check.style.color = piece.color;
      card.appendChild(check);
    } else {
      // FLIP zone
      const flipZone = document.createElement("div");
      flipZone.className   = "pz-zone pz-zone-flip";
      flipZone.textContent = "⇅ FLIP";
      flipZone.addEventListener("click",      e => { e.stopPropagation(); doFlip(piece); });
      flipZone.addEventListener("touchstart", e => { e.stopPropagation(); e.preventDefault(); }, { passive: false });
      flipZone.addEventListener("touchend",   e => { e.stopPropagation(); e.preventDefault(); doFlip(piece); }, { passive: false });
      card.appendChild(flipZone);

      // Star shows only when piece is in correct hint orientation
      const hintShape    = _getHintShape(piece);
      const hintShapeKey = hintShape.map(([r,c])=>`${r},${c}`).join("|");
      const curShapeKey  = displayCells.map(([r,c])=>`${r},${c}`).join("|");
      const starVisible  = showStar && (hintShapeKey === curShapeKey);
      if (starVisible) {
        const star = document.createElement("div");
        star.style.cssText = "position:absolute;top:22px;right:3px;font-size:10px;font-weight:900;color:#fde68a;pointer-events:none;z-index:5;";
        star.textContent = "★";
        card.appendChild(star);
      }
      // Gold border only when star showing
      if (!isSelected && !isPeeking) {
        card.style.borderColor = starVisible ? "rgba(253,230,138,0.6)" : isHinted ? "rgba(253,230,138,0.2)" : "#1e1030";
      }

      // Mini piece
      const body = document.createElement("div");
      body.className = "pz-card-body";
      body.appendChild(renderMiniPiece(displayCells, piece.color));
      body.addEventListener("click",      e => { e.stopPropagation(); doSelect(piece); });
      body.addEventListener("touchstart", e => { onCardTouchStart(e, piece); }, { passive: false });
      body.addEventListener("touchend",   e => { e.stopPropagation(); e.preventDefault(); doSelect(piece); }, { passive: false });
      card.appendChild(body);

      // Peek on hold — show where piece goes on board
      if (isHinted) {
        // Mouse: hold to peek
        card.addEventListener("mousedown", e => {
          if (e.button !== 0) return;
          const timer = setTimeout(() => _startPeek(piece.name), 200);
          const stop  = () => { clearTimeout(timer); _endPeek(); document.removeEventListener("mouseup", stop); };
          document.addEventListener("mouseup", stop);
        });
        // Touch: hold to peek
        card.addEventListener("touchstart", e => {
          const timer = setTimeout(() => _startPeek(piece.name), 200);
          const stop  = () => { clearTimeout(timer); _endPeek(); };
          card.addEventListener("touchend",    stop, { once: true });
          card.addEventListener("touchcancel", stop, { once: true });
        }, { passive: true });
      }

      // ROTATE zone
      const rotZone = document.createElement("div");
      rotZone.className   = "pz-zone pz-zone-rot";
      rotZone.textContent = "↻ ROTATE";
      rotZone.addEventListener("click",      e => { e.stopPropagation(); doRotate(piece); });
      rotZone.addEventListener("touchstart", e => { e.stopPropagation(); e.preventDefault(); }, { passive: false });
      rotZone.addEventListener("touchend",   e => { e.stopPropagation(); e.preventDefault(); doRotate(piece); }, { passive: false });
      card.appendChild(rotZone);
    }

    // Name
    const nameEl = document.createElement("div");
    nameEl.className   = "pz-card-name";
    nameEl.textContent = piece.name;
    if (isSelected || isPeeking) nameEl.style.color = piece.color;
    else if (isPlaced)           nameEl.style.color = piece.color+"88";
    card.appendChild(nameEl);

    trayEl.appendChild(card);
  });
}

function renderMiniPiece(cells, color) {
  const SZ = 6, GAP = 1, STP = SZ + GAP;
  const maxR = Math.max(...cells.map(([r])=>r));
  const maxC = Math.max(...cells.map(([,c])=>c));
  const set  = new Set(cells.map(([r,c])=>`${r},${c}`));
  const wrap = document.createElement("div");
  wrap.style.cssText = `position:relative;width:${(maxC+1)*STP-GAP}px;height:${(maxR+1)*STP-GAP}px;`;
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const cell = document.createElement("div");
      cell.style.cssText = `position:absolute;top:${r*STP}px;left:${c*STP}px;width:${SZ}px;height:${SZ}px;border-radius:2px;background:${set.has(`${r},${c}`)?color:"transparent"};`;
      wrap.appendChild(cell);
    }
  }
  return wrap;
}

function renderWin() {
  const win = document.getElementById("punzle-win");
  if (!win) return;
  win.style.display = "flex";
  win.innerHTML = `
    <div class="pz-win-inner">
      <div style="font-size:52px;margin-bottom:12px;">🎉</div>
      <div class="pz-win-title">Solved!</div>
      <div class="pz-win-sub">Piece out. Well played. 🧩</div>
      <button class="pz-win-btn" onclick="resetPunzle()">Play Again</button>
    </div>
  `;
}
