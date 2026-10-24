import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { PLATFORM_FEATURES, type PlatformFeatureKey } from './feature-catalog';

export { PLATFORM_FEATURES };
export type { PlatformFeatureKey };

export interface PlatformSettings {
  branding: { primaryColor: string; accentColor: string };
  features: Record<PlatformFeatureKey, boolean>;
  advertising: { enabled: boolean; dashboard: boolean; operations: boolean };
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  branding: { primaryColor: '#1E4272', accentColor: '#1473E6' },
  features: {
    clients: true, policies: true, claims: true, renewals: true, operations: true,
    tasks: true, insurers: true, leads: true, finance: true, analytics: true,
    copilot: true, documents: true, notifications: true,
  },
  advertising: { enabled: true, dashboard: true, operations: false },
};

const SETTINGS_COLLECTION = 'platformSettings';
const SETTINGS_ID = 'global';
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}

export function normalizePlatformSettings(value: unknown): PlatformSettings {
  const raw = asRecord(value);
  const branding = asRecord(raw.branding);
  const featureData = asRecord(raw.features);
  const advertisingData = asRecord(raw.advertising);
  const features = {} as Record<PlatformFeatureKey, boolean>;

  for (const feature of PLATFORM_FEATURES) {
    const saved = featureData[feature.key];
    features[feature.key] = typeof saved === 'boolean'
      ? saved
      : DEFAULT_PLATFORM_SETTINGS.features[feature.key];
  }

  return {
    branding: {
      primaryColor: safeColor(branding.primaryColor, DEFAULT_PLATFORM_SETTINGS.branding.primaryColor),
      accentColor: safeColor(branding.accentColor, DEFAULT_PLATFORM_SETTINGS.branding.accentColor),
    },
    features,
    advertising: {
      enabled: typeof advertisingData.enabled === 'boolean' ? advertisingData.enabled : DEFAULT_PLATFORM_SETTINGS.advertising.enabled,
      dashboard: typeof advertisingData.dashboard === 'boolean' ? advertisingData.dashboard : DEFAULT_PLATFORM_SETTINGS.advertising.dashboard,
      operations: typeof advertisingData.operations === 'boolean' ? advertisingData.operations : DEFAULT_PLATFORM_SETTINGS.advertising.operations,
    },
  };
}

export async function loadPlatformSettings(): Promise<PlatformSettings> {
  const snapshot = await getDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_ID));
  return normalizePlatformSettings(snapshot.exists() ? snapshot.data() : null);
}

export function subscribePlatformSettings(
  onSettings: (settings: PlatformSettings) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, SETTINGS_COLLECTION, SETTINGS_ID),
    (snapshot) => onSettings(normalizePlatformSettings(snapshot.exists() ? snapshot.data() : null)),
    onError,
  );
}

export async function savePlatformSettings(settings: PlatformSettings, actorUid: string): Promise<void> {
  if (!actorUid.trim()) throw new Error('تعذر تحديد حساب المسؤول الذي يحفظ الإعدادات.');
  if (!HEX_COLOR.test(settings.branding.primaryColor) || !HEX_COLOR.test(settings.branding.accentColor)) {
    throw new Error('أدخل ألوانًا صحيحة بصيغة HEX مثل #1E4272.');
  }
  const normalized = normalizePlatformSettings(settings);
  await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_ID), {
    branding: normalized.branding,
    features: normalized.features,
    advertising: normalized.advertising,
    updatedBy: actorUid,
    updatedAt: serverTimestamp(),
  });
}
