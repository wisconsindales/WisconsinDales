const SPLASH_SOUND = "splash.wav";
let splashAudio = new Audio(SPLASH_SOUND);
splashAudio.loop = true;
splashAudio.volume = 0.4;
splashAudio.preload = "auto";

const boardEl = document.getElementById("board");
const monthSelect = document.getElementById("monthSelect");
const daySelect = document.getElementById("daySelect");
const dateInput = document.getElementById("dateInput");
const solutionCountBox = document.getElementById("solutionCountBox");
const statusBox = document.getElementById("statusBox");
const legendEl = document.getElementById("legend");
const piecesPreviewEl = document.getElementById("piecesPreview");
const hintBtn = document.getElementById("hintBtn");
const solveBtn = document.getElementById("solveBtn");
const confusedBtn = document.getElementById("confusedBtn");
const hintSection = document.getElementById("hintSection");
const todaySolutionCountEl = document.getElementById("todaySolutionCount");

let currentSolutions = [];
let currentIndex = 0;
let revealedHintPieces = new Set();
let heldHintPieceName = null;
let hintUseCount = 0;
let confusedResetTimer = null;

const CONFUSED_LINES = {
  idle: [
    "Are you confused?",
    "You can't be lost already.",
    "Confidence is doing a lot of heavy lifting here.",
    "Does That board have you in a headlock.",
    "Take your time & postpone the failure.",
    "You're not lost. You're exploring badly.",
    "Keep poking it. Something useful might happen.",
    "You're warming up. Try not to ruin it.",
    "Progress?  As long as you think so!",
    "Suspiciously decent effort so far."
  ],

  click: [
    "Yes. Obviously. The hint button is right there.",
    "Need adult supervision? Scroll down.",
    "Another hint GEANYUS?",
    "You got that hint button over worked",
    "Press it again, call it a strategy.",
    "You seem overwhelmed. Adorable.",
    "The hint button is waiting for your dramatic entrance.",
    "Go ahead. Ask for help like the rest of us.",
    "You clicked this instead of solving it. Bold.",
    "Scroll down, puzzle warrior. Salvation is lower."
  ],

  firstHint: [
    "Fine. One pity hint.",
    "There. A tiny crumb of competence.",
    "One starred piece. Try not to waste it.",
    "I helped once. Let's not make this a lifestyle.",
    "Enjoy your starter hint, puzzle goblin.",
    "Okay, now do something useful with it.",
    "There. I helped. Try not to waste my generosity.",
    "Now you have a fighting chance. Tiny, but real.",
    "One clue. No excuses.",
    "Use the starred piece like you've seen a puzzle before."
  ],

  moreHints: [
    "Another hint? Stunning.",
    "At this point I'm basically playing too.",
    "You're not solving it. You're collecting charity.",
    "This puzzle is in a toxic relationship with your hint button.",
    "Keep pressing it. Dignity was never the plan.",
    "You may not be hopeless after all.",
    "Keep going. The puzzle is starting to fear you a little.",
    "Somehow, against the odds, that worked.",
    "You're stumbling in the correct direction.",
    "Fine. That was a decent move."
  ],

  encouragement: [
    "You're actually closer than your face suggests.",
    "Look at you, accidentally making progress.",
    "That was almost competent. Keep going.",
    "That looked smarter than usual.",
    "One more good move and I'll act impressed.",
    "I hate to admit it, but that helped.",
    "You're doing better than your strategy deserves.",
    "I expected worse. Congratulations.",
    "That was almost elegant. Don't get cocky.",
    "Even chaos can be effective, apparently."
  ],

  meanEncouragement: [
    "You're still a mess, but now a productive one.",
    "Keep flailing. You're hitting useful things now.",
    "That move had actual brain cells in it.",
    "You're improving, which is honestly annoying.",
    "Gross. That was kind of smart.",
    "Fine. You've earned one tiny shred of respect.",
    "Keep going, puzzle goblin. You're less embarrassing now.",
    "That wasn't luck. Probably.",
    "You've upgraded from confused to dangerous.",
    "The board still hates you, but slightly less."
  ],

  close: [
    "You're one good move away from pretending this was skill.",
    "You're close enough to start acting smug.",
    "Don't panic now. This is the smart part.",
    "You're hovering near competence. Stay there.",
    "One more move and you can lie about solving it cleanly.",
    "The answer is practically tripping over you now.",
    "You're so close it's irritating.",
    "Keep it together. This almost looks intentional.",
    "You can absolutely finish this, assuming you don't get weird.",
    "The board is wobbling. Push."
  ],

  allHints: [
    "That's all of them. Figure it out, hero.",
    "No more mystery. Only your decisions remain.",
    "Every piece is starred now. The rest is on your shaky shoulders.",
    "You have all the crumbs. Bake your own answer.",
    "I've done enough. Embarrass yourself without assistance.",
    "The training wheels are off now.",
    "You have all the help you're getting. Terrifying, I know.",
    "Everything useful has been handed to you already.",
    "No more hints. Time to find out what you're made of."
  ],

  piecePeek: [
    "There. That's where it goes. Try pretending you knew that.",
    "Look closely. I will not draw you a map.",
    "That starred piece finally found a purpose.",
    "Memorize it before you let go and panic again.",
    "See? Even the piece has better instincts than you.",
    "There you go. A brief visit from competence.",
    "Study it quickly before the mystery comes back.",
    "That piece seems smarter than the person holding it.",
    "You get a peek, not a full rescue.",
    "Try remembering that location with your best remaining brain cell."
  ],

  solutionHold: [
    "Hold to peek. Release to resume the lie.",
    "Ah yes, learning through aggressive peeking.",
    "Cheating, but make it interactive.",
    "Borrow the answer all you want. It still isn't your idea.",
    "Look fast. Competence expires on release.",
    "There it is. The whole thing. Try not to act innocent.",
    "Enjoy your temporary honesty.",
    "You're not solving it, but you are observing it intensely.",
    "A bold educational strategy: staring.",
    "This is less 'solving' and more 'borrowing confidence.'"
  ],

  noSolution: [
    "Even the solver gave up on that one.",
    "No layout found. Congratulations, you found chaos.",
    "That date is fighting back harder than you are.",
    "Nothing works there. Impressive choice.",
    "Not solvable. Finally, something that's not your fault.",
    "For once, the puzzle is the problem.",
    "You broke nothing. That one just stinks.",
    "The board said no, and honestly it seemed personal.",
    "No solution there. A rare excuse for your confusion.",
    "Even I can't roast you for this one."
  ]
};

