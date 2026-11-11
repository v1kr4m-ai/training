// Self-check: node --experimental-strip-types src/training/trainingStorage.check.ts
import { patchTraining, readTraining, TRAINING_CHANGED } from './trainingStorage.ts';

const ok = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, v); }
};
const win = new EventTarget();
(globalThis as Record<string, unknown>).window = win;

let fired: string[] = [];
win.addEventListener(TRAINING_CHANGED, e => fired.push((e as CustomEvent<{ key: string }>).detail.key));

ok(readTraining('k') === null, 'nothing saved reads as null');
store.set('k', JSON.stringify({ year: 2026, topics: [{ id: 't' }], settings: { days: {}, startTime: '13:45' } }));
ok(patchTraining('k', s => ({ sessions: [{ id: 's1' } as never] })) === true, 'patch succeeds');
const after = readTraining('k')!;
ok(after.year === 2026 && after.topics!.length === 1 && after.sessions!.length === 1, 'patch keeps other fields');
ok(fired.length === 1 && fired[0] === 'k', 'change announced with its key');

store.set('bad', '{not json');
ok(patchTraining('bad', () => ({ year: 1 })) === false && store.get('bad') === '{not json', 'unreadable data is not replaced');
ok(fired.length === 1, 'no announcement when nothing was written');
console.log('trainingStorage ok');
