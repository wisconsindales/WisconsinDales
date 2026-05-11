// punzle-game.js — Core board logic, pieces, and solver

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLORS = [
  "#ef4444","#f97316","#eab308","#22c55e",
  "#06b6d4","#3b82f6","#8b5cf6","#ec4899"
];

const PIECES = [
  { name:"W", color:COLORS[0], cells:[[0,0],[1,0],[2,0],[3,0],[4,0]] },
  { name:"I", color:COLORS[1], cells:[[0,0],[1,0],[2,0],[3,0],[0,1]] },
  { name:"S", color:COLORS[2], cells:[[0,0],[1,0],[2,0],[3,0],[1,1]] },
  { name:"C", color:COLORS[3], cells:[[0,0],[1,0],[2,0],[0,1],[1,1]] },
  { name:"O", color:COLORS[4], cells:[[0,0],[1,0],[2,0],[0,1],[2,1]] },
  { name:"P", color:COLORS[5], cells:[[0,0],[1,0],[2,0],[0,1],[0,2]] },
  { name:"U", color:COLORS[6], cells:[[0,0],[1,0],[2,0],[1,1],[1,2]] },
  { name:"N", color:COLORS[7], cells:[[0,0],[1,0],[2,0],[3,0],[4,0],[0,1]] }
];

const BOARD_CELLS = [];
const LABELS = new Map();
const MONTH_POSITIONS = new Map();
const DAY_POSITIONS = new Map();

function cellKey(r, c) { return `${r},${c}`; }

function buildBoard() {
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

function normalize(shape) {
  const minR = Math.min(...shape.map(([r]) => r));
  const minC = Math.min(...shape.map(([,c]) => c));
  return shape.map(([r,c]) => [r-minR, c-minC]).sort((a,b) => (a[0]-b[0])||(a[1]-b[1]));
}

function rotate(shape) { return shape.map(([r,c]) => [c,-r]); }
function flip(shape)   { return shape.map(([r,c]) => [r,-c]); }

function getVariants(cells, allowFlip=true) {
  const seen = new Set(); const out = [];
  const seeds = allowFlip ? [cells, flip(cells)] : [cells];
  for (const seed of seeds) {
    let cur = seed;
    for (let i = 0; i < 4; i++) {
      const norm = normalize(cur);
      const key = norm.map(([r,c])=>`${r}:${c}`).join("|");
      if (!seen.has(key)) { seen.add(key); out.push(norm); }
      cur = rotate(cur);
    }
  }
  return out;
}

function getBlockedCells(month, day) {
  const m = MONTH_POSITIONS.get(month);
  const d = DAY_POSITIONS.get(day);
  return new Set([cellKey(m[0],m[1]), cellKey(d[0],d[1])]);
}

function isValidCell(r, c) {
  return BOARD_CELLS.some(([br,bc]) => br===r && bc===c);
}

buildBoard();

function getPlacements(piece, allowFlip, blocked) {
  const valid = new Set(BOARD_CELLS.map(([r,c]) => cellKey(r,c)));
  const placements = [];
  const variants = getVariants(piece.cells, allowFlip);
  for (const variant of variants) {
    const maxR = Math.max(...variant.map(([r])=>r));
    const maxC = Math.max(...variant.map(([,c])=>c));
    for (let dr = 0; dr <= 6-maxR; dr++) {
      for (let dc = 0; dc <= 6-maxC; dc++) {
        const cells = variant.map(([r,c]) => [r+dr, c+dc]);
        const keys  = cells.map(([r,c]) => cellKey(r,c));
        if (!keys.every(k => valid.has(k) && !blocked.has(k))) continue;
        const uk = [...keys].sort().join("|");
        placements.push({ piece:piece.name, color:piece.color, cells, key:uk });
      }
    }
  }
  const dedup = new Map();
  placements.forEach(p => dedup.set(p.key, p));
  return [...dedup.values()];
}

function solve(month, day, allowFlip=true) {
  const blocked   = getBlockedCells(month, day);
  const remaining = new Set(BOARD_CELLS.map(([r,c])=>cellKey(r,c)).filter(k=>!blocked.has(k)));
  const cellToPlacements = new Map();
  for (const piece of PIECES) {
    for (const placement of getPlacements(piece, allowFlip, blocked)) {
      for (const [r,c] of placement.cells) {
        const k = cellKey(r,c);
        if (!cellToPlacements.has(k)) cellToPlacements.set(k,[]);
        cellToPlacements.get(k).push(placement);
      }
    }
  }
  const usedPieces = new Set();
  const filled     = new Set();
  const path       = [];
  const solutions  = [];

  function backtrack() {
    if (usedPieces.size === PIECES.length) {
      if (filled.size === remaining.size) solutions.push(path.map(p=>({...p,cells:p.cells.map(([r,c])=>[r,c])})));
      return;
    }
    let best = null;
    for (const cell of remaining) {
      if (filled.has(cell)) continue;
      const opts = (cellToPlacements.get(cell)||[]).filter(p=>{
        if (usedPieces.has(p.piece)) return false;
        return p.cells.every(([r,c])=>!filled.has(cellKey(r,c)));
      });
      if (!best || opts.length < best.length) { best = opts; if (!opts.length) break; }
    }
    if (!best || !best.length) return;
    for (const p of best) {
      usedPieces.add(p.piece); path.push(p);
      const added = p.cells.map(([r,c])=>{ const k=cellKey(r,c); filled.add(k); return k; });
      backtrack();
      added.forEach(k=>filled.delete(k)); path.pop(); usedPieces.delete(p.piece);
      if (solutions.length >= 100) return;
    }
  }
  backtrack();
  return solutions;
}
