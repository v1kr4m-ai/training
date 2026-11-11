// Self-check: node --experimental-strip-types src/portal/leave.check.ts
import { emptyDb, parseDb } from './db.ts';
import { hashPassword, newSalt, verifyPassword } from './auth.ts';
import { balances, canDecide, daysBetween, firstStatus, getApprovalRoute, monthlyForecast, shortfalls, statusAfterApproval, validateApplication } from './leaveLogic.ts';
import { blankShip } from './ship.ts';
import { tushilSeed } from './tushilSeed.ts';
import type { Db, LeaveRequest, Person, User } from './types.ts';

const ok = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };

ok(daysBetween('2026-03-01', '2026-03-01') === 1 && daysBetween('2026-02-27', '2026-03-02') === 4 && daysBetween('2026-03-02', '2026-03-01') === 0, 'daysBetween');

const salt = newSalt();
const h = await hashPassword('correct horse', salt);
ok(await verifyPassword('correct horse', salt, h) && !(await verifyPassword('wrong', salt, h)), 'password hash');
ok(parseDb('garbage').users.length === 0 && parseDb(null).leaveTypes.length === 4, 'bad saved data falls back');

// ship profile: a saved db without one (older version) gets the starting profile; a saved one is kept
ok(parseDb(null, blankShip('INS X', 'F1')).ship.name === 'INS X', 'new db carries the ship');
const legacy = JSON.stringify({ version: 1, users: [], personnel: [], leaveRequests: [] });
ok(parseDb(legacy, tushilSeed()).ship.name === 'INS Tushil', 'saved db without a profile gets the seed');
const saved = JSON.stringify({ ...JSON.parse(legacy), ship: { ...blankShip('INS Y', 'F2'), about: 'edited' } });
ok(parseDb(saved, tushilSeed()).ship.about === 'edited' && parseDb(saved, tushilSeed()).ship.name === 'INS Y', 'saved profile is kept');
ok(tushilSeed().facts.length > 5 && tushilSeed().specs.every(g => g.items.length > 0) && tushilSeed().timeline.length === 3, 'seed content');

const person = (id: string, department: string): Person => ({ id, serviceNo: id, name: id, rank: '', designation: '', category: 'Sailor', department, subDepartment: '', active: true });
const user = (id: string, role: User['role'], personId: string): User => ({ id, username: id, displayName: id, role, personId, salt: '', hash: '', active: true });
const db: Db = {
  ...emptyDb(),
  personnel: [person('a', 'Engineering'), person('b', 'Engineering'), person('hod', 'Engineering'), person('co', 'Executive'), person('x', 'Medical')],
  users: [user('ua', 'USER', 'a'), user('uhod', 'HOD', 'hod'), user('uco', 'CO', 'co')]
};

// approval routing
ok(firstStatus(db, db.personnel[0]) === 'PENDING_DO', 'sailor -> Department Officer');
ok(firstStatus(db, db.personnel[2]) === 'PENDING_CO', 'HoD -> CO');
ok(firstStatus(db, db.personnel[3]) === 'PENDING_ADMIN', 'CO -> admin');
ok(firstStatus(db, { ...db.personnel[4], category: 'Officer' }) === 'PENDING_CO', 'officer in department without HoD -> CO');
ok(statusAfterApproval('PENDING_HOD') === 'PENDING_CO' && statusAfterApproval('PENDING_CO') === 'APPROVED', 'stage progression');

const req = (over: Partial<LeaveRequest>): LeaveRequest => ({
  id: 'r1', personId: 'a', typeId: 'annual', from: '2026-06-01', to: '2026-06-10', days: 10, reason: '', addressDuringLeave: '',
  status: 'PENDING_HOD', history: [], createdAt: '', ...over
});
ok(canDecide(db, db.users[1], req({})), 'HoD of same department decides');
ok(!canDecide(db, db.users[2], req({})), 'CO cannot skip HoD stage');
ok(!canDecide(db, db.users[1], req({ personId: 'x' })), 'HoD of another department cannot decide');
ok(!canDecide(db, db.users[1], req({ personId: 'hod' })), 'nobody approves own leave');
ok(canDecide(db, db.users[2], req({ status: 'PENDING_CO' })), 'CO decides at CO stage');

