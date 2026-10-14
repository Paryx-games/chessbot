function moveSoundType(pieces, from, to, enPassant) {
  const piece = pieces[from]?.toLowerCase();
  if (piece === 'k' && (from >> 3) === (to >> 3) && Math.abs((from & 7) - (to & 7)) === 2) return 'castle';
  const target = 'abcdefgh'[to & 7] + (8 - (to >> 3));
  if (pieces[to] || (piece === 'p' && (from & 7) !== (to & 7) && target === enPassant)) return 'capture';
  return 'move';
}
if (typeof module !== 'undefined') module.exports = { moveSoundType };
