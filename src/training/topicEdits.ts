/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ALL_TRACK_DEPARTMENTS, SHIP_WIDE } from '../data/departments.ts';
import type { ScheduledSession, Topic } from '../types/index.ts';

export const trackFor = (department: string): Topic['trackType'] => (department === SHIP_WIDE ? 'COMPANY_WIDE' : 'DEPARTMENTAL');

export function newTopicId(topics: Topic[]): string {
  let n = topics.length + 1;
  let id: string;
  do {
    id = `TOP-${String(n++).padStart(3, '0')}`;
  } while (topics.some(t => t.id === id));
  return id;
}

/** Error text if the topic cannot be saved, else null. `topics` is the list before the change. */
export function validateTopic(t: Topic, topics: Topic[], isNew: boolean): string | null {
  if (!t.id) return 'Give the topic an ID.';
  if (isNew && topics.some(x => x.id === t.id)) return `Topic ID "${t.id}" is already used.`;
  if (!t.title) return 'Give the topic a title.';
  if (!ALL_TRACK_DEPARTMENTS.includes(t.department)) return 'Choose a department.';
  if (t.durationMinutes != null && (!Number.isInteger(t.durationMinutes) || t.durationMinutes <= 0)) return 'Duration must be a whole number of minutes.';
  if (t.prerequisiteId === t.id) return 'A topic cannot be its own prerequisite.';
  if (t.prerequisiteId && !topics.some(x => x.id === t.prerequisiteId)) return 'The prerequisite topic does not exist.';
  const seen = new Set<string>();
  let p: string | null | undefined = t.prerequisiteId;
  while (p && !seen.has(p)) {
    if (p === t.id) return 'That prerequisite would make a loop of topics.';
    seen.add(p);
    p = topics.find(x => x.id === p)?.prerequisiteId;
  }
  return null;
}

export function upsertTopic(topics: Topic[], topic: Topic): Topic[] {
  return topics.some(t => t.id === topic.id) ? topics.map(t => (t.id === topic.id ? topic : t)) : [...topics, topic];
}

/** Copy a topic's details onto its sessions that are not finished yet. Completed and skipped sessions keep their record. */
export function syncSessionsToTopic(sessions: ScheduledSession[], topic: Topic): ScheduledSession[] {
  return sessions.map(s =>
    s.topicId !== topic.id || s.status === 'Completed' || s.status === 'Skipped'
      ? s
      : {
          ...s,
          title: topic.title,
          department: topic.department,
          subDepartment: topic.subDepartment,
          trackType: topic.trackType,
          speaker: topic.speaker,
          description: topic.description,
          prerequisiteId: topic.prerequisiteId ?? null
        }
  );
}

export type DeleteTopicResult =
  | { error: string }
  | { topics: Topic[]; sessions: ScheduledSession[]; removed: number; unlinked: number };

/** Remove a topic and its planned sessions. Refused while any of its sessions is completed, rescheduled, or locked. */
export function deleteTopicAndSessions(topics: Topic[], sessions: ScheduledSession[], id: string): DeleteTopicResult {
  const blocking = sessions.filter(s => s.topicId === id && (s.status !== 'Scheduled' || s.isCustomLocked));
  if (blocking.length > 0) {
    return { error: `${blocking.length} session(s) for this topic are completed, rescheduled or locked. Change or delete those sessions first.` };
  }
  const remaining = sessions.filter(s => s.topicId !== id).map((s, i) => ({ ...s, sequenceNumber: i + 1 }));
  return {
    topics: topics.filter(t => t.id !== id).map(t => (t.prerequisiteId === id ? { ...t, prerequisiteId: null } : t)),
    sessions: remaining,
    removed: sessions.length - remaining.length,
    unlinked: topics.filter(t => t.prerequisiteId === id).length
  };
}