const BOARD_CELLS = [];
const LABELS = new Map();
const MONTH_POSITIONS = new Map();
const DAY_POSITIONS = new Map();

function cellKey(r, c) {
  return `${r},${c}`;
}

function buildBoardDefinition() {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const valid = (r < 2 && c < 6) || (r >= 2 && r <= 5) || (r === 6 && c < 3);
      if (!valid) continue;
      BOARD_CELLS.push([r, c]);
    }
  }

  for (let i = 0; i < 6; i++) {
    LABELS.set(cellKey(0, i), MONTHS[i]);
    MONTH_POSITIONS.set(i + 1, [0, i]);
  }
  for (let i = 0; i < 6; i++) {
    LABELS.set(cellKey(1, i), MONTHS[i + 6]);
    MONTH_POSITIONS.set(i + 7, [1, i]);
  }

  let day = 1;
  for (let r = 2; r <= 5; r++) {
    for (let c = 0; c < 7; c++) {
      LABELS.set(cellKey(r, c), String(day));
      DAY_POSITIONS.set(day, [r, c]);
      day++;
    }
  }
  for (let c = 0; c < 3; c++) {
    LABELS.set(cellKey(6, c), String(day));
    DAY_POSITIONS.set(day, [6, c]);
    day++;
  }
}

function populateControls() {
  MONTHS.forEach((month, i) => {
    const opt = document.createElement("option");
    opt.value = String(i + 1);
    opt.textContent = month;
    monthSelect.appendChild(opt);
  });

  for (let day = 1; day <= 31; day++) {
    const opt = document.createElement("option");
    opt.value = String(day);
    opt.textContent = String(day);
    daySelect.appendChild(opt);
  }
}

function setToday() {
  const now = new Date();
  monthSelect.value = String(now.getMonth() + 1);
  daySelect.value = String(now.getDate());
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  dateInput.value = `${yyyy}-${mm}-${dd}`;
  renderBoard();
}

function syncFromDateInput() {
  if (!dateInput.value) return;
  const dt = new Date(dateInput.value + "T12:00:00");
  if (Number.isNaN(dt.getTime())) return;
  monthSelect.value = String(dt.getMonth() + 1);
  daySelect.value = String(dt.getDate());
  renderBoard();
}

