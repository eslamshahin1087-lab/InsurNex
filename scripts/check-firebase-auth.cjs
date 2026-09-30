#!/usr/bin/env node
"use strict";

// Read-only configuration probe. Uses an intentionally nonexistent email and never creates a user.
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const configPath = path.join(__dirname, "..", "js", "config.js");
  const source = fs.readFileSync(configPath, "utf8");
  const match = source.match(/apiKey:\s*["']([^"']+)["']/);
  if (!match) throw new Error("Firebase Web API key was not found in js/config.js.");

  const projectMatch = source.match(/projectId:\s*["']([^"']+)["']/);
  if (!projectMatch || projectMatch[1] !== "insurnex-8a9df") {
    throw new Error("Refusing live check: js/config.js does not target the expected InsurNex project.");
  }

  const origins = [
    process.env.INSURNEX_APP_ORIGIN,
    "https://insurnex-8a9df.web.app/",
    "https://insurnex-8a9df.firebaseapp.com/"
  ].filter(Boolean).map(value => {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("App origin must use HTTP or HTTPS.");
    return url.origin + "/";
  }).filter((value, index, all) => all.indexOf(value) === index);

  const endpoint = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + encodeURIComponent(match[1]);
  let lastCode = "";
  for (const origin of origins) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "referer": origin
      },
      body: JSON.stringify({
        email: "insurnex-config-check-invalid@example.invalid",
        password: "not-a-real-password",
        returnSecureToken: true
      }),
      signal: AbortSignal.timeout(10000)
    });
    const result = await response.json().catch(() => ({}));
    const code = result.error && result.error.message;
    lastCode = code || "HTTP_" + response.status;

    if (response.ok) {
      throw new Error("Unexpected successful authentication response; investigate before using this probe.");
    }
    if (code === "API_KEY_HTTP_REFERRER_BLOCKED") continue;
    if (["API_KEY_INVALID", "API_KEY_EXPIRED", "API_KEY_SERVICE_BLOCKED", "PROJECT_NOT_FOUND"].includes(code)) {
      throw new Error("Firebase rejected the configured key/project (" + code + "). Check the Web API key, project association, enabled APIs and API restrictions in Google Cloud.");
    }
    if (code === "OPERATION_NOT_ALLOWED") {
      console.error("Firebase accepted the key and origin, but Email/Password sign-in is disabled in Firebase Authentication.");
      process.exitCode = 2;
      return;
    }
    if (["EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS", "USER_DISABLED"].includes(code)) {
      console.log("Firebase Authentication accepted the configured key and this app origin: " + origin);
      console.log("Email/Password sign-in is enabled. The reserved .invalid email was not created or modified.");
      return;
    }
    throw new Error("Firebase returned an inconclusive response (" + lastCode + "). No credentials or API key were printed.");
  }

  throw new Error("Firebase rejected the key for all tested origins. Set INSURNEX_APP_ORIGIN to the exact deployed app origin and allow it under the API key's HTTP referrer restrictions in Google Cloud.");
}

main().catch(error => {
  console.error("Live Firebase Auth check failed:", error.message || error);
  process.exit(1);
});
