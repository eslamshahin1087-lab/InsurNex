export type ViewModePreference = 'desktop' | 'mobile';

export function readViewModePreference(): ViewModePreference | null;
export function writeViewModePreference(mode: ViewModePreference): boolean;