function syncDateInputFromSelectors() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(Number(monthSelect.value)).padStart(2, "0");
  const dd = String(Number(daySelect.value)).padStart(2, "0");
  dateInput.value = `${yyyy}-${mm}-${dd}`;
}

function normalize(shape) {
  const minR = Math.min(...shape.map(([r]) => r));
  const minC = Math.min(...shape.map(([, c]) => c));
  return shape
    .map(([r, c]) => [r - minR, c - minC])
    .sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
}

function shapeKey(shape) {
  return shape.map(([r, c]) => `${r}:${c}`).join("|");
}

function rotate(shape) {
  return shape.map(([r, c]) => [c, -r]);
}

function flip(shape) {
  return shape.map(([r, c]) => [r, -c]);
}

function getVariants(cells, allowFlip) {
  const seen = new Set();
  const out = [];
  const seeds = allowFlip ? [cells, flip(cells)] : [cells];

  for (const seed of seeds) {
    let cur = seed;
    for (let i = 0; i < 4; i++) {
      const norm = normalize(cur);
      const key = shapeKey(norm);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(norm);
      }
      cur = rotate(cur);
    }
  }

  return out;
}

function getBlockedCells(month, day) {
  const m = MONTH_POSITIONS.get(month);
  const d = DAY_POSITIONS.get(day);
  return new Set([cellKey(m[0], m[1]), cellKey(d[0], d[1])]);
}

function getPlacements(piece, allowFlip, blocked) {
  const valid = new Set(BOARD_CELLS.map(([r, c]) => cellKey(r, c)));
  const placements = [];
  const variants = getVariants(piece.cells, allowFlip);

  for (const variant of variants) {
    const maxR = Math.max(...variant.map(([r]) => r));
    const maxC = Math.max(...variant.map(([, c]) => c));

    for (let dr = 0; dr <= 6 - maxR; dr++) {
      for (let dc = 0; dc <= 6 - maxC; dc++) {
        const cells = variant.map(([r, c]) => [r + dr, c + dc]);
        const keys = cells.map(([r, c]) => cellKey(r, c));
        const ok = keys.every((k) => valid.has(k) && !blocked.has(k));
        if (!ok) continue;
        const uniqueKey = [...keys].sort().join("|");
        placements.push({ piece: piece.name, color: piece.color, cells, key: uniqueKey });
      }
    }
  }

  const dedup = new Map();
  placements.forEach((p) => dedup.set(p.key, p));
  return [...dedup.values()];
}

function solve(month, day, allowFlip) {
  const blocked = getBlockedCells(month, day);
  const remaining = new Set(
    BOARD_CELLS.map(([r, c]) => cellKey(r, c)).filter((k) => !blocked.has(k))
  );
  const placementsByPiece = new Map();
  const cellToPlacements = new Map();

  for (const piece of PIECES) {
    const placements = getPlacements(piece, allowFlip, blocked);
    placementsByPiece.set(piece.name, placements);
    for (const placement of placements) {
      for (const [r, c] of placement.cells) {
        const k = cellKey(r, c);
        if (!cellToPlacements.has(k)) cellToPlacements.set(k, []);
        cellToPlacements.get(k).push(placement);
      }
    }
  }

  const usedPieces = new Set();
  const filled = new Set();
  const path = [];
  const solutions = [];

  function backtrack() {
    if (usedPieces.size === PIECES.length) {
      if (filled.size === remaining.size) {
        solutions.push(
          path.map((p) => ({ ...p, cells: p.cells.map(([r, c]) => [r, c]) }))
        );
      }
      return;
    }

    let bestOptions = null;

    for (const cell of remaining) {
      if (filled.has(cell)) continue;
      const options = (cellToPlacements.get(cell) || []).filter((placement) => {
        if (usedPieces.has(placement.piece)) return false;
        for (const [r, c] of placement.cells) {
          if (filled.has(cellKey(r, c))) return false;
        }
        return true;
      });

      if (!bestOptions || options.length < bestOptions.length) {
        bestOptions = options;
        if (options.length === 0) break;
      }
    }

    if (!bestOptions || bestOptions.length === 0) return;

    for (const placement of bestOptions) {
      usedPieces.add(placement.piece);
      path.push(placement);

      const added = [];
      for (const [r, c] of placement.cells) {
        const k = cellKey(r, c);
        filled.add(k);
        added.push(k);
      }

      backtrack();

      added.forEach((k) => filled.delete(k));
      path.pop();
      usedPieces.delete(placement.piece);

      if (solutions.length >= 100) return;
    }
  }

  backtrack();
  return solutions;
}

