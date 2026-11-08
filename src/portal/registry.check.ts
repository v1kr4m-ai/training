// Self-check: node --experimental-strip-types src/portal/registry.check.ts
import { addShipRef, dbKey, loadRegistry, removeShipRef, trainingKey, uniqueId } from './registry.ts';

const ok = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
const mem = () => { const m = new Map<string, string>(); return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

// fresh install: INS Tushil is the first ship
const a = mem();
const r1 = loadRegistry(a);
ok(r1.ships.length === 1 && r1.activeId === 'ins-tushil' && r1.ships[0].pennant === 'F70', 'first ship');

// data from the single-ship version is moved under INS Tushil
const b = mem();
b.setItem('TUSHIL_PORTAL_DB_V1', '{"legacy":1}');
b.setItem('ANNUAL_TRAINING_MATRIX_STATE_V1', '{"t":1}');
loadRegistry(b);
ok(b.getItem(dbKey('ins-tushil')) === '{"legacy":1}' && b.getItem(trainingKey('ins-tushil')) === '{"t":1}', 'legacy data migrated');
ok(b.getItem('TUSHIL_PORTAL_DB_V1') === null && b.getItem('ANNUAL_TRAINING_MATRIX_STATE_V1') === null, 'legacy keys removed');
ok(loadRegistry(b).ships.length === 1, 'registry is stable on reload');

// corrupt registry falls back safely
const c = mem(); c.setItem('TUSHIL_PORTAL_SHIPS_V1', 'garbage');
ok(loadRegistry(c).activeId === 'ins-tushil', 'corrupt registry recovered');

// add / remove
const { registry: r2, id } = addShipRef(r1, 'INS Vikrant', 'R11');
ok(id === 'ins-vikrant' && r2.ships.length === 2 && r2.activeId === id, 'add ship');
ok(addShipRef(r2, 'INS Vikrant', '').id === 'ins-vikrant-2', 'duplicate name gets a distinct id');
ok(uniqueId('!!!', []) === 'ship', 'odd name');
const r3 = removeShipRef(r2, id);
ok(r3.ships.length === 1 && r3.activeId === 'ins-tushil', 'remove active ship switches to another');
ok(removeShipRef(r3, 'ins-tushil').ships.length === 1, 'last ship cannot be removed');
console.log('registry ok');
