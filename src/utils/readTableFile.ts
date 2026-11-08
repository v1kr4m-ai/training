/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';

export const TABLE_FILE_ACCEPT = '.csv,.tsv,.txt,.xlsx,.xls';

/** Turn a CSV / TSV / text / Excel file into delimited text (first sheet only for Excel), ready for the table parsers. */
export async function readTableFile(file: File): Promise<string> {
  if (/\.xlsx?$/i.test(file.name)) {
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw new Error('The workbook has no sheets.');
    return XLSX.utils.sheet_to_csv(sheet);
  }
  return file.text();
}
