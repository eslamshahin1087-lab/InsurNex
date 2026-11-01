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
 * Resolve only Supabase keys explicitly configured by the trusted runtime.
 * Values may be publishable keys or names of environment variables holding
 * those keys. No browser-supplied key can expand this allow-list.
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
      // A malformed optional publishable-key map does not expand the allow-list.
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
