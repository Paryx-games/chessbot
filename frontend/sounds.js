const SOUND_NAMES = ['capture', 'castle', 'check', 'illegal', 'move-check', 'move-opponent', 'move-self', 'premove', 'promote'];
function moveSoundType(pieces, from, to, enPassant, opponent = false) {
  const piece = pieces[from]?.toLowerCase();
  if (piece === 'p' && (to < 8 || to >= 56)) return 'promote';
  if (piece === 'k' && (from >> 3) === (to >> 3) && Math.abs((from & 7) - (to & 7)) === 2) return 'castle';
  const target = 'abcdefgh'[to & 7] + (8 - (to >> 3));
  if (pieces[to] || (piece === 'p' && (from & 7) !== (to & 7) && target === enPassant)) return 'capture';
  return opponent ? 'move-opponent' : 'move-self';
}
function completedMoveSound(type, result) {
  if (result.kind === 'checkmate') return 'check';
  if (type === 'promote') return 'promote';
  return result.checked_square != null ? 'move-check' : type;
}
if (typeof module !== 'undefined') module.exports = { SOUND_NAMES, moveSoundType, completedMoveSound };
