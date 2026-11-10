// Self-check: node --experimental-strip-types src/utils/scheduler.check.ts
import { cascadeReschedule, generateFullSchedule, auditScheduleConflicts, findUnscheduledTopics, generateAnnualWorkingSlots } from './scheduler.ts';
import { DEFAULT_HOLIDAYS_2026 } from '../data/holidays.ts';
import { DEPARTMENT_NAMES } from '../data/departments.ts';
import type { Topic } from '../types/index.ts';

const ok = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
const t = (id: string, department: string, prerequisiteId: string | null = null): Topic => ({
  id, title: id, department, subDepartment: '', trackType: department === 'Ship-Wide' ? 'COMPANY_WIDE' : 'DEPARTMENTAL',
  speaker: '', durationMinutes: 60, prerequisiteId, description: ''
});

ok(generateFullSchedule(2026, [], DEFAULT_HOLIDAYS_2026).length === 0, 'no topics -> no sessions');

const topics: Topic[] = [
  t('B', 'Executive', 'A'), t('A', 'Executive'), t('C', 'Ship-Wide'),
  ...DEPARTMENT_NAMES.map(d => t(`x-${d}`, d)),
  t('orphan', 'Medical', 'does-not-exist'), t('cycle1', 'Electrical', 'cycle2'), t('cycle2', 'Electrical', 'cycle1')
];
const sessions = generateFullSchedule(2026, topics, DEFAULT_HOLIDAYS_2026);

ok(new Set(sessions.map(s => s.topicId)).size === sessions.length, 'each topic once');
ok(!sessions.some(s => s.topicId === 'orphan' || s.topicId.startsWith('cycle')), 'unplaceable topics stay out');
ok(findUnscheduledTopics(topics, sessions).length === 3, 'three unscheduled reported');
const holidays = new Set(DEFAULT_HOLIDAYS_2026.map(h => h.date));
ok(!sessions.some(s => holidays.has(s.date) || [0, 6].includes(new Date(s.date + 'T12:00').getDay())), 'no holiday/weekend sessions');
ok(auditScheduleConflicts(sessions, DEFAULT_HOLIDAYS_2026, topics).length === 0, 'generated schedule audits clean');
const a = sessions.find(s => s.topicId === 'A')!, b = sessions.find(s => s.topicId === 'B')!;
ok(a.date < b.date, 'prerequisite first');
const slots = generateAnnualWorkingSlots(2026, DEFAULT_HOLIDAYS_2026).length;
ok(slots > 200 && slots < 262, `slot count sane (${slots})`);
ok(sessions.every(s => s.date.startsWith('2026-')), 'stays inside the year');
const extra = [...DEFAULT_HOLIDAYS_2026, { date: '2026-01-06', name: 'x', type: 'CORPORATE_BLACKOUT' as const }];
const moved = cascadeReschedule(sessions, extra, topics, 1);
ok(!auditScheduleConflicts(moved, extra, topics).some(c => c.type === 'SLOT_TYPE_MISMATCH' || c.type === 'HOLIDAY_COLLISION'), 'cascade keeps tracks on right weekdays and off holidays');
console.log('scheduler ok,', sessions.length, 'sessions,', slots, 'working days');

import { goodFriday, defaultHolidays } from '../data/holidays.ts';
ok(goodFriday(2026) === '2026-04-03' && goodFriday(2027) === '2027-03-26' && goodFriday(2025) === '2025-04-18', 'good friday');
ok(defaultHolidays(2027).length === 5 && defaultHolidays(2026).length === 17, 'default holidays per year');
const s27 = generateFullSchedule(2027, topics, defaultHolidays(2027));
ok(s27.length === 9 && s27.every(s => s.date.startsWith('2027-')), 'other year schedules inside that year');
console.log('year checks ok');

// Flexible days/time: Wednesday + Saturday, either track, 09:00-10:30
const flex = { days: { 0: null, 1: null, 2: null, 3: 'ANY', 4: null, 5: null, 6: 'ANY' }, startTime: '09:00', durationMinutes: 90 } as const;
const fs = generateFullSchedule(2026, topics, DEFAULT_HOLIDAYS_2026, undefined, flex as never);
ok(fs.length === 9, 'flex: all placeable topics scheduled');
ok(fs.every(s => [3, 6].includes(s.dayOfWeek) && s.startTime === '09:00' && s.endTime === '10:00'), 'flex: only configured days and start; the topic length (60 min) sets the end');
ok(auditScheduleConflicts(fs, DEFAULT_HOLIDAYS_2026, topics, flex as never).length === 0, 'flex: weekend training is not a conflict');
const moved2 = cascadeReschedule(fs, DEFAULT_HOLIDAYS_2026, topics, 1, flex as never);
ok(moved2.every(s => [3, 6].includes(s.dayOfWeek)), 'flex: cascade stays on configured days');
const overlap = [{ ...fs[0] }, { ...fs[1], date: fs[0].date, startTime: '10:00', endTime: '11:00' }];
ok(auditScheduleConflicts(overlap, DEFAULT_HOLIDAYS_2026, topics, flex as never).some(c => c.type === 'DUPLICATE_DATE'), 'overlap detected');
const noOverlap = [{ ...fs[0] }, { ...fs[1], date: fs[0].date, startTime: '10:30', endTime: '11:30' }];
ok(!auditScheduleConflicts(noOverlap, DEFAULT_HOLIDAYS_2026, topics, flex as never).some(c => c.message.startsWith('Overlaps')), 'back-to-back is not an overlap (still flagged as two sessions on one day)');
const noEnd = [{ ...fs[0], endTime: '', durationMinutes: null }, { ...fs[1], date: fs[0].date, startTime: fs[0].startTime, endTime: '', durationMinutes: null }];
ok(auditScheduleConflicts(noEnd, DEFAULT_HOLIDAYS_2026, topics, flex as never).some(c => c.type === 'DUPLICATE_DATE' || c.type === 'TIME_SLOT_DEPARTMENT_CONFLICT'), 'same start without an end overlaps');
const skipped = [{ ...fs[0] }, { ...fs[1], date: fs[0].date, startTime: fs[0].startTime, status: 'Skipped' as const }];
ok(!auditScheduleConflicts(skipped, DEFAULT_HOLIDAYS_2026, topics, flex as never).some(c => c.type === 'DUPLICATE_DATE'), 'skipped sessions do not collide');
console.log('flex checks ok');