function renderBoard(solution = null, previewPieceName = null) {
  boardEl.innerHTML = "";
  legendEl.innerHTML = "";

  const month = Number(monthSelect.value || 1);
  const day = Number(daySelect.value || 1);
  const blocked = getBlockedCells(month, day);
  const solutionMap = new Map();
  const previewMap = new Map();

  if (solution) {
    solution.forEach((placement) => {
      placement.cells.forEach(([r, c]) => {
        solutionMap.set(cellKey(r, c), placement);
      });
    });
  }

  if (previewPieceName && currentSolutions.length) {
    const previewPlacement = currentSolutions[currentIndex].find(
      (p) => p.piece === previewPieceName
    );
    if (previewPlacement) {
      previewPlacement.cells.forEach(([r, c]) => {
        previewMap.set(cellKey(r, c), previewPlacement);
      });
    }
  }

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const el = document.createElement("div");
      const key = cellKey(r, c);
      const valid = BOARD_CELLS.some(([br, bc]) => br === r && bc === c);

      if (!valid) {
        el.className = "cell off";
        boardEl.appendChild(el);
        continue;
      }

      el.classList.add("cell");
      el.textContent = LABELS.get(key) || "";

      if (blocked.has(key)) {
        el.classList.add("open-date");
      } else if (solutionMap.has(key)) {
        const p = solutionMap.get(key);
        el.classList.add("covered");
        el.style.background = p.color;
      } else if (previewMap.has(key)) {
        const p = previewMap.get(key);
        el.classList.add("covered");
        el.style.background = p.color;
      } else {
        el.classList.add("empty");
      }

      boardEl.appendChild(el);
    }
  }

  if (solution) {
    PIECES.forEach((piece) => {
      const chip = document.createElement("div");
      chip.className = "chip";
      chip.innerHTML = `<span class="dot" style="background:${piece.color}"></span>${piece.name}`;
      legendEl.appendChild(chip);
    });
  }

  syncDateInputFromSelectors();
  updateUrl();
}

function getCurrentHintShape(piece) {
  if (!currentSolutions.length || !revealedHintPieces.has(piece.name)) {
    return normalize(piece.cells);
  }
  const placement = currentSolutions[currentIndex].find((p) => p.piece === piece.name);
  return placement ? normalize(placement.cells) : normalize(piece.cells);
}

function renderPiecesPreview() {
  piecesPreviewEl.innerHTML = "";

  PIECES.forEach((piece) => {
    const isHinted = revealedHintPieces.has(piece.name);
    const isPreviewActive = heldHintPieceName === piece.name;
    const card = document.createElement("div");
    card.className = `piece-card${isHinted ? " hinted-piece" : ""}${isPreviewActive ? " preview-active" : ""}`;
    card.dataset.piece = piece.name;

    const title = document.createElement("div");
    title.className = "piece-title";

    const hintMark = isHinted
      ? `<span class="hint-mark" title="Hint shown">*</span>`
      : "";

    title.innerHTML = `<span class="dot" style="background:${piece.color}"></span>${piece.name}${hintMark}`;

    const shape = getCurrentHintShape(piece);
    const rows = Math.max(...shape.map(([r]) => r)) + 1;
    const cols = Math.max(...shape.map(([, c]) => c)) + 1;
    const grid = document.createElement("div");
    grid.className = "mini-grid";
    grid.style.gridTemplateColumns = `repeat(${Math.max(cols, 4)}, 18px)`;

    for (let r = 0; r < Math.max(rows, 4); r++) {
      for (let c = 0; c < Math.max(cols, 4); c++) {
        const mc = document.createElement("div");
        mc.className = "mini-cell";
        const on = shape.some(([sr, sc]) => sr === r && sc === c);
        if (on) {
          mc.classList.add("on");
          mc.style.background = piece.color;
        }
        grid.appendChild(mc);
      }
    }

    if (isHinted) {
      const startPreview = (event) => handleHintPieceHoldStart(event, piece.name);
      card.addEventListener("pointerdown", startPreview);
      card.addEventListener("pointerup", hideHeldHintPiece);
      card.addEventListener("pointercancel", hideHeldHintPiece);
    }

    card.appendChild(title);
    card.appendChild(grid);
    piecesPreviewEl.appendChild(card);
  });
}

