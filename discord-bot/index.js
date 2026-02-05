import "dotenv/config";
import fs from "fs";
import http from "http";
import path from "path";
import { randomUUID } from "crypto";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, GatewayIntentBits } from "discord.js";
import { canAccessCommand, normalizePolicy } from "./lib/policy.js";
import { sha256, verifyBackupPayload as verifyBackupPayloadCore } from "./lib/backup.js";

const token = process.env.DISCORD_TOKEN;
const apiBase = process.env.ADMIN_API_BASE || "";
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
const statusMentionOnline = process.env.STATUS_MENTION_ONLINE || "";
const statusMentionMaintenance = process.env.STATUS_MENTION_MAINTENANCE || "";
const statusMentionOffline = process.env.STATUS_MENTION_OFFLINE || "";
const dailyReminderTime = process.env.DAILY_REMINDER_TIME || ""; // HH:MM
const dailyReminderMessage = process.env.DAILY_REMINDER_MESSAGE || "";
const dailyReminderChannelId = process.env.DAILY_REMINDER_CHANNEL_ID || "";
const dailySummaryTime = process.env.DAILY_SUMMARY_TIME || ""; // HH:MM
const dailySummaryChannelId = process.env.DAILY_SUMMARY_CHANNEL_ID || "";
const serverIp = process.env.SERVER_IP || "";
const playerCountApi = process.env.PLAYER_COUNT_API || "";
const playerCountLabel = process.env.PLAYER_COUNT_LABEL || "Players Online";
const ticketChannelId = process.env.TICKET_CHANNEL_ID || "";
const ticketSupportRoleId = process.env.TICKET_SUPPORT_ROLE_ID || "";
const restartAlertRoleId = process.env.RESTART_ALERT_ROLE_ID || "";
const wipeAlertRoleId = process.env.WIPE_ALERT_ROLE_ID || "";
const raidsAlertRoleId = process.env.RAIDS_ALERT_ROLE_ID || "";
const tradeAlertRoleId = process.env.TRADE_ALERT_ROLE_ID || "";
const modCallChannelId = process.env.MODCALL_CHANNEL_ID || "";
const modCallRoleId = process.env.MODCALL_ROLE_ID || "";
const seniorModRoleId = process.env.SENIOR_MOD_ROLE_ID || "";
const trustedRoleIds = (process.env.TRUSTED_ROLE_IDS || "").split(",").map((r) => r.trim()).filter(Boolean);
const modCallCooldownSeconds = Number(process.env.MODCALL_COOLDOWN_SECONDS || 120);
const modCallEscalateMinutes = Number(process.env.MODCALL_ESCALATE_MINUTES || 5);
const modCallEscalateRepeatMinutes = Number(process.env.MODCALL_ESCALATE_REPEAT_MINUTES || 10);
const modCallDigestHourUtc = Number(process.env.MODCALL_DIGEST_HOUR_UTC || 13);
const modCallDigestWeekdayUtc = Number(process.env.MODCALL_DIGEST_WEEKDAY_UTC || 1);
const raidModeMaxMentions = Number(process.env.RAID_MODE_MAX_MENTIONS || 5);
const raidModeMinAccountDays = Number(process.env.RAID_MODE_MIN_ACCOUNT_DAYS || 7);
const allowedRoleIds = (process.env.ALLOWED_ROLE_IDS || "").split(",").map(r => r.trim()).filter(Boolean);
const ownerRoleIds = (process.env.OWNER_ROLE_IDS || "").split(",").map(r => r.trim()).filter(Boolean);
const autoStatusMinutes = parsePositiveMinutes(process.env.AUTO_STATUS_MINUTES, 10, "AUTO_STATUS_MINUTES");
const autoActivityMinutes = parsePositiveMinutes(process.env.AUTO_ACTIVITY_MINUTES, 10, "AUTO_ACTIVITY_MINUTES");
const autoUpdatesMinutes = parsePositiveMinutes(process.env.AUTO_UPDATES_MINUTES, 30, "AUTO_UPDATES_MINUTES");
const autoTransmissionsMinutes = parsePositiveMinutes(process.env.AUTO_TRANSMISSIONS_MINUTES, 30, "AUTO_TRANSMISSIONS_MINUTES");
const autoModsMinutes = parsePositiveMinutes(process.env.AUTO_MODS_MINUTES, 60, "AUTO_MODS_MINUTES");
const siteUrl = process.env.SITE_URL || apiBase || "https://greyhourrp.xyz";
const botActivity = process.env.BOT_ACTIVITY_TEXT || "Grey Hour RP | /help";
const deployTag = process.env.BOT_DEPLOY_TAG || process.env.RELEASE_VERSION || "dev";
const loreSnippet = process.env.LORE_SNIPPET ||
  "Day One did not end with screams or firestorms. It ended with silence. The Grey Hour is the moment the world balanced between what it was and what it would become.";
const stagingMode = /^(1|true|yes)$/i.test(process.env.STAGING_MODE || "");
const dryRunMode = /^(1|true|yes)$/i.test(process.env.DRY_RUN_MODE || "");
const metricsPort = Number(process.env.METRICS_PORT || 0);
const metricsHost = process.env.METRICS_HOST || "127.0.0.1";
const abuseWindowSeconds = Number(process.env.ABUSE_WINDOW_SECONDS || 30);
const abuseUserMax = Number(process.env.ABUSE_USER_MAX_COMMANDS || 12);
const abuseChannelMax = Number(process.env.ABUSE_CHANNEL_MAX_COMMANDS || 40);
const backupRetentionDaily = Number(process.env.BACKUP_RETENTION_DAILY || 14);
const backupRetentionWeekly = Number(process.env.BACKUP_RETENTION_WEEKLY || 8);
const jobWorkerIntervalSeconds = Number(process.env.JOB_WORKER_INTERVAL_SECONDS || 5);
const permissionPolicyFile = process.env.PERMISSION_POLICY_FILE || path.join(process.cwd(), "config", "permissions-policy.json");
const alertChannelId = process.env.ALERT_CHANNEL_ID || logChannelId || announceChannelId;
const queueBacklogAlertThreshold = Number(process.env.QUEUE_BACKLOG_ALERT_THRESHOLD || 50);
const commandErrorRateThreshold = Number(process.env.COMMAND_ERROR_RATE_THRESHOLD || 0.25);
const smokeStatusMaxAgeMinutes = Number(process.env.SMOKE_STATUS_MAX_AGE_MINUTES || 30);
const auditRetentionDays = Number(process.env.AUDIT_RETENTION_DAYS || 30);
const incidentRetentionDays = Number(process.env.INCIDENT_RETENTION_DAYS || 180);

function validateStartupConfig() {
  const errors = [];
  const warnings = [];

  if (!token) errors.push("DISCORD_TOKEN is required.");
  if (!apiBase) errors.push("ADMIN_API_BASE is required.");
  if (metricsPort && (!Number.isInteger(metricsPort) || metricsPort < 1 || metricsPort > 65535)) {
    errors.push("METRICS_PORT must be an integer from 1 to 65535.");
  }
  const hhmmRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (dailyReminderTime && !hhmmRegex.test(dailyReminderTime)) errors.push("DAILY_REMINDER_TIME must match HH:MM.");
  if (dailySummaryTime && !hhmmRegex.test(dailySummaryTime)) errors.push("DAILY_SUMMARY_TIME must match HH:MM.");
  if (abuseWindowSeconds < 1) errors.push("ABUSE_WINDOW_SECONDS must be >= 1.");
  if (abuseUserMax < 1) errors.push("ABUSE_USER_MAX_COMMANDS must be >= 1.");
  if (abuseChannelMax < 1) errors.push("ABUSE_CHANNEL_MAX_COMMANDS must be >= 1.");
  if (jobWorkerIntervalSeconds < 1) errors.push("JOB_WORKER_INTERVAL_SECONDS must be >= 1.");
  if (backupRetentionDaily < 1) errors.push("BACKUP_RETENTION_DAILY must be >= 1.");
  if (backupRetentionWeekly < 1) errors.push("BACKUP_RETENTION_WEEKLY must be >= 1.");
  if (queueBacklogAlertThreshold < 1) errors.push("QUEUE_BACKLOG_ALERT_THRESHOLD must be >= 1.");
  if (commandErrorRateThreshold <= 0 || commandErrorRateThreshold >= 1) errors.push("COMMAND_ERROR_RATE_THRESHOLD must be between 0 and 1.");
  if (smokeStatusMaxAgeMinutes < 1) errors.push("SMOKE_STATUS_MAX_AGE_MINUTES must be >= 1.");
  if (auditRetentionDays < 1) errors.push("AUDIT_RETENTION_DAYS must be >= 1.");
  if (incidentRetentionDays < 1) errors.push("INCIDENT_RETENTION_DAYS must be >= 1.");
  if (modCallCooldownSeconds < 1) errors.push("MODCALL_COOLDOWN_SECONDS must be >= 1.");
  if (modCallEscalateMinutes < 1) errors.push("MODCALL_ESCALATE_MINUTES must be >= 1.");
  if (modCallEscalateRepeatMinutes < 1) errors.push("MODCALL_ESCALATE_REPEAT_MINUTES must be >= 1.");
  if (modCallDigestHourUtc < 0 || modCallDigestHourUtc > 23) errors.push("MODCALL_DIGEST_HOUR_UTC must be 0-23.");
  if (modCallDigestWeekdayUtc < 0 || modCallDigestWeekdayUtc > 6) errors.push("MODCALL_DIGEST_WEEKDAY_UTC must be 0-6.");

  if (!announceChannelId) warnings.push("ANNOUNCE_CHANNEL_ID is not configured; announcement features will be limited.");
  if (!statusChannelId) warnings.push("STATUS_CHANNEL_ID is not configured; status autoposting is disabled.");
  if (!logChannelId) warnings.push("LOG_CHANNEL_ID is not configured; activity feed is disabled.");
  if (!modCallRoleId) warnings.push("MODCALL_ROLE_ID is not configured; mod call pings will be limited.");
  if (!modCallChannelId) warnings.push("MODCALL_CHANNEL_ID is not configured; modcall setup defaults to current channel.");
  if (!alertChannelId) warnings.push("ALERT_CHANNEL_ID/LOG_CHANNEL_ID/ANNOUNCE_CHANNEL_ID not configured; failure alerting disabled.");
  if (!fs.existsSync(permissionPolicyFile)) warnings.push(`PERMISSION_POLICY_FILE not found at ${permissionPolicyFile}; default open policy will apply.`);
  if (stagingMode) warnings.push("STAGING_MODE is enabled; outbound channel posts are suppressed.");
  if (dryRunMode) warnings.push("DRY_RUN_MODE is enabled; no outbound channel posts will be sent.");

  return { errors, warnings };
}

const startupValidation = validateStartupConfig();
for (const warning of startupValidation.warnings) {
  console.warn(`[config] WARN ${warning}`);
}
if (startupValidation.errors.length) {
  for (const error of startupValidation.errors) {
    console.error(`[config] ERROR ${error}`);
  }
  process.exit(1);
}

const stateDir = path.join(process.cwd(), "data");
const stateFile = path.join(stateDir, "state.json");
const remindersFile = path.join(stateDir, "reminders.json");
const eventsFile = path.join(stateDir, "events.json");
const communityFile = path.join(stateDir, "community.json");
const incidentsFile = path.join(stateDir, "incidents.json");
const modCallsFile = path.join(stateDir, "modcalls.json");
const auditLogFile = path.join(stateDir, "audit.log.jsonl");
const jobsFile = path.join(stateDir, "jobs.json");
const smokeStatusFile = path.join(stateDir, "smoke-status.json");
const backupsDir = path.join(stateDir, "backups");

const metrics = {
  startedAt: Date.now(),
  commandsTotal: 0,
  commandErrors: 0,
  apiCalls: 0,
  apiErrors: 0,
  schedulerRuns: 0,
  schedulerErrors: 0,
  byCommand: {},
  queueEnqueued: 0,
  queueProcessed: 0,
  queueFailed: 0,
  abuseBlocked: 0,
  logsWritten: 0,
  modCallsCreated: 0,
  modCallsClaimed: 0,
  modCallsClosed: 0
};
const commandCooldowns = new Map();
const abuseUserWindow = new Map();
const abuseChannelWindow = new Map();
let jobWorkerRunning = false;
let metricsServer = null;
let commandWindowTotal = 0;
let commandWindowErrors = 0;
const cooldownMs = {
  default: 3000,
  roll: 4000,
  survivor: 6000,
  lfg: 5000,
  trade: 5000
};
const dataFiles = {
  state: stateFile,
  reminders: remindersFile,
  events: eventsFile,
  community: communityFile,
  incidents: incidentsFile,
  modcalls: modCallsFile,
  audit: auditLogFile
};

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

function loadEvents() {
  try {
    if (!fs.existsSync(eventsFile)) return [];
    return JSON.parse(fs.readFileSync(eventsFile, "utf-8"));
  } catch {
    return [];
  }
}

function saveEvents(list) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(eventsFile, JSON.stringify(list, null, 2));
  } catch {}
}

function defaultCommunity() {
  return {
    lfg: [],
    factions: {},
    trades: [],
    contests: [],
    markers: [],
    safehouses: [],
    raids: [],
    signups: {},
    reputation: {},
    squadVcs: [],
    raidMode: false,
    commends: []
  };
}

function loadIncidents() {
  try {
    if (!fs.existsSync(incidentsFile)) return [];
    return JSON.parse(fs.readFileSync(incidentsFile, "utf-8"));
  } catch {
    return [];
  }
}

function saveIncidents(list) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(incidentsFile, JSON.stringify(list, null, 2));
  } catch {}
}

function defaultModCallsState() {
  return {
    cases: [],
    shifts: {},
    stats: {
      created: 0,
      claimed: 0,
      closed: 0,
      escalated: 0,
      falseReports: 0
    }
  };
}

function loadModCallsState() {
  try {
    if (!fs.existsSync(modCallsFile)) return defaultModCallsState();
    const parsed = JSON.parse(fs.readFileSync(modCallsFile, "utf-8"));
    return {
      ...defaultModCallsState(),
      ...parsed,
      cases: Array.isArray(parsed?.cases) ? parsed.cases : [],
      shifts: parsed?.shifts && typeof parsed.shifts === "object" ? parsed.shifts : {},
      stats: parsed?.stats && typeof parsed.stats === "object" ? { ...defaultModCallsState().stats, ...parsed.stats } : defaultModCallsState().stats
    };
  } catch {
    return defaultModCallsState();
  }
}

function saveModCallsState(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(modCallsFile, JSON.stringify(data, null, 2));
  } catch {}
}

function getOpenModCaseById(data, id) {
  return data.cases.find((x) => x.id === id && x.status !== "closed" && x.status !== "cancelled");
}

function hasTrustedRole(member) {
  if (!member) return false;
  if (!trustedRoleIds.length) return false;
  return member.roles.cache.some((r) => trustedRoleIds.includes(r.id));
}

function addCaseHistoryRow(row, action, actorId, note = "") {
  row.history = ensureArray(row.history);
  row.history.push({
    at: new Date().toISOString(),
    action,
    actorId: actorId || "",
    note: truncate(note, 600)
  });
}

function buildModCallSummaryRow(row) {
  const ageMin = Math.max(0, Math.floor((Date.now() - new Date(row.createdAt || 0).getTime()) / 60000));
  return `\`${row.id}\` • ${row.priority || "normal"} • ${row.status} • reporter:<@${row.reporterId}>${row.targetUserId ? ` • target:<@${row.targetUserId}>` : ""} • age:${ageMin}m${row.claimedBy ? ` • claimed:<@${row.claimedBy}>` : ""}`;
}

function shouldThrottleModCall(data, reporterId, sourceChannelId) {
  const now = Date.now();
  const recentFromReporter = data.cases.find((x) =>
    x.reporterId === reporterId &&
    (now - new Date(x.createdAt || 0).getTime()) < modCallCooldownSeconds * 1000 &&
    x.status !== "closed" &&
    x.status !== "cancelled");
  if (recentFromReporter) return { blocked: true, reason: `cooldown (${modCallCooldownSeconds}s)` };

  const duplicate = data.cases.find((x) =>
    x.reporterId === reporterId &&
    x.sourceChannelId === sourceChannelId &&
    (now - new Date(x.createdAt || 0).getTime()) < 5 * 60 * 1000 &&
    x.status !== "closed" &&
    x.status !== "cancelled");
  if (duplicate) return { blocked: true, reason: `duplicate open case ${duplicate.id}`, existing: duplicate };
  return { blocked: false };
}

function isModOnShift(data, userId) {
  const row = data.shifts?.[userId];
  return Boolean(row && row.on === true);
}

