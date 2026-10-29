export interface SupabaseApiKeyConfig {
  legacyAnonKey?: string | null;
  publishableKeysJson?: string | null;
}

/**
 * The Supabase Edge gateway cannot validate modern sb_publishable_* keys as
 * JWTs. If verify_jwt is disabled for this function, match the public API key
 * against the keys supplied by the trusted runtime environment, then continue
 * to require the caller's verified Firebase ID token and organization membership.
 */
export function isAllowedSupabaseApiKey(
  providedKey: string | null,
  config: SupabaseApiKeyConfig,
): boolean {
  if (typeof providedKey !== "string" || !providedKey.trim()) return false;

  const allowedKeys = new Set<string>();
  const legacyKey = config.legacyAnonKey?.trim();
  if (legacyKey) allowedKeys.add(legacyKey);

  const configuredPublishableKeys = config.publishableKeysJson;
  if (typeof configuredPublishableKeys === "string" && configuredPublishableKeys.trim()) {
    try {
      const parsed: unknown = JSON.parse(configuredPublishableKeys);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const value of Object.values(parsed)) {
          if (typeof value === "string" && value.trim()) allowedKeys.add(value.trim());
        }
      } else if (Array.isArray(parsed)) {
        for (const value of parsed) {
          if (typeof value === "string" && value.trim()) allowedKeys.add(value.trim());
        }
      }
    } catch {
      // Keep the legacy key usable if the optional JSON variable is malformed.
    }
  }

  return allowedKeys.has(providedKey.trim());
}