function setStatus(html) {
  if (!statusBox) return;
  statusBox.innerHTML = html;
}

let confusedLineCounter = 0;

function pickConfusedLine(pool) {
  if (!pool || !pool.length) return "Are you confused?";
  const line = pool[confusedLineCounter % pool.length];
  confusedLineCounter += 1;
  return line;
}

function setConfusedText(poolOrText, holdMs = 8000) {
  if (!confusedBtn) return;

  if (confusedResetTimer) {
    clearTimeout(confusedResetTimer);
    confusedResetTimer = null;
  }

  confusedBtn.textContent = Array.isArray(poolOrText)
    ? pickConfusedLine(poolOrText)
    : poolOrText;

  confusedBtn.classList.remove("hint-pulse");
  void confusedBtn.offsetWidth;
  confusedBtn.classList.add("hint-pulse");

  if (holdMs > 0) {
    confusedResetTimer = setTimeout(() => {
      confusedBtn.classList.remove("hint-pulse");
      confusedBtn.textContent = pickConfusedLine(CONFUSED_LINES.idle);
      confusedResetTimer = null;
    }, holdMs);
  }
}

function resetConfusedText() {
  if (!confusedBtn) return;

  if (confusedResetTimer) {
    clearTimeout(confusedResetTimer);
    confusedResetTimer = null;
  }

  confusedBtn.classList.remove("hint-pulse");
  confusedBtn.textContent = pickConfusedLine(CONFUSED_LINES.idle);
}

function playSplashOnce() {
  const audio = new Audio(SPLASH_SOUND);
  audio.volume = 0.4;
  audio.play().catch(() => {});
}

function showHeldHintPiece(pieceName) {
  if (!revealedHintPieces.has(pieceName)) return;

  if (!ensureSolutionsReady()) {
    setStatus("<strong>No layout found.</strong> Try a different date or adjust the pieces.");
    setConfusedText(CONFUSED_LINES.noSolution, 16000);
    return;
  }

  heldHintPieceName = pieceName;
  hideHeldSolution();
  renderBoard(null, pieceName);
  renderPiecesPreview();

  const month = MONTHS[Number(monthSelect.value) - 1];
  const day = Number(daySelect.value);

  setStatus(
    `<strong>Peek mode on.</strong> Holding piece <strong>${pieceName}</strong> shows where it goes for ${month} ${day}. Let go and it disappears.`
  );

  setConfusedText(
    [
      ...CONFUSED_LINES.piecePeek,
      `${pieceName} goes there. Try to look surprised.`,
      `That little starred menace is ${pieceName}. Memorize it.`,
      `Yep, ${pieceName} belongs there. The puzzle had standards.`
    ],
    2800
  );
}

function hideHeldHintPiece() {
  if (!heldHintPieceName) return;
  heldHintPieceName = null;
  renderBoard();
  renderPiecesPreview();
  setStatus("");
}

function handleHintPieceHoldStart(event, pieceName) {
  if (event) event.preventDefault();
  showHeldHintPiece(pieceName);
}

function refreshSolutionsForCurrentDate() {
  const month = Number(monthSelect.value || 1);
  const day = Number(daySelect.value || 1);
  currentSolutions = solve(month, day, true);
  currentIndex = 0;

  solutionCountBox.innerHTML =
    `<strong>Possible layouts for this day:</strong> ${currentSolutions.length}`;

  if (todaySolutionCountEl) {
    todaySolutionCountEl.textContent =
      `The Number of Solutions for Today is ${currentSolutions.length}`;
  }

  return currentSolutions;
}

function clearHints(resetMessage = false) {
  heldHintPieceName = null;
  revealedHintPieces = new Set();
  hintUseCount = 0;
  renderPiecesPreview();

  if (resetMessage) {
    resetConfusedText();
  }
}

