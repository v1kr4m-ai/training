import { createContext, useContext } from 'react';
import type { ScheduleSettings } from '../types/index.ts';
import { DEFAULT_SETTINGS } from './settings.ts';

export const SettingsContext = createContext<ScheduleSettings>(DEFAULT_SETTINGS);
export const useSettings = () => useContext(SettingsContext);
