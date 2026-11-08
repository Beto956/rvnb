#!/usr/bin/env node
/**
 * RVNB owner custom-claim provisioning tool.
 *
 * Grants, revokes, or checks the server-managed `owner` custom claim on a
 * Firebase Authentication user, identified by exact UID. This is the ONLY
 * supported way to change owner privileges; clients can never set it.
 *
 * Authentication uses the firebase-tools CLI's own stored login
 * (`npx firebase login`) — no service-account keys or tokens are stored in
 * this repository, printed, or passed on the command line.
 *
 * Usage:
 *   node scripts/owner-claim.cjs --project rvnb-latest --uid <UID> --check
 *   node scripts/owner-claim.cjs --project rvnb-latest --uid <UID> --grant --yes
 *   node scripts/owner-claim.cjs --project rvnb-latest --uid <UID> --revoke --yes
 *
 * Local Auth-emulator variant for demo testing (no credentials needed):
 *   node scripts/owner-claim.cjs --emulator --project demo-rvnb-local --uid <UID> --grant --yes
 *
 * After any change, the user must sign out and back in (or their token must
 * refresh) before the new claim takes effect.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
"use strict";

const EMULATOR_HOST = "http://127.0.0.1:9099";

function parseArgs(argv) {
  const args = { project: "", uid: "", action: "", yes: false, emulator: false };
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--grant" || flag === "--revoke" || flag === "--check") args.action = flag.slice(2);
    else if (flag === "--yes") args.yes = true;
    else if (flag === "--emulator") args.emulator = true;
    else if (flag === "--project") args.project = argv[++i] || "";
    else if (flag === "--uid") args.uid = argv[++i] || "";
    else if (flag === "--help" || flag === "-h") { args.action = "help"; }
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

function usage() {
  console.log("Usage: node scripts/owner-claim.cjs --project <id> --uid <UID> (--check | --grant --yes | --revoke --yes) [--emulator]");
}

function readClaims(userRecord) {
  const raw = userRecord && userRecord.customAttributes;
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.action === "help") { usage(); return; }
  if (!args.project || !args.uid || !args.action) {
    usage();
    throw new Error("--project, --uid, and an action (--check/--grant/--revoke) are required.");
  }
  if ((args.action === "grant" || args.action === "revoke") && !args.yes) {
    throw new Error(`Refusing to ${args.action} without --yes. Re-run with --yes to confirm UID ${args.uid} on project ${args.project}.`);
  }
  if (args.emulator && !args.project.startsWith("demo-")) {
    throw new Error("--emulator requires a demo- project ID; never point emulator mode at a real project.");
  }

  let post;
  if (args.emulator) {
    post = async (path, body) => {
      // The Auth emulator accepts the magic "owner" bearer token for
      // project-level operations (same convention as the Firestore emulator).
      // It only works against localhost emulators and is not a credential.
      const response = await fetch(`${EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/projects/${args.project}${path}?key=demo-api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Emulator request failed (${response.status}): ${data.error?.message || "unknown error"}`);
      return data;
    };
  } else {
    // Reuse the firebase-tools CLI login; no credentials live in this repo.
    const { Client } = require("firebase-tools/lib/apiv2");
    const client = new Client({ urlPrefix: "https://identitytoolkit.googleapis.com", auth: true });
    post = async (path, body) => {
      const response = await client.post(`/v1/projects/${args.project}${path}`, body);
      return response.body;
    };
  }

  const lookup = await post("/accounts:lookup", { localId: [args.uid] });
  const record = Array.isArray(lookup.users) ? lookup.users[0] : null;
  if (!record) throw new Error(`No user with UID ${args.uid} in project ${args.project}. Verify the exact UID in Firebase Authentication.`);

  const before = readClaims(record);
  console.log(`UID: ${args.uid}`);
  console.log(`Email: ${record.email || "(none)"}`);
  console.log(`Current custom claims: ${JSON.stringify(before)}`);

  if (args.action === "check") return;

  const next = { ...before };
  if (args.action === "grant") next.owner = true;
  else delete next.owner;

  // Identity Toolkit replaces ALL custom attributes on update, so always send
  // the merged set; an empty string clears claims entirely.
  const customAttributes = Object.keys(next).length > 0 ? JSON.stringify(next) : "";
  await post("/accounts:update", { localId: args.uid, customAttributes });

  const verify = await post("/accounts:lookup", { localId: [args.uid] });
  const after = readClaims(Array.isArray(verify.users) ? verify.users[0] : null);
  console.log(`Updated custom claims: ${JSON.stringify(after)}`);
  const expected = args.action === "grant";
  if (Boolean(after.owner) !== expected) {
    throw new Error(`Verification failed: expected owner=${expected}, got ${JSON.stringify(after)}`);
  }
  console.log(`OK: owner claim ${args.action === "grant" ? "granted" : "revoked"}. The user must sign out and back in for it to take effect.`);
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