// designation text alone grants no role
const titled: Db = { ...db, personnel: db.personnel.map(p => (p.id === 'a' ? { ...p, designation: 'Commanding Officer' } : p)) };
ok(!canDecide(titled, db.users[0], req({ personId: 'x', status: 'PENDING_CO' })), 'designation does not grant CO decision');
ok(!canDecide(titled, db.users[0], req({ personId: 'x', status: 'PENDING_EXO' })), 'designation does not grant EXO decision');
ok(firstStatus(titled, { ...db.personnel[4], category: 'Officer', designation: 'Commanding Officer' }) === 'PENDING_CO', 'designation does not route to admin');
ok(getApprovalRoute({ ...db.personnel[4], category: 'Officer' }, 'USER').some(s => s.role === 'HOD'), 'officer without HOD role routes via HOD');
ok(getApprovalRoute({ ...db.personnel[4], category: 'Officer' }, 'HOD').every(s => s.role !== 'HOD'), 'HOD role routes straight to CO; designation ignored');

// balances: 10 approved days, 6 already taken as of 2026-06-06
const withLeave: Db = { ...db, leaveRequests: [req({ status: 'APPROVED' }), req({ id: 'r2', typeId: 'casual', from: '2026-09-01', to: '2026-09-03', days: 3, status: 'PENDING_CO' })] };
const bal = balances(withLeave, 'a', 2026, '2026-06-06');
const annual = bal.find(b => b.typeId === 'annual')!;
ok(annual.availed === 6 && annual.upcoming === 4 && annual.available === 50, `annual balance ${JSON.stringify(annual)}`);
ok(bal.find(b => b.typeId === 'casual')!.pending === 3 && bal.find(b => b.typeId === 'sick')!.available === null, 'pending + uncapped');

// year boundary
const cross = { ...db, leaveRequests: [req({ from: '2026-12-28', to: '2027-01-03', days: 7, status: 'APPROVED' })] };
ok(balances(cross, 'a', 2026, '2027-02-01').find(b => b.typeId === 'annual')!.availed === 4 && balances(cross, 'a', 2027, '2027-02-01').find(b => b.typeId === 'annual')!.availed === 3, 'leave split across years');

// validation
ok(validateApplication(withLeave, 'a', 'annual', '2026-06-05', '2026-06-12', '2026-06-01') !== null, 'overlap rejected');
ok(validateApplication(withLeave, 'a', 'annual', '2026-07-01', '2026-08-30', '2026-06-01')?.includes('available') === true, 'over-balance rejected');
ok(validateApplication(withLeave, 'a', 'annual', '2026-07-01', '2026-07-05', '2026-06-01') === null, 'valid application');
ok(validateApplication(withLeave, 'a', 'sick', '2026-10-01', '2026-12-30', '2026-06-01') === null, 'uncapped type has no balance limit');

// forecast + shortfall (3 of 3 Engineering on leave > 25%)
const busy: Db = { ...db, leaveRequests: ['a', 'b', 'hod'].map((p, i) => req({ id: `q${i}`, personId: p, from: '2026-04-10', to: '2026-04-12', days: 3, status: 'APPROVED' })) };
ok(monthlyForecast(busy, 2026)[3].approvedDays === 9 && monthlyForecast(busy, 2026)[3].peakOnLeave === 3, 'monthly forecast');
const sf = shortfalls(busy, '2026-04-01', '2026-04-30');
ok(sf.length === 1 && sf[0].department === 'Engineering' && sf[0].from === '2026-04-10' && sf[0].to === '2026-04-12' && sf[0].peakPct === 100, 'shortfall range');
console.log('leave ok');
