import "dotenv/config";
import fs from "fs";
import path from "path";
import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const apiBase = process.env.ADMIN_API_BASE || "";
const apiKey = process.env.ADMIN_API_KEY || "";
const adminBasicAuthUser = process.env.ADMIN_BASIC_AUTH_USER || "";
const adminBasicAuthPass = process.env.ADMIN_BASIC_AUTH_PASS || "";
const adminBasicAuthHeader = process.env.ADMIN_BASIC_AUTH_HEADER || "";
const announceChannelId = process.env.ANNOUNCE_CHANNEL_ID || "";
const statusChannelId = process.env.STATUS_CHANNEL_ID || "";
const logChannelId = process.env.LOG_CHANNEL_ID || "";
const welcomeChannelId = process.env.WELCOME_CHANNEL_ID || "";
const welcomeMessage = process.env.WELCOME_MESSAGE || "Welcome to Grey Hour RP, {user}.";
const goodbyeChannelId = process.env.GOODBYE_CHANNEL_ID || "";
const goodbyeMessage = process.env.GOODBYE_MESSAGE || "{user} has left the Grey Hour.";
const statusAlertMention = process.env.STATUS_ALERT_MENTION || "";
const dailyReminderTime = process.env.DAILY_REMINDER_TIME || ""; // HH:MM
const dailyReminderMessage = process.env.DAILY_REMINDER_MESSAGE || "";
const dailyReminderChannelId = process.env.DAILY_REMINDER_CHANNEL_ID || "";
const allowedRoleIds = (process.env.ALLOWED_ROLE_IDS || "").split(",").map(r => r.trim()).filter(Boolean);
const ownerRoleIds = (process.env.OWNER_ROLE_IDS || "").split(",").map(r => r.trim()).filter(Boolean);
const autoStatusMinutes = parsePositiveMinutes(process.env.AUTO_STATUS_MINUTES, 10, "AUTO_STATUS_MINUTES");
const autoActivityMinutes = parsePositiveMinutes(process.env.AUTO_ACTIVITY_MINUTES, 10, "AUTO_ACTIVITY_MINUTES");
const autoUpdatesMinutes = parsePositiveMinutes(process.env.AUTO_UPDATES_MINUTES, 30, "AUTO_UPDATES_MINUTES");
const autoTransmissionsMinutes = parsePositiveMinutes(process.env.AUTO_TRANSMISSIONS_MINUTES, 30, "AUTO_TRANSMISSIONS_MINUTES");
const autoModsMinutes = parsePositiveMinutes(process.env.AUTO_MODS_MINUTES, 60, "AUTO_MODS_MINUTES");
const siteUrl = process.env.SITE_URL || apiBase || "https://greyhourrp.xyz";
const botActivity = process.env.BOT_ACTIVITY_TEXT || "Grey Hour RP | /help";
const loreSnippet = process.env.LORE_SNIPPET ||
  "Day One did not end with screams or firestorms. It ended with silence. The Grey Hour is the moment the world balanced between what it was and what it would become.";

if (!token || !apiBase || !apiKey) {
  console.error("Missing DISCORD_TOKEN, ADMIN_API_BASE, or ADMIN_API_KEY");
  process.exit(1);
}

const stateDir = path.join(process.cwd(), "data");
const stateFile = path.join(stateDir, "state.json");
const remindersFile = path.join(stateDir, "reminders.json");

const links = {
  site: siteUrl,
  rules: `${siteUrl}/rules`,
  join: `${siteUrl}/how-to-join`,
  updates: `${siteUrl}/updates`,
  transmissions: `${siteUrl}/transmissions`,
  mods: `${siteUrl}/mods`
};

function loadState() {
  try {
    if (!fs.existsSync(stateFile)) return {};
    return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch {}
}

function loadReminders() {
  try {
    if (!fs.existsSync(remindersFile)) return [];
    return JSON.parse(fs.readFileSync(remindersFile, "utf-8"));
  } catch {
    return [];
  }
}

function saveReminders(list) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(remindersFile, JSON.stringify(list, null, 2));
  } catch {}
}