function showHint() {
  const monthNum = Number(monthSelect.value);
  const dayNum = Number(daySelect.value);
  const allowFlip = true;

  if (!currentSolutions.length) {
    setStatus("<strong>Finding a hidden hint…</strong> Solving in the background without showing the full solution.");
    const started = performance.now();
    currentSolutions = solve(monthNum, dayNum, allowFlip);
    currentIndex = 0;
    const ms = Math.round(performance.now() - started);

    if (!currentSolutions.length) {
      renderBoard();
      renderPiecesPreview();
      setStatus(`<strong>No solution found.</strong> Background hint search completed in ${ms} ms.`);
      setConfusedText(CONFUSED_LINES.noSolution, 16000);
      return;
    }

    renderBoard();
  }

  const remainingPieces = PIECES
    .map((piece) => piece.name)
    .filter((name) => !revealedHintPieces.has(name));

  if (!remainingPieces.length) {
    setStatus("<strong>All hint orientations are already shown.</strong> Each starred piece below the calendar is rotated to the correct solution orientation.");
    setConfusedText(CONFUSED_LINES.allHints, 16000);
    return;
  }

  const nextPiece = remainingPieces[Math.floor(Math.random() * remainingPieces.length)];
  revealedHintPieces.add(nextPiece);
  hintUseCount += 1;
  renderPiecesPreview();

  const month = MONTHS[monthNum - 1];
  const day = dayNum;

  setStatus(
    `<strong>Hint shown.</strong> Piece <strong>${nextPiece}</strong> below the calendar was rotated to its correct orientation and marked with <strong>*</strong> for ${month} ${day}. The full board solution is still hidden.`
  );

  const linePool = hintUseCount === 1
    ? [
        ...CONFUSED_LINES.firstHint,
        `Piece ${nextPiece} is starred now. Please act like this helped.`,
        `I rotated ${nextPiece} for you. You're welcome, I guess.`,
        `${nextPiece} is the hint. Try not to fumble the charity.`
      ]
    : [
        ...CONFUSED_LINES.moreHints,
        `Another one? Fine. ${nextPiece} is starred now.`,
        `${nextPiece} is yours now. Try not to disappoint it.`,
        `I handed you ${nextPiece}. What more do you want, a parade?`
      ];

  setConfusedText(linePool, 16000);
}

function showCurrentSolution() {
  if (!currentSolutions.length) {
    renderBoard();
    renderPiecesPreview();
    setStatus("<strong>No layout found.</strong> Try a different date or adjust the piece definitions.");
    return;
  }

  const month = MONTHS[Number(monthSelect.value) - 1];
  const day = Number(daySelect.value);
  renderBoard(currentSolutions[currentIndex]);
  renderPiecesPreview();
  setStatus(
    `<strong>Showing splash layout ${currentIndex + 1} of ${currentSolutions.length}.</strong> ${month} ${day}`
  );
}

function runSolve() {
  const month = Number(monthSelect.value);
  const day = Number(daySelect.value);
  const allowFlip = true;

  setStatus("<strong>Making a splash…</strong> Searching valid placements in your browser.");
  renderBoard();

  requestAnimationFrame(() => {
    const started = performance.now();
    currentSolutions = solve(month, day, allowFlip);
    currentIndex = 0;
    heldHintPieceName = null;
    revealedHintPieces = new Set();
    hintUseCount = 0;

    const ms = Math.round(performance.now() - started);

    if (currentSolutions.length) {
      showCurrentSolution();
      setStatus(
        `<strong>Found ${currentSolutions.length} splash layout${currentSolutions.length === 1 ? "" : "s"}.</strong> Search completed in ${ms} ms.`
      );
    } else {
      renderBoard();
      setStatus(
        `<strong>No layout found.</strong> Search completed in ${ms} ms. If your physical puzzle uses slightly different pieces, edit the <code>PIECES</code> array in the script.`
      );
    }

    resetConfusedText();
  });
}

function updateUrl() {
  const month = String(monthSelect.value).padStart(2, "0");
  const day = String(daySelect.value).padStart(2, "0");
  const params = new URLSearchParams();
  params.set("date", `${month}-${day}`);
  history.replaceState({}, "", `${location.pathname}?${params.toString()}`);
}

let holdActive = false;
let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSplashSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.22;

  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc1.type = "triangle";
  osc2.type = "sine";
  osc1.frequency.setValueAtTime(720, now);
  osc1.frequency.exponentialRampToValueAtTime(240, now + duration);
  osc2.frequency.setValueAtTime(380, now);
  osc2.frequency.exponentialRampToValueAtTime(120, now + duration);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1400, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}

function ensureSolutionsReady() {
  if (currentSolutions.length) return true;
  refreshSolutionsForCurrentDate();
  return currentSolutions.length > 0;
}

