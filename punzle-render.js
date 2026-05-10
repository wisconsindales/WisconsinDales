// punzle-render.js — Board and tray rendering

function renderPunzleBoard() {
  const boardEl = document.getElementById("punzle-board");
  if (!boardEl) return;
  boardEl.innerHTML = "";

  const today = new Date();
  const month = today.getMonth() + 1;
  const day   = today.getDate();
  const blk   = getBlockedCells(month, day);

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const el  = document.createElement("div");
      const key = cellKey(r, c);
      const valid = isValidCell(r, c);

      if (!valid) {
        el.className = "pz-cell pz-off";
        boardEl.appendChild(el);
        continue;
      }

      el.dataset.r = r;
      el.dataset.c = c;
      el.textContent = LABELS.get(key) || "";

      if (blk.has(key)) {
        el.className = "pz-cell pz-blocked";
      } else {
        const placed = placedPieces.find(p =>
          p.cells.some(([pr,pc]) => pr===r && pc===c)
        );
        if (placed) {
          el.className = "pz-cell pz-placed";
          el.style.background = placed.color;
          el.dataset.piece = placed.name;
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

    const card = document.createElement("div");
    card.className = `pz-card${isPlaced ? " pz-card-done" : ""}${isSelected ? " pz-card-sel" : ""}`;
    card.dataset.piece = piece.name;
    card.style.borderColor = isSelected ? "#22d3ee" : isPlaced ? piece.color + "66" : "#1e1030";

    // Color bar at top
    const bar = document.createElement("div");
    bar.className = "pz-card-bar";
    bar.style.background = isPlaced ? piece.color + "66" : piece.color;
    card.appendChild(bar);

    if (isPlaced) {
      const check = document.createElement("div");
      check.className = "pz-card-check";
      check.textContent = "✓";
      check.style.color = piece.color;
      card.appendChild(check);
    } else {
      // ── FLIP zone (top) — explicit button ──
      const flipZone = document.createElement("div");
      flipZone.className = "pz-zone pz-zone-top";
      flipZone.innerHTML = "<span>⇅ FLIP</span>";
      flipZone.addEventListener("click", e => onCardTap(e, piece, "flip"));
      flipZone.addEventListener("touchend", e => { e.preventDefault(); onCardTap(e, piece, "flip"); });
      card.appendChild(flipZone);

      // ── Mini piece shape (center) ──
      const body = document.createElement("div");
      body.className = "pz-card-body";
      const cells = isSelected ? selectedCells : normalize(piece.cells);
      const mini  = renderMiniPiece(cells, piece.color);
      body.appendChild(mini);
      body.addEventListener("click", e => onCardTap(e, piece, "center"));
      card.appendChild(body);

      // ── ROTATE zone (bottom) — explicit button ──
      const rotZone = document.createElement("div");
      rotZone.className = "pz-zone pz-zone-bot";
      rotZone.innerHTML = "<span>↻ ROTATE</span>";
      rotZone.addEventListener("click", e => onCardTap(e, piece, "rotate"));
      rotZone.addEventListener("touchend", e => { e.preventDefault(); onCardTap(e, piece, "rotate"); });
      card.appendChild(rotZone);

      // Touch drag from card body
      card.addEventListener("touchstart", e => onCardTouchStart(e, piece), { passive: true });

      // Mouse drag
      card.draggable = true;
      card.addEventListener("dragstart", e => onCardDragStart(e, piece));
    }

    // Piece name label
    const name = document.createElement("div");
    name.className = "pz-card-name";
    name.textContent = piece.name;
    if (isSelected) name.style.color = piece.color;
    else if (isPlaced) name.style.color = piece.color + "88";
    card.appendChild(name);

    trayEl.appendChild(card);
  });
}

function renderMiniPiece(cells, color) {
  const MINI = 7; const GAP = 1;
  const maxR = Math.max(...cells.map(([r])=>r));
  const maxC = Math.max(...cells.map(([,c])=>c));
  const set  = new Set(cells.map(([r,c])=>`${r},${c}`));
  const step = MINI + GAP;

  const wrap = document.createElement("div");
  wrap.style.cssText = `
    position:relative;
    width:${(maxC+1)*step}px;
    height:${(maxR+1)*step}px;
    margin:auto;
  `;

  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const cell = document.createElement("div");
      const on   = set.has(`${r},${c}`);
      cell.style.cssText = `
        position:absolute;
        top:${r*step}px;left:${c*step}px;
        width:${MINI}px;height:${MINI}px;
        border-radius:2px;
        background:${on ? color : "transparent"};
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
