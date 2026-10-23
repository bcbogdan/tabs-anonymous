export function choose(tabs, meta, strategy, random = Math.random) {
  const eligible = tabs.filter(t => !t.pinned).sort((a,b) => (meta[a.id]?.born || 0) - (meta[b.id]?.born || 0) || a.id-b.id);
  if (!eligible.length) throw Error('No unpinned tabs available. Choose a tab manually.');
  if (strategy === 'random') return eligible[Math.floor(random()*eligible.length)];
  if (strategy === 'fifo') return eligible[0];
  if (strategy === 'lifo') return eligible.at(-1);
  throw Error('Unknown strategy');
}
export function positive(value, max=500) {
  const n=Number(value); if(!Number.isInteger(n)||n<1||n>max) throw Error(`Choose a whole number between 1 and ${max}.`); return n;
}
export function destination(url) {
  return /^(https?:|file:)/.test(url || '') ? url : 'chrome://newtab/';
}
