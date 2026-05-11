// punzle-render.js — Board and tray rendering

function renderPunzleBoard() {
  const boardEl = document.getElementById("punzle-board");
  if (!boardEl) return;
  boardEl.innerHTML = "";

  const today = new Date();
  const blk   = getBlockedCells(today.getMonth() + 1, today.getDate());

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

      if (blk.has(key)) {
        el.className = "pz-cell pz-blocked";
      } else {
        const placed = placedPieces.find(p =>
          p.cells.some(([pr,pc]) => pr===r && pc===c)
        );
        if (placed) {
          el.className       = "pz-cell pz-placed";
          el.style.background = placed.color;
          el.dataset.piece   = placed.name;
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
    // Apply hint orientation if piece is hinted but not selected
    let displayCells = normalize(piece.cells);
    if (isHinted && !isSelected && _hintOrientations[piece.name]) {
      const ho = _hintOrientations[piece.name];
      let cells = piece.cells.map(([r,c])=>[r,c]);
      const turns = ho.rot / 90;
      for (let i = 0; i < turns; i++) cells = rotate(cells);
      if (ho.flip) cells = flip(cells);
      displayCells = normalize(cells);
    }
    // Star only shows if current orientation matches hint orientation
    const hintOrient = _hintOrientations && _hintOrientations[piece.name];
    const isCorrectOrient = isHinted && hintOrient && (
      isSelected
        ? (currentRot === hintOrient.rot && currentFlip === hintOrient.flip)
        : true // not selected — always showing hint orientation
    );

    // ── Card wrapper ──────────────────────────────────────────────────────────
    const card = document.createElement("div");
    card.className   = `pz-card${isPlaced ? " pz-card-done" : ""}${isSelected ? " pz-card-sel" : ""}`;
    card.dataset.piece = piece.name;
    card.style.borderColor = isSelected ? "#22d3ee" : isCorrectOrient ? "rgba(253,230,138,0.6)" : isPlaced ? piece.color + "66" : "#1e1030";

    if (!isPlaced) {
      card.draggable = true;
      card.addEventListener("mousedown", e => onCardMouseDown(e, piece));
    }

    // ── Color bar ─────────────────────────────────────────────────────────────
    const bar = document.createElement("div");
    bar.className       = "pz-card-bar";
    bar.style.background = isPlaced ? piece.color + "66" : piece.color;
    card.appendChild(bar);

    if (isPlaced) {
      // ── Checkmark ──────────────────────────────────────────────────────────
      const check = document.createElement("div");
      check.className   = "pz-card-check";
      check.textContent = "✓";
      check.style.color = piece.color;
      card.appendChild(check);
    } else {
      // ── FLIP zone ──────────────────────────────────────────────────────────
      const flipZone = document.createElement("div");
      flipZone.className   = "pz-zone pz-zone-flip";
      flipZone.textContent = "⇅ FLIP";
      flipZone.addEventListener("click", e => { e.stopPropagation(); doFlip(piece); });
      flipZone.addEventListener("touchstart", e => { e.stopPropagation(); e.preventDefault(); }, { passive: false });
      flipZone.addEventListener("touchend",   e => { e.stopPropagation(); e.preventDefault(); doFlip(piece); }, { passive: false });
      card.appendChild(flipZone);

      // ── Hint star ──────────────────────────────────────────────────────────
      if (isCorrectOrient) {
        const star = document.createElement("div");
        star.style.cssText = "position:absolute;top:22px;right:3px;font-size:9px;font-weight:900;color:#fde68a;z-index:10;pointer-events:none;";
        star.textContent = "★";
        card.appendChild(star);
      }

      // ── Mini piece (center) ───────────────────────────────────────────────
      const body = document.createElement("div");
      body.className = "pz-card-body";

      const cells = isSelected ? selectedCells : displayCells;
      body.appendChild(renderMiniPiece(cells, piece.color));
      body.addEventListener("click",      e => { e.stopPropagation(); doSelect(piece); });
      body.addEventListener("touchstart", e => { onCardTouchStart(e, piece); }, { passive: false });
      body.addEventListener("touchend",   e => { e.stopPropagation(); e.preventDefault(); doSelect(piece); }, { passive: false });
      card.appendChild(body);

      // ── ROTATE zone ───────────────────────────────────────────────────────
      const rotZone = document.createElement("div");
      rotZone.className   = "pz-zone pz-zone-rot";
      rotZone.textContent = "↻ ROTATE";
      rotZone.addEventListener("click",      e => { e.stopPropagation(); doRotate(piece); });
      rotZone.addEventListener("touchstart", e => { e.stopPropagation(); e.preventDefault(); }, { passive: false });
      rotZone.addEventListener("touchend",   e => { e.stopPropagation(); e.preventDefault(); doRotate(piece); }, { passive: false });
      card.appendChild(rotZone);
    }

    // ── Piece name ────────────────────────────────────────────────────────────
    const nameEl = document.createElement("div");
    nameEl.className   = "pz-card-name";
    nameEl.textContent = piece.name;
    if (isSelected)    nameEl.style.color = piece.color;
    else if (isPlaced) nameEl.style.color = piece.color + "88";
    card.appendChild(nameEl);

    trayEl.appendChild(card);
  });
}

function renderMiniPiece(cells, color) {
  const SZ  = 6;
  const GAP = 1;
  const STP = SZ + GAP;
  const maxR = Math.max(...cells.map(([r]) => r));
  const maxC = Math.max(...cells.map(([,c]) => c));
  const set  = new Set(cells.map(([r,c]) => `${r},${c}`));

  const wrap = document.createElement("div");
  wrap.style.cssText = `position:relative;width:${(maxC+1)*STP-GAP}px;height:${(maxR+1)*STP-GAP}px;`;

  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const cell = document.createElement("div");
      cell.style.cssText = `
        position:absolute;top:${r*STP}px;left:${c*STP}px;
        width:${SZ}px;height:${SZ}px;border-radius:2px;
        background:${set.has(`${r},${c}`) ? color : "transparent"};
      `;
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
