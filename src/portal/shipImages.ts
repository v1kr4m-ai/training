import heroSea from '../assets/images/ins_tushil_frigate_sea_1793948457479.jpg';
import { TUSHIL_ID } from './tushilSeed';
import type { ShipProfile } from './ship';

/** Banner photo for a ship: the one uploaded for it, else the built-in one (INS Tushil only), else none. */
export const heroOf = (shipId: string, ship: ShipProfile): string | undefined =>
  ship.heroImage || (shipId === TUSHIL_ID ? heroSea : undefined);
