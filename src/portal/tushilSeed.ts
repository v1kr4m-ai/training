/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ShipProfile } from './ship.ts';

export const TUSHIL_ID = 'ins-tushil';

/**
 * Starting profile for INS Tushil, from publicly reported information. It is ordinary editable ship data
 * (Home > Edit ship profile): review it against official sources and correct it as needed.
 */
export function tushilSeed(): ShipProfile {
  return {
    name: 'INS Tushil',
    pennant: 'F70',
    shipClass: 'Project 1135.6M (Talwar-class follow-on)',
    motto: 'Abhedya Kavacham',
    mottoMeaning: 'The Impenetrable Shield. "Tushil" is Sanskrit for Protector Shield.',
    command: 'Western Fleet',
    homeport: 'Karwar Naval Base (INS Kadamba), Karnataka',
    about: 'Guided-missile frigate of the Indian Navy, built by Yantar Shipyard, Kaliningrad, Russia, and commissioned on 9 December 2024.',
    facts: [
      { label: 'Builder', value: 'Yantar Shipyard, Kaliningrad, Russia' },
      { label: 'Commissioned', value: '9 December 2024' },
      { label: 'Commissioned by', value: 'Shri Rajnath Singh (Defence Minister) and Admiral Dinesh K. Tripathi (CNS)' },
      { label: 'Displacement', value: '3,678 t standard / 4,100 t full load' },
      { label: 'Length', value: '124.8 m' },
      { label: 'Beam', value: '15.2 m' },
      { label: 'Draught', value: '4.5 m' },
      { label: 'Propulsion', value: 'COGAG, 2 cruise + 2 boost gas turbines (Zorya-Mashproekt M7N1), twin shaft' },
      { label: 'Power', value: '56,000 shp (41,800 kW)' },
      { label: 'Speed', value: '30+ knots' },
      { label: 'Range', value: '4,850 nm at 14 knots' },
      { label: 'Endurance', value: '30 days' },
      { label: 'Complement', value: '220 (22 officers, 198 sailors)' },
      { label: 'Indigenous content', value: '26%+ (BrahMos, BEL, Keltron, DRDO)' }
    ],
    specs: [
      {
        id: 'surface-strike', title: 'Surface & land attack', description: 'Vertical launch modules for long-range supersonic anti-ship and land attack.',
        items: [
          { label: 'Vertical launch system', value: '8-cell universal launcher (3S14)', note: 'Forward deck' },
          { label: 'Supersonic missile', value: 'BrahMos cruise missile', note: 'Mach 3.0 · 300 to 450+ km range · land attack and anti-ship' },
          { label: 'Main gun', value: '100mm A-190 automatic gun', note: '80 rounds/min · 20+ km range' },
          { label: 'Gun fire control', value: '5P-10 Puma radar and electro-optical tracker' }
        ]
      },
      {
        id: 'air-defense', title: 'Air & missile defence', description: 'Vertical-launch surface-to-air interceptors and terminal close-in weapons.',
        items: [
          { label: 'Air defence VLS', value: 'Shtil-1 multi-channel system (3S90M)', note: '24 x 9M317M missiles · up to 50 km' },
          { label: 'Close-in weapon system', value: '2 x AK-630M 30mm six-barrel cannons', note: 'Terminal defence against sea-skimming missiles' },
          { label: 'Decoys', value: 'PK-10 / KT-216 chaff and flare launchers' }
        ]
      },
      {
        id: 'anti-submarine', title: 'Anti-submarine warfare', description: 'Acoustic detection and kinetic ordnance for littoral and deep-ocean ASW.',
        items: [
          { label: 'Hull sonar', value: 'HUMSA-NG (DRDO / BEL)', note: 'Active and passive' },
          { label: 'Towed sonar', value: 'Variable-depth low-frequency sonar' },
          { label: 'Torpedo tubes', value: '2 x twin 533mm DTA-53-11356' },
          { label: 'ASW rockets', value: 'RBU-6000 12-barrel launcher' }
        ]
      },
      {
        id: 'sensors-ew', title: 'Radars & electronic warfare', description: 'Surveillance, target acquisition and countermeasures.',
        items: [
          { label: 'Air surveillance radar', value: 'Fregat-M2EM 3D radar', note: '300 km range' },
          { label: 'Surface target acquisition', value: '3Ts-25E Garpun-B radar' },
          { label: 'Electronic warfare', value: 'Shakti EW suite (BEL / DRDO)' },
          { label: 'Data link', value: 'Combat management system with Link-II' }
        ]
      },
      {
        id: 'aviation', title: 'Aviation', description: 'Flight deck and enclosed hangar for day and night operations.',
        items: [
          { label: 'Facility', value: 'Helipad and enclosed telescopic hangar' },
          { label: 'Anti-submarine helicopter', value: 'Kamov Ka-28' },
          { label: 'Airborne early warning', value: 'Kamov Ka-31' },
          { label: 'Also compatible', value: 'MH-60R Seahawk' }
        ]
      }
    ],
    timeline: [
      { id: 't1', date: 'October 2016', title: 'Inter-governmental agreement for four frigates', description: 'India and Russia signed an agreement for four Project 1135.6M frigates, two built at Yantar Kaliningrad and two at Goa Shipyard Limited.', source: 'Ministry of Defence / PIB' },
      { id: 't2', date: 'October 2021', title: 'Launched and named Tushil', description: 'Launched at Yantar Shipyard, Kaliningrad, and named "Tushil", Sanskrit for Protector Shield.' },
      { id: 't3', date: '9 December 2024', title: 'Commissioned as INS Tushil (F70)', description: 'Commissioned at Yantar Shipyard by the Defence Minister and the Chief of Naval Staff.', source: 'Press Information Bureau / MoD' }
    ]
  };
}
