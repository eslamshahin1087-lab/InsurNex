export type ViewModePreference = 'desktop' | 'mobile';

export function readViewModePreference(): ViewModePreference | null;
export function writeViewModePreference(mode: ViewModePreference): boolean;

export function resolveViewMode(
  search: string,
  preference: ViewModePreference | null,
): ViewModePreference;
export function buildViewModeHref(
  pathname: string,
  search: string,
  hash: string,
  mode: ViewModePreference,
): string;