async function adminFetch(pathname) {
  const headers = {
    "X-Admin-Key": apiKey
  };

  const authHeader = getAdminAuthHeader();
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const res = await fetch(`${apiBase}${pathname}`, {
    headers
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

function getAdminAuthHeader() {
  if (adminBasicAuthHeader) {
    return adminBasicAuthHeader.startsWith("Basic ")
      ? adminBasicAuthHeader
      : `Basic ${adminBasicAuthHeader}`;
  }

  if (adminBasicAuthUser && adminBasicAuthPass) {
    const tokenValue = Buffer.from(`${adminBasicAuthUser}:${adminBasicAuthPass}`).toString("base64");
    return `Basic ${tokenValue}`;
  }

  return "";
}

function hasRole(member, ids) {
  if (!ids.length) return false;
  return member.roles.cache.some(r => ids.includes(r.id));
}

function parsePositiveMinutes(raw, fallback, label) {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(`Invalid ${label}="${raw}". Using fallback ${fallback}.`);
    return fallback;
  }
  return n;
}

function intervalMs(minutes) {
  return Math.max(1, Math.floor(minutes)) * 60 * 1000;
}

function isAuthorizedMember(member, guildOwnerId) {
  if (!member) return false;
  if (guildOwnerId && member.id === guildOwnerId) return true;
  return hasRole(member, allowedRoleIds) || hasRole(member, ownerRoleIds);
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

async function checkTextChannel(channelId, label) {
  if (!channelId) return { ok: false, summary: `${label}: not configured` };
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return { ok: false, summary: `${label}: not found (${channelId})` };
  if (!channel.isTextBased()) return { ok: false, summary: `${label}: not text-based (${channelId})` };
  return { ok: true, summary: `${label}: #${channel.name || "unknown"} (${channelId})` };
}

async function checkAdminApi() {
  try {
    const status = await adminFetch("/api/admin/content/server-status");
    return { ok: true, summary: `Admin API reachable (${status.status || "unknown"})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, summary: `Admin API error: ${truncate(msg, 160)}` };
  }
}

async function runStartupDiagnostics() {
  console.log("[diag] Starting startup diagnostics...");
  console.log(`[diag] Scheduler minutes: status=${autoStatusMinutes}, updates=${autoUpdatesMinutes}, transmissions=${autoTransmissionsMinutes}, mods=${autoModsMinutes}, activity=${autoActivityMinutes}`);
  console.log(`[diag] Role gates: allowedRoleIds=${allowedRoleIds.length}, ownerRoleIds=${ownerRoleIds.length}`);
  console.log(`[diag] Admin auth headers: x-admin-key=${apiKey ? "set" : "missing"}, basic-auth=${getAdminAuthHeader() ? "set" : "missing"}`);

  const checks = await Promise.all([
    checkAdminApi(),
    checkTextChannel(announceChannelId, "Announcement channel"),
    checkTextChannel(statusChannelId, "Status channel"),
    checkTextChannel(logChannelId, "Log channel")
  ]);

  for (const check of checks) {
    console.log(`[diag] ${check.ok ? "OK" : "WARN"} ${check.summary}`);
  }
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}

function truncate(text, max = 500) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function previewFromBody(lines) {
  if (!Array.isArray(lines)) return "";
  const combined = lines.slice(0, 3).join("\n");
  return truncate(combined, 700);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("clientReady", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  if (client.user) {
    client.user.setPresence({
      activities: [{ name: botActivity }],
      status: "online"
    });
  }
  runStartupDiagnostics().catch((err) => {
    console.error("[diag] Startup diagnostics failed", err);
  });
  startSchedulers();
});

client.on("error", (err) => {
  console.error("[discord] client error", err);
});

client.on("warn", (message) => {
  console.warn("[discord] warn", message);
});

client.on("guildMemberAdd", async (member) => {
  if (!welcomeChannelId) return;
  const channel = await client.channels.fetch(welcomeChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const msg = welcomeMessage.replace("{user}", `<@${member.id}>`);
  await channel.send(msg);
});

client.on("guildMemberRemove", async (member) => {
  if (!goodbyeChannelId) return;
  const channel = await client.channels.fetch(goodbyeChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const msg = goodbyeMessage.replace("{user}", member.user?.username || "A survivor");
  await channel.send(msg);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === "ping") {
      await interaction.reply(`Pong. ${client.ws.ping}ms`);
      return;
    }

    if (interaction.commandName === "help") {
      await interaction.reply({
        content: [
          "Grey Hour RP Bot Commands:",
          "/status, /statushistory",
          "/updates, /transmissions, /mods",
          "/rules, /join, /links, /lore",
          "/health",
          "/announce, /reminder, /activity",
          "/roll"
        ].join("\n"),
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "links") {
      const embed = new EmbedBuilder()
        .setTitle("Grey Hour RP Links")
        .setDescription("Quick links for survivors.")
        .addFields(
          { name: "Website", value: links.site, inline: false },
          { name: "Rules", value: links.rules, inline: false },
          { name: "How to Join", value: links.join, inline: false },
          { name: "Updates", value: links.updates, inline: false },
          { name: "Transmissions", value: links.transmissions, inline: false },
          { name: "Mods", value: links.mods, inline: false }
        )
        .setColor(0xb10f16);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "health") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const allowed = isAuthorizedMember(member, interaction.guild.ownerId);
      if (!allowed) {
        await interaction.reply({ content: "Unauthorized", ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const checks = await Promise.all([
        checkAdminApi(),
        checkTextChannel(announceChannelId, "Announcement channel"),
        checkTextChannel(statusChannelId, "Status channel"),
        checkTextChannel(logChannelId, "Log channel")
      ]);

      const summary = checks.map((c) => `${c.ok ? "✅" : "❌"} ${c.summary}`).join("\n");
      const healthy = checks.every((c) => c.ok);

      const embed = new EmbedBuilder()
        .setTitle("Bot Health")
        .setDescription(summary)
        .addFields(
          { name: "Gateway Ping", value: `${client.ws.ping}ms`, inline: true },
          { name: "Uptime", value: formatUptime(process.uptime()), inline: true },
          { name: "Schedulers", value: `S:${autoStatusMinutes} U:${autoUpdatesMinutes} T:${autoTransmissionsMinutes} M:${autoModsMinutes} A:${autoActivityMinutes}`, inline: false }
        )
        .setColor(healthy ? 0x22c55e : 0xef4444)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "lore") {
      const embed = new EmbedBuilder()
        .setTitle("The Grey Hour")
        .setDescription(truncate(loreSnippet, 900))
        .addFields({ name: "Read More", value: `${links.site}/about`, inline: false })
        .setColor(0x111827);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "status") {
      const status = await adminFetch("/api/admin/content/server-status");
      const embed = new EmbedBuilder()
        .setTitle("Grey Hour RP Status")
        .setDescription(status.message || "No status published")
        .addFields(
          { name: "State", value: status.status || "unknown", inline: true },
          { name: "Updated", value: status.updatedUtc ? new Date(status.updatedUtc).toUTCString() : "Unknown", inline: true }
        )
        .setColor(status.status === "online" ? 0x4ade80 : status.status === "maintenance" ? 0xfacc15 : 0xf87171);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "statushistory") {
      const history = await adminFetch("/api/admin/content/status-history");
      const recent = history.slice(0, 3);
      if (!recent.length) {
        await interaction.reply("No status history posted yet.");
        return;
      }
      const lines = recent.map(item => {
        const stamp = item.dateUtc ? new Date(item.dateUtc).toUTCString() : "Unknown";
        return `${stamp} • ${item.status}${item.message ? ` • ${item.message}` : ""}`;
      });
      const embed = new EmbedBuilder()
        .setTitle("Status History")
        .setDescription(truncate(lines.join("\n"), 900))
        .setColor(0x9ca3af);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "updates") {
      const updates = await adminFetch("/api/admin/content/updates");
      const latest = updates[0];
      if (!latest) {
        await interaction.reply("No updates posted yet.");
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle(latest.title)
        .setDescription(previewFromBody(latest.body))
        .addFields(
          { name: "Date", value: latest.date || "Unknown", inline: true },
          { name: "Read More", value: links.updates, inline: true }
        )
        .setColor(0xb10f16);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "transmissions") {
      const items = await adminFetch("/api/admin/content/transmissions");
      const latest = items[0];
      if (!latest) {
        await interaction.reply("No transmissions posted yet.");
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle(latest.title)
        .setDescription(previewFromBody(latest.body))
        .addFields(
          { name: "Date", value: latest.date || "Unknown", inline: true },
          { name: "Category", value: (latest.category || "World"), inline: true },
          { name: "Read More", value: links.transmissions, inline: true }
        )
        .setColor(0xb10f16);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "mods") {
      const mods = await adminFetch("/api/admin/content/mods");
      const list = mods.slice(0, 10).map(m => `• ${m.name}`).join("\n");
      const embed = new EmbedBuilder()
        .setTitle("Modpack Overview")
        .setDescription(list || "No mods listed yet.")
        .addFields(
          { name: "Total Mods", value: String(mods.length), inline: true },
          { name: "Full List", value: links.mods, inline: true }
        )
        .setColor(0xb10f16);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "rules") {
      await interaction.reply(`Rules: ${links.rules}`);
      return;
    }

    if (interaction.commandName === "join") {
      await interaction.reply(`Join guide: ${links.join}`);
      return;
    }

    if (interaction.commandName === "announce") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const allowed = isAuthorizedMember(member, interaction.guild.ownerId);
      if (!allowed) {
        await interaction.reply({ content: "Unauthorized", ephemeral: true });
        return;
      }

      if (!announceChannelId) {
        await interaction.reply({ content: "ANNOUNCE_CHANNEL_ID is not configured.", ephemeral: true });
        return;
      }

      const message = interaction.options.getString("message", true);
      const everyone = interaction.options.getBoolean("everyone") || false;
      const channel = await client.channels.fetch(announceChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: "Announcement channel not configured", ephemeral: true });
        return;
      }
      await channel.send(everyone ? `@everyone\n${message}` : message);
      await interaction.reply({ content: "Announcement sent.", ephemeral: true });
      return;
    }

    if (interaction.commandName === "reminder") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const allowed = isAuthorizedMember(member, interaction.guild.ownerId);
      if (!allowed) {
        await interaction.reply({ content: "Unauthorized", ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const reminders = loadReminders();

      if (sub === "add") {
        const minutes = interaction.options.getInteger("minutes", true);
        if (minutes < 1 || minutes > 10080) {
          await interaction.reply({ content: "Minutes must be between 1 and 10080.", ephemeral: true });
          return;
        }
        const message = interaction.options.getString("message", true);
        const due = Date.now() + minutes * 60000;
        const id = `rem-${Date.now()}`;
        reminders.push({ id, due, message, channelId: announceChannelId });
        saveReminders(reminders);
        await interaction.reply({ content: `Reminder scheduled (${id}) in ${minutes} minutes.`, ephemeral: true });
      }

      if (sub === "list") {
        if (!reminders.length) {
          await interaction.reply({ content: "No reminders scheduled.", ephemeral: true });
          return;
        }
        const list = reminders
          .map(r => `${r.id} • ${new Date(r.due).toLocaleString()} • ${r.message}`)
          .slice(0, 10)
          .join("\n");
        await interaction.reply({ content: list, ephemeral: true });
      }

      if (sub === "remove") {
        const id = interaction.options.getString("id", true);
        const next = reminders.filter(r => r.id !== id);
        saveReminders(next);
        await interaction.reply({ content: `Reminder removed: ${id}`, ephemeral: true });
      }
      return;
    }

    if (interaction.commandName === "roll") {
      const sides = Math.min(Math.max(interaction.options.getInteger("sides") || 6, 2), 100);
      const count = Math.min(Math.max(interaction.options.getInteger("count") || 1, 1), 10);
      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      const total = rolls.reduce((sum, val) => sum + val, 0);
      await interaction.reply(`Rolled ${count}d${sides}: ${rolls.join(", ")} (Total ${total})`);
      return;
    }

    if (interaction.commandName === "activity") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
        return;
      }

      const member = await interaction.guild.members.fetch(interaction.user.id);
      const allowed = isAuthorizedMember(member, interaction.guild.ownerId);
      if (!allowed) {
        await interaction.reply({ content: "Unauthorized", ephemeral: true });
        return;
      }

      const activity = await adminFetch("/api/admin/activity?limit=5");
      if (!activity.length) {
        await interaction.reply({ content: "No activity yet.", ephemeral: true });
        return;
      }
      const lines = activity.map(item => `${item.timeUtc || ""} • ${item.action} • ${item.target} • ${item.user}`);
      await interaction.reply({ content: truncate(lines.join("\n"), 1800), ephemeral: true });
      return;
    }
  } catch (err) {
    console.error(err);
    if (!interaction.replied) {
      await interaction.reply({ content: "Error processing command.", ephemeral: true });
    }
  }
});

async function postStatusUpdate() {
  if (!statusChannelId) return;
  const status = await adminFetch("/api/admin/content/server-status");
  const state = loadState();
  const hash = `${status.status}-${status.message}-${status.updatedUtc}`;
  if (state.lastStatus === hash) return;

  const channel = await client.channels.fetch(statusChannelId);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle("Server Status")
    .setDescription(status.message || "No status published")
    .addFields({ name: "State", value: status.status || "unknown", inline: true })
    .setColor(status.status === "online" ? 0x4ade80 : status.status === "maintenance" ? 0xfacc15 : 0xf87171);

  const needsAlert = status.status === "offline" || status.status === "maintenance";
  await channel.send({ content: needsAlert && statusAlertMention ? statusAlertMention : undefined, embeds: [embed] });
  state.lastStatus = hash;
  saveState(state);
}

async function postLatestUpdate() {
  if (!announceChannelId) return;
  const updates = await adminFetch("/api/admin/content/updates");
  if (!updates.length) return;
  const latest = updates[0];
  const state = loadState();
  if (state.lastUpdateId === latest.id) return;

  const channel = await client.channels.fetch(announceChannelId);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(`Update: ${latest.title}`)
    .setDescription(previewFromBody(latest.body))
    .addFields(
      { name: "Date", value: latest.date || "Unknown", inline: true },
      { name: "Full Update", value: links.updates, inline: true }
    )
    .setColor(0xb10f16);

  await channel.send({ embeds: [embed] });
  state.lastUpdateId = latest.id;
  saveState(state);
}

async function postLatestTransmission() {
  if (!announceChannelId) return;
  const items = await adminFetch("/api/admin/content/transmissions");
  if (!items.length) return;
  const latest = items[0];
  const state = loadState();
  if (state.lastTransmissionId === latest.id) return;

  const channel = await client.channels.fetch(announceChannelId);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle(`Transmission: ${latest.title}`)
    .setDescription(previewFromBody(latest.body))
    .addFields(
      { name: "Date", value: latest.date || "Unknown", inline: true },
      { name: "Full Transmission", value: links.transmissions, inline: true }
    )
    .setColor(0xb10f16);

  await channel.send({ embeds: [embed] });
  state.lastTransmissionId = latest.id;
  saveState(state);
}

async function postModsChange() {
  if (!announceChannelId) return;
  const mods = await adminFetch("/api/admin/content/mods");
  const state = loadState();
  const hash = hashString(JSON.stringify(mods));
  if (state.lastModsHash === hash) return;

  const channel = await client.channels.fetch(announceChannelId);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle("Modpack Updated")
    .setDescription("The Grey Hour modpack has changed. Check the website for details.")
    .addFields(
      { name: "Mods", value: String(mods.length), inline: true },
      { name: "Full List", value: links.mods, inline: true }
    )
    .setColor(0xb10f16);

  await channel.send({ embeds: [embed] });
  state.lastModsHash = hash;
  saveState(state);
}

async function postActivityLog() {
  if (!logChannelId) return;
  const activity = await adminFetch("/api/admin/activity?limit=20");
  const state = loadState();
  const lastSeen = state.lastActivityTime || 0;

  const items = activity.filter(a => new Date(a.timeUtc || 0).getTime() > lastSeen);
  if (!items.length) return;

  const channel = await client.channels.fetch(logChannelId);
  if (!channel || !channel.isTextBased()) return;

  for (const item of items.reverse()) {
    const embed = new EmbedBuilder()
      .setTitle("Admin Activity")
      .setDescription(`${item.action} • ${item.target}`)
      .addFields({ name: "User", value: `${item.user} (${item.role})`, inline: true })
      .setColor(0x9ca3af);
    await channel.send({ embeds: [embed] });
  }

  const newest = items[items.length - 1];
  state.lastActivityTime = new Date(newest.timeUtc || Date.now()).getTime();
  saveState(state);
}

async function runReminders() {
  const reminders = loadReminders();
  if (!reminders.length) return;
  const now = Date.now();
  const due = reminders.filter(r => r.due <= now);
  if (!due.length) return;

  for (const r of due) {
    const channel = await client.channels.fetch(r.channelId || announceChannelId);
    if (channel && channel.isTextBased()) {
      await channel.send(r.message);
    }
  }
  const remaining = reminders.filter(r => r.due > now);
  saveReminders(remaining);
}

async function runDailyReminder() {
  if (!dailyReminderTime || !dailyReminderMessage || !dailyReminderChannelId) return;
  const state = loadState();
  const now = new Date();
  const [hh, mm] = dailyReminderTime.split(":").map(n => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return;

  const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  if (state.lastDailyReminder === stamp) return;

  if (now.getHours() === hh && now.getMinutes() === mm) {
    const channel = await client.channels.fetch(dailyReminderChannelId);
    if (channel && channel.isTextBased()) {
      await channel.send(dailyReminderMessage);
      state.lastDailyReminder = stamp;
      saveState(state);
    }
  }
}

function startSchedulers() {
  postStatusUpdate().catch(() => {});
  postLatestUpdate().catch(() => {});
  postLatestTransmission().catch(() => {});
  postModsChange().catch(() => {});
  postActivityLog().catch(() => {});

  setInterval(() => postStatusUpdate().catch(() => {}), intervalMs(autoStatusMinutes));
  setInterval(() => postLatestUpdate().catch(() => {}), intervalMs(autoUpdatesMinutes));
  setInterval(() => postLatestTransmission().catch(() => {}), intervalMs(autoTransmissionsMinutes));
  setInterval(() => postModsChange().catch(() => {}), intervalMs(autoModsMinutes));
  setInterval(() => postActivityLog().catch(() => {}), intervalMs(autoActivityMinutes));
  setInterval(() => runReminders().catch(() => {}), 60 * 1000);
  setInterval(() => runDailyReminder().catch(() => {}), 60 * 1000);
}

client.login(token);
