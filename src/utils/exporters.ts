/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ScheduledSession } from '../types';

/**
 * Escapes text according to RFC 5545 iCalendar specification
 */
function escapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Formats a date string (YYYY-MM-DD) and time (HH:MM) to iCalendar local datetime (YYYYMMDDTHHMMSS)
 */
function formatIcsDateTime(dateStr: string, timeStr: string): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const cleanTime = timeStr.replace(/:/g, '') + '00';
  return `${cleanDate}T${cleanTime}`;
}

/**
 * Export sessions as RFC 5545 compliant iCalendar (.ics) format
 * Supports department or section filtering
 */
export function generateIcsContent(
  sessions: ScheduledSession[],
  filter?: { department?: string; subDepartment?: string },
  shipName: string = 'Ship'
): string {
  let filtered = sessions;
  if (filter?.department && filter.department !== 'ALL') {
    filtered = filtered.filter(s => s.department === filter.department);
  }
  if (filter?.subDepartment && filter.subDepartment !== 'ALL') {
    filtered = filtered.filter(s => s.subDepartment === filter.subDepartment);
  }

  const nowUtc = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const calTitle = filter?.subDepartment && filter.subDepartment !== 'ALL'
    ? `${shipName} Training - ${filter.subDepartment}`
    : filter?.department && filter.department !== 'ALL'
      ? `${shipName} Training - ${filter.department}`
      : `${shipName} Annual Training Matrix`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ship Portal//Annual Training Matrix//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calTitle)}`,
    'X-WR-TIMEZONE:Local',
  ];

  filtered.forEach(session => {
    const dtStart = formatIcsDateTime(session.date, session.startTime);
    const dtEnd = session.endTime ? formatIcsDateTime(session.date, session.endTime) : '';
    const uid = `session-${session.id}-${session.date}@training-matrix.local`;

    const descriptionBody = [
      `Session #${session.sequenceNumber} (Week ${session.weekNumber})`,
      `Track: ${session.trackType === 'COMPANY_WIDE' ? 'Ship-Wide' : 'Departmental'}`,
      `Department: ${session.department} (${session.subDepartment})`,
      session.speaker ? `Speaker: ${session.speaker}` : '',
      session.prerequisiteId ? `Prerequisite Topic ID: ${session.prerequisiteId}` : '',
      session.location ? `Location: ${session.location}` : '',
      '',
      session.description,
      session.notes ? `\nNotes: ${session.notes}` : ''
    ].filter(Boolean).join('\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${nowUtc}`,
      `DTSTART:${dtStart}`,
      ...(dtEnd ? [`DTEND:${dtEnd}`] : []),
      `SUMMARY:${escapeIcsText(`[${session.department}] ${session.title}`)}`,
      `DESCRIPTION:${escapeIcsText(descriptionBody)}`,
      `LOCATION:${escapeIcsText(session.location)}`,
      `CATEGORIES:${escapeIcsText(`${session.department},${session.subDepartment},${session.trackType}`)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Downloads a string payload as a client-side file blob with proper MIME type
 */
export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Export RFC 4180 CSV with UTF-8 BOM so Microsoft Excel renders characters cleanly on Windows
 */
export function generateCsvContent(sessions: ScheduledSession[]): string {
  const headers = [
    'Sequence',
    'Week',
    'Date',
    'Day of Week',
    'Start Time',
    'End Time',
    'Duration (min)',
    'Track Type',
    'Department',
    'Section',
    'Topic ID',
    'Topic Title',
    'Speaker',
    'Prerequisite ID',
    'Location',
    'Status',
    'Notes',
    'Description'
  ];

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function escapeCsvCell(val: unknown): string {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  const rows: string[] = [
    headers.map(h => escapeCsvCell(h)).join(',')
  ];

  sessions.forEach(s => {
    const row = [
      s.sequenceNumber,
      s.weekNumber,
      s.date,
      days[s.dayOfWeek] || 'Weekday',
      s.startTime,
      s.endTime || '',
      s.durationMinutes ?? '',
      s.trackType,
      s.department,
      s.subDepartment,
      s.topicId,
      s.title,
      s.speaker,
      s.prerequisiteId || '',
      s.location,
      s.status,
      s.notes || '',
      s.description || ''
    ];
    rows.push(row.map(escapeCsvCell).join(','));
  });

  // UTF-8 BOM (\uFEFF) ensures Excel recognizes UTF-8 without manual import wizard
  return '\uFEFF' + rows.join('\r\n');
}

/**
 * Formats rich-text HTML table for Microsoft Teams / Outlook clipboard pasting
 */
const esc = (v: string) => (v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function generateClipboardHtml(sessions: ScheduledSession[], title: string = 'Training Schedule'): { html: string; plainText: string } {
  const plainRows = sessions.map(s => 
    `#${s.sequenceNumber} | ${s.date} (${s.endTime ? `${s.startTime}-${s.endTime}` : s.startTime}) | [${s.department}] ${s.title} | Speaker: ${s.speaker || '—'}`
  ).join('\n');

  const plainText = `${title}\n${'='.repeat(title.length)}\n\n${plainRows}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 900px; padding: 12px;">
      <h2 style="margin: 0 0 12px 0; color: #1e293b; font-size: 18px; border-bottom: 2px solid #3b82f6; padding-bottom: 6px;">
        ${esc(title)}
      </h2>
      <p style="font-size: 13px; color: #64748b; margin: 0 0 16px 0;">
        ${sessions.length} sessions
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 8px 10px; font-weight: 600; color: #334155;">#</th>
            <th style="padding: 8px 10px; font-weight: 600; color: #334155;">Date</th>
            <th style="padding: 8px 10px; font-weight: 600; color: #334155;">Track</th>
            <th style="padding: 8px 10px; font-weight: 600; color: #334155;">Department</th>
            <th style="padding: 8px 10px; font-weight: 600; color: #334155;">Topic Title</th>
            <th style="padding: 8px 10px; font-weight: 600; color: #334155;">Speaker</th>
            <th style="padding: 8px 10px; font-weight: 600; color: #334155;">Location</th>
          </tr>
        </thead>
        <tbody>
          ${sessions.map((s, idx) => `
            <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding: 8px 10px; font-weight: 600; color: #64748b;">${s.sequenceNumber}</td>
              <td style="padding: 8px 10px; font-family: monospace; font-size: 11px; white-space: nowrap;">${s.date}</td>
              <td style="padding: 8px 10px;">
                <span style="font-size: 11px; font-weight: 600; color: ${s.trackType === 'COMPANY_WIDE' ? '#1d4ed8' : '#047857'};">
                  ${s.trackType === 'COMPANY_WIDE' ? 'Ship-Wide' : 'Departmental'}
                </span>
              </td>
              <td style="padding: 8px 10px; font-weight: 500;">${esc(s.department)}</td>
              <td style="padding: 8px 10px; font-weight: 600; color: #0f172a;">${esc(s.title)}</td>
              <td style="padding: 8px 10px; color: #475569;">${esc(s.speaker)}</td>
              <td style="padding: 8px 10px; color: #64748b; font-size: 11px;">${esc(s.location)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  return { html, plainText };
}

/**
 * Copies rich text HTML to clipboard using W3C ClipboardItem API
 */
export async function copyScheduleToClipboard(sessions: ScheduledSession[], title?: string): Promise<boolean> {
  try {
    const { html, plainText } = generateClipboardHtml(sessions, title);
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const textBlob = new Blob([plainText], { type: 'text/plain' });

    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': textBlob
      })
    ]);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard via ClipboardItem API:', err);
    // Fallback to plain text
    try {
      const { plainText } = generateClipboardHtml(sessions, title);
      await navigator.clipboard.writeText(plainText);
      return true;
    } catch {
      return false;
    }
  }
}
