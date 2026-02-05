import test from "node:test";
import assert from "node:assert/strict";
import { canAccessCommand } from "../lib/policy.js";

test("policy denies user even if role would allow", () => {
  const policy = {
    allowUserIds: [],
    denyUserIds: ["u1"],
    commandRoleIds: { backup: ["r1"] }
  };
  assert.equal(canAccessCommand(policy, "u1", ["r1"], "backup"), false);
});

test("policy allow list bypasses role requirement", () => {
  const policy = {
    allowUserIds: ["u2"],
    denyUserIds: [],
    commandRoleIds: { backup: ["r1"] }
  };
  assert.equal(canAccessCommand(policy, "u2", [], "backup"), true);
});

test("policy requires mapped role for command", () => {
  const policy = {
    allowUserIds: [],
    denyUserIds: [],
    commandRoleIds: { audit: ["staff"] }
  };
  assert.equal(canAccessCommand(policy, "u3", ["member"], "audit"), false);
  assert.equal(canAccessCommand(policy, "u3", ["staff"], "audit"), true);
});
