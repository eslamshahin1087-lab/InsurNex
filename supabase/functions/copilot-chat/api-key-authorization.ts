export interface SupabaseApiKeyConfig {
  legacyAnonKey?: string | null;
  publishableKeysJson?: string | null;
  lookupEnvironmentVariable?: (name: string) => string | undefined;
}

function addPublishableKey(candidate: unknown, allowedKeys: Set<string>): void {
  if (typeof candidate === "string" && candidate.startsWith("sb_publishable_")) {
    allowedKeys.add(candidate);
  }
}

/**
 * The modern Supabase runtime exposes SUPABASE_PUBLISHABLE_KEYS as a JSON map.
 * Depending on runtime configuration, values may be the key itself or the
 * name of another environment variable holding it. Resolve both safely.
 */
export function getConfiguredSupabaseApiKeys(config: SupabaseApiKeyConfig): Set<string> {
  const allowedKeys = new Set<string>();
  const legacyKey = config.legacyAnonKey?.trim();
  if (legacyKey) allowedKeys.add(legacyKey);

  const configuredPublishableKeys = config.publishableKeysJson;
  if (typeof configuredPublishableKeys === "string" && configuredPublishableKeys.trim()) {
    try {
      const parsed: unknown = JSON.parse(configuredPublishableKeys);
      const values: unknown[] = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
          ? Object.values(parsed)
          : [];

      for (const value of values) {
        addPublishableKey(value, allowedKeys);
        if (typeof value === "string" && config.lookupEnvironmentVariable) {
          addPublishableKey(config.lookupEnvironmentVariable(value), allowedKeys);
        }
      }
    } catch {
      // Keep the legacy key usable if the optional JSON variable is malformed.
    }
  }

  return allowedKeys;
}

export function isAllowedSupabaseApiKey(
  providedKey: string | null,
  config: SupabaseApiKeyConfig,
): boolean {
  if (typeof providedKey !== "string" || !providedKey.trim()) return false;
  return getConfiguredSupabaseApiKeys(config).has(providedKey.trim());
}
