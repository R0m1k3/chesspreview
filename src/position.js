const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function positionFromGame(game) {
  const position = {};
  for (const rank of RANKS) {
    for (const file of FILES) {
      const piece = game.get(`${file}${rank}`);
      if (piece) position[`${file}${rank}`] = { type: piece.type, color: piece.color };
    }
  }
  return position;
}

export function buildFen(position, turn = 'w') {
  const rows = RANKS.map((rank) => {
    let row = '';
    let empty = 0;
    for (const file of FILES) {
      const piece = position[`${file}${rank}`];
      if (!piece) { empty += 1; continue; }
      if (empty) { row += empty; empty = 0; }
      row += piece.color === 'w' ? piece.type.toUpperCase() : piece.type;
    }
    return row + (empty || '');
  });
  return `${rows.join('/')} ${turn} - - 0 1`;
}
