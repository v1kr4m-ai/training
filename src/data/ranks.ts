/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/** Indian Navy ranks, junior to senior. */
export const OFFICER_RANKS = ['Sub Lieutenant', 'Lieutenant', 'Lieutenant Commander', 'Commander', 'Captain', 'Commodore', 'Rear Admiral', 'Vice Admiral', 'Admiral'];
export const SAILOR_RANKS = ['Seaman II', 'Seaman I', 'Leading Seaman', 'Petty Officer', 'Chief Petty Officer', 'Master Chief Petty Officer II', 'Master Chief Petty Officer I'];

export const BUILT_IN_RANKS: Record<string, string[]> = { Officer: OFFICER_RANKS, Sailor: SAILOR_RANKS, Civilian: [] };

/** Dropdown list for a category: ranks added by users first, then the standard ones. */
export const ranksFor = (category: string, custom: string[] = []): string[] => {
  const std = BUILT_IN_RANKS[category] || [];
  return [...custom.filter(r => !std.includes(r)), ...std];
};
