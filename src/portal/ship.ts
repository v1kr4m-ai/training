/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Everything that describes one ship. The rest of the portal is the same for every ship.

export interface ShipFact { label: string; value: string }
export interface SpecItem { label: string; value: string; note?: string }
export interface SpecGroup { id: string; title: string; description?: string; items: SpecItem[] }
export interface TimelineItem { id: string; date: string; title: string; description: string; source?: string }

export interface ShipProfile {
  name: string;
  pennant: string;
  shipClass: string;
  motto: string;
  mottoMeaning: string;
  command: string; // fleet / command the ship belongs to
  homeport: string;
  about: string;
  facts: ShipFact[];
  specs: SpecGroup[];
  timeline: TimelineItem[];
  /** Data URL of the banner photo. Left empty, the ship's built-in photo (if any) or a plain banner is used. */
  heroImage?: string;
}

export const blankShip = (name: string, pennant: string): ShipProfile => ({
  name, pennant, shipClass: '', motto: '', mottoMeaning: '', command: '', homeport: '', about: '', facts: [], specs: [], timeline: []
});

/** "INS Tushil (F70)" or just the name when there is no pennant. */
export const shipTitle = (s: Pick<ShipProfile, 'name' | 'pennant'>) => (s.pennant ? `${s.name} (${s.pennant})` : s.name);
