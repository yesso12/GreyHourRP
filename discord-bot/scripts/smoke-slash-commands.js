import "dotenv/config";
import { REST, Routes } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const smokeGuildIds = (process.env.SMOKE_SLASH_GUILD_IDS || process.env.SMOKE_SLASH_GUILD_ID || guildId || "")
  .split(",")
  .map((x) => String(x || "").trim())
  .filter(Boolean);
const required = (process.env.SMOKE_REQUIRED_COMMANDS || "ping,help,music,ticket,status")
  .split(",")
  .map((x) => String(x || "").trim().toLowerCase())
  .filter(Boolean);

if (!token || !clientId || !smokeGuildIds.length) {
  console.error("[smoke-slash] Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or SMOKE_SLASH_GUILD_IDS");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(token);

async function main() {
  let sawAccessibleGuild = false;
  for (const gid of smokeGuildIds) {
    console.log(`[smoke-slash] Checking guild commands in ${gid}`);
    try {
      const rows = await rest.get(Routes.applicationGuildCommands(clientId, gid));
      const names = new Set(Array.isArray(rows) ? rows.map((x) => String(x?.name || "").toLowerCase()).filter(Boolean) : []);
      const missing = required.filter((name) => !names.has(name));
      sawAccessibleGuild = true;
      if (missing.length) {
        console.error(`[smoke-slash] Missing commands in ${gid}: ${missing.join(", ")}`);
        process.exit(1);
      }
      console.log(`[smoke-slash] PASS (${gid}): required commands present (${required.join(", ")})`);
      return;
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      if (/Missing Access/i.test(msg)) {
        console.warn(`[smoke-slash] WARN (${gid}): missing access, trying next guild`);
        continue;
      }
      throw err;
    }
  }
  if (!sawAccessibleGuild) {
    console.error("[smoke-slash] FAIL: no accessible guild in SMOKE_SLASH_GUILD_IDS");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`[smoke-slash] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
