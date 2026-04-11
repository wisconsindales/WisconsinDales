// puzzle-drag.js

const floatingEl = document.getElementById("floatingPiece");

let dragState = {
  active: false,
  piece: null
};

function createFloatingPiece(piece) {
  floatingEl.innerHTML = "";

  const shape = normalize(piece.cells);

  const rows = Math.max(...shape.map(([r]) => r)) + 1;
  const cols = Math.max(...shape.map(([, c]) => c)) + 1;

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${cols}, 24px)`;
  grid.style.gap = "2px";

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.style.width = "24px";
      cell.style.height = "24px";
      cell.style.borderRadius = "4px";

      const on = shape.some(([sr, sc]) => sr === r && sc === c);

      if (on) {
        cell.style.background = piece.color;
      }

      grid.appendChild(cell);
    }
  }

  floatingEl.appendChild(grid);
}
