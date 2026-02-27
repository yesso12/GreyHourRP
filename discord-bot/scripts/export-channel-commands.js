import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { REST, Routes } from "discord.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !guildId) {
  console.error("Missing DISCORD_TOKEN or DISCORD_GUILD_ID");
  process.exit(1);
}

const prodProfilePath = "/opt/greyhourrp-discord-bot/config/channel-profiles.json";
const localProfilePath = path.resolve(__dirname, "..", "config", "channel-profiles.json");
const channelProfilesFile = process.env.CHANNEL_PROFILES_FILE || (fs.existsSync(prodProfilePath) ? prodProfilePath : localProfilePath);

const prodChannelMapPath = "/opt/greyhourrp-discord-bot/config/channel-map.json";
const localChannelMapPath = path.resolve(__dirname, "..", "config", "channel-map.json");
const channelMapFile = process.env.CHANNEL_MAP_FILE || (fs.existsSync(prodChannelMapPath) ? prodChannelMapPath : localChannelMapPath);

const defaultSiteRoot = fs.existsSync("/opt/greyhourrp/public")
  ? "/opt/greyhourrp"
  : path.resolve(__dirname, "..", "..");
const siteRoot = process.env.GH_SITE_ROOT || defaultSiteRoot;

const commandDocPath = path.resolve(siteRoot, "public", "content", "discord-commands.json");
if (!fs.existsSync(commandDocPath)) {
  console.error(`Missing command catalog at ${commandDocPath}. Run export-commands.js first.`);
  process.exit(1);
}

const channelProfiles = JSON.parse(fs.readFileSync(channelProfilesFile, "utf8"));
const commandDoc = JSON.parse(fs.readFileSync(commandDocPath, "utf8"));

const rest = new REST({ version: "10" }).setToken(token);
const channelById = new Map();
const categoryById = new Map();

function hydrateChannelMaps(list) {
  for (const ch of list) {
    if (!ch?.id) continue;
    channelById.set(ch.id, ch);
    if (ch.type === 4) {
      categoryById.set(ch.id, ch.name);
    }
  }
}

if (fs.existsSync(channelMapFile)) {
  try {
    const raw = fs.readFileSync(channelMapFile, "utf8");
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.channels) ? parsed.channels : [];
    if (list.length) {
      hydrateChannelMaps(list);
    }
  } catch {
    console.warn(`Warning: failed to read channel map at ${channelMapFile}.`);
  }
}

if (channelById.size === 0) {
  try {
    const guildChannels = await rest.get(Routes.guildChannels(guildId));
    hydrateChannelMaps(guildChannels || []);
  } catch (err) {
    console.warn("Warning: failed to fetch Discord channels via REST. Trying curl fallback.");
    try {
      let raw = "";
      try {
        raw = execSync(
          `curl -s -H "Authorization: Bot ${token}" "https://discord.com/api/v10/guilds/${guildId}/channels"`,
          { encoding: "utf8" }
        );
      } catch {
        const envPath = process.env.DOTENV_CONFIG_PATH || "/opt/greyhourrp-discord-bot/.env";
        raw = execSync(
          `bash -lc 'source "${envPath}" >/dev/null 2>&1; curl -s -H "Authorization: Bot $DISCORD_TOKEN" "https://discord.com/api/v10/guilds/$DISCORD_GUILD_ID/channels"'`,
          { encoding: "utf8" }
        );
      }
      const guildChannels = JSON.parse(raw || "[]");
      if (Array.isArray(guildChannels)) {
        hydrateChannelMaps(guildChannels);
      } else {
        console.warn("Warning: curl fallback returned unexpected data.");
      }
    } catch {
      console.warn("Warning: failed to fetch Discord channels. Falling back to ID-only map.");
    }
  }
}

function commandMatchesRule(commandKey, rule) {
  if (!rule) return false;
  if (rule.endsWith(".*")) {
    const prefix = rule.replace(".*", "");
    return commandKey.startsWith(`${prefix}.`) || commandKey === prefix;
  }
  return commandKey === rule;
}

function buildCommandIndex(doc) {
  const index = [];
  for (const cmd of doc.commands || []) {
    const base = {
      key: cmd.name,
      usage: cmd.usage,
      description: cmd.description || "",
      permission: cmd.permission || "public"
    };
    index.push(base);
    if (Array.isArray(cmd.subcommands) && cmd.subcommands.length > 0) {
      for (const sub of cmd.subcommands) {
        index.push({
          key: `${cmd.name}.${sub.name}`,
          usage: sub.usage,
          description: sub.description || "",
          permission: cmd.permission || "public"
        });
      }
    }
  }
  return index;
}

const commandIndex = buildCommandIndex(commandDoc);

function usagesForRule(rule) {
  const normalized = String(rule || "").trim();
  if (!normalized) return [];
  const matches = commandIndex.filter((entry) => commandMatchesRule(entry.key, normalized));

  if (!normalized.includes(".") && !normalized.endsWith(".*")) {
    const prefix = `${normalized}.`;
    for (const entry of commandIndex) {
      if (entry.key.startsWith(prefix)) matches.push(entry);
    }
  }

  const seen = new Set();
  const out = [];
  for (const match of matches) {
    const key = `${match.usage}::${match.permission}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      usage: match.usage,
      description: match.description,
      permission: match.permission
    });
  }
  return out;
}

const channels = [];
const profileChannels = channelProfiles.channels || {};
for (const channelId of Object.keys(profileChannels)) {
  const profile = profileChannels[channelId] || {};
  const allowRules = Array.isArray(profile.allowCommands) ? profile.allowCommands : [];
  const ch = channelById.get(channelId);
  const parentName = ch?.parent_id ? categoryById.get(ch.parent_id) || null : null;
  const commands = allowRules.flatMap(usagesForRule);

  channels.push({
    id: channelId,
    name: ch?.name || `channel-${channelId.slice(-6)}`,
    parentId: ch?.parent_id ?? null,
    parentName,
    type: ch?.type ?? null,
    allowRules,
    commands
  });
}

channels.sort((a, b) => {
  const aCat = a.parentName || "";
  const bCat = b.parentName || "";
  if (aCat !== bCat) return aCat.localeCompare(bCat);
  return a.name.localeCompare(b.name);
});

const payload = {
  generatedUtc: new Date().toISOString(),
  channels
};

const outPath = path.resolve(siteRoot, "public", "content", "discord-channel-commands.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${channels.length} channels to ${outPath}`);
