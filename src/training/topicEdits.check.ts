// Self-check: node --experimental-strip-types src/training/topicEdits.check.ts
import { deleteTopicAndSessions, newTopicId, syncSessionsToTopic, upsertTopic, validateTopic } from './topicEdits.ts';
import type { ScheduledSession, Topic } from '../types/index.ts';

const ok = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
const topic = (id: string, over: Partial<Topic> = {}): Topic => ({
  id, title: id, department: 'Engineering', subDepartment: '', trackType: 'DEPARTMENTAL', speaker: '', prerequisiteId: null, description: '', ...over
});
const session = (id: string, topicId: string, over: Partial<ScheduledSession> = {}): ScheduledSession => ({
  id, sequenceNumber: 1, weekNumber: 1, dayOfWeek: 2, date: '2026-12-01', startTime: '13:45', endTime: '', topicId, title: topicId,
  department: 'Engineering', subDepartment: '', trackType: 'DEPARTMENTAL', speaker: '', prerequisiteId: null, description: '', location: '', status: 'Scheduled', ...over
});

const topics = [topic('A'), topic('B', { prerequisiteId: 'A' })];
ok(newTopicId(topics) === 'TOP-003' && newTopicId([]) === 'TOP-001', 'new id skips used ids');
ok(validateTopic(topic('C'), topics, true) === null, 'valid new topic');
ok(validateTopic(topic('A'), topics, true)?.includes('already used') === true, 'duplicate id on add');
ok(validateTopic(topic('A', { title: '' }), topics, false) !== null, 'title required');
ok(validateTopic(topic('C', { department: 'Nowhere' }), topics, true) !== null, 'unknown department rejected');
ok(validateTopic(topic('C', { durationMinutes: 0 }), topics, true) !== null, 'zero duration rejected');
ok(validateTopic(topic('C', { durationMinutes: NaN }), topics, true) !== null, 'NaN duration rejected');
ok(validateTopic(topic('A', { prerequisiteId: 'A' }), topics, false) !== null, 'self prerequisite rejected');
ok(validateTopic(topic('C', { prerequisiteId: 'nope' }), topics, true) !== null, 'missing prerequisite rejected');
ok(validateTopic(topic('A', { prerequisiteId: 'B' }), topics, false)?.includes('loop') === true, 'prerequisite loop rejected');

const edited = upsertTopic(topics, topic('B', { title: 'Renamed' }));
ok(edited.length === 2 && edited[1].title === 'Renamed', 'edit replaces in place');
ok(upsertTopic(topics, topic('C')).length === 3, 'add appends');

const sessions = [session('s1', 'B'), session('s2', 'B', { status: 'Completed', title: 'old' }), session('s3', 'A')];
const synced = syncSessionsToTopic(sessions, topic('B', { title: 'Renamed' }));
ok(synced[0].title === 'Renamed' && synced[1].title === 'old' && synced[2].title === 'A', 'edit syncs open sessions only');

const blocked = deleteTopicAndSessions(topics, sessions, 'B');
ok('error' in blocked, 'delete refused when a session is completed');
const clean = deleteTopicAndSessions(topics, [session('s3', 'A')], 'B');
ok(!('error' in clean) && clean.topics.length === 1 && clean.removed === 0, 'delete topic with no sessions');
const withPlanned = deleteTopicAndSessions(topics, [session('s1', 'B'), session('s3', 'A')], 'A');
ok(!('error' in withPlanned) && withPlanned.removed === 1 && withPlanned.unlinked === 1, 'deleting a prerequisite removes its session and reports the link');
ok(!('error' in withPlanned) && withPlanned.topics.find(t => t.id === 'B')!.prerequisiteId === null, 'dependent topic loses its prerequisite');
ok(!('error' in withPlanned) && withPlanned.sessions.length === 1 && withPlanned.sessions[0].topicId === 'B', 'sessions of other topics kept');
console.log('topicEdits ok');