function nextEscalationAt(row) {
  const createdAt = new Date(row.createdAt || 0).getTime();
  if (!row.lastEscalatedAt) return createdAt + modCallEscalateMinutes * 60 * 1000;
  return new Date(row.lastEscalatedAt).getTime() + modCallEscalateRepeatMinutes * 60 * 1000;
}

async function postModCaseContext(thread, row) {
  if (!thread || !thread.isTextBased()) return;
  const guild = thread.guild;
  if (!guild) return;

  const reporter = await guild.members.fetch(row.reporterId).catch(() => null);
  const target = row.targetUserId ? await guild.members.fetch(row.targetUserId).catch(() => null) : null;
  const sourceChannel = row.sourceChannelId ? await guild.channels.fetch(row.sourceChannelId).catch(() => null) : null;
  const incidents = loadIncidents().filter((x) => x.userId === row.reporterId || (row.targetUserId && x.userId === row.targetUserId)).slice(0, 5);

  const lines = [
    `Case: \`${row.id}\``,
    `Reporter: <@${row.reporterId}> (${reporter?.user?.tag || "unknown"})`,
    `Reporter Account Age: ${reporter?.user?.createdAt ? Math.floor((Date.now() - reporter.user.createdAt.getTime()) / (24 * 60 * 60 * 1000)) : "unknown"} days`,
    `Reporter Roles: ${reporter ? reporter.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.name).slice(0, 8).join(", ") || "none" : "unknown"}`,
    `Target: ${row.targetUserId ? `<@${row.targetUserId}> (${target?.user?.tag || "unknown"})` : "none"}`,
    `Source Channel: ${sourceChannel ? `<#${sourceChannel.id}>` : "unknown"}`,
    `Priority: ${row.priority}`,
    `Category: ${row.category || "general"}`,
    incidents.length ? `Recent Incidents:\n${incidents.map((x) => `- ${x.id} ${x.severity} ${x.status}: ${truncate(x.reason, 120)}`).join("\n")}` : "Recent Incidents: none"
  ];
  await sendMessageWithGuards(thread, { content: lines.join("\n") }, "modcall.context");

  if (sourceChannel && sourceChannel.isTextBased()) {
    const recent = await sourceChannel.messages.fetch({ limit: 10 }).catch(() => null);
    if (recent && recent.size) {
      const context = recent
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map((m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author?.tag || "unknown"}: ${truncate(m.content || "(attachment)", 160)}`)
        .join("\n");
      await sendMessageWithGuards(thread, { content: `Recent Channel Context:\n${truncate(context, 1900)}` }, "modcall.context");
    }
  }
}

async function notifyReporterUpdate(clientRef, row, message) {
  if (!row?.reporterId) return;
  const reporter = await clientRef.users.fetch(row.reporterId).catch(() => null);
  if (!reporter) return;
  await reporter.send(`Case \`${row.id}\`: ${truncate(message, 1500)}`).catch(() => {});
}

function addIncident(record) {
  const incidents = loadIncidents();
  incidents.unshift({
    id: makeId("inc"),
    status: "open",
    createdAt: new Date().toISOString(),
    ...record
  });
  saveIncidents(incidents);
}

function loadCommunity() {
  try {
    if (!fs.existsSync(communityFile)) return defaultCommunity();
    const parsed = JSON.parse(fs.readFileSync(communityFile, "utf-8"));
    return { ...defaultCommunity(), ...parsed };
  } catch {
    return defaultCommunity();
  }
}

function saveCommunity(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(communityFile, JSON.stringify(data, null, 2));
  } catch {}
}

function makeRequestId() {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

function logEvent(level, event, fields = {}) {
  metrics.logsWritten += 1;
  const record = {
    timeUtc: new Date().toISOString(),
    level,
    event,
    ...fields
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function loadJobs() {
  return readJsonFile(jobsFile, []);
}

function saveJobs(jobs) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(jobsFile, JSON.stringify(jobs, null, 2));
  } catch {}
}

function normalizeEmbeds(embeds) {
  if (!Array.isArray(embeds)) return [];
  return embeds.map((item) => {
    if (!item) return null;
    if (typeof item.toJSON === "function") return item.toJSON();
    return item;
  }).filter(Boolean);
}

function enqueueJob(job) {
  const jobs = loadJobs();
  if (job.idempotencyKey) {
    const existing = jobs.find((x) => x.idempotencyKey === job.idempotencyKey && x.status !== "failed");
    if (existing) return existing;
  }
  const row = {
    id: makeId("job"),
    type: job.type || "message",
    idempotencyKey: job.idempotencyKey || "",
    channelId: job.channelId || "",
    content: job.content || "",
    embeds: normalizeEmbeds(job.embeds),
    runAt: job.runAt || Date.now(),
    retries: 0,
    maxRetries: Math.max(0, Number(job.maxRetries ?? 5)),
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastError: ""
  };
  jobs.push(row);
  saveJobs(jobs);
  metrics.queueEnqueued += 1;
  return row;
}

function hitWindow(map, key, windowMs) {
  const now = Date.now();
  const prev = map.get(key) || [];
  const next = prev.filter((t) => now - t < windowMs);
  next.push(now);
  map.set(key, next);
  return next.length;
}

function cleanupAbuseWindows() {
  const windowMs = abuseWindowSeconds * 1000;
  const now = Date.now();
  for (const [k, arr] of abuseUserWindow.entries()) {
    const next = arr.filter((t) => now - t < windowMs);
    if (!next.length) abuseUserWindow.delete(k);
    else abuseUserWindow.set(k, next);
  }
  for (const [k, arr] of abuseChannelWindow.entries()) {
    const next = arr.filter((t) => now - t < windowMs);
    if (!next.length) abuseChannelWindow.delete(k);
    else abuseChannelWindow.set(k, next);
  }
}

function isAbuseBlocked(interaction) {
  const windowMs = abuseWindowSeconds * 1000;
  const userCount = hitWindow(abuseUserWindow, interaction.user.id, windowMs);
  const channelKey = interaction.channelId || "dm";
  const channelCount = hitWindow(abuseChannelWindow, channelKey, windowMs);
  if (userCount > abuseUserMax || channelCount > abuseChannelMax) {
    metrics.abuseBlocked += 1;
    return { blocked: true, userCount, channelCount };
  }
  return { blocked: false };
}

function loadPermissionPolicy() {
  const fallback = { allowUserIds: [], denyUserIds: [], commandRoleIds: {} };
  return normalizePolicy(readJsonFile(permissionPolicyFile, fallback));
}

function hasPolicyAccess(member, commandName) {
  const roleIds = member.roles.cache.map((r) => r.id);
  return canAccessCommand(loadPermissionPolicy(), member.id, roleIds, commandName);
}

function loadSmokeStatus() {
  return readJsonFile(smokeStatusFile, {});
}

function loadMaintenanceState() {
  const state = loadState();
  return {
    enabled: Boolean(state.maintenanceModeEnabled),
    message: state.maintenanceModeMessage || "Server maintenance in progress. Please try again soon.",
    announcedAt: state.maintenanceModeAnnouncedAt || ""
  };
}

function setMaintenanceState(enabled, message, actorId = "") {
  const state = loadState();
  state.maintenanceModeEnabled = Boolean(enabled);
  state.maintenanceModeMessage = message || "Server maintenance in progress. Please try again soon.";
  state.maintenanceModeUpdatedAt = new Date().toISOString();
  state.maintenanceModeUpdatedBy = actorId;
  if (!enabled) {
    state.maintenanceModeAnnouncedAt = "";
  }
  saveState(state);
}

function shouldBypassMaintenance(commandName) {
  return ["ping", "help", "status"].includes(commandName);
}

async function postMaintenanceBanner(reqId = "") {
  if (!announceChannelId) return false;
  const state = loadState();
  if (state.maintenanceModeAnnouncedAt) return false;
  const channel = await client.channels.fetch(announceChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return false;
  const maintenance = loadMaintenanceState();
  const sent = await sendMessageWithGuards(channel, {
    content: `🛠️ **Maintenance Mode Enabled**\n${maintenance.message}`
  }, "maintenance.banner", reqId);
  if (sent) {
    state.maintenanceModeAnnouncedAt = new Date().toISOString();
    saveState(state);
  }
  return Boolean(sent);
}

async function sendOpsAlert(kind, message, reqId = "") {
  if (!alertChannelId) return;
  const state = loadState();
  const key = `alertDedup:${kind}`;
  const now = Date.now();
  const last = Number(state[key] || 0);
  if (now - last < 15 * 60 * 1000) return;
  state[key] = now;
  saveState(state);

  enqueueJob({
    type: "ops-alert",
    channelId: alertChannelId,
    idempotencyKey: `ops-alert:${kind}:${Math.floor(now / (15 * 60 * 1000))}`,
    content: `⚠️ **Ops Alert**: ${message}`,
    maxRetries: 8
  });
  logEvent("warn", "ops.alert.enqueued", { reqId, kind, message: truncate(message, 220) });
}

function buildGuildInventory(guild) {
  const channels = guild.channels.cache.map((c) => ({
    id: c.id,
    name: c.name,
    type: String(c.type),
    parentId: c.parentId || "",
    position: c.position || 0
  }));
  const roles = guild.roles.cache
    .filter((r) => r.id !== guild.id)
    .map((r) => ({ id: r.id, name: r.name, position: r.position, color: r.hexColor }));
  const members = guild.members.cache.map((m) => ({
    id: m.id,
    tag: m.user.tag,
    displayName: m.displayName,
    bot: m.user.bot,
    roles: m.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.id)
  }));

  return {
    generatedAt: new Date().toISOString(),
    guild: {
      id: guild.id,
      name: guild.name,
      memberCount: guild.memberCount,
      channels: channels.length,
      roles: roles.length
    },
    channels,
    roles,
    members
  };
}

async function sendMessageWithGuards(channel, payload, context, reqId = "") {
  if (!channel || !channel.isTextBased()) return null;
  if (stagingMode || dryRunMode) {
    logEvent("info", "dispatch.skipped", {
      reqId,
      context,
      reason: dryRunMode ? "dry-run" : "staging",
      channelId: channel.id
    });
    return null;
  }
  return channel.send(payload);
}

async function processPendingJobs() {
  if (jobWorkerRunning) return;
  jobWorkerRunning = true;
  try {
    const jobs = loadJobs();
    const now = Date.now();
    const queue = jobs
      .filter((x) => x.status === "pending" && Number(x.runAt || 0) <= now)
      .sort((a, b) => Number(a.runAt || 0) - Number(b.runAt || 0));

    for (const job of queue) {
      try {
        const channel = await client.channels.fetch(job.channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
          throw new Error(`Channel not found or not text-based: ${job.channelId}`);
        }
        await sendMessageWithGuards(channel, { content: job.content || undefined, embeds: job.embeds || [] }, `job.${job.type}`, "");
        job.status = "done";
        job.updatedAt = new Date().toISOString();
        job.processedAt = new Date().toISOString();
        metrics.queueProcessed += 1;
      } catch (err) {
        job.retries = Number(job.retries || 0) + 1;
        job.updatedAt = new Date().toISOString();
        job.lastError = err instanceof Error ? truncate(err.message, 200) : truncate(String(err), 200);
        if (job.retries > Number(job.maxRetries || 5)) {
          job.status = "failed";
          metrics.queueFailed += 1;
          sendOpsAlert("queue-job-failed", `Job ${job.id} (${job.type}) failed permanently after ${job.retries} retries.`).catch(() => {});
        }
      }
    }

    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const next = jobs.filter((x) => {
      if (x.status === "pending") return true;
      const updated = new Date(x.updatedAt || x.createdAt || 0).getTime();
      return updated >= cutoff;
    });
    saveJobs(next);
  } finally {
    jobWorkerRunning = false;
  }
}

function startMetricsServer() {
  if (!metricsPort || metricsServer) return;
  metricsServer = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }
    if (req.url !== "/metrics") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }

    const jobs = loadJobs();
    const pendingJobs = jobs.filter((x) => x.status === "pending").length;
    const modState = loadModCallsState();
    const openModCases = modState.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled").length;
    const lines = [
      "# HELP gh_bot_uptime_seconds Bot uptime in seconds.",
      "# TYPE gh_bot_uptime_seconds gauge",
      `gh_bot_uptime_seconds ${Math.floor(process.uptime())}`,
      "# HELP gh_bot_commands_total Total slash commands processed.",
      "# TYPE gh_bot_commands_total counter",
      `gh_bot_commands_total ${metrics.commandsTotal}`,
      "# HELP gh_bot_command_errors_total Total command errors.",
      "# TYPE gh_bot_command_errors_total counter",
      `gh_bot_command_errors_total ${metrics.commandErrors}`,
      "# HELP gh_bot_api_calls_total Total Admin API calls.",
      "# TYPE gh_bot_api_calls_total counter",
      `gh_bot_api_calls_total ${metrics.apiCalls}`,
      "# HELP gh_bot_api_errors_total Total Admin API call failures.",
      "# TYPE gh_bot_api_errors_total counter",
      `gh_bot_api_errors_total ${metrics.apiErrors}`,
      "# HELP gh_bot_scheduler_runs_total Total scheduler runs.",
      "# TYPE gh_bot_scheduler_runs_total counter",
      `gh_bot_scheduler_runs_total ${metrics.schedulerRuns}`,
      "# HELP gh_bot_scheduler_errors_total Total scheduler errors.",
      "# TYPE gh_bot_scheduler_errors_total counter",
      `gh_bot_scheduler_errors_total ${metrics.schedulerErrors}`,
      "# HELP gh_bot_queue_enqueued_total Total queue jobs enqueued.",
      "# TYPE gh_bot_queue_enqueued_total counter",
      `gh_bot_queue_enqueued_total ${metrics.queueEnqueued}`,
      "# HELP gh_bot_queue_processed_total Total queue jobs processed.",
      "# TYPE gh_bot_queue_processed_total counter",
      `gh_bot_queue_processed_total ${metrics.queueProcessed}`,
      "# HELP gh_bot_queue_failed_total Total queue jobs failed.",
      "# TYPE gh_bot_queue_failed_total counter",
      `gh_bot_queue_failed_total ${metrics.queueFailed}`,
      "# HELP gh_bot_queue_pending Number of pending queued jobs.",
      "# TYPE gh_bot_queue_pending gauge",
      `gh_bot_queue_pending ${pendingJobs}`,
      "# HELP gh_bot_abuse_blocked_total Command requests blocked by abuse shields.",
      "# TYPE gh_bot_abuse_blocked_total counter",
      `gh_bot_abuse_blocked_total ${metrics.abuseBlocked}`,
      "# HELP gh_bot_modcalls_created_total Total moderator calls created.",
      "# TYPE gh_bot_modcalls_created_total counter",
      `gh_bot_modcalls_created_total ${metrics.modCallsCreated}`,
      "# HELP gh_bot_modcalls_claimed_total Total moderator calls claimed.",
      "# TYPE gh_bot_modcalls_claimed_total counter",
      `gh_bot_modcalls_claimed_total ${metrics.modCallsClaimed}`,
      "# HELP gh_bot_modcalls_closed_total Total moderator calls closed.",
      "# TYPE gh_bot_modcalls_closed_total counter",
      `gh_bot_modcalls_closed_total ${metrics.modCallsClosed}`,
      "# HELP gh_bot_modcalls_open Number of open moderator calls.",
      "# TYPE gh_bot_modcalls_open gauge",
      `gh_bot_modcalls_open ${openModCases}`
    ];
    for (const [commandName, count] of Object.entries(metrics.byCommand)) {
      lines.push(`gh_bot_command_by_name_total{command="${commandName}"} ${count}`);
    }
    res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
    res.end(lines.join("\n"));
  });

  metricsServer.listen(metricsPort, metricsHost, () => {
    logEvent("info", "metrics.server.started", { host: metricsHost, port: metricsPort });
  });
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function findPzTip(kind, query) {
  const q = query.trim().toLowerCase();
  const db = {
    trait: {
      strong: "Strong boosts melee damage and carry weight, huge for frontline builds.",
      athletic: "Athletic improves endurance and sprinting efficiency for long loot runs.",
      burglar: "Burglar enables hotwiring and stealth-focused starts.",
      smoker: "Carry cigarettes and a lighter to manage stress cheaply."
    },
    recipe: {
      sheetrope: "Sheet rope needs ripped sheets + nail. Place from 2nd floor escape point.",
      raincollector: "Rain collector barrels secure water after utilities shut off.",
      logwall: "Log walls are sturdy perimeter defense for safehouses.",
      generator: "Read How to Use Generators before connecting one."
    },
    infection: {
      bite: "Bites are lethal under default settings. Prioritize backup plans.",
      scratch: "Scratches have lower infection chance, disinfect and monitor.",
      laceration: "Lacerations are risky. Keep bandages and disinfectant ready.",
      wound: "Clean wounds quickly to avoid regular infection and pain debuffs."
    },
    skill: {
      carpentry: "Watch Life and Living early + read books to multiply XP gains.",
      mechanics: "Daily uninstall/reinstall loops are great for safe mechanics XP.",
      tailoring: "Patch clothing repeatedly for steady tailoring progression.",
      nimble: "Combat stance movement trains nimble. Practice while clearing areas."
    }
  };

  const table = db[kind] || {};
  const exact = table[q];
  if (exact) return exact;
  const key = Object.keys(table).find((k) => k.includes(q) || q.includes(k));
  if (key) return table[key];
  const fallback = {
    trait: "Pick traits that support your role: looter, fighter, mechanic, or builder.",
    recipe: "Prioritize water, storage, and defense recipes first week.",
    infection: "Treat wounds fast, stay clean, and avoid overextending when injured.",
    skill: "Books + TV/VHS + focused repetition is the fastest skill strategy."
  };
  return fallback[kind] || "No tip available yet.";
}

