import test from "node:test";
import assert from "node:assert/strict";
import { sha256, verifyBackupPayload } from "../lib/backup.js";

test("backup verification passes with valid checksums and json", () => {
  const files = {
    state: JSON.stringify({ ok: true }),
    reminders: JSON.stringify([]),
    events: JSON.stringify([]),
    community: JSON.stringify({}),
    incidents: JSON.stringify([]),
    audit: "{\"line\":1}\n"
  };
  const payload = {
    files,
    checksums: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, sha256(v)]))
  };
  const result = verifyBackupPayload(payload, Object.keys(files), ["state", "reminders", "events", "community", "incidents"]);
  assert.equal(result.ok, true);
});

test("backup verification fails on checksum mismatch", () => {
  const payload = {
    files: { state: JSON.stringify({ ok: true }) },
    checksums: { state: "bad" }
  };
  const result = verifyBackupPayload(payload, ["state"], ["state"]);
  assert.equal(result.ok, false);
});

test("backup verification fails on invalid json for json keys", () => {
  const payload = {
    files: { state: "{bad-json" },
    checksums: {}
  };
  const result = verifyBackupPayload(payload, ["state"], ["state"]);
  assert.equal(result.ok, false);
});
