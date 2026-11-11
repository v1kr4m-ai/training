/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Window {
    /** Starting data bundled into the single-file HTML, keyed by file name (e.g. 'training_curriculum.json'). */
    __TUSHIL_SEED__?: Record<string, unknown>;
  }
}

/** Starting data: the copy bundled into the single-file HTML if present, else fetched from the server. */
export function loadSeedJson<T>(name: string): Promise<T | null> {
  const bundled = window.__TUSHIL_SEED__?.[name];
  if (bundled !== undefined) return Promise.resolve(bundled as T);
  return fetch(`/data/${name}`).then(res => (res.ok ? (res.json() as Promise<T>) : null));
}
