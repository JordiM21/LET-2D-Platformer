// Sorts by score desc; ties share a rank.
export function ranked(list) {
  const sorted = [...list].sort((a, b) => b.score - a.score);
  let rank = 0, prev = null;
  return sorted.map((r, i) => { if (r.score !== prev) { rank = i + 1; prev = r.score; } return { ...r, rank }; });
}
export const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export const rnd = (a, b) => a + Math.random() * (b - a);