function getOptInRoleId(type) {
  if (type === "restart") return restartAlertRoleId;
  if (type === "wipe") return wipeAlertRoleId;
  if (type === "raids") return raidsAlertRoleId;
  if (type === "trade") return tradeAlertRoleId;
  return "";
}

async function toggleOptInRole(member, type) {
  const roleId = getOptInRoleId(type);
  if (!roleId) return { ok: false, message: `Role for ${type} alerts is not configured.` };
  if (member.roles.cache.has(roleId)) {
    await member.roles.remove(roleId).catch(() => null);
    return { ok: true, message: `${type} alerts disabled.` };
  }
  await member.roles.add(roleId).catch(() => null);
  return { ok: true, message: `${type} alerts enabled.` };
}

function checkAndSetCooldown(interaction, commandName) {
  const now = Date.now();
  const ms = cooldownMs[commandName] || cooldownMs.default;
  const key = `${interaction.user.id}:${commandName}`;
  const until = commandCooldowns.get(key) || 0;
  if (until > now) {
    const wait = Math.ceil((until - now) / 1000);
    return wait;
  }
  commandCooldowns.set(key, now + ms);
  return 0;
}

function appendAuditEntry(entry) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.appendFileSync(auditLogFile, `${JSON.stringify(entry)}\n`);
  } catch {}
}

function loadAuditEntries(limit = 20) {
  try {
    if (!fs.existsSync(auditLogFile)) return [];
    const lines = fs.readFileSync(auditLogFile, "utf-8").trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean).reverse();
  } catch {
    return [];
  }
}

function createDataBackup(label, actorId) {
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const cleanLabel = (label || "snapshot").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "snapshot";
  const file = `backup-${stamp}-${cleanLabel}.json`;
  const payload = {
    version: 1,
    createdAt: new Date().toISOString(),
    actorId,
    label: cleanLabel,
    files: {},
    checksums: {}
  };
  for (const [key, filePath] of Object.entries(dataFiles)) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      payload.files[key] = content;
      payload.checksums[key] = sha256(content);
    } else {
      payload.files[key] = null;
      payload.checksums[key] = "";
    }
  }
  const fullPath = path.join(backupsDir, file);
  fs.writeFileSync(fullPath, JSON.stringify(payload, null, 2));
  return file;
}

function listDataBackups(limit = 10) {
  if (!fs.existsSync(backupsDir)) return [];
  return fs.readdirSync(backupsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const p = path.join(backupsDir, f);
      const st = fs.statSync(p);
      return { file: f, mtimeMs: st.mtimeMs, size: st.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit);
}

function restoreDataBackup(file) {
  const target = path.resolve(backupsDir, file);
  const root = path.resolve(backupsDir);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("Invalid backup path");
  if (!fs.existsSync(target)) throw new Error("Backup not found");
  const payload = JSON.parse(fs.readFileSync(target, "utf-8"));
  const files = payload.files || {};
  fs.mkdirSync(stateDir, { recursive: true });
  for (const [key, filePath] of Object.entries(dataFiles)) {
    const content = files[key];
    if (content === null || content === undefined) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      continue;
    }
    fs.writeFileSync(filePath, String(content));
  }
}

function verifyBackupPayload(payload) {
  const keys = Object.keys(dataFiles);
  const jsonKeys = keys.filter((k) => k !== "audit");
  return verifyBackupPayloadCore(payload, keys, jsonKeys);
}

function verifyBackupFile(file) {
  const target = path.resolve(backupsDir, file);
  const root = path.resolve(backupsDir);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return { ok: false, message: "Invalid backup path." };
  if (!fs.existsSync(target)) return { ok: false, message: "Backup not found." };
  const payload = JSON.parse(fs.readFileSync(target, "utf-8"));
  return verifyBackupPayload(payload);
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function applyBackupRetention() {
  if (!fs.existsSync(backupsDir)) return { deleted: [], kept: [] };
  const files = fs.readdirSync(backupsDir).filter((f) => f.endsWith(".json")).map((file) => {
    const full = path.join(backupsDir, file);
    const st = fs.statSync(full);
    return { file, mtimeMs: st.mtimeMs };
  }).sort((a, b) => b.mtimeMs - a.mtimeMs);

  const keep = new Set();
  const daily = new Set();
  const weekly = new Set();
  for (const row of files) {
    const date = new Date(row.mtimeMs);
    const dayKey = date.toISOString().slice(0, 10);
    const weekKey = isoWeekKey(date);

    if (daily.size < backupRetentionDaily && !daily.has(dayKey)) {
      daily.add(dayKey);
      keep.add(row.file);
      continue;
    }
    if (weekly.size < backupRetentionWeekly && !weekly.has(weekKey)) {
      weekly.add(weekKey);
      keep.add(row.file);
    }
  }

  const deleted = [];
  for (const row of files) {
    if (keep.has(row.file)) continue;
    const full = path.join(backupsDir, row.file);
    fs.unlinkSync(full);
    deleted.push(row.file);
  }
  return { deleted, kept: Array.from(keep) };
}

function bumpMetric(name, commandName) {
  if (name === "command") {
    metrics.commandsTotal += 1;
    commandWindowTotal += 1;
    if (commandName) {
      metrics.byCommand[commandName] = (metrics.byCommand[commandName] || 0) + 1;
    }
    return;
  }
  if (name === "commandError") {
    metrics.commandErrors += 1;
    commandWindowErrors += 1;
  }
  if (name === "apiCall") metrics.apiCalls += 1;
  if (name === "apiError") metrics.apiErrors += 1;
  if (name === "schedulerRun") metrics.schedulerRuns += 1;
  if (name === "schedulerError") metrics.schedulerErrors += 1;
}

async function adminFetch(pathname, ctx = {}) {
  bumpMetric("apiCall");
  const reqId = ctx.reqId || randomUUID();
  const headers = {
    "X-Request-ID": reqId
  };

  const authHeader = getAdminAuthHeader();
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  const startedAt = Date.now();
  const res = await fetch(`${apiBase}${pathname}`, {
    headers
  });
  if (!res.ok) {
    bumpMetric("apiError");
    logEvent("warn", "admin.fetch.error", {
      reqId,
      pathname,
      status: res.status,
      durationMs: Date.now() - startedAt
    });
    throw new Error(`${res.status} ${await res.text()}`);
  }
  logEvent("info", "admin.fetch.ok", {
    reqId,
    pathname,
    status: res.status,
    durationMs: Date.now() - startedAt
  });
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

function statusColor(status) {
  if (status === "online") return 0x4ade80;
  if (status === "maintenance") return 0xfacc15;
  return 0xf87171;
}

function statusMention(status) {
  if (status === "online") return statusMentionOnline;
  if (status === "maintenance") return statusMentionMaintenance || statusAlertMention;
  if (status === "offline") return statusMentionOffline || statusAlertMention;
  return "";
}

function summarizeMetrics() {
  const pendingJobs = loadJobs().filter((x) => x.status === "pending").length;
  return [
    `Deploy: ${deployTag}`,
    `Uptime: ${formatUptime(process.uptime())}`,
    `Commands: ${metrics.commandsTotal} (${metrics.commandErrors} errors)`,
    `API Calls: ${metrics.apiCalls} (${metrics.apiErrors} errors)`,
    `Scheduler: ${metrics.schedulerRuns} runs (${metrics.schedulerErrors} errors)`,
    `Queue: ${metrics.queueProcessed} processed, ${pendingJobs} pending, ${metrics.queueFailed} failed`,
    `Abuse Blocks: ${metrics.abuseBlocked}`,
    `Mod Calls: ${metrics.modCallsCreated} created, ${metrics.modCallsClaimed} claimed, ${metrics.modCallsClosed} closed`
  ].join("\n");
}

function isStaffMember(interaction, member) {
  return Boolean(interaction.guild && isAuthorizedMember(member, interaction.guild.ownerId));
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
    const status = await adminFetch("/api/admin/content/server-status", { reqId: "diag-admin-api" });
    return { ok: true, summary: `Admin API reachable (${status.status || "unknown"})` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, summary: `Admin API error: ${truncate(msg, 160)}` };
  }
}

async function runStartupDiagnostics() {
  console.log("[diag] Starting startup diagnostics...");
  console.log(`[diag] Deploy tag: ${deployTag} | mode=${dryRunMode ? "dry-run" : (stagingMode ? "staging" : "live")}`);
  console.log(`[diag] Scheduler minutes: status=${autoStatusMinutes}, updates=${autoUpdatesMinutes}, transmissions=${autoTransmissionsMinutes}, mods=${autoModsMinutes}, activity=${autoActivityMinutes}`);
  console.log(`[diag] Role gates: allowedRoleIds=${allowedRoleIds.length}, ownerRoleIds=${ownerRoleIds.length}`);
  console.log(`[diag] Admin auth header: basic-auth=${getAdminAuthHeader() ? "set" : "missing"}`);

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

async function getServerStatus() {
  return adminFetch("/api/admin/content/server-status");
}

async function getPlayerCount() {
  if (playerCountApi) {
    try {
      const res = await fetch(playerCountApi);
      if (res.ok) {
        const data = await res.json();
        const value = data.players ?? data.playerCount ?? data.count ?? data.online ?? null;
        if (typeof value === "number") return value;
      }
    } catch {}
  }

  const status = await getServerStatus();
  const value = status.players ?? status.playerCount ?? status.onlinePlayers ?? null;
  return typeof value === "number" ? value : null;
}

function formatEvent(event) {
  const state = event.ended ? "ended" : "active";
  return `\`${event.id}\` • ${event.title} • ${event.time} • ${state}`;
}

async function renderStaffList(interaction) {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
    return;
  }

  const guild = interaction.guild;
  await guild.members.fetch();
  await guild.roles.fetch();

  const ownerIds = new Set([guild.ownerId, ...ownerRoleIds]);
  const adminIds = new Set(allowedRoleIds);
  const modIds = new Set([modCallRoleId, seniorModRoleId].filter(Boolean));

  const ownerMembers = guild.members.cache
    .filter((m) => m.id === guild.ownerId || m.roles.cache.some((r) => ownerIds.has(r.id)))
    .map((m) => `<@${m.id}>`)
    .slice(0, 30);

  const adminMembers = guild.members.cache
    .filter((m) => m.roles.cache.some((r) => adminIds.has(r.id)))
    .map((m) => `<@${m.id}>`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 50);

  const modMembers = guild.members.cache
    .filter((m) => m.roles.cache.some((r) => modIds.has(r.id)))
    .map((m) => `<@${m.id}>`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 80);

  const embed = new EmbedBuilder()
    .setTitle("Staff Directory")
    .setDescription("Current staff by role group")
    .addFields(
      { name: "Owners", value: ownerMembers.join(", ") || "None configured", inline: false },
      { name: "Admins", value: adminMembers.join(", ") || "None configured", inline: false },
      { name: "Moderators", value: modMembers.join(", ") || "None configured", inline: false }
    )
    .setColor(0x2563eb)
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

async function requireStaff(interaction, commandName = interaction.commandName || "") {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
    return null;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "Unable to load your member profile.", ephemeral: true });
    return null;
  }
  if (!isStaffMember(interaction, member)) {
    await interaction.reply({ content: "Unauthorized", ephemeral: true });
    return null;
  }
  if (!hasPolicyAccess(member, commandName)) {
    await interaction.reply({ content: `Permission policy denied access to /${commandName}.`, ephemeral: true });
    return null;
  }

  return member;
}

async function hasStaffAccess(interaction) {
  if (!interaction.inGuild() || !interaction.guild) return false;
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  return Boolean(member && isStaffMember(interaction, member));
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
  logEvent("info", "discord.ready", { userTag: client.user?.tag || "unknown" });
  if (client.user) {
    client.user.setPresence({
      activities: [{ name: `${botActivity} [${deployTag}]`.slice(0, 120) }],
      status: "online"
    });
  }
  startMetricsServer();
  runStartupDiagnostics().catch((err) => {
    logEvent("error", "diag.startup.failed", { error: err instanceof Error ? err.message : String(err) });
  });
  safeScheduler(processPendingJobs);
  setInterval(() => safeScheduler(processPendingJobs), Math.max(1, jobWorkerIntervalSeconds) * 1000);
  setInterval(cleanupAbuseWindows, Math.max(10, abuseWindowSeconds) * 1000);
  startSchedulers();
});

client.on("error", (err) => {
  logEvent("error", "discord.client.error", { error: err instanceof Error ? err.message : String(err) });
});

client.on("warn", (message) => {
  logEvent("warn", "discord.client.warn", { message: truncate(String(message), 300) });
});