function showHeldSolution() {
  heldHintPieceName = null;
  holdActive = true;
  solveBtn.classList.add("hold-active");
  renderBoard();
  renderPiecesPreview();

  setConfusedText(CONFUSED_LINES.solutionHold, 16000);

  setStatus(`
    <strong>Hint survival guide.</strong><br>
    • Smash <strong>Splash me a hint</strong> to reveal one rotated piece.<br>
    • Any piece with a <strong>*</strong> is now unlocked for your struggling fingertips.<br>
    • Press and hold that starred piece to see exactly where it goes on the board.<br>
    • Let go and it vanishes again, because commitment is hard.<br><br>
    Keep poking the puzzle. It's adorable that you think you're close.
  `);
}

function hideHeldSolution() {
  if (!holdActive) return;
  holdActive = false;
  solveBtn.classList.remove("hold-active");
  renderBoard();
  renderPiecesPreview();
  setStatus("");
}

function handleSolveHoldStart(event) {
  if (event) event.preventDefault();
  playSplashSound();
  showHeldSolution();
}

function handleSolveHoldEnd(event) {
  if (event) event.preventDefault();
  hideHeldSolution();
}

function readUrlState() {
  const params = new URLSearchParams(location.search);
  const date = params.get("date");

  if (date && /^\d{2}-\d{2}$/.test(date)) {
    const [m, d] = date.split("-").map(Number);
    if (m >= 1 && m <= 12) monthSelect.value = String(m);
    if (d >= 1 && d <= 31) daySelect.value = String(d);
  } else {
    const now = new Date();
    monthSelect.value = String(now.getMonth() + 1);
    daySelect.value = String(now.getDate());
  }

  syncDateInputFromSelectors();
}

hintBtn.addEventListener("mousedown", playSplashOnce);
hintBtn.addEventListener("touchstart", playSplashOnce, { passive: true });
hintBtn.addEventListener("click", showHint);

document.getElementById("todayBtn").addEventListener("click", () => {
  setToday();
  clearHints(false);
  refreshSolutionsForCurrentDate();
  updateUrl();
});

document.getElementById("prevBtn").addEventListener("click", () => {
  const audio = new Audio("https://actions.google.com/sounds/v1/cartoon/pop.ogg");
  audio.volume = 0.4;
  audio.play().catch(() => {});

  if (!currentSolutions.length) return;

  currentIndex = (currentIndex - 1 + currentSolutions.length) % currentSolutions.length;
  clearHints(false);
  renderBoard();
});

document.getElementById("nextBtn").addEventListener("click", () => {
  const audio = new Audio("https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg");
  audio.volume = 0.4;
  audio.play().catch(() => {});

  if (!currentSolutions.length) return;

  currentIndex = (currentIndex + 1) % currentSolutions.length;
  clearHints(false);
  renderBoard();
});

dateInput.addEventListener("change", () => {
  clearHints(false);
  syncFromDateInput();
  refreshSolutionsForCurrentDate();
  updateUrl();
});

monthSelect.addEventListener("change", () => {
  clearHints(false);
  syncDateInputFromSelectors();
  renderBoard();
  refreshSolutionsForCurrentDate();
  updateUrl();
});

daySelect.addEventListener("change", () => {
  clearHints(false);
  syncDateInputFromSelectors();
  renderBoard();
  refreshSolutionsForCurrentDate();
  updateUrl();
});

solveBtn.addEventListener("click", (e) => {
  e.preventDefault();
  hintSection.scrollIntoView({ behavior: "smooth", block: "start" });
  hintBtn.classList.remove("hint-pulse");
  void hintBtn.offsetWidth;
  hintBtn.classList.add("hint-pulse");
});

document.addEventListener("mouseup", () => {
  hideHeldHintPiece();
});

document.addEventListener("touchend", () => {
  hideHeldHintPiece();
});

document.addEventListener("touchcancel", () => {
  hideHeldHintPiece();
});

confusedBtn.addEventListener("click", () => {
  hintSection.scrollIntoView({ behavior: "smooth", block: "center" });
  hintBtn.classList.remove("hint-pulse");
  void hintBtn.offsetWidth;
  hintBtn.classList.add("hint-pulse");
});

buildBoardDefinition();
populateControls();
readUrlState();
renderPiecesPreview();
renderBoard();
resetConfusedText();
refreshSolutionsForCurrentDate();
updateUrl();
