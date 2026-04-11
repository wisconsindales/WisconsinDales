 const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const COLORS = [
      "#ef4444", "#f97316", "#eab308", "#22c55e",
      "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"
    ];

    // Classic 7x7 calendar board shape: 12 month cells + 31 day cells = 43 cells.
    // Two cells remain open (selected month + selected day), so pieces must cover 41 cells total.
    const PIECES = [
      { name: "W", color: COLORS[0], cells: [[0,0],[1,0],[2,0],[3,0],[4,0]] },
      { name: "I", color: COLORS[1], cells: [[0,0],[1,0],[2,0],[3,0],[0,1]] },
      { name: "S", color: COLORS[2], cells: [[0,0],[1,0],[2,0],[3,0],[1,1]] },
      { name: "C", color: COLORS[3], cells: [[0,0],[1,0],[2,0],[0,1],[1,1]] },
      { name: "O", color: COLORS[4], cells: [[0,0],[1,0],[2,0],[0,1],[2,1]] },
      { name: "P", color: COLORS[5], cells: [[0,0],[1,0],[2,0],[0,1],[0,2]] },
      { name: "U", color: COLORS[6], cells: [[0,0],[1,0],[2,0],[1,1],[1,2]] },
      { name: "N", color: COLORS[7], cells: [[0,0],[1,0],[2,0],[3,0],[4,0],[0,1]] }
    ];