client.on("guildMemberAdd", async (member) => {
  if (!welcomeChannelId) return;
  const channel = await client.channels.fetch(welcomeChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const msg = welcomeMessage.replace("{user}", `<@${member.id}>`);
  await sendMessageWithGuards(channel, { content: msg }, "guildMemberAdd");
});

client.on("guildMemberRemove", async (member) => {
  if (!goodbyeChannelId) return;
  const channel = await client.channels.fetch(goodbyeChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const msg = goodbyeMessage.replace("{user}", member.user?.username || "A survivor");
  await sendMessageWithGuards(channel, { content: msg }, "guildMemberRemove");
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;
  const community = loadCommunity();
  if (!community.raidMode) return;

  const member = message.member;
  if (!member) return;
  if (isStaffMember({ guild: message.guild }, member)) return;

  const accountAgeDays = Math.floor((Date.now() - message.author.createdTimestamp) / (24 * 60 * 60 * 1000));
  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  const hasLink = /(https?:\/\/|discord\.gg\/)/i.test(message.content);
  const isSuspicious = mentionCount >= raidModeMaxMentions || (hasLink && accountAgeDays < raidModeMinAccountDays);

  if (!isSuspicious) return;

  await message.delete().catch(() => {});
  await sendMessageWithGuards(message.channel, { content: `⚠️ <@${message.author.id}> message removed by raid mode. Please slow down and avoid mass mentions/links.` }, "raidmode.enforcement").catch(() => {});
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({ content: "Buttons only work in server channels.", ephemeral: true });
      return;
    }
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: "Unable to load your member profile.", ephemeral: true });
      return;
    }

    if (interaction.customId.startsWith("onboard:")) {
      const type = interaction.customId.split(":")[1];
      const result = await toggleOptInRole(member, type);
      await interaction.reply({ content: result.message, ephemeral: true });
      return;
    }

    if (interaction.customId === "modcall:create") {
      const data = loadModCallsState();
      const throttle = shouldThrottleModCall(data, interaction.user.id, interaction.channelId || "");
      if (throttle.blocked) {
        await interaction.reply({ content: throttle.existing ? `You already have an active mod call: \`${throttle.existing.id}\`` : `Mod call blocked by ${throttle.reason}.`, ephemeral: true });
        return;
      }

      const id = makeId("mod");
      const trusted = hasTrustedRole(member);
      const priority = trusted ? "high" : "normal";
      const parent = modCallChannelId
        ? await interaction.guild.channels.fetch(modCallChannelId).catch(() => null)
        : interaction.channel;
      if (!parent || !parent.isTextBased()) {
        await interaction.reply({ content: "Mod call channel is not configured correctly.", ephemeral: true });
        return;
      }

      const onShiftMentions = Object.entries(data.shifts || {}).filter(([, row]) => row?.on).map(([id]) => `<@${id}>`);
      const mention = onShiftMentions.length
        ? onShiftMentions.join(" ")
        : (modCallRoleId ? `<@&${modCallRoleId}>` : "Moderators");
      const seed = await sendMessageWithGuards(parent, {
        content: `🚨 ${mention} new live mod call \`${id}\` from <@${interaction.user.id}> in <#${interaction.channelId}>`
      }, "modcall.button.create");
      if (!seed) {
        await interaction.reply({ content: "Mod call suppressed due to staging/dry-run mode.", ephemeral: true });
        return;
      }

      const thread = await seed.startThread({
        name: `modcall-${interaction.user.username}-${Date.now().toString(36)}`.slice(0, 95),
        autoArchiveDuration: 1440,
        reason: `Mod call by ${interaction.user.tag}`
      }).catch(() => null);
      if (!thread) {
        await interaction.reply({ content: "Unable to start case thread. Check bot permissions.", ephemeral: true });
        return;
      }

      const row = {
        id,
        source: "button",
        reporterId: interaction.user.id,
        targetUserId: "",
        sourceChannelId: interaction.channelId || "",
        threadId: thread.id,
        status: "open",
        category: "live-call",
        priority,
        createdAt: new Date().toISOString(),
        claimedBy: "",
        claimedAt: "",
        closedAt: "",
        closedBy: "",
        closeReason: "",
        escalationCount: 0,
        lastEscalatedAt: "",
        reporterFlags: 0,
        evidence: [],
        history: []
      };
      addCaseHistoryRow(row, "created", interaction.user.id, "Created from live call button");
      data.cases.unshift(row);
      data.stats.created += 1;
      metrics.modCallsCreated += 1;
      saveModCallsState(data);

      const controls = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`modact:claim:${id}`).setLabel("Claim").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`modact:close:${id}`).setLabel("Close").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`modact:warn:${id}`).setLabel("Warn").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`modact:timeout:${id}`).setLabel("Timeout 10m").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`modact:quarantine:${id}`).setLabel("Quarantine").setStyle(ButtonStyle.Danger)
      );
      const controls2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`modact:slowmode:${id}`).setLabel("Slowmode 30s").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`modact:lock:${id}`).setLabel("Lock Source").setStyle(ButtonStyle.Secondary)
      );
      await sendMessageWithGuards(thread, { content: `Case \`${id}\` opened. Reporter: <@${interaction.user.id}>`, components: [controls, controls2] }, "modcall.button.controls");
      await postModCaseContext(thread, row);
      await interaction.reply({ content: `Moderator call created: ${thread.toString()} (\`${id}\`)`, ephemeral: true });
      return;
    }

    if (interaction.customId.startsWith("modact:")) {
      const [, action, caseId] = interaction.customId.split(":");
      const isStaff = isStaffMember(interaction, member);
      if (!isStaff) {
        await interaction.reply({ content: "Only staff can use moderation action buttons.", ephemeral: true });
        return;
      }
      const data = loadModCallsState();
      const row = data.cases.find((x) => x.id === caseId);
      if (!row) {
        await interaction.reply({ content: "Case not found.", ephemeral: true });
        return;
      }

      if (action === "claim") {
        if (!row.claimedBy) {
          row.claimedBy = interaction.user.id;
          row.claimedAt = new Date().toISOString();
          row.status = "claimed";
          addCaseHistoryRow(row, "claimed", interaction.user.id, "Claimed via button");
          data.stats.claimed += 1;
          metrics.modCallsClaimed += 1;
          saveModCallsState(data);
        }
        await notifyReporterUpdate(interaction.client, row, `Your case has been claimed by <@${row.claimedBy}>.`);
        await interaction.reply({ content: `Case \`${caseId}\` claimed by <@${row.claimedBy}>.`, ephemeral: true });
        return;
      }

      if (action === "close") {
        row.status = "closed";
        row.closedAt = new Date().toISOString();
        row.closedBy = interaction.user.id;
        row.closeReason = row.closeReason || "Closed via quick action.";
        addCaseHistoryRow(row, "closed", interaction.user.id, row.closeReason);
        data.stats.closed += 1;
        metrics.modCallsClosed += 1;
        saveModCallsState(data);
        await notifyReporterUpdate(interaction.client, row, `Your case has been closed. Reason: ${row.closeReason}`);
        await interaction.reply({ content: `Case \`${caseId}\` closed.`, ephemeral: true });
        return;
      }

      const targetId = row.targetUserId || row.reporterId;
      const targetMember = targetId ? await interaction.guild.members.fetch(targetId).catch(() => null) : null;
      const sourceChannel = row.sourceChannelId ? await interaction.guild.channels.fetch(row.sourceChannelId).catch(() => null) : null;

      if (action === "warn") {
        await sendMessageWithGuards(interaction.channel, { content: `⚠️ Warning issued to <@${targetId}> for case \`${caseId}\`.` }, "modcall.button.warn");
        addCaseHistoryRow(row, "warn", interaction.user.id, `Warned ${targetId}`);
        saveModCallsState(data);
        await interaction.reply({ content: "Warning posted.", ephemeral: true });
        return;
      }

      if (action === "timeout") {
        if (!targetMember || !targetMember.moderatable) {
          await interaction.reply({ content: "Target cannot be timed out by bot.", ephemeral: true });
          return;
        }
        await targetMember.timeout(10 * 60 * 1000, `Case ${caseId} quick action by ${interaction.user.tag}`).catch(() => null);
        addCaseHistoryRow(row, "timeout", interaction.user.id, `Timeout 10m for ${targetId}`);
        saveModCallsState(data);
        await interaction.reply({ content: "Timeout applied (10m).", ephemeral: true });
        return;
      }

      if (!sourceChannel || !sourceChannel.isTextBased()) {
        await interaction.reply({ content: "Source channel unavailable for this action.", ephemeral: true });
        return;
      }

      if (action === "slowmode") {
        await sourceChannel.setRateLimitPerUser(30, `Case ${caseId} quick action by ${interaction.user.tag}`).catch(() => null);
        addCaseHistoryRow(row, "slowmode", interaction.user.id, `Set 30s in #${sourceChannel.id}`);
        saveModCallsState(data);
        await interaction.reply({ content: "Source channel slowmode set to 30s.", ephemeral: true });
        return;
      }
      if (action === "lock") {
        await sourceChannel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason: `Case ${caseId} lock by ${interaction.user.tag}` }).catch(() => null);
        addCaseHistoryRow(row, "lock", interaction.user.id, `Locked #${sourceChannel.id}`);
        saveModCallsState(data);
        await interaction.reply({ content: "Source channel locked.", ephemeral: true });
        return;
      }
      if (action === "quarantine") {
        if (!targetId) {
          await interaction.reply({ content: "No target user on this case.", ephemeral: true });
          return;
        }
        await sourceChannel.permissionOverwrites.edit(targetId, { SendMessages: false }, { reason: `Case ${caseId} quarantine by ${interaction.user.tag}` }).catch(() => null);
        addCaseHistoryRow(row, "quarantine", interaction.user.id, `Quarantined ${targetId} in #${sourceChannel.id}`);
        saveModCallsState(data);
        await interaction.reply({ content: "Target quarantined in source channel.", ephemeral: true });
        return;
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const reqId = makeRequestId();
  const auditStartedAt = Date.now();
  let auditStatus = "success";
  let auditNote = "";

  try {
    logEvent("info", "command.received", {
      reqId,
      command: interaction.commandName,
      userId: interaction.user?.id || "",
      guildId: interaction.guildId || "",
      channelId: interaction.channelId || ""
    });
    bumpMetric("command", interaction.commandName);
    const abuse = isAbuseBlocked(interaction);
    if (abuse.blocked) {
      auditStatus = "abuse_blocked";
      auditNote = `userCount=${abuse.userCount || 0},channelCount=${abuse.channelCount || 0}`;
      await interaction.reply({ content: "Rate limit shield active. Please slow down and try again shortly.", ephemeral: true });
      return;
    }

    const wait = checkAndSetCooldown(interaction, interaction.commandName);
    if (wait > 0) {
      auditStatus = "cooldown";
      auditNote = `wait=${wait}s`;
      await interaction.reply({ content: `Cooldown active. Try again in ${wait}s.`, ephemeral: true });
      return;
    }

    if (!shouldBypassMaintenance(interaction.commandName)) {
      const maintenance = loadMaintenanceState();
      if (maintenance.enabled) {
        const member = interaction.inGuild() && interaction.guild
          ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
          : null;
        const isStaff = Boolean(member && isStaffMember(interaction, member));
        if (!isStaff) {
          auditStatus = "maintenance_blocked";
          auditNote = "maintenance-mode";
          await interaction.reply({ content: `Maintenance mode is enabled. ${maintenance.message}`, ephemeral: true });
          return;
        }
      }
    }

    if (interaction.commandName === "ping") {
      await interaction.reply(`Pong. ${client.ws.ping}ms`);
      return;
    }

    if (interaction.commandName === "help") {
      await interaction.reply({
        content: [
          "Grey Hour RP Bot Commands:",
          "/lfg, /faction, /trade, /contest",
          "/raid, /signup, /mapmark, /safehouse",
          "/commend, /leaderboard, /optin, /onboard, /raidmode",
          "/squadvc, /survivor, /pz",
          "/whois, /playercount, /serverip, /staff",
          "/status, /statushistory",
          "/updates, /transmissions, /mods",
          "/rules, /join, /links, /lore, /moddiff",
          "/poll, /event, /ticket",
          "/purge, /slowmode, /lock, /unlock",
          "/audit, /incident, /backup, /ops, /modcall, /mod",
          "/health, /metrics, /announce, /reminder, /activity, /roll"
        ].join("\n"),
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "whois") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
        return;
      }

      const target = interaction.options.getUser("user") || interaction.user;
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "User is not a member of this server.", ephemeral: true });
        return;
      }

      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild.id)
        .map((r) => `<@&${r.id}>`)
        .slice(0, 10)
        .join(", ");

      const embed = new EmbedBuilder()
        .setTitle(`Whois: ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "User", value: `${target.tag} (\`${target.id}\`)`, inline: false },
          { name: "Joined Server", value: member.joinedAt ? member.joinedAt.toUTCString() : "Unknown", inline: true },
          { name: "Created Account", value: target.createdAt.toUTCString(), inline: true },
          { name: "Roles", value: roles || "None", inline: false }
        )
        .setColor(0x60a5fa);

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interaction.commandName === "playercount") {
      const count = await getPlayerCount();
      await interaction.reply(count === null ? "Player count unavailable right now." : `${playerCountLabel}: **${count}**`);
      return;
    }

    if (interaction.commandName === "serverip") {
      if (!serverIp) {
        await interaction.reply("Server IP is not configured yet.");
        return;
      }
      await interaction.reply(`Server connect: \`${serverIp}\``);
      return;
    }

    if (interaction.commandName === "staff") {
      await renderStaffList(interaction);
      return;
    }

    if (interaction.commandName === "lfg") {
      const sub = interaction.options.getSubcommand();
      const community = loadCommunity();
      community.lfg = ensureArray(community.lfg);

      if (sub === "create") {
        const id = makeId("lfg");
        const playstyle = interaction.options.getString("playstyle", true);
        const map = interaction.options.getString("map", true);
        const details = interaction.options.getString("details") || "";
        community.lfg.unshift({
          id,
          userId: interaction.user.id,
          playstyle: truncate(playstyle, 80),
          map: truncate(map, 80),
          details: truncate(details, 300),
          createdAt: new Date().toISOString(),
          expiresAt: Date.now() + 6 * 60 * 60 * 1000
        });
        saveCommunity(community);
        await interaction.reply(`LFG created: \`${id}\` (${playstyle} on ${map})`);
        return;
      }

      if (sub === "list") {
        const now = Date.now();
        community.lfg = community.lfg.filter((x) => !x.expiresAt || x.expiresAt > now);
        saveCommunity(community);
        const items = community.lfg.slice(0, 10);
        if (!items.length) {
          await interaction.reply("No active LFG posts.");
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle("Active LFG Posts")
          .setDescription(items.map((x) => `\`${x.id}\` • <@${x.userId}> • **${x.playstyle}** • ${x.map}${x.details ? `\n${x.details}` : ""}`).join("\n\n"))
          .setColor(0x22d3ee);
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "close") {
        const id = interaction.options.getString("id", true);
        const isStaff = await hasStaffAccess(interaction);
        const before = community.lfg.length;
        community.lfg = community.lfg.filter((x) => !(x.id === id && (x.userId === interaction.user.id || isStaff)));
        saveCommunity(community);
        await interaction.reply(before === community.lfg.length ? "No matching LFG found or insufficient permission." : `LFG closed: ${id}`);
        return;
      }
    }

    if (interaction.commandName === "faction") {
      const sub = interaction.options.getSubcommand();
      const community = loadCommunity();
      community.factions = community.factions || {};

      if (sub === "create") {
        const name = interaction.options.getString("name", true).trim();
        const tag = (interaction.options.getString("tag") || "").trim();
        if (community.factions[name]) {
          await interaction.reply({ content: "Faction already exists.", ephemeral: true });
          return;
        }
        community.factions[name] = { ownerId: interaction.user.id, tag: truncate(tag, 10), members: [interaction.user.id], createdAt: new Date().toISOString() };
        saveCommunity(community);
        await interaction.reply(`Faction created: **${name}**${tag ? ` [${tag}]` : ""}`);
        return;
      }

      if (sub === "recruit") {
        const name = interaction.options.getString("faction", true);
        const user = interaction.options.getUser("user", true);
        const faction = community.factions[name];
        if (!faction) {
          await interaction.reply({ content: "Faction not found.", ephemeral: true });
          return;
        }
        const isStaff = await hasStaffAccess(interaction);
        if (faction.ownerId !== interaction.user.id && !isStaff) {
          await interaction.reply({ content: "Only faction owner or staff can recruit.", ephemeral: true });
          return;
        }
        faction.members = ensureArray(faction.members);
        if (!faction.members.includes(user.id)) faction.members.push(user.id);
        saveCommunity(community);
        await interaction.reply(`Added <@${user.id}> to **${name}**`);
        return;
      }

      if (sub === "roster") {
        const name = interaction.options.getString("faction", true);
        const faction = community.factions[name];
        if (!faction) {
          await interaction.reply({ content: "Faction not found.", ephemeral: true });
          return;
        }
        const members = ensureArray(faction.members).map((id) => `<@${id}>`).join(", ");
        const embed = new EmbedBuilder()
          .setTitle(`Faction: ${name}`)
          .addFields(
            { name: "Owner", value: `<@${faction.ownerId}>`, inline: true },
            { name: "Tag", value: faction.tag || "N/A", inline: true },
            { name: "Members", value: members || "None", inline: false }
          )
          .setColor(0xf59e0b);
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "disband") {
        const name = interaction.options.getString("faction", true);
        const faction = community.factions[name];
        if (!faction) {
          await interaction.reply({ content: "Faction not found.", ephemeral: true });
          return;
        }
        const isStaff = await hasStaffAccess(interaction);
        if (faction.ownerId !== interaction.user.id && !isStaff) {
          await interaction.reply({ content: "Only faction owner or staff can disband.", ephemeral: true });
          return;
        }
        delete community.factions[name];
        saveCommunity(community);
        await interaction.reply(`Faction disbanded: **${name}**`);
        return;
      }
    }

    if (interaction.commandName === "trade") {
      const sub = interaction.options.getSubcommand();
      const community = loadCommunity();
      community.trades = ensureArray(community.trades);

      if (sub === "post") {
        const id = makeId("trade");
        const type = interaction.options.getString("type", true).toUpperCase();
        const item = interaction.options.getString("item", true);
        const details = interaction.options.getString("details") || "";
        community.trades.unshift({
          id,
          userId: interaction.user.id,
          type: truncate(type, 4),
          item: truncate(item, 120),
          details: truncate(details, 300),
          createdAt: new Date().toISOString(),
          expiresAt: Date.now() + 48 * 60 * 60 * 1000
        });
        saveCommunity(community);
        const mention = tradeAlertRoleId ? `<@&${tradeAlertRoleId}> ` : "";
        await interaction.reply(`${mention}Trade posted: \`${id}\` ${type} ${item}`);
        return;
      }

      if (sub === "list") {
        const now = Date.now();
        community.trades = community.trades.filter((x) => !x.expiresAt || x.expiresAt > now);
        saveCommunity(community);
        const rows = community.trades.slice(0, 12);
        if (!rows.length) {
          await interaction.reply("No active trade listings.");
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle("Trade Board")
          .setDescription(rows.map((x) => `\`${x.id}\` • **${x.type}** ${x.item} • <@${x.userId}>${x.details ? `\n${x.details}` : ""}`).join("\n\n"))
          .setColor(0x10b981);
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "close") {
        const id = interaction.options.getString("id", true);
        const isStaff = await hasStaffAccess(interaction);
        const before = community.trades.length;
        community.trades = community.trades.filter((x) => !(x.id === id && (x.userId === interaction.user.id || isStaff)));
        saveCommunity(community);
        await interaction.reply(before === community.trades.length ? "No matching trade found or insufficient permission." : `Trade closed: ${id}`);
        return;
      }
    }

    if (interaction.commandName === "contest") {
      const sub = interaction.options.getSubcommand();
      const community = loadCommunity();
      community.contests = ensureArray(community.contests);

      if (sub === "start") {
        const staff = await requireStaff(interaction);
        if (!staff) return;
        const id = makeId("contest");
        const title = interaction.options.getString("title", true);
        const theme = interaction.options.getString("theme", true);
        community.contests.unshift({
          id,
          title: truncate(title, 120),
          theme: truncate(theme, 200),
          createdBy: interaction.user.id,
          votes: {},
          active: true,
          createdAt: new Date().toISOString()
        });
        saveCommunity(community);
        await interaction.reply(`Contest started: \`${id}\` — ${title} (${theme})`);
        return;
      }

      if (sub === "vote") {
        const id = interaction.options.getString("id", true);
        const user = interaction.options.getUser("user", true);
        const contest = community.contests.find((x) => x.id === id && x.active);
        if (!contest) {
          await interaction.reply({ content: "Active contest not found.", ephemeral: true });
          return;
        }
        contest.votes = contest.votes || {};
        contest.votes[interaction.user.id] = user.id;
        saveCommunity(community);
        await interaction.reply({ content: `Vote recorded for <@${user.id}> in ${id}.`, ephemeral: true });
        return;
      }

      if (sub === "end") {
        const staff = await requireStaff(interaction);
        if (!staff) return;
        const id = interaction.options.getString("id", true);
        const contest = community.contests.find((x) => x.id === id);
        if (!contest) {
          await interaction.reply({ content: "Contest not found.", ephemeral: true });
          return;
        }
        contest.active = false;
        const tallies = {};
        for (const votedFor of Object.values(contest.votes || {})) {
          tallies[votedFor] = (tallies[votedFor] || 0) + 1;
        }
        const winner = Object.entries(tallies).sort((a, b) => b[1] - a[1])[0];
        saveCommunity(community);
        await interaction.reply(winner ? `Contest ${id} ended. Winner: <@${winner[0]}> (${winner[1]} votes).` : `Contest ${id} ended. No votes cast.`);
        return;
      }
    }

    if (interaction.commandName === "pz") {
      const sub = interaction.options.getSubcommand();
      if (sub === "infection") {
        const topic = interaction.options.getString("topic") || "wound";
        await interaction.reply(`🩹 ${findPzTip("infection", topic)}`);
        return;
      }
      const name = interaction.options.getString("name", true);
      await interaction.reply(`📚 ${findPzTip(sub, name)}`);
      return;
    }

    if (interaction.commandName === "mapmark") {
      const sub = interaction.options.getSubcommand();
      const community = loadCommunity();
      community.markers = ensureArray(community.markers);

      if (sub === "add") {
        const id = makeId("map");
        const label = interaction.options.getString("label", true);
        const location = interaction.options.getString("location", true);
        const notes = interaction.options.getString("notes") || "";
        community.markers.unshift({ id, userId: interaction.user.id, label: truncate(label, 100), location: truncate(location, 140), notes: truncate(notes, 220), createdAt: new Date().toISOString() });
        saveCommunity(community);
        await interaction.reply(`Map marker added: \`${id}\``);
        return;
      }

      if (sub === "list") {
        const lines = community.markers.slice(0, 12).map((x) => `\`${x.id}\` • ${x.label} @ ${x.location}${x.notes ? ` • ${x.notes}` : ""}`);
        await interaction.reply(lines.length ? truncate(lines.join("\n"), 1900) : "No map markers yet.");
        return;
      }

      if (sub === "remove") {
        const id = interaction.options.getString("id", true);
        const isStaff = await hasStaffAccess(interaction);
        const before = community.markers.length;
        community.markers = community.markers.filter((x) => !(x.id === id && (x.userId === interaction.user.id || isStaff)));
        saveCommunity(community);
        await interaction.reply(before === community.markers.length ? "No matching marker found or insufficient permission." : `Removed marker ${id}.`);
        return;
      }
    }

    if (interaction.commandName === "safehouse") {
      const sub = interaction.options.getSubcommand();
      const community = loadCommunity();
      community.safehouses = ensureArray(community.safehouses);

      if (sub === "request") {
        const id = makeId("house");
        const location = interaction.options.getString("location", true);
        const details = interaction.options.getString("details") || "";
        community.safehouses.unshift({
          id,
          userId: interaction.user.id,
          location: truncate(location, 140),
          details: truncate(details, 300),
          status: "pending",
          reviewedBy: "",
          createdAt: new Date().toISOString()
        });
        saveCommunity(community);
        await interaction.reply(`Safehouse request submitted: \`${id}\``);
        return;
      }

      if (sub === "review") {
        const staff = await requireStaff(interaction);
        if (!staff) return;
        const id = interaction.options.getString("id", true);
        const decision = interaction.options.getString("decision", true).toLowerCase();
        const req = community.safehouses.find((x) => x.id === id);
        if (!req) {
          await interaction.reply({ content: "Request not found.", ephemeral: true });
          return;
        }
        if (!["approve", "deny"].includes(decision)) {
          await interaction.reply({ content: "Decision must be approve or deny.", ephemeral: true });
          return;
        }
        req.status = decision === "approve" ? "approved" : "denied";
        req.reviewedBy = interaction.user.id;
        req.reviewedAt = new Date().toISOString();
        saveCommunity(community);
        await interaction.reply(`Safehouse ${id} ${req.status}.`);
        return;
      }

      if (sub === "list") {
        const lines = community.safehouses.slice(0, 12).map((x) => `\`${x.id}\` • ${x.location} • ${x.status} • <@${x.userId}>`);
        await interaction.reply(lines.length ? truncate(lines.join("\n"), 1900) : "No safehouse requests.");
        return;
      }
    }

    if (interaction.commandName === "raid") {
      const staff = await requireStaff(interaction);
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      const community = loadCommunity();
      community.raids = ensureArray(community.raids);

      if (sub === "create") {
        const id = makeId("raid");
        const title = interaction.options.getString("title", true);
        const time = interaction.options.getString("time", true);
        const details = interaction.options.getString("details") || "";
        community.raids.unshift({
          id,
          title: truncate(title, 120),
          time: truncate(time, 120),
          details: truncate(details, 260),
          createdBy: interaction.user.id,
          active: true,
          createdAt: new Date().toISOString()
        });
        saveCommunity(community);
        const ping = raidsAlertRoleId ? `<@&${raidsAlertRoleId}> ` : "";
        await interaction.reply(`${ping}Raid created: \`${id}\` ${title} @ ${time}`);
        return;
      }

      if (sub === "list") {
        const rows = community.raids.filter((x) => x.active).slice(0, 10);
        if (!rows.length) {
          await interaction.reply("No active raids.");
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle("Active Raids")
          .setDescription(rows.map((x) => `\`${x.id}\` • **${x.title}** @ ${x.time}${x.details ? `\n${x.details}` : ""}`).join("\n\n"))
          .setColor(0xef4444);
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === "end") {
        const id = interaction.options.getString("id", true);
        const raid = community.raids.find((x) => x.id === id);
        if (!raid) {
          await interaction.reply({ content: "Raid not found.", ephemeral: true });
          return;
        }
        raid.active = false;
        raid.endedAt = new Date().toISOString();
        saveCommunity(community);
        await interaction.reply(`Raid ended: ${id}`);
        return;
      }
    }

    if (interaction.commandName === "signup") {
      const sub = interaction.options.getSubcommand();
      const id = interaction.options.getString("id", true);
      const community = loadCommunity();
      community.signups = community.signups || {};
      community.signups[id] = ensureArray(community.signups[id]);

      if (sub === "join") {
        if (!community.signups[id].includes(interaction.user.id)) {
          community.signups[id].push(interaction.user.id);
        }
        saveCommunity(community);
        await interaction.reply({ content: `You joined signup: ${id}`, ephemeral: true });
        return;
      }

      if (sub === "leave") {
        community.signups[id] = community.signups[id].filter((u) => u !== interaction.user.id);
        saveCommunity(community);
        await interaction.reply({ content: `You left signup: ${id}`, ephemeral: true });
        return;
      }

      if (sub === "list") {
        const members = community.signups[id].map((u) => `<@${u}>`).join(", ");
        await interaction.reply(community.signups[id].length ? `Signups for \`${id}\`: ${members}` : `No signups for \`${id}\``);
        return;
      }
    }

    if (interaction.commandName === "commend") {
      const target = interaction.options.getUser("user", true);
      const reason = interaction.options.getString("reason") || "Helpful survivor";
      if (target.id === interaction.user.id) {
        await interaction.reply({ content: "You cannot commend yourself.", ephemeral: true });
        return;
      }
      const community = loadCommunity();
      community.reputation = community.reputation || {};
      community.commends = ensureArray(community.commends);
      const cooldownHit = community.commends.find((x) => x.from === interaction.user.id && x.to === target.id && Date.now() - x.at < 24 * 60 * 60 * 1000);
      if (cooldownHit) {
        await interaction.reply({ content: "You can only commend the same user once per 24h.", ephemeral: true });
        return;
      }
      community.reputation[target.id] = (community.reputation[target.id] || 0) + 1;
      community.commends.push({ from: interaction.user.id, to: target.id, at: Date.now() });
      community.commends = community.commends.slice(-1000);
      saveCommunity(community);
      await interaction.reply(`👏 <@${target.id}> was commended by <@${interaction.user.id}> (${reason}).`);
      return;
    }

    if (interaction.commandName === "leaderboard") {
      const community = loadCommunity();
      const board = Object.entries(community.reputation || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (!board.length) {
        await interaction.reply("No reputation data yet.");
        return;
      }
      const lines = board.map(([id, score], idx) => `${idx + 1}. <@${id}> — **${score}**`);
      const embed = new EmbedBuilder()
        .setTitle("Reputation Leaderboard")
        .setDescription(lines.join("\n"))
        .setColor(0xeab308);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "squadvc") {
      const sub = interaction.options.getSubcommand();
      const community = loadCommunity();
      community.squadVcs = ensureArray(community.squadVcs);

      if (sub === "create") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const name = interaction.options.getString("name", true);
        const limit = interaction.options.getInteger("limit") || 0;
        const channel = await interaction.guild.channels.create({
          name: truncate(name, 90),
          type: ChannelType.GuildVoice,
          userLimit: Math.max(0, Math.min(limit, 99)),
          reason: `Squad VC for ${interaction.user.tag}`
        }).catch(() => null);
        if (!channel) {
          await interaction.reply({ content: "Failed to create VC. Check permissions.", ephemeral: true });
          return;
        }
        community.squadVcs.push({ channelId: channel.id, ownerId: interaction.user.id, createdAt: Date.now() });
        saveCommunity(community);
        await interaction.reply({ content: `Squad VC created: <#${channel.id}>`, ephemeral: true });
        return;
      }

      if (sub === "close") {
        const channel = interaction.member?.voice?.channel;
        if (!channel) {
          await interaction.reply({ content: "Join your squad VC first.", ephemeral: true });
          return;
        }
        const row = community.squadVcs.find((x) => x.channelId === channel.id);
        const isStaff = await hasStaffAccess(interaction);
        if (!row || (row.ownerId !== interaction.user.id && !isStaff)) {
          await interaction.reply({ content: "You can only close your own squad VC (or be staff).", ephemeral: true });
          return;
        }
        community.squadVcs = community.squadVcs.filter((x) => x.channelId !== channel.id);
        saveCommunity(community);
        await channel.delete(`Squad VC closed by ${interaction.user.tag}`).catch(() => {});
        await interaction.reply({ content: "Squad VC closed.", ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "optin") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
        return;
      }
      const type = interaction.options.getString("type", true);
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const result = await toggleOptInRole(member, type);
      await interaction.reply({ content: result.message, ephemeral: true });
      return;
    }

    if (interaction.commandName === "onboard") {
      const staff = await requireStaff(interaction);
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "post") {
        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("onboard:restart").setLabel("Restart Alerts").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("onboard:wipe").setLabel("Wipe Alerts").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("onboard:raids").setLabel("Raid Alerts").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("onboard:trade").setLabel("Trade Alerts").setStyle(ButtonStyle.Secondary)
        );
        const content = [
          "🧭 **Welcome to Grey Hour RP**",
          "1. Read the rules: /rules",
          "2. Grab alerts with `/optin type:<restart|wipe|raids|trade>`",
          "3. Find groups with `/lfg create` and `/lfg list`",
          "4. Open support with `/ticket create`",
          "5. Check server status with `/status` and `/playercount`"
        ].join("\n");
        await sendMessageWithGuards(interaction.channel, { content, components: [buttons] }, "onboard.post", reqId);
        await interaction.reply({ content: "Onboarding panel posted.", ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "raidmode") {
      const staff = await requireStaff(interaction);
      if (!staff) return;
      const stateValue = interaction.options.getString("state", true);
      const community = loadCommunity();
      community.raidMode = stateValue === "on";
      saveCommunity(community);
      addIncident({
        severity: "medium",
        userId: interaction.user.id,
        reason: `raidmode ${community.raidMode ? "enabled" : "disabled"}`,
        createdBy: interaction.user.id,
        auto: true
      });
      await interaction.reply(`Raid mode ${community.raidMode ? "enabled" : "disabled"}.`);
      return;
    }

    if (interaction.commandName === "modcall") {
      const sub = interaction.options.getSubcommand();

      if (sub === "setup") {
        const staff = await requireStaff(interaction, "modcall");
        if (!staff) return;
        const panel = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("modcall:create").setLabel("Call a Moderator").setStyle(ButtonStyle.Danger)
        );
        await sendMessageWithGuards(interaction.channel, {
          content: "Need a moderator right now? Press the button below to open a live mod case.",
          components: [panel]
        }, "modcall.setup", reqId);
        await interaction.reply({ content: "Mod call panel posted.", ephemeral: true });
        return;
      }

      if (sub === "create") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const data = loadModCallsState();
        const throttle = shouldThrottleModCall(data, interaction.user.id, interaction.channelId || "");
        if (throttle.blocked) {
          await interaction.reply({ content: throttle.existing ? `You already have an active mod call: \`${throttle.existing.id}\`` : `Mod call blocked by ${throttle.reason}.`, ephemeral: true });
          return;
        }

        const severity = interaction.options.getString("severity") || "medium";
        const category = interaction.options.getString("category") || "general";
        const details = interaction.options.getString("details") || "";
        const target = interaction.options.getUser("target");
        const attachment = interaction.options.getAttachment("attachment");
        const id = makeId("mod");
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const priority = member && hasTrustedRole(member) ? "high" : (severity === "critical" ? "critical" : "normal");

        const parent = modCallChannelId
          ? await interaction.guild.channels.fetch(modCallChannelId).catch(() => null)
          : interaction.channel;
        if (!parent || !parent.isTextBased()) {
          await interaction.reply({ content: "Mod call channel is not configured correctly.", ephemeral: true });
          return;
        }

        const onShiftMentions = Object.entries(data.shifts || {}).filter(([, row]) => row?.on).map(([id]) => `<@${id}>`);
        const mention = onShiftMentions.length
          ? onShiftMentions.join(" ")
          : (modCallRoleId ? `<@&${modCallRoleId}>` : "Moderators");
        const seed = await sendMessageWithGuards(parent, {
          content: `🚨 ${mention} mod call \`${id}\` (${priority}) from <@${interaction.user.id}>${target ? ` • target <@${target.id}>` : ""}\nCategory: ${category}\nSeverity: ${severity}\n${truncate(details, 700)}`
        }, "modcall.create", reqId);
        if (!seed) {
          await interaction.reply({ content: "Mod call suppressed due to staging/dry-run mode.", ephemeral: true });
          return;
        }
        const thread = await seed.startThread({
          name: `modcall-${interaction.user.username}-${Date.now().toString(36)}`.slice(0, 95),
          autoArchiveDuration: 1440,
          reason: `Mod call by ${interaction.user.tag}`
        }).catch(() => null);
        if (!thread) {
          await interaction.reply({ content: "Unable to start case thread. Check bot permissions.", ephemeral: true });
          return;
        }

        const row = {
          id,
          source: "slash",
          reporterId: interaction.user.id,
          targetUserId: target?.id || "",
          sourceChannelId: interaction.channelId || "",
          threadId: thread.id,
          status: "open",
          category,
          severity,
          priority,
          details: truncate(details, 1200),
          createdAt: new Date().toISOString(),
          claimedBy: "",
          claimedAt: "",
          closedAt: "",
          closedBy: "",
          closeReason: "",
          escalationCount: 0,
          lastEscalatedAt: "",
          reporterFlags: 0,
          evidence: [],
          history: []
        };
        if (attachment) {
          row.evidence.push({
            at: new Date().toISOString(),
            by: interaction.user.id,
            type: "attachment",
            name: attachment.name || "",
            url: attachment.url || "",
            size: attachment.size || 0,
            contentType: attachment.contentType || ""
          });
        }
        addCaseHistoryRow(row, "created", interaction.user.id, "Created via /modcall create");
        data.cases.unshift(row);
        data.stats.created += 1;
        metrics.modCallsCreated += 1;
        saveModCallsState(data);

        const controls = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`modact:claim:${id}`).setLabel("Claim").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`modact:close:${id}`).setLabel("Close").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`modact:warn:${id}`).setLabel("Warn").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`modact:timeout:${id}`).setLabel("Timeout 10m").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`modact:quarantine:${id}`).setLabel("Quarantine").setStyle(ButtonStyle.Danger)
        );
        const controls2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`modact:slowmode:${id}`).setLabel("Slowmode 30s").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`modact:lock:${id}`).setLabel("Lock Source").setStyle(ButtonStyle.Secondary)
        );
        await sendMessageWithGuards(thread, { content: `Case \`${id}\` opened by <@${interaction.user.id}>`, components: [controls, controls2] }, "modcall.controls", reqId);
        await postModCaseContext(thread, row);
        await interaction.reply({ content: `Mod case created: ${thread.toString()} (\`${id}\`)`, ephemeral: true });
        return;
      }

      const staff = await requireStaff(interaction, "modcall");
      if (!staff) {
        auditStatus = "denied";
        return;
      }
      const data = loadModCallsState();

      if (sub === "list") {
        const openOnly = interaction.options.getBoolean("open_only");
        let rows = data.cases.slice();
        if (openOnly !== false) {
          rows = rows.filter((x) => x.status !== "closed" && x.status !== "cancelled");
        }
        rows = rows
          .sort((a, b) => {
            const pa = a.priority === "critical" ? 3 : a.priority === "high" ? 2 : 1;
            const pb = b.priority === "critical" ? 3 : b.priority === "high" ? 2 : 1;
            if (pa !== pb) return pb - pa;
            return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          })
          .slice(0, 25);
        if (!rows.length) {
          await interaction.reply({ content: "No mod calls found.", ephemeral: true });
          return;
        }
        await interaction.reply({ content: truncate(rows.map(buildModCallSummaryRow).join("\n"), 1900), ephemeral: true });
        return;
      }

      if (sub === "claim") {
        const id = interaction.options.getString("id", true);
        const row = getOpenModCaseById(data, id);
        if (!row) {
          await interaction.reply({ content: "Open case not found.", ephemeral: true });
          return;
        }
        if (!row.claimedBy) {
          row.claimedBy = interaction.user.id;
          row.claimedAt = new Date().toISOString();
          row.status = "claimed";
          addCaseHistoryRow(row, "claimed", interaction.user.id, "Claimed via /modcall claim");
          data.stats.claimed += 1;
          metrics.modCallsClaimed += 1;
          const responseMs = new Date(row.claimedAt).getTime() - new Date(row.createdAt || 0).getTime();
          row.firstResponseMs = responseMs;
        }
        saveModCallsState(data);
        const thread = row.threadId ? await interaction.guild.channels.fetch(row.threadId).catch(() => null) : null;
        if (thread && thread.isTextBased()) {
          await sendMessageWithGuards(thread, { content: `👮 Case claimed by <@${interaction.user.id}>.` }, "modcall.claim", reqId);
        }
        await notifyReporterUpdate(interaction.client, row, `Your case is now claimed by <@${interaction.user.id}>.`);
        await interaction.reply({ content: `Case \`${id}\` claimed.`, ephemeral: true });
        return;
      }

      if (sub === "transfer") {
        const id = interaction.options.getString("id", true);
        const toUser = interaction.options.getUser("to", true);
        const row = getOpenModCaseById(data, id);
        if (!row) {
          await interaction.reply({ content: "Open case not found.", ephemeral: true });
          return;
        }
        row.claimedBy = toUser.id;
        row.claimedAt = row.claimedAt || new Date().toISOString();
        row.status = "claimed";
        addCaseHistoryRow(row, "transferred", interaction.user.id, `Transferred to ${toUser.id}`);
        saveModCallsState(data);
        const thread = row.threadId ? await interaction.guild.channels.fetch(row.threadId).catch(() => null) : null;
        if (thread && thread.isTextBased()) {
          await sendMessageWithGuards(thread, { content: `🔁 Case transferred to <@${toUser.id}> by <@${interaction.user.id}>.` }, "modcall.transfer", reqId);
        }
        await notifyReporterUpdate(interaction.client, row, `Your case has been transferred to <@${toUser.id}>.`);
        await interaction.reply({ content: `Case \`${id}\` transferred to <@${toUser.id}>.`, ephemeral: true });
        return;
      }

      if (sub === "close") {
        const id = interaction.options.getString("id", true);
        const reason = interaction.options.getString("reason") || "Resolved by moderator.";
        const row = data.cases.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        row.status = "closed";
        row.closedAt = new Date().toISOString();
        row.closedBy = interaction.user.id;
        row.closeReason = truncate(reason, 600);
        addCaseHistoryRow(row, "closed", interaction.user.id, row.closeReason);
        if (row.createdAt) {
          row.resolutionMs = Math.max(0, new Date(row.closedAt).getTime() - new Date(row.createdAt).getTime());
        }
        data.stats.closed += 1;
        metrics.modCallsClosed += 1;
        saveModCallsState(data);
        const thread = row.threadId ? await interaction.guild.channels.fetch(row.threadId).catch(() => null) : null;
        if (thread && thread.isTextBased()) {
          await sendMessageWithGuards(thread, { content: `✅ Case closed by <@${interaction.user.id}>. Reason: ${row.closeReason}` }, "modcall.close", reqId);
        }
        await notifyReporterUpdate(interaction.client, row, `Your case has been closed. Reason: ${row.closeReason}`);
        await interaction.reply({ content: `Case \`${id}\` closed.`, ephemeral: true });
        return;
      }

      if (sub === "status") {
        const id = interaction.options.getString("id", true);
        const message = interaction.options.getString("message", true);
        const row = data.cases.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        addCaseHistoryRow(row, "status-update", interaction.user.id, message);
        saveModCallsState(data);
        const thread = row.threadId ? await interaction.guild.channels.fetch(row.threadId).catch(() => null) : null;
        if (thread && thread.isTextBased()) {
          await sendMessageWithGuards(thread, { content: `📣 Status update from <@${interaction.user.id}>: ${truncate(message, 1200)}` }, "modcall.status", reqId);
        }
        await notifyReporterUpdate(interaction.client, row, `Update: ${message}`);
        await interaction.reply({ content: "Status update sent.", ephemeral: true });
        return;
      }

      if (sub === "evidence") {
        const id = interaction.options.getString("id", true);
        const note = interaction.options.getString("note") || "";
        const url = interaction.options.getString("url") || "";
        const attachment = interaction.options.getAttachment("attachment");
        const row = data.cases.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        const evidence = {
          at: new Date().toISOString(),
          by: interaction.user.id,
          type: attachment ? "attachment" : "link",
          note: truncate(note, 500),
          url: attachment?.url || url || "",
          name: attachment?.name || ""
        };
        row.evidence = ensureArray(row.evidence);
        row.evidence.push(evidence);
        addCaseHistoryRow(row, "evidence", interaction.user.id, evidence.url || evidence.note);
        saveModCallsState(data);
        const thread = row.threadId ? await interaction.guild.channels.fetch(row.threadId).catch(() => null) : null;
        if (thread && thread.isTextBased()) {
          await sendMessageWithGuards(thread, { content: `🧾 Evidence added by <@${interaction.user.id}>: ${evidence.url || evidence.note || "attachment"}` }, "modcall.evidence", reqId);
        }
        await interaction.reply({ content: "Evidence captured.", ephemeral: true });
        return;
      }

      if (sub === "flag") {
        const id = interaction.options.getString("id", true);
        const reason = interaction.options.getString("reason") || "False report";
        const row = data.cases.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        row.reporterFlags = Number(row.reporterFlags || 0) + 1;
        addCaseHistoryRow(row, "flagged", interaction.user.id, reason);
        data.stats.falseReports += 1;
        saveModCallsState(data);
        await interaction.reply({ content: `Reporter on \`${id}\` flagged (${row.reporterFlags} total flags).`, ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "mod") {
      const staff = await requireStaff(interaction, "mod");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      const data = loadModCallsState();

      if (sub === "shift") {
        const stateValue = interaction.options.getString("state", true);
        const on = stateValue === "on";
        data.shifts[interaction.user.id] = {
          on,
          updatedAt: new Date().toISOString()
        };
        saveModCallsState(data);
        await interaction.reply({ content: `Shift ${on ? "enabled" : "disabled"} for <@${interaction.user.id}>.`, ephemeral: true });
        return;
      }

      if (sub === "coverage") {
        const onShiftIds = Object.entries(data.shifts).filter(([, v]) => v?.on).map(([id]) => id);
        const openCases = data.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled").length;
        const lines = [
          `On-shift moderators: ${onShiftIds.length}`,
          onShiftIds.length ? onShiftIds.map((id) => `- <@${id}>`).join("\n") : "- none",
          `Open cases: ${openCases}`
        ];
        await interaction.reply({ content: lines.join("\n"), ephemeral: true });
        return;
      }

      if (sub === "metrics") {
        const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const weekly = data.cases.filter((x) => new Date(x.createdAt || 0).getTime() >= weekCutoff);
        const closed = weekly.filter((x) => x.status === "closed");
        const avgResponse = closed.filter((x) => Number.isFinite(x.firstResponseMs)).map((x) => x.firstResponseMs);
        const avgResolution = closed.filter((x) => Number.isFinite(x.resolutionMs)).map((x) => x.resolutionMs);
        const mean = (arr) => arr.length ? Math.floor(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
        const reopenCount = weekly.filter((x) => ensureArray(x.history).some((h) => h.action === "reopened")).length;

        const lines = [
          `Weekly cases: ${weekly.length}`,
          `Weekly closed: ${closed.length}`,
          `Avg first response: ${Math.floor(mean(avgResponse) / 1000)}s`,
          `Avg resolution: ${Math.floor(mean(avgResolution) / 60000)}m`,
          `Reopened: ${reopenCount}`,
          `False-report flags: ${data.stats.falseReports || 0}`,
          `Escalations: ${data.stats.escalated || 0}`
        ];
        await interaction.reply({ content: lines.join("\n"), ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "audit") {
      const staff = await requireStaff(interaction);
      if (!staff) {
        auditStatus = "denied";
        return;
      }
      const sub = interaction.options.getSubcommand();
      if (sub === "list") {
        const limit = Math.min(Math.max(interaction.options.getInteger("limit") || 15, 1), 50);
        const items = loadAuditEntries(limit);
        if (!items.length) {
          await interaction.reply({ content: "No audit entries yet.", ephemeral: true });
          return;
        }
        const lines = items.map((x) => {
          const t = x.timeUtc ? new Date(x.timeUtc).toISOString() : "unknown";
          return `${t} • ${x.command} • ${x.status} • ${x.userTag || x.userId || "unknown"}${x.note ? ` • ${x.note}` : ""}`;
        });
        await interaction.reply({ content: truncate(lines.join("\n"), 1900), ephemeral: true });
        return;
      }
      if (sub === "export") {
        const limit = Math.min(Math.max(interaction.options.getInteger("limit") || 200, 1), 1000);
        const format = interaction.options.getString("format") || "json";
        const items = loadAuditEntries(limit).reverse();
        if (!items.length) {
          await interaction.reply({ content: "No audit entries to export.", ephemeral: true });
          return;
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        if (format === "csv") {
          const header = "timeUtc,command,status,userId,userTag,guildId,channelId,durationMs,note";
          const rows = items.map((x) => [
            x.timeUtc || "",
            x.command || "",
            x.status || "",
            x.userId || "",
            x.userTag || "",
            x.guildId || "",
            x.channelId || "",
            String(x.durationMs || ""),
            (x.note || "").replace(/"/g, "\"\"")
          ].map((v, idx) => idx === 8 ? `"${v}"` : `"${String(v).replace(/"/g, "\"\"")}"`).join(","));
          const csv = [header, ...rows].join("\n");
          await interaction.reply({
            content: `Exported ${items.length} audit entries.`,
            ephemeral: true,
            files: [{ attachment: Buffer.from(csv, "utf-8"), name: `audit-export-${stamp}.csv` }]
          });
          return;
        }
        const json = JSON.stringify(items, null, 2);
        await interaction.reply({
          content: `Exported ${items.length} audit entries.`,
          ephemeral: true,
          files: [{ attachment: Buffer.from(json, "utf-8"), name: `audit-export-${stamp}.json` }]
        });
        return;
      }
    }

    if (interaction.commandName === "incident") {
      const staff = await requireStaff(interaction);
      if (!staff) {
        auditStatus = "denied";
        return;
      }
      const sub = interaction.options.getSubcommand();
      const incidents = loadIncidents();

      if (sub === "create") {
        const user = interaction.options.getUser("user", true);
        const severity = interaction.options.getString("severity", true);
        const reason = interaction.options.getString("reason", true);
        const id = makeId("inc");
        incidents.unshift({
          id,
          userId: user.id,
          severity,
          reason: truncate(reason, 500),
          status: "open",
          createdBy: interaction.user.id,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          resolvedBy: null,
          resolutionNote: ""
        });
        saveIncidents(incidents);
        await interaction.reply({ content: `Incident created: \`${id}\` for <@${user.id}> (${severity})`, ephemeral: true });
        return;
      }

      if (sub === "list") {
        const openOnly = interaction.options.getBoolean("open_only") || false;
        const rows = incidents.filter((x) => openOnly ? x.status === "open" : true).slice(0, 20);
        if (!rows.length) {
          await interaction.reply({ content: "No incidents found.", ephemeral: true });
          return;
        }
        const lines = rows.map((x) => `\`${x.id}\` • <@${x.userId}> • ${x.severity} • ${x.status} • ${x.reason}`);
        await interaction.reply({ content: truncate(lines.join("\n"), 1900), ephemeral: true });
        return;
      }

      if (sub === "resolve") {
        const id = interaction.options.getString("id", true);
        const note = interaction.options.getString("note") || "";
        const row = incidents.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Incident not found.", ephemeral: true });
          return;
        }
        row.status = "resolved";
        row.resolvedAt = new Date().toISOString();
        row.resolvedBy = interaction.user.id;
        row.resolutionNote = truncate(note, 400);
        saveIncidents(incidents);
        await interaction.reply({ content: `Incident resolved: ${id}`, ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "backup") {
      const staff = await requireStaff(interaction);
      if (!staff) {
        auditStatus = "denied";
        return;
      }
      const sub = interaction.options.getSubcommand();

      if (sub === "create") {
        const label = interaction.options.getString("label") || "manual";
        const file = createDataBackup(label, interaction.user.id);
        const verify = verifyBackupFile(file);
        const retention = applyBackupRetention();
        if (!verify.ok) {
          await interaction.reply({ content: `Backup created but verification failed: \`${file}\` • ${verify.message}`, ephemeral: true });
          return;
        }
        await interaction.reply({
          content: `Backup created: \`${file}\` • verified • retention deleted ${retention.deleted.length} old backup(s).`,
          ephemeral: true
        });
        return;
      }

      if (sub === "list") {
        const limit = Math.min(Math.max(interaction.options.getInteger("limit") || 10, 1), 30);
        const rows = listDataBackups(limit);
        if (!rows.length) {
          await interaction.reply({ content: "No backups found.", ephemeral: true });
          return;
        }
        const lines = rows.map((x) => `\`${x.file}\` • ${(x.size / 1024).toFixed(1)} KB • ${new Date(x.mtimeMs).toISOString()}`);
        await interaction.reply({ content: truncate(lines.join("\n"), 1900), ephemeral: true });
        return;
      }

      if (sub === "restore") {
        const file = interaction.options.getString("file", true);
        const verify = verifyBackupFile(file);
        if (!verify.ok) {
          await interaction.reply({ content: `Refusing restore. Backup verification failed: ${verify.message}`, ephemeral: true });
          return;
        }
        restoreDataBackup(file);
        await interaction.reply({ content: `Backup restored: \`${file}\``, ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "survivor") {
      const sub = interaction.options.getSubcommand();
      const tips = [
        "Carry a backup weapon and painkillers before long runs.",
        "Stairs are choke points. Clear below before descending.",
        "Always keep spare bandages and water in your go-bag.",
        "Overconfidence kills more survivors than zombies."
      ];
      const challenges = [
        "No car challenge: survive 2 in-game days on foot only.",
        "Night raid: clear one block after dark with a teammate.",
        "Scavenger run: fill a duffel from one POI and exfil alive.",
        "Medic run: carry only support gear and save a teammate."
      ];
      const pool = sub === "tip" ? tips : challenges;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      await interaction.reply(sub === "tip" ? `🧠 ${pick}` : `🔥 Challenge: ${pick}`);
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

    if (interaction.commandName === "ops") {
      const member = await requireStaff(interaction, "ops");
      if (!member) return;
      const sub = interaction.options.getSubcommand();

      if (sub === "status") {
        const jobs = loadJobs();
        const pendingJobs = jobs.filter((x) => x.status === "pending").length;
        const smoke = loadSmokeStatus();
        const maintenance = loadMaintenanceState();
        const state = loadState();
        const lastSchedulerErr = state.lastSchedulerErrorAt || "none";
        const embed = new EmbedBuilder()
          .setTitle("Ops Status")
          .setDescription("Current operational state of the Discord bot")
          .addFields(
            { name: "Deploy", value: deployTag, inline: true },
            { name: "Mode", value: dryRunMode ? "dry-run" : (stagingMode ? "staging" : "live"), inline: true },
            { name: "Maintenance", value: maintenance.enabled ? `on - ${truncate(maintenance.message, 80)}` : "off", inline: false },
            { name: "Queue", value: `${pendingJobs} pending / ${metrics.queueFailed} failed`, inline: true },
            { name: "Schedulers", value: `${metrics.schedulerRuns} runs / ${metrics.schedulerErrors} errors`, inline: true },
            { name: "Command Errors", value: `${metrics.commandErrors}/${metrics.commandsTotal}`, inline: true },
            { name: "Last Scheduler Error", value: String(lastSchedulerErr), inline: false },
            { name: "Smoke", value: smoke.checkedAt ? `${smoke.ok ? "PASS" : "FAIL"} @ ${smoke.checkedAt}` : "No smoke status file", inline: false }
          )
          .setColor(maintenance.enabled ? 0xf59e0b : 0x22c55e)
          .setTimestamp();
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (sub === "maintenance") {
        const stateValue = interaction.options.getString("state", true);
        const message = interaction.options.getString("message") || "Server maintenance in progress. Please try again soon.";
        const enabled = stateValue === "on";
        setMaintenanceState(enabled, message, interaction.user.id);
        if (enabled) {
          await postMaintenanceBanner(reqId);
        }
        await interaction.reply({ content: `Maintenance mode ${enabled ? "enabled" : "disabled"}.`, ephemeral: true });
        return;
      }

      if (sub === "inventory") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const mode = interaction.options.getString("mode") || "summary";
        await interaction.guild.members.fetch();
        await interaction.guild.roles.fetch();
        await interaction.guild.channels.fetch();
        const inv = buildGuildInventory(interaction.guild);

        if (mode === "export") {
          const name = `guild-inventory-${interaction.guild.id}-${new Date().toISOString().slice(0, 10)}.json`;
          await interaction.reply({
            content: `Exported inventory for ${interaction.guild.name}.`,
            ephemeral: true,
            files: [{ attachment: Buffer.from(JSON.stringify(inv, null, 2), "utf-8"), name }]
          });
          return;
        }

        const summary = [
          `Guild: ${inv.guild.name} (${inv.guild.id})`,
          `Members: ${inv.members.length}`,
          `Roles: ${inv.roles.length}`,
          `Channels: ${inv.channels.length}`,
          `Top roles: ${inv.roles.slice(0, 8).map((r) => r.name).join(", ") || "none"}`
        ].join("\n");
        await interaction.reply({ content: summary, ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "health") {
      const member = await requireStaff(interaction);
      if (!member) return;

      await interaction.deferReply({ ephemeral: true });
      const details = interaction.options.getBoolean("details") || false;

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
          { name: "Deploy", value: deployTag, inline: true },
          { name: "Gateway Ping", value: `${client.ws.ping}ms`, inline: true },
          { name: "Uptime", value: formatUptime(process.uptime()), inline: true },
          { name: "Schedulers", value: `S:${autoStatusMinutes} U:${autoUpdatesMinutes} T:${autoTransmissionsMinutes} M:${autoModsMinutes} A:${autoActivityMinutes}`, inline: false }
        )
        .setColor(healthy ? 0x22c55e : 0xef4444)
        .setTimestamp();

      if (details) {
        embed.addFields(
          { name: "Auth", value: `Basic Auth: ${getAdminAuthHeader() ? "set" : "missing"}`, inline: false },
          { name: "Runtime", value: summarizeMetrics(), inline: false }
        );
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "metrics") {
      const member = await requireStaff(interaction);
      if (!member) return;
      await interaction.reply({ content: summarizeMetrics(), ephemeral: true });
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
      const status = await adminFetch("/api/admin/content/server-status", { reqId });
      const updatedStamp = status.updatedUtc || status.updated || status.dateUtc || null;
      const embed = new EmbedBuilder()
        .setTitle("Grey Hour RP Status")
        .setDescription(status.message || "No status published")
        .addFields(
          { name: "State", value: status.status || "unknown", inline: true },
          { name: "Updated", value: updatedStamp ? new Date(updatedStamp).toUTCString() : "Unknown", inline: true }
        )
        .setColor(statusColor(status.status));
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "statushistory") {
      const history = await adminFetch("/api/admin/content/status-history", { reqId });
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
      const updates = await adminFetch("/api/admin/content/updates", { reqId });
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
      const items = await adminFetch("/api/admin/content/transmissions", { reqId });
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
      const mods = await adminFetch("/api/admin/content/mods", { reqId });
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

    if (interaction.commandName === "poll") {
      const member = await requireStaff(interaction);
      if (!member) return;

      const question = interaction.options.getString("question", true);
      const pollMessage = await sendMessageWithGuards(interaction.channel, { content: `📊 **Poll:** ${question}\nReact with 👍 or 👎` }, "poll.create", reqId);
      if (pollMessage) {
        await pollMessage.react("👍").catch(() => {});
        await pollMessage.react("👎").catch(() => {});
      }
      await interaction.reply({ content: pollMessage ? `Poll created: ${pollMessage.url}` : "Poll suppressed due to staging/dry-run mode.", ephemeral: true });
      return;
    }

    if (interaction.commandName === "event") {
      const member = await requireStaff(interaction);
      if (!member) return;

      const sub = interaction.options.getSubcommand();
      const events = loadEvents();

      if (sub === "create") {
        const title = interaction.options.getString("title", true);
        const time = interaction.options.getString("time", true);
        const details = interaction.options.getString("details") || "";
        const id = `evt-${Date.now().toString(36)}`;
        events.unshift({
          id,
          title: truncate(title, 120),
          time: truncate(time, 120),
          details: truncate(details, 400),
          createdBy: interaction.user.id,
          createdAt: new Date().toISOString(),
          ended: false
        });
        saveEvents(events);
        await interaction.reply({ content: `Event created: \`${id}\``, ephemeral: true });
        return;
      }

      if (sub === "list") {
        const active = events.filter((e) => !e.ended).slice(0, 10);
        if (!active.length) {
          await interaction.reply({ content: "No active events.", ephemeral: true });
          return;
        }
        await interaction.reply({ content: active.map(formatEvent).join("\n"), ephemeral: true });
        return;
      }

      if (sub === "announce") {
        const id = interaction.options.getString("id", true);
        const evt = events.find((e) => e.id === id);
        if (!evt) {
          await interaction.reply({ content: `Event not found: ${id}`, ephemeral: true });
          return;
        }
        const channel = await client.channels.fetch(announceChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
          await interaction.reply({ content: "Announcement channel not configured.", ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle(`Event: ${evt.title}`)
          .setDescription(evt.details || "Event announcement")
          .addFields(
            { name: "When", value: evt.time, inline: true },
            { name: "Event ID", value: evt.id, inline: true }
          )
          .setColor(0x06b6d4);
        await sendMessageWithGuards(channel, { embeds: [embed] }, "event.announce", reqId);
        await interaction.reply({ content: `Event announced: ${evt.id}`, ephemeral: true });
        return;
      }

      if (sub === "end") {
        const id = interaction.options.getString("id", true);
        const evt = events.find((e) => e.id === id);
        if (!evt) {
          await interaction.reply({ content: `Event not found: ${id}`, ephemeral: true });
          return;
        }
        evt.ended = true;
        evt.endedAt = new Date().toISOString();
        saveEvents(events);
        await interaction.reply({ content: `Event ended: ${evt.id}`, ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "ticket") {
      const sub = interaction.options.getSubcommand();

      if (sub === "create") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const subject = interaction.options.getString("subject", true);
        const details = interaction.options.getString("details") || "No details provided.";
        const parent = ticketChannelId
          ? await client.channels.fetch(ticketChannelId).catch(() => null)
          : interaction.channel;

        if (!parent || !parent.isTextBased()) {
          await interaction.reply({ content: "Ticket channel is not configured or invalid.", ephemeral: true });
          return;
        }

        const supportMention = ticketSupportRoleId ? `<@&${ticketSupportRoleId}>` : "Support team";
        const seed = await sendMessageWithGuards(parent, { content: `🎫 New ticket from <@${interaction.user.id}> — **${truncate(subject, 120)}**\n${supportMention}\n${truncate(details, 900)}` }, "ticket.create", reqId);
        if (!seed) {
          await interaction.reply({ content: "Ticket creation suppressed due to staging/dry-run mode.", ephemeral: true });
          return;
        }
        const thread = await seed.startThread({
          name: `ticket-${interaction.user.username}-${Date.now().toString(36)}`.slice(0, 95),
          autoArchiveDuration: 1440,
          reason: `Ticket by ${interaction.user.tag}`
        }).catch(() => null);

        if (!thread) {
          await interaction.reply({ content: "Unable to create ticket thread. Check bot permissions.", ephemeral: true });
          return;
        }

        await interaction.reply({ content: `Ticket created: ${thread.toString()}`, ephemeral: true });
        return;
      }

      if (sub === "close") {
        const member = await requireStaff(interaction);
        if (!member) return;
        const channel = interaction.channel;
        if (!channel || channel.type !== ChannelType.PublicThread) {
          await interaction.reply({ content: "Run this inside the ticket thread you want to close.", ephemeral: true });
          return;
        }
        await channel.setLocked(true, `Closed by ${interaction.user.tag}`).catch(() => {});
        await channel.setArchived(true, `Closed by ${interaction.user.tag}`).catch(() => {});
        await interaction.reply({ content: "Ticket thread closed.", ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "moddiff") {
      const mods = await adminFetch("/api/admin/content/mods", { reqId });
      const state = loadState();
      const previous = Array.isArray(state.lastModsSnapshot) ? state.lastModsSnapshot : [];
      const current = mods.map((m) => m.name).filter(Boolean);
      const added = current.filter((name) => !previous.includes(name));
      const removed = previous.filter((name) => !current.includes(name));
      if (!added.length && !removed.length) {
        await interaction.reply("No mod changes since last snapshot.");
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle("Modpack Diff")
        .addFields(
          { name: "Added", value: added.length ? truncate(added.map((x) => `+ ${x}`).join("\n"), 900) : "None", inline: false },
          { name: "Removed", value: removed.length ? truncate(removed.map((x) => `- ${x}`).join("\n"), 900) : "None", inline: false }
        )
        .setColor(0x22c55e);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "announce") {
      const member = await requireStaff(interaction);
      if (!member) return;

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
      const sent = await sendMessageWithGuards(channel, { content: everyone ? `@everyone\n${message}` : message }, "announce.send", reqId);
      await interaction.reply({ content: sent ? "Announcement sent." : "Announcement suppressed due to staging/dry-run mode.", ephemeral: true });
      return;
    }

    if (interaction.commandName === "reminder") {
      const member = await requireStaff(interaction);
      if (!member) return;

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

    if (interaction.commandName === "purge") {
      const member = await requireStaff(interaction);
      if (!member) return;
      const amount = interaction.options.getInteger("amount", true);
      if (amount < 1 || amount > 100) {
        await interaction.reply({ content: "Amount must be between 1 and 100.", ephemeral: true });
        return;
      }
      if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: "Invalid channel.", ephemeral: true });
        return;
      }
      const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
      if (!deleted) {
        await interaction.reply({ content: "Failed to purge messages. Check permissions and message age (<14 days).", ephemeral: true });
        return;
      }
      addIncident({
        severity: "medium",
        userId: interaction.user.id,
        reason: `purge ${deleted.size} messages in #${interaction.channel.id}`,
        createdBy: interaction.user.id,
        auto: true
      });
      await interaction.reply({ content: `Deleted ${deleted.size} messages.`, ephemeral: true });
      return;
    }

    if (interaction.commandName === "slowmode") {
      const member = await requireStaff(interaction);
      if (!member) return;
      const seconds = interaction.options.getInteger("seconds", true);
      if (seconds < 0 || seconds > 21600) {
        await interaction.reply({ content: "Slowmode seconds must be between 0 and 21600.", ephemeral: true });
        return;
      }
      if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: "Invalid channel.", ephemeral: true });
        return;
      }
      await interaction.channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.tag}`).catch(() => null);
      addIncident({
        severity: "low",
        userId: interaction.user.id,
        reason: `slowmode ${seconds}s in #${interaction.channel.id}`,
        createdBy: interaction.user.id,
        auto: true
      });
      await interaction.reply({ content: seconds === 0 ? "Slowmode disabled." : `Slowmode set to ${seconds}s.`, ephemeral: true });
      return;
    }

    if (interaction.commandName === "lock" || interaction.commandName === "unlock") {
      const member = await requireStaff(interaction);
      if (!member) return;
      if (!interaction.channel || !interaction.guild) {
        await interaction.reply({ content: "Invalid channel.", ephemeral: true });
        return;
      }
      const everyoneRole = interaction.guild.roles.everyone;
      const lock = interaction.commandName === "lock";
      await interaction.channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: lock ? false : null
      }, { reason: `${interaction.commandName} by ${interaction.user.tag}` }).catch(() => null);
      addIncident({
        severity: "medium",
        userId: interaction.user.id,
        reason: `${interaction.commandName} channel #${interaction.channel.id}`,
        createdBy: interaction.user.id,
        auto: true
      });
      await interaction.reply({ content: lock ? "Channel locked." : "Channel unlocked.", ephemeral: true });
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
      const member = await requireStaff(interaction);
      if (!member) return;

      const activity = await adminFetch("/api/admin/activity?limit=5", { reqId });
      if (!activity.length) {
        await interaction.reply({ content: "No activity yet.", ephemeral: true });
        return;
      }
      const lines = activity.map(item => `${item.timeUtc || ""} • ${item.action} • ${item.target} • ${item.user}`);
      await interaction.reply({ content: truncate(lines.join("\n"), 1800), ephemeral: true });
      return;
    }
  } catch (err) {
    auditStatus = "error";
    auditNote = err instanceof Error ? truncate(err.message, 220) : truncate(String(err), 220);
    bumpMetric("commandError");
    await sendOpsAlert("command-error", `/${interaction.commandName || "unknown"} failed: ${auditNote}`, reqId);
    logEvent("error", "command.error", {
      reqId,
      command: interaction.commandName || "",
      error: auditNote
    });
    if (interaction.deferred) {
      await interaction.editReply({ content: "Error processing command." }).catch(() => {});
    } else if (!interaction.replied) {
      await interaction.reply({ content: "Error processing command.", ephemeral: true });
    }
  } finally {
    logEvent("info", "command.complete", {
      reqId,
      command: interaction.commandName || "",
      status: auditStatus,
      durationMs: Date.now() - auditStartedAt
    });
    appendAuditEntry({
      reqId,
      timeUtc: new Date().toISOString(),
      durationMs: Date.now() - auditStartedAt,
      guildId: interaction.guildId || "",
      channelId: interaction.channelId || "",
      userId: interaction.user?.id || "",
      userTag: interaction.user?.tag || "",
      command: interaction.commandName || "",
      status: auditStatus,
      note: auditNote
    });
  }
});

async function postStatusUpdate() {
  if (!statusChannelId) return;
  bumpMetric("schedulerRun");
  const status = await adminFetch("/api/admin/content/server-status", { reqId: "scheduler-status" });
  const state = loadState();
  const updatedStamp = status.updatedUtc || status.updated || status.dateUtc || "";
  const hash = `${status.status}-${status.message}-${updatedStamp}`;
  if (state.lastStatus === hash) return;

  const previousState = state.lastStatusState || "unknown";
  const mention = statusMention(status.status);
  const embed = new EmbedBuilder()
    .setTitle(`Server Status: ${(status.status || "unknown").toUpperCase()}`)
    .setDescription(status.message || "No status published")
    .addFields(
      { name: "State", value: status.status || "unknown", inline: true },
      { name: "Previous", value: previousState, inline: true },
      { name: "Updated", value: updatedStamp ? new Date(updatedStamp).toUTCString() : "Unknown", inline: false }
    )
    .setColor(statusColor(status.status))
    .setTimestamp();

  enqueueJob({
    type: "status-update",
    channelId: statusChannelId,
    idempotencyKey: `status:${hash}`,
    content: mention || "",
    embeds: [embed],
    maxRetries: 6
  });
  state.lastStatus = hash;
  state.lastStatusState = status.status || "unknown";
  saveState(state);
}

async function postLatestUpdate() {
  if (!announceChannelId) return;
  bumpMetric("schedulerRun");
  const updates = await adminFetch("/api/admin/content/updates", { reqId: "scheduler-updates" });
  if (!updates.length) return;
  const latest = updates[0];
  const state = loadState();
  if (state.lastUpdateId === latest.id) return;

  const embed = new EmbedBuilder()
    .setTitle(`Update: ${latest.title}`)
    .setDescription(previewFromBody(latest.body))
    .addFields(
      { name: "Date", value: latest.date || "Unknown", inline: true },
      { name: "Full Update", value: links.updates, inline: true }
    )
    .setColor(0xb10f16);

  enqueueJob({
    type: "update-post",
    channelId: announceChannelId,
    idempotencyKey: `update:${latest.id}`,
    embeds: [embed],
    maxRetries: 6
  });
  state.lastUpdateId = latest.id;
  saveState(state);
}

async function postLatestTransmission() {
  if (!announceChannelId) return;
  bumpMetric("schedulerRun");
  const items = await adminFetch("/api/admin/content/transmissions", { reqId: "scheduler-transmissions" });
  if (!items.length) return;
  const latest = items[0];
  const state = loadState();
  if (state.lastTransmissionId === latest.id) return;

  const embed = new EmbedBuilder()
    .setTitle(`Transmission: ${latest.title}`)
    .setDescription(previewFromBody(latest.body))
    .addFields(
      { name: "Date", value: latest.date || "Unknown", inline: true },
      { name: "Full Transmission", value: links.transmissions, inline: true }
    )
    .setColor(0xb10f16);

  enqueueJob({
    type: "transmission-post",
    channelId: announceChannelId,
    idempotencyKey: `transmission:${latest.id}`,
    embeds: [embed],
    maxRetries: 6
  });
  state.lastTransmissionId = latest.id;
  saveState(state);
}

async function postModsChange() {
  if (!announceChannelId) return;
  bumpMetric("schedulerRun");
  const mods = await adminFetch("/api/admin/content/mods", { reqId: "scheduler-mods" });
  const state = loadState();
  const hash = hashString(JSON.stringify(mods));
  if (state.lastModsHash === hash) return;

  const embed = new EmbedBuilder()
    .setTitle("Modpack Updated")
    .setDescription("The Grey Hour modpack has changed. Check the website for details.")
    .addFields(
      { name: "Mods", value: String(mods.length), inline: true },
      { name: "Full List", value: links.mods, inline: true }
    )
    .setColor(0xb10f16);

  enqueueJob({
    type: "mods-post",
    channelId: announceChannelId,
    idempotencyKey: `mods:${hash}`,
    embeds: [embed],
    maxRetries: 6
  });
  state.lastModsHash = hash;
  state.lastModsSnapshot = mods.map((m) => m.name).filter(Boolean);
  saveState(state);
}

async function postActivityLog() {
  if (!logChannelId) return;
  bumpMetric("schedulerRun");
  const activity = await adminFetch("/api/admin/activity?limit=20", { reqId: "scheduler-activity" });
  const state = loadState();
  const lastSeen = state.lastActivityTime || 0;

  const items = activity.filter(a => new Date(a.timeUtc || 0).getTime() > lastSeen);
  if (!items.length) return;

  for (const item of items.reverse()) {
    const embed = new EmbedBuilder()
      .setTitle("Admin Activity")
      .setDescription(`${item.action} • ${item.target}`)
      .addFields({ name: "User", value: `${item.user} (${item.role})`, inline: true })
      .setColor(0x9ca3af);
    enqueueJob({
      type: "activity-post",
      channelId: logChannelId,
      idempotencyKey: `activity:${item.timeUtc || ""}:${item.action || ""}:${item.target || ""}`,
      embeds: [embed],
      maxRetries: 6
    });
  }

  const newest = items[items.length - 1];
  state.lastActivityTime = new Date(newest.timeUtc || Date.now()).getTime();
  saveState(state);
}

async function runReminders() {
  bumpMetric("schedulerRun");
  const reminders = loadReminders();
  if (!reminders.length) return;
  const now = Date.now();
  const due = reminders.filter(r => r.due <= now);
  if (!due.length) return;

  for (const r of due) {
    enqueueJob({
      type: "reminder-post",
      channelId: r.channelId || announceChannelId,
      idempotencyKey: `reminder:${r.id}`,
      content: r.message,
      maxRetries: 6
    });
  }
  const remaining = reminders.filter(r => r.due > now);
  saveReminders(remaining);
}

async function runDailyReminder() {
  if (!dailyReminderTime || !dailyReminderMessage || !dailyReminderChannelId) return;
  bumpMetric("schedulerRun");
  const state = loadState();
  const now = new Date();
  const [hh, mm] = dailyReminderTime.split(":").map(n => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return;

  const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  if (state.lastDailyReminder === stamp) return;

  if (now.getHours() === hh && now.getMinutes() === mm) {
    enqueueJob({
      type: "daily-reminder",
      channelId: dailyReminderChannelId,
      idempotencyKey: `daily-reminder:${stamp}`,
      content: dailyReminderMessage,
      maxRetries: 6
    });
    state.lastDailyReminder = stamp;
    saveState(state);
  }
}

async function runDailySummary() {
  if (!dailySummaryTime || !dailySummaryChannelId) return;
  bumpMetric("schedulerRun");
  const state = loadState();
  const now = new Date();
  const [hh, mm] = dailySummaryTime.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return;

  const stamp = now.toISOString().slice(0, 10);
  if (state.lastDailySummary === stamp) return;
  if (now.getHours() !== hh || now.getMinutes() !== mm) return;

  const embed = new EmbedBuilder()
    .setTitle("Daily Bot Summary")
    .setDescription(summarizeMetrics())
    .setColor(0x14b8a6)
    .setTimestamp();

  enqueueJob({
    type: "daily-summary",
    channelId: dailySummaryChannelId,
    idempotencyKey: `daily-summary:${stamp}`,
    embeds: [embed],
    maxRetries: 6
  });
  state.lastDailySummary = stamp;
  saveState(state);
}

async function runCommunityMaintenance() {
  bumpMetric("schedulerRun");
  const community = loadCommunity();
  const now = Date.now();
  community.lfg = ensureArray(community.lfg).filter((x) => !x.expiresAt || x.expiresAt > now);
  community.trades = ensureArray(community.trades).filter((x) => !x.expiresAt || x.expiresAt > now);

  const vcs = ensureArray(community.squadVcs);
  const nextVcs = [];
  for (const row of vcs) {
    const channel = await client.channels.fetch(row.channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildVoice) continue;
    if (channel.members.size === 0 && now - (row.createdAt || now) > 30 * 60 * 1000) {
      await channel.delete("Auto-clean empty squad VC").catch(() => {});
      continue;
    }
    nextVcs.push(row);
  }
  community.squadVcs = nextVcs;
  saveCommunity(community);
}

async function runBackupMaintenance() {
  bumpMetric("schedulerRun");
  const result = applyBackupRetention();
  if (result.deleted.length) {
    logEvent("info", "backup.retention.deleted", { count: result.deleted.length });
  }
}

async function runRetentionMaintenance() {
  bumpMetric("schedulerRun");

  if (fs.existsSync(auditLogFile)) {
    const cutoff = Date.now() - auditRetentionDays * 24 * 60 * 60 * 1000;
    const lines = fs.readFileSync(auditLogFile, "utf-8").split("\n").filter(Boolean);
    const kept = lines.filter((line) => {
      try {
        const row = JSON.parse(line);
        const ts = new Date(row.timeUtc || 0).getTime();
        return Number.isFinite(ts) && ts >= cutoff;
      } catch {
        return false;
      }
    });
    if (kept.length !== lines.length) {
      fs.writeFileSync(auditLogFile, kept.length ? `${kept.join("\n")}\n` : "");
      logEvent("info", "retention.audit.pruned", { removed: lines.length - kept.length });
    }
  }

  const incidents = loadIncidents();
  const incidentCutoff = Date.now() - incidentRetentionDays * 24 * 60 * 60 * 1000;
  const keptIncidents = incidents.filter((row) => {
    const ts = new Date(row.createdAt || 0).getTime();
    return Number.isFinite(ts) && ts >= incidentCutoff;
  });
  if (keptIncidents.length !== incidents.length) {
    saveIncidents(keptIncidents);
    logEvent("info", "retention.incidents.pruned", { removed: incidents.length - keptIncidents.length });
  }

  const modState = loadModCallsState();
  const modCutoff = Date.now() - incidentRetentionDays * 24 * 60 * 60 * 1000;
  const beforeModCases = modState.cases.length;
  const keptCases = modState.cases.filter((row) => {
    const ts = new Date(row.createdAt || 0).getTime();
    if (!Number.isFinite(ts) || ts < modCutoff) {
      return row.status !== "closed" && row.status !== "cancelled";
    }
    return true;
  });
  if (keptCases.length !== modState.cases.length) {
    modState.cases = keptCases;
    saveModCallsState(modState);
    logEvent("info", "retention.modcalls.pruned", { removed: beforeModCases - keptCases.length });
  }
}

async function runModCallEscalations() {
  bumpMetric("schedulerRun");
  const data = loadModCallsState();
  const now = Date.now();
  const openRows = data.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled");
  if (!openRows.length) return;

  const onShiftMentions = Object.entries(data.shifts || {})
    .filter(([, row]) => row?.on)
    .map(([id]) => `<@${id}>`);

  for (const row of openRows) {
    if (row.claimedBy) continue;
    const nextAt = nextEscalationAt(row);
    if (now < nextAt) continue;

    row.escalationCount = Number(row.escalationCount || 0) + 1;
    row.lastEscalatedAt = new Date().toISOString();
    addCaseHistoryRow(row, "escalated", "", `Escalation #${row.escalationCount}`);
    data.stats.escalated += 1;

    const mention = row.escalationCount > 1 && seniorModRoleId
      ? `<@&${seniorModRoleId}>`
      : (onShiftMentions.length ? onShiftMentions.join(" ") : (modCallRoleId ? `<@&${modCallRoleId}>` : "Moderators"));
    const text = `⏱️ Unclaimed mod case \`${row.id}\` needs response (${row.escalationCount} escalation${row.escalationCount === 1 ? "" : "s"}). ${mention}`;

    if (row.threadId) {
      const thread = await client.channels.fetch(row.threadId).catch(() => null);
      if (thread && thread.isTextBased()) {
        await sendMessageWithGuards(thread, { content: text }, "modcall.escalation");
      }
    }
    await sendOpsAlert("modcall-escalation", `Case ${row.id} escalated (${row.escalationCount}).`);
    await notifyReporterUpdate(client, row, "Your case has been escalated for faster moderator response.");
  }

  saveModCallsState(data);
}

async function runModWeeklyDigest() {
  bumpMetric("schedulerRun");
  if (!alertChannelId) return;
  const now = new Date();
  if (now.getUTCDay() !== modCallDigestWeekdayUtc) return;
  if (now.getUTCHours() !== modCallDigestHourUtc || now.getUTCMinutes() !== 0) return;

  const state = loadState();
  const weekKey = `${now.getUTCFullYear()}-${Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))}`;
  if (state.lastModWeeklyDigest === weekKey) return;

  const data = loadModCallsState();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekly = data.cases.filter((x) => new Date(x.createdAt || 0).getTime() >= cutoff);
  const closed = weekly.filter((x) => x.status === "closed");
  const mean = (arr) => arr.length ? Math.floor(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const avgResponse = mean(closed.filter((x) => Number.isFinite(x.firstResponseMs)).map((x) => x.firstResponseMs));
  const avgResolution = mean(closed.filter((x) => Number.isFinite(x.resolutionMs)).map((x) => x.resolutionMs));
  const byMod = {};
  for (const row of closed) {
    if (!row.closedBy) continue;
    byMod[row.closedBy] = (byMod[row.closedBy] || 0) + 1;
  }
  const topMods = Object.entries(byMod).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `<@${id}>:${n}`).join(", ") || "none";

  enqueueJob({
    type: "mod-weekly-digest",
    channelId: alertChannelId,
    idempotencyKey: `mod-weekly-digest:${weekKey}`,
    content: [
      "📊 **Weekly Moderator Digest**",
      `Cases created: ${weekly.length}`,
      `Cases closed: ${closed.length}`,
      `Avg first response: ${Math.floor(avgResponse / 1000)}s`,
      `Avg resolution: ${Math.floor(avgResolution / 60000)}m`,
      `Escalations: ${data.stats.escalated || 0}`,
      `False-report flags: ${data.stats.falseReports || 0}`,
      `Top closers: ${topMods}`
    ].join("\n"),
    maxRetries: 6
  });

  state.lastModWeeklyDigest = weekKey;
  saveState(state);
}

async function runOpsWatchdog() {
  bumpMetric("schedulerRun");
  const state = loadState();
  const jobs = loadJobs();
  const pendingJobs = jobs.filter((x) => x.status === "pending").length;
  if (pendingJobs >= queueBacklogAlertThreshold) {
    await sendOpsAlert("queue-backlog", `Queue backlog is ${pendingJobs}, threshold is ${queueBacklogAlertThreshold}.`);
  }

  const rate = commandWindowTotal > 0 ? (commandWindowErrors / commandWindowTotal) : 0;
  if (commandWindowTotal >= 10 && rate >= commandErrorRateThreshold) {
    await sendOpsAlert("command-error-rate", `Command error rate is ${(rate * 100).toFixed(1)}% over ${commandWindowTotal} recent commands.`);
  }
  commandWindowTotal = 0;
  commandWindowErrors = 0;

  if (metrics.schedulerErrors > Number(state.lastSchedulerErrorsSeen || 0)) {
    state.lastSchedulerErrorsSeen = metrics.schedulerErrors;
    saveState(state);
    await sendOpsAlert("scheduler-errors", `Scheduler errors increased to ${metrics.schedulerErrors}.`);
  }

  const smoke = loadSmokeStatus();
  if (!smoke.checkedAt) {
    await sendOpsAlert("smoke-missing", "No smoke status found. Run npm run smoke.");
    return;
  }
  const ageMs = Date.now() - new Date(smoke.checkedAt).getTime();
  if (smoke.ok === false) {
    await sendOpsAlert("smoke-failed", `Latest smoke check failed at ${smoke.checkedAt}.`);
  } else if (ageMs > smokeStatusMaxAgeMinutes * 60 * 1000) {
    await sendOpsAlert("smoke-stale", `Latest smoke check is stale (${Math.floor(ageMs / 60000)} minutes old).`);
  }
}

function safeScheduler(task) {
  task().catch((err) => {
    bumpMetric("schedulerError");
    const state = loadState();
    state.lastSchedulerErrorAt = new Date().toISOString();
    state.lastSchedulerErrorTask = task.name || "anonymous";
    saveState(state);
    logEvent("error", "scheduler.task.failed", {
      task: task.name || "anonymous",
      error: err instanceof Error ? err.message : String(err)
    });
    sendOpsAlert("scheduler-task-failed", `Task ${task.name || "anonymous"} failed: ${err instanceof Error ? err.message : String(err)}`).catch(() => {});
  });
}

function startSchedulers() {
  safeScheduler(postStatusUpdate);
  safeScheduler(postLatestUpdate);
  safeScheduler(postLatestTransmission);
  safeScheduler(postModsChange);
  safeScheduler(postActivityLog);
  safeScheduler(runModCallEscalations);
  safeScheduler(runOpsWatchdog);

  setInterval(() => safeScheduler(postStatusUpdate), intervalMs(autoStatusMinutes));
  setInterval(() => safeScheduler(postLatestUpdate), intervalMs(autoUpdatesMinutes));
  setInterval(() => safeScheduler(postLatestTransmission), intervalMs(autoTransmissionsMinutes));
  setInterval(() => safeScheduler(postModsChange), intervalMs(autoModsMinutes));
  setInterval(() => safeScheduler(postActivityLog), intervalMs(autoActivityMinutes));
  setInterval(() => safeScheduler(runReminders), 60 * 1000);
  setInterval(() => safeScheduler(runDailyReminder), 60 * 1000);
  setInterval(() => safeScheduler(runDailySummary), 60 * 1000);
  setInterval(() => safeScheduler(runCommunityMaintenance), 5 * 60 * 1000);
  setInterval(() => safeScheduler(runBackupMaintenance), 60 * 60 * 1000);
  setInterval(() => safeScheduler(runRetentionMaintenance), 60 * 60 * 1000);
  setInterval(() => safeScheduler(runModCallEscalations), 60 * 1000);
  setInterval(() => safeScheduler(runModWeeklyDigest), 60 * 1000);
  setInterval(() => safeScheduler(runOpsWatchdog), 60 * 1000);
}

client.login(token);
