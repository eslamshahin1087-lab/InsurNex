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

  const endpoint = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + encodeURIComponent(match[1]);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "insurnex-config-check-invalid@example.invalid",
      password: "not-a-real-password",
      returnSecureToken: true
    }),
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json().catch(() => ({}));
  const code = result.error && result.error.message;

  if (response.ok) {
    throw new Error("Unexpected successful authentication response; investigate before using this probe.");
  }
  if (["API_KEY_INVALID", "API_KEY_EXPIRED", "API_KEY_SERVICE_BLOCKED", "PROJECT_NOT_FOUND"].includes(code)) {
    throw new Error("Firebase rejected the configured key/project (" + code + "). Check the Web API key, project association and API restrictions in Google Cloud.");
  }
  if (code === "OPERATION_NOT_ALLOWED") {
    console.error("Firebase key/project was accepted, but Email/Password sign-in is disabled in Firebase Authentication.");
    process.exitCode = 2;
    return;
  }
  if (["EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS", "USER_DISABLED"].includes(code)) {
    console.log("Firebase Authentication endpoint accepted the configured key and Email/Password provider is enabled.");
    console.log("The probe used a reserved .invalid email and did not create or modify a user.");
    return;
  }
  throw new Error("Firebase returned an inconclusive response (" + (code || "HTTP_" + response.status) + "). No credentials or API key were printed.");
}

main().catch(error => {
  console.error("Live Firebase Auth check failed:", error.message || error);
  process.exit(1);
});
