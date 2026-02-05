import "dotenv/config";
import fs from "fs";
import path from "path";
import { Client, GatewayIntentBits, PermissionsBitField } from "discord.js";

const required = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_GUILD_ID",
  "ADMIN_API_BASE",
  "ANNOUNCE_CHANNEL_ID",
  "STATUS_CHANNEL_ID",
  "LOG_CHANNEL_ID"
];

function pass(msg) {
  console.log(`[preflight][PASS] ${msg}`);
}

function fail(msg) {
  console.error(`[preflight][FAIL] ${msg}`);
}

async function main() {
  let ok = true;
  for (const key of required) {
    if (!process.env[key]) {
      fail(`missing env: ${key}`);
      ok = false;
    } else {
      pass(`env present: ${key}`);
    }
  }
  if (!ok) process.exit(1);

  const policyPath = process.env.PERMISSION_POLICY_FILE || path.join(process.cwd(), "config", "permissions-policy.json");
  if (!fs.existsSync(policyPath)) {
    fail(`permission policy file missing: ${policyPath}`);
    process.exit(1);
  }
  pass(`permission policy found: ${policyPath}`);

  try {
    JSON.parse(fs.readFileSync(policyPath, "utf-8"));
    pass("permission policy is valid JSON");
  } catch {
    fail("permission policy is invalid JSON");
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
  });

  await new Promise((resolve, reject) => {
    client.once("ready", resolve);
    client.once("error", reject);
    client.login(process.env.DISCORD_TOKEN).catch(reject);
  });

  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  const me = await guild.members.fetchMe();
  pass(`connected as ${me.user.tag} in guild ${guild.name}`);

  const channels = [
    { key: "ANNOUNCE_CHANNEL_ID", id: process.env.ANNOUNCE_CHANNEL_ID },
    { key: "STATUS_CHANNEL_ID", id: process.env.STATUS_CHANNEL_ID },
    { key: "LOG_CHANNEL_ID", id: process.env.LOG_CHANNEL_ID }
  ];

  for (const row of channels) {
    const channel = await guild.channels.fetch(row.id).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      fail(`${row.key} invalid or not text channel: ${row.id}`);
      ok = false;
      continue;
    }
    const perms = channel.permissionsFor(me);
    const canView = Boolean(perms?.has(PermissionsBitField.Flags.ViewChannel));
    const canSend = Boolean(perms?.has(PermissionsBitField.Flags.SendMessages));
    if (!canView || !canSend) {
      fail(`${row.key} missing perms (view=${canView}, send=${canSend})`);
      ok = false;
    } else {
      pass(`${row.key} permissions OK in #${channel.name}`);
    }
  }

  await client.destroy();
  if (!ok) process.exit(1);
  pass("preflight complete");
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
