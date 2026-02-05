import "dotenv/config";
import fs from "fs";
import http from "http";
import path from "path";
import { randomUUID } from "crypto";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, GatewayIntentBits, ModalBuilder, PermissionsBitField, TextInputBuilder, TextInputStyle } from "discord.js";
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
const modCallFirstResponseSlaMinutes = Number(process.env.MODCALL_FIRST_RESPONSE_SLA_MINUTES || 3);
const modCallResolutionSlaMinutes = Number(process.env.MODCALL_RESOLUTION_SLA_MINUTES || 30);
const modCallFollowupHours = Number(process.env.MODCALL_FOLLOWUP_HOURS || 24);
const modCallDigestHourUtc = Number(process.env.MODCALL_DIGEST_HOUR_UTC || 13);
const modCallDigestWeekdayUtc = Number(process.env.MODCALL_DIGEST_WEEKDAY_UTC || 1);
const adminRequireSecondConfirmation = !/^(0|false|no)$/i.test(process.env.ADMIN_REQUIRE_SECOND_CONFIRMATION || "true");
const raidModeMaxMentions = Number(process.env.RAID_MODE_MAX_MENTIONS || 5);
const raidModeMinAccountDays = Number(process.env.RAID_MODE_MIN_ACCOUNT_DAYS || 7);
const voiceRaidMemberThreshold = Number(process.env.VOICE_RAID_MEMBER_THRESHOLD || 12);
const allowedRoleIds = (process.env.ALLOWED_ROLE_IDS || "").split(",").map(r => r.trim()).filter(Boolean);
const ownerRoleIds = (process.env.OWNER_ROLE_IDS || "").split(",").map(r => r.trim()).filter(Boolean);
const ownerUserIds = (process.env.OWNER_USER_IDS || "").split(",").map(r => r.trim()).filter(Boolean);
const autoStatusMinutes = parsePositiveMinutes(process.env.AUTO_STATUS_MINUTES, 10, "AUTO_STATUS_MINUTES");
const autoActivityMinutes = parsePositiveMinutes(process.env.AUTO_ACTIVITY_MINUTES, 10, "AUTO_ACTIVITY_MINUTES");
const autoUpdatesMinutes = parsePositiveMinutes(process.env.AUTO_UPDATES_MINUTES, 30, "AUTO_UPDATES_MINUTES");
const autoTransmissionsMinutes = parsePositiveMinutes(process.env.AUTO_TRANSMISSIONS_MINUTES, 30, "AUTO_TRANSMISSIONS_MINUTES");
const autoModsMinutes = parsePositiveMinutes(process.env.AUTO_MODS_MINUTES, 60, "AUTO_MODS_MINUTES");
const autoDiscordAutomationMinutes = parsePositiveMinutes(process.env.AUTO_DISCORD_AUTOMATION_MINUTES, 1, "AUTO_DISCORD_AUTOMATION_MINUTES");
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
const commandErrorStreakSafeModeThreshold = Number(process.env.COMMAND_ERROR_STREAK_SAFEMODE_THRESHOLD || 6);
const raidBurstThreshold = Number(process.env.RAID_BURST_THRESHOLD || 20);
const smokeStatusMaxAgeMinutes = Number(process.env.SMOKE_STATUS_MAX_AGE_MINUTES || 30);
const auditRetentionDays = Number(process.env.AUDIT_RETENTION_DAYS || 30);
const incidentRetentionDays = Number(process.env.INCIDENT_RETENTION_DAYS || 180);
const dashboardBaseUrl = process.env.DASHBOARD_BASE_URL || "";
const toxicityAlertThreshold = Number(process.env.TOXICITY_ALERT_THRESHOLD || 6);

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
  if (modCallFirstResponseSlaMinutes < 1) errors.push("MODCALL_FIRST_RESPONSE_SLA_MINUTES must be >= 1.");
  if (modCallResolutionSlaMinutes < 1) errors.push("MODCALL_RESOLUTION_SLA_MINUTES must be >= 1.");
  if (modCallFollowupHours < 1) errors.push("MODCALL_FOLLOWUP_HOURS must be >= 1.");
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
const ticketsFile = path.join(stateDir, "tickets.json");
const userLocalesFile = path.join(stateDir, "user-locales.json");
const shiftPlansFile = path.join(stateDir, "shift-plans.json");
const postmortemsFile = path.join(stateDir, "postmortems.json");
const oncallFile = path.join(stateDir, "oncall.json");
const drillsFile = path.join(stateDir, "drills.json");
const vaultLinksFile = path.join(stateDir, "vault-links.json");
const knowledgeIngestFile = path.join(stateDir, "knowledge-ingest.json");
const modQueueFile = path.join(stateDir, "mod-queue.json");
const adminSnapshotsFile = path.join(stateDir, "admin-snapshots.json");
const auditLogFile = path.join(stateDir, "audit.log.jsonl");
const jobsFile = path.join(stateDir, "jobs.json");
const smokeStatusFile = path.join(stateDir, "smoke-status.json");
const backupsDir = path.join(stateDir, "backups");
const roleSyncFile = path.join(process.cwd(), "config", "role-sync.json");
const staffProfilesFile = path.join(process.cwd(), "config", "staff-profiles.json");

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
  modCallsClosed: 0,
  roleSyncUpdates: 0,
  commandLatency: {
    le_200: 0,
    le_500: 0,
    le_1000: 0,
    gt_1000: 0
  }
};
const commandCooldowns = new Map();
const abuseUserWindow = new Map();
const abuseChannelWindow = new Map();
const toxicityWindow = new Map();
const commandErrorStreaks = new Map();
let jobWorkerRunning = false;
let metricsServer = null;
let commandWindowTotal = 0;
let commandWindowErrors = 0;
const cooldownMs = {
  default: 3000,
  clear: 12000,
  purge: 10000,
  ticket: 5000,
  modcall: 5000,
  incident: 5000,
  ops: 4000,
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
  tickets: ticketsFile,
  locales: userLocalesFile,
  shiftPlans: shiftPlansFile,
  postmortems: postmortemsFile,
  oncall: oncallFile,
  drills: drillsFile,
  vaultLinks: vaultLinksFile,
  knowledgeIngest: knowledgeIngestFile,
  modQueue: modQueueFile,
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

const PLAYBOOKS = {
  harassment: [
    "Acknowledge report and separate involved users immediately.",
    "Collect evidence: screenshots, message links, witness statements.",
    "Issue proportionate action: warning, timeout, role restriction, or removal.",
    "Log incident and notify reporter of outcome."
  ],
  cheating: [
    "Secure evidence first: clips, logs, timestamps, and related reports.",
    "Avoid public accusations while investigation is active.",
    "Apply temporary controls if active harm is ongoing.",
    "Document final decision with rationale and linked evidence."
  ],
  spam: [
    "Apply slowmode and remove obvious spam payloads.",
    "Quarantine repeat offenders with timeout or channel restrictions.",
    "Escalate to lockdown if coordinated spam persists.",
    "Post concise public status so members know action is in progress."
  ],
  raid: [
    "Enable raid mode and alert on-shift moderators.",
    "Suppress harmful links/mentions and lock impacted channels if needed.",
    "Triage accounts by age, behavior, and coordinated patterns.",
    "After stabilization, unwind temporary restrictions and post summary."
  ]
};

const ANNOUNCE_PRESETS = {
  restart: "Server restart scheduled soon. Please secure your character and prepare to reconnect.",
  maintenance: "Maintenance is in progress. Some services may be unavailable temporarily.",
  wipe: "World wipe schedule has been posted. Review the latest update for exact timing.",
  incident: "Staff is actively handling an in-game incident. Please avoid speculation while we investigate.",
  resolved: "The earlier incident has been resolved. Thank you for your patience."
};

const HELP_CATALOG = [
  { syntax: "/ping", desc: "Check bot latency.", staffOnly: false },
  { syntax: "/help", desc: "Show commands you can use based on your roles.", staffOnly: false },
  { syntax: "/status", desc: "Show current server status.", staffOnly: false },
  { syntax: "/statushistory", desc: "Show recent status history.", staffOnly: false },
  { syntax: "/updates", desc: "Show the latest server update.", staffOnly: false },
  { syntax: "/transmissions", desc: "Show latest transmission/lore post.", staffOnly: false },
  { syntax: "/mods", desc: "Show modpack info.", staffOnly: false },
  { syntax: "/rules", desc: "Get the rules link.", staffOnly: false },
  { syntax: "/join", desc: "Get join instructions.", staffOnly: false },
  { syntax: "/links", desc: "Show key Grey Hour RP links.", staffOnly: false },
  { syntax: "/lore", desc: "Show lore primer.", staffOnly: false },
  { syntax: "/whois", desc: "Show member profile details.", staffOnly: false },
  { syntax: "/playercount", desc: "Show live player count.", staffOnly: false },
  { syntax: "/serverip", desc: "Show server connection details.", staffOnly: false },
  { syntax: "/staff", desc: "Show owner/admin/mod staff directory.", staffOnly: false },
  { syntax: "/ticket create", desc: "Open a private support ticket channel.", staffOnly: false },
  { syntax: "/lfg", desc: "Create/manage looking-for-group posts.", staffOnly: false },
  { syntax: "/faction", desc: "Faction and roster tools.", staffOnly: false },
  { syntax: "/trade", desc: "Create/manage trade listings.", staffOnly: false },
  { syntax: "/contest", desc: "Start/manage contests.", staffOnly: false },
  { syntax: "/raid", desc: "Create/manage raid events.", staffOnly: false },
  { syntax: "/signup", desc: "Join/leave event signups.", staffOnly: false },
  { syntax: "/mapmark", desc: "Save and view map markers.", staffOnly: false },
  { syntax: "/safehouse", desc: "Request/review safehouse claims.", staffOnly: false },
  { syntax: "/commend", desc: "Commend helpful members.", staffOnly: false },
  { syntax: "/leaderboard", desc: "Show community leaderboard.", staffOnly: false },
  { syntax: "/squadvc", desc: "Create/close squad voice channels.", staffOnly: false },
  { syntax: "/survivor", desc: "Get survivor tips/challenges.", staffOnly: false },
  { syntax: "/pz", desc: "Project Zomboid quick tips.", staffOnly: false },
  { syntax: "/optin", desc: "Toggle alert roles.", staffOnly: false },
  { syntax: "/modcall", desc: "Run moderator call workflow.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/case assign-next", desc: "Auto-assign next open case to least-busy on-shift mod.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/case timeline", desc: "Render full timeline for a case.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/triage", desc: "Analyze issue text and suggest category/urgency/actions.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/lang", desc: "Set your language preference for bot responses.", staffOnly: false },
  { syntax: "/voice panic-move", desc: "Move everyone in your current voice channel to another channel.", staffOnly: true, policyKey: "mod" },
  { syntax: "/voice mute-cooldown", desc: "Apply short timeout to users in your current voice channel.", staffOnly: true, policyKey: "mod" },
  { syntax: "/trustgraph", desc: "Summarize trust/risk context for a user.", staffOnly: true, policyKey: "incident" },
  { syntax: "/policy test", desc: "Simulate whether a user can run a command by policy.", staffOnly: true, policyKey: "ops" },
  { syntax: "/copilot suggest", desc: "Get next-step moderation recommendations for a case.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/shiftplan add|list|remove", desc: "Manage personal shift reminders (UTC).", staffOnly: true, policyKey: "mod" },
  { syntax: "/mod", desc: "Set shift status and view moderation metrics.", staffOnly: true, policyKey: "mod" },
  { syntax: "/incident", desc: "Create/list/resolve/link moderation incidents.", staffOnly: true, policyKey: "incident" },
  { syntax: "/incident correlate", desc: "Correlate incident/case/ticket patterns for a user.", staffOnly: true, policyKey: "incident" },
  { syntax: "/incident report", desc: "Generate post-incident summary report.", staffOnly: true, policyKey: "incident" },
  { syntax: "/incident postmortem_create", desc: "Draft a postmortem for an incident.", staffOnly: true, policyKey: "incident" },
  { syntax: "/incident postmortem_approve", desc: "Approve a postmortem draft.", staffOnly: true, policyKey: "incident" },
  { syntax: "/incident wizard", desc: "Guided incident response checklist.", staffOnly: true, policyKey: "incident" },
  { syntax: "/audit", desc: "View/export command audit logs.", staffOnly: true, policyKey: "audit" },
  { syntax: "/audit verify", desc: "Verify audit hash chain integrity.", staffOnly: true, policyKey: "audit" },
  { syntax: "/backup", desc: "Create/list/restore bot data backups.", staffOnly: true, policyKey: "backup" },
  { syntax: "/ops", desc: "Operations status, maintenance, safemode, inventory.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops dashboard", desc: "Show dashboard and metrics endpoints.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops simulation", desc: "Toggle simulation mode for drills.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops remediate", desc: "Apply one-click incident remediation recipe to a channel.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops organize", desc: "Preview/apply server channel organization cleanup.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops analytics", desc: "Show command usage and error trends.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops syncpanel", desc: "Sync bot ops snapshot to admin panel.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops disaster", desc: "Enable/disable disaster recovery mode.", staffOnly: true, policyKey: "ops" },
  { syntax: "/rolesync", desc: "Preview/validate role-sync rules.", staffOnly: true, policyKey: "ops" },
  { syntax: "/permissions audit", desc: "Check missing bot permissions in key channels.", staffOnly: true, policyKey: "ops" },
  { syntax: "/staffpanel", desc: "Open one-click staff action panel.", staffOnly: true, policyKey: "ops" },
  { syntax: "/staffquickstart", desc: "Post and pin staff quickstart guide.", staffOnly: true, policyKey: "ops" },
  { syntax: "/playbook", desc: "Show moderation SOP playbooks.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/modcall wizard", desc: "Guided moderation workflow checklist.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/handoff", desc: "Generate shift handoff summary.", staffOnly: true, policyKey: "mod" },
  { syntax: "/staffstats", desc: "Show moderator performance stats.", staffOnly: true, policyKey: "mod" },
  { syntax: "/knowledge", desc: "Search rules/playbooks/FAQ knowledge snippets.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/admin", desc: "Admin control plane actions and approvals.", staffOnly: true, policyKey: "admin" },
  { syntax: "/announce", desc: "Post custom or preset announcements.", staffOnly: true, policyKey: "announce" },
  { syntax: "/announcepreset", desc: "Send preset announcement template.", staffOnly: true, policyKey: "announce" },
  { syntax: "/health", desc: "Run bot health checks.", staffOnly: true, policyKey: "health" },
  { syntax: "/diagnose", desc: "Diagnose command policy, perms, cooldown, and context.", staffOnly: false },
  { syntax: "/oncall", desc: "Manage and ping on-call rota.", staffOnly: true, policyKey: "ops" },
  { syntax: "/sla board", desc: "Show SLA queue and breach status.", staffOnly: true, policyKey: "mod" },
  { syntax: "/summarize", desc: "Summarize channel/user moderation context.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/safety score", desc: "Show channel safety score.", staffOnly: true, policyKey: "incident" },
  { syntax: "/drill", desc: "Run and score red-team drills.", staffOnly: true, policyKey: "ops" },
  { syntax: "/vault", desc: "Create/list signed evidence links.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/kb", desc: "Ingest and search custom knowledge snippets.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/approve", desc: "Approve/deny pending high-risk requests.", staffOnly: true, policyKey: "admin" },
  { syntax: "/metrics", desc: "Show runtime metrics summary.", staffOnly: true, policyKey: "metrics" },
  { syntax: "/poll", desc: "Create quick reaction poll.", staffOnly: true, policyKey: "poll" },
  { syntax: "/event", desc: "Create/list/announce/end events.", staffOnly: true, policyKey: "event" },
  { syntax: "/ticket close", desc: "Close ticket thread/channel.", staffOnly: true },
  { syntax: "/ticket forceclose", desc: "Owner/admin force-delete a ticket channel/thread (recovery path).", staffOnly: true, policyKey: "admin" },
  { syntax: "/ticket reopen", desc: "Reopen closed ticket by id.", staffOnly: true },
  { syntax: "/ticket feedback", desc: "Submit post-ticket satisfaction feedback.", staffOnly: false },
  { syntax: "/onboard", desc: "Post onboarding panel.", staffOnly: true, policyKey: "onboard" },
  { syntax: "/raidmode", desc: "Toggle raid mode protections.", staffOnly: true, policyKey: "raidmode" },
  { syntax: "/reminder", desc: "Manage scheduled reminders.", staffOnly: true, policyKey: "reminder" },
  { syntax: "/activity", desc: "Show recent admin activity.", staffOnly: true, policyKey: "activity" },
  { syntax: "/purge", desc: "Bulk-delete recent messages.", staffOnly: true, policyKey: "purge" },
  { syntax: "/clear messages", desc: "Batch clear up to 1000 recent messages from a channel.", staffOnly: true, policyKey: "purge" },
  { syntax: "/clear nuke", desc: "Recreate a channel to fully wipe history.", staffOnly: true, policyKey: "purge" },
  { syntax: "/slowmode", desc: "Set channel slowmode.", staffOnly: true, policyKey: "slowmode" },
  { syntax: "/lock", desc: "Lock channel for @everyone.", staffOnly: true, policyKey: "lock" },
  { syntax: "/unlock", desc: "Unlock channel for @everyone.", staffOnly: true, policyKey: "unlock" }
];

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

function isSimulationModeEnabled() {
  const state = loadState();
  return Boolean(state.simulationModeEnabled);
}

function setSimulationModeEnabled(enabled, actorId = "") {
  const state = loadState();
  state.simulationModeEnabled = Boolean(enabled);
  state.simulationModeUpdatedAt = new Date().toISOString();
  state.simulationModeUpdatedBy = actorId;
  saveState(state);
}

function getUserRiskScore(userId) {
  const state = loadState();
  const map = state.userRiskScores && typeof state.userRiskScores === "object" ? state.userRiskScores : {};
  return Number(map[userId] || 0);
}

function adjustUserRiskScore(userId, delta, reason = "") {
  if (!userId) return;
  const state = loadState();
  const map = state.userRiskScores && typeof state.userRiskScores === "object" ? state.userRiskScores : {};
  const next = Math.max(0, Number(map[userId] || 0) + Number(delta || 0));
  map[userId] = next;
  state.userRiskScores = map;
  state.lastRiskUpdate = {
    userId,
    delta,
    reason: truncate(reason, 200),
    at: new Date().toISOString()
  };
  saveState(state);
}

function getUserLocale(userId) {
  const map = loadUserLocales();
  return String(map[userId] || "en");
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

function loadTickets() {
  try {
    if (!fs.existsSync(ticketsFile)) return [];
    return JSON.parse(fs.readFileSync(ticketsFile, "utf-8"));
  } catch {
    return [];
  }
}

function saveTickets(list) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(ticketsFile, JSON.stringify(list, null, 2));
  } catch {}
}

function loadUserLocales() {
  return readJsonFile(userLocalesFile, {});
}

function saveUserLocales(map) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(userLocalesFile, JSON.stringify(map || {}, null, 2));
  } catch {}
}

function loadShiftPlans() {
  return readJsonFile(shiftPlansFile, []);
}

function saveShiftPlans(list) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(shiftPlansFile, JSON.stringify(list || [], null, 2));
  } catch {}
}

function loadPostmortems() {
  return readJsonFile(postmortemsFile, []);
}

function savePostmortems(list) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(postmortemsFile, JSON.stringify(list || [], null, 2));
  } catch {}
}

function loadOncall() {
  return readJsonFile(oncallFile, []);
}

function saveOncall(rows) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(oncallFile, JSON.stringify(rows || [], null, 2));
  } catch {}
}

function loadDrills() {
  return readJsonFile(drillsFile, []);
}

function saveDrills(rows) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(drillsFile, JSON.stringify(rows || [], null, 2));
  } catch {}
}

function loadVaultLinks() {
  return readJsonFile(vaultLinksFile, []);
}

function saveVaultLinks(rows) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(vaultLinksFile, JSON.stringify(rows || [], null, 2));
  } catch {}
}

function loadKnowledgeIngest() {
  return readJsonFile(knowledgeIngestFile, []);
}

function saveKnowledgeIngest(rows) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(knowledgeIngestFile, JSON.stringify(rows || [], null, 2));
  } catch {}
}

function loadModQueue() {
  return readJsonFile(modQueueFile, []);
}

function saveModQueue(rows) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(modQueueFile, JSON.stringify(rows || [], null, 2));
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

function loadAdminSnapshots() {
  return readJsonFile(adminSnapshotsFile, []);
}

function saveAdminSnapshots(rows) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(adminSnapshotsFile, JSON.stringify(rows, null, 2));
  } catch {}
}

function loadPendingAdminApprovals() {
  const state = loadState();
  return Array.isArray(state.pendingAdminApprovals) ? state.pendingAdminApprovals : [];
}

function savePendingAdminApprovals(rows) {
  const state = loadState();
  state.pendingAdminApprovals = rows;
  saveState(state);
}

function isHighRiskAdminAction(action) {
  if (!adminRequireSecondConfirmation) return false;
  return ["purge", "lockdown", "unlockdown", "rollback"].includes(action);
}

function describeAdminAction(action, payload) {
  if (action === "purge") return `purge ${payload.amount} in #${payload.channelId}`;
  if (action === "lockdown") return `lockdown #${payload.channelId}`;
  if (action === "unlockdown") return `unlockdown #${payload.channelId}`;
  if (action === "rolegrant") return `rolegrant role ${payload.roleId} to user ${payload.userId}`;
  if (action === "rolerevoke") return `rolerevoke role ${payload.roleId} from user ${payload.userId}`;
  if (action === "snapshot") return `snapshot ${payload.label || "manual"}`;
  if (action === "rollback") return `rollback snapshot ${payload.snapshotId}`;
  return action;
}

function createApprovalRecord(action, payload, requestedBy, guildId, channelId) {
  return {
    id: makeId("apr"),
    action,
    payload,
    requestedBy,
    guildId,
    channelId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    confirmations: [],
    requiredConfirmations: 1,
    status: "pending"
  };
}

async function sendApprovalMessage(interaction, record, reqId = "") {
  const actionText = describeAdminAction(record.action, record.payload);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`adminapprove:confirm:${record.id}`).setLabel("Confirm").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`adminapprove:reject:${record.id}`).setLabel("Reject").setStyle(ButtonStyle.Secondary)
  );
  await sendMessageWithGuards(interaction.channel, {
    content: [
      `🔐 **Admin Approval Required**`,
      `Request: \`${record.id}\``,
      `Requester: <@${record.requestedBy}>`,
      `Action: ${actionText}`,
      `Policy: second staff confirmation required`,
      `Expires: ${record.expiresAt}`
    ].join("\n"),
    components: [row]
  }, "admin.approval.request", reqId);
}

function getEveryoneSendState(channel, everyoneRoleId) {
  const overwrite = channel.permissionOverwrites.cache.get(everyoneRoleId);
  if (!overwrite) return "inherit";
  if (overwrite.allow.has(PermissionsBitField.Flags.SendMessages)) return "allow";
  if (overwrite.deny.has(PermissionsBitField.Flags.SendMessages)) return "deny";
  return "inherit";
}

async function createGuildSnapshot(guild, label, actorId) {
  await guild.channels.fetch();
  const items = guild.channels.cache
    .filter((c) => c?.isTextBased?.() && c.type !== ChannelType.DM)
    .map((channel) => ({
      channelId: channel.id,
      sendState: getEveryoneSendState(channel, guild.roles.everyone.id),
      slowmode: typeof channel.rateLimitPerUser === "number" ? channel.rateLimitPerUser : 0
    }));
  const row = {
    id: makeId("snap"),
    label: truncate(label || "snapshot", 80),
    guildId: guild.id,
    createdBy: actorId,
    createdAt: new Date().toISOString(),
    items
  };
  const rows = loadAdminSnapshots();
  rows.unshift(row);
  saveAdminSnapshots(rows.slice(0, 200));
  return row;
}

async function applyGuildSnapshot(guild, snapshot) {
  const everyone = guild.roles.everyone;
  for (const item of snapshot.items || []) {
    const channel = await guild.channels.fetch(item.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) continue;
    if (typeof item.slowmode === "number" && channel.rateLimitPerUser !== undefined) {
      await channel.setRateLimitPerUser(Math.max(0, Math.min(item.slowmode, 21600)), `Rollback snapshot ${snapshot.id}`).catch(() => {});
    }
    if (item.sendState === "deny") {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: false }, { reason: `Rollback snapshot ${snapshot.id}` }).catch(() => {});
    } else if (item.sendState === "allow") {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: true }, { reason: `Rollback snapshot ${snapshot.id}` }).catch(() => {});
    } else {
      await channel.permissionOverwrites.edit(everyone, { SendMessages: null }, { reason: `Rollback snapshot ${snapshot.id}` }).catch(() => {});
    }
  }
}

async function executeAdminAction(interaction, action, payload, actorId, reqId = "") {
  if (!interaction.inGuild() || !interaction.guild) throw new Error("Admin actions require guild context.");
  const guild = interaction.guild;
  if (action === "purge") {
    const channel = await guild.channels.fetch(payload.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) throw new Error("Target channel invalid.");
    const amount = Math.max(1, Math.min(Number(payload.amount || 1), 100));
    const deleted = await channel.bulkDelete(amount, true).catch(() => null);
    if (!deleted) throw new Error("Bulk delete failed.");
    return `Purged ${deleted.size} messages in <#${channel.id}>.`;
  }
  if (action === "clear_nuke") {
    const channel = await guild.channels.fetch(payload.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) throw new Error("Target channel invalid.");
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
      throw new Error("Nuke supports text/announcement channels only.");
    }
    const cloned = await channel.clone({ reason: `Approved nuke by ${actorId}` }).catch(() => null);
    if (!cloned) throw new Error("Failed to clone channel for nuke.");
    await cloned.setPosition(channel.position).catch(() => null);
    await channel.delete(`Approved nuke by ${actorId}`).catch(() => null);
    return `Nuked channel <#${payload.channelId}> -> <#${cloned.id}>.`;
  }
  if (action === "lockdown" || action === "unlockdown") {
    const channel = await guild.channels.fetch(payload.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) throw new Error("Target channel invalid.");
    const lock = action === "lockdown";
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: lock ? false : null }, {
      reason: `${action} by ${actorId}${payload.reason ? `: ${payload.reason}` : ""}`
    }).catch(() => {});
    return `${lock ? "Locked" : "Unlocked"} <#${channel.id}>.`;
  }
  if (action === "rolegrant" || action === "rolerevoke") {
    const member = await guild.members.fetch(payload.userId).catch(() => null);
    const role = await guild.roles.fetch(payload.roleId).catch(() => null);
    if (!member || !role) throw new Error("Member or role not found.");
    if (action === "rolegrant") {
      await member.roles.add(role, `rolegrant by ${actorId}`).catch(() => null);
      return `Granted <@&${role.id}> to <@${member.id}>.`;
    }
    await member.roles.remove(role, `rolerevoke by ${actorId}`).catch(() => null);
    return `Revoked <@&${role.id}> from <@${member.id}>.`;
  }
  if (action === "snapshot") {
    const snapshot = await createGuildSnapshot(guild, payload.label || "manual", actorId);
    return `Snapshot created: \`${snapshot.id}\` (${snapshot.items.length} channels).`;
  }
  if (action === "rollback") {
    const snapshot = loadAdminSnapshots().find((x) => x.id === payload.snapshotId && x.guildId === guild.id);
    if (!snapshot) throw new Error("Snapshot not found.");
    await applyGuildSnapshot(guild, snapshot);
    return `Rollback applied from snapshot \`${snapshot.id}\`.`;
  }
  throw new Error(`Unsupported admin action: ${action}`);
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

function getOpenCaseLoadByModerator(data) {
  const load = {};
  for (const row of data.cases || []) {
    if (row.status === "closed" || row.status === "cancelled") continue;
    if (!row.claimedBy) continue;
    load[row.claimedBy] = (load[row.claimedBy] || 0) + 1;
  }
  return load;
}

function loadStaffProfiles() {
  const raw = readJsonFile(staffProfilesFile, { profiles: [] });
  const profiles = Array.isArray(raw.profiles) ? raw.profiles : [];
  const map = {};
  for (const p of profiles) {
    const userId = String(p?.userId || "").trim();
    if (!userId) continue;
    map[userId] = {
      expertise: Array.isArray(p?.expertise) ? p.expertise.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [],
      unavailable: Boolean(p?.unavailable)
    };
  }
  return map;
}

function triageContent(text) {
  const body = String(text || "").toLowerCase();
  const signals = {
    urgent: /(urgent|asap|immediately|now|critical|emergency|threat|dox|suicide|self-harm)/i.test(body),
    cheating: /(cheat|aimbot|esp|exploit|dup|dupe|hack|script)/i.test(body),
    harassment: /(harass|abuse|slur|hate|threat|stalk)/i.test(body),
    spam: /(spam|raid|flood|invite link|phish|scam)/i.test(body),
    payment: /(payment|chargeback|refund|donat)/i.test(body)
  };
  let category = "general";
  if (signals.cheating) category = "cheating";
  else if (signals.harassment) category = "harassment";
  else if (signals.spam) category = "spam";
  else if (signals.payment) category = "billing";
  const urgency = signals.urgent ? "urgent" : (signals.spam ? "high" : "normal");
  const actions = [];
  if (urgency === "urgent") actions.push("Page on-shift staff immediately.");
  if (category === "spam") actions.push("Apply slowmode/lockdown controls.");
  if (category === "harassment") actions.push("Separate users and preserve evidence.");
  if (category === "cheating") actions.push("Collect clips/logs before enforcement.");
  if (!actions.length) actions.push("Acknowledge and gather full context.");
  return { category, urgency, actions };
}

function pickLeastBusyModerator(data, candidateIds, context = {}) {
  if (!candidateIds.length) return "";
  const load = getOpenCaseLoadByModerator(data);
  const profiles = loadStaffProfiles();
  const preferred = String(context.preferredExpertise || "").toLowerCase();
  const now = Date.now();
  return candidateIds
    .slice()
    .sort((a, b) => {
      const da = load[a] || 0;
      const db = load[b] || 0;
      const pa = profiles[a] || { expertise: [], unavailable: false };
      const pb = profiles[b] || { expertise: [], unavailable: false };
      if (pa.unavailable !== pb.unavailable) return pa.unavailable ? 1 : -1;
      const ea = preferred && pa.expertise.includes(preferred) ? -1 : 0;
      const eb = preferred && pb.expertise.includes(preferred) ? -1 : 0;
      if (ea !== eb) return ea - eb;
      const oldestOpenA = data.cases
        .filter((x) => x.claimedBy === a && x.status !== "closed" && x.status !== "cancelled")
        .map((x) => now - new Date(x.createdAt || 0).getTime())
        .sort((x, y) => y - x)[0] || 0;
      const oldestOpenB = data.cases
        .filter((x) => x.claimedBy === b && x.status !== "closed" && x.status !== "cancelled")
        .map((x) => now - new Date(x.createdAt || 0).getTime())
        .sort((x, y) => y - x)[0] || 0;
      if (da !== db) return da - db;
      if (oldestOpenA !== oldestOpenB) return oldestOpenA - oldestOpenB;
      return a.localeCompare(b);
    })[0] || "";
}

function buildStaffStats(data, targetUserId = "") {
  const rows = (data.cases || []).filter((x) => !targetUserId || x.claimedBy === targetUserId || x.closedBy === targetUserId);
  const byMod = {};
  for (const row of rows) {
    const key = row.closedBy || row.claimedBy || "";
    if (!key) continue;
    if (!byMod[key]) {
      byMod[key] = { assigned: 0, closed: 0, reopened: 0, responseMs: [], resolutionMs: [] };
    }
    if (row.claimedBy === key) byMod[key].assigned += 1;
    if (row.closedBy === key) byMod[key].closed += 1;
    if (Number.isFinite(row.firstResponseMs)) byMod[key].responseMs.push(row.firstResponseMs);
    if (Number.isFinite(row.resolutionMs)) byMod[key].resolutionMs.push(row.resolutionMs);
    if (ensureArray(row.history).some((h) => h.action === "reopened")) byMod[key].reopened += 1;
  }
  return byMod;
}

function buildUserContextSummary(userId) {
  if (!userId) return "No user context.";
  const incidents = loadIncidents().filter((x) => x.userId === userId);
  const modState = loadModCallsState();
  const cases = modState.cases.filter((x) => x.reporterId === userId || x.targetUserId === userId);
  const tickets = loadTickets().filter((x) => x.userId === userId);
  const openCases = cases.filter((x) => x.status !== "closed" && x.status !== "cancelled").length;
  const openTickets = tickets.filter((x) => x.status === "open").length;
  const risk = getUserRiskScore(userId);
  return [
    `Risk score: ${risk}`,
    `Incidents: ${incidents.length} (${incidents.filter((x) => x.status === "open").length} open)`,
    `Mod cases: ${cases.length} (${openCases} open)`,
    `Tickets: ${tickets.length} (${openTickets} open)`
  ].join("\n");
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
  const locale = getUserLocale(row.reporterId);
  const prefix = formatLocalized(locale, "case_prefix", { id: row.id });
  await reporter.send(`${prefix} ${truncate(message, 1500)}`).catch(() => {});
}

function formatLocalized(locale, key, params = {}) {
  const l = String(locale || "en").toLowerCase();
  const dict = {
    en: {
      case_prefix: "Case `{id}`:",
      ticket_closed_dm: "Your ticket ({name}) was closed by staff. If needed, open a new ticket with /ticket create.",
      ticket_reopened_dm: "Your ticket ({name}) has been reopened by staff.",
      ticket_feedback_thanks: "Thanks for your feedback."
    },
    es: {
      case_prefix: "Caso `{id}`:",
      ticket_closed_dm: "Tu ticket ({name}) fue cerrado por el staff. Si lo necesitas, abre otro con /ticket create.",
      ticket_reopened_dm: "Tu ticket ({name}) fue reabierto por el staff.",
      ticket_feedback_thanks: "Gracias por tu comentario."
    },
    pt: {
      case_prefix: "Caso `{id}`:",
      ticket_closed_dm: "Seu ticket ({name}) foi fechado pela equipe. Se precisar, abra outro com /ticket create.",
      ticket_reopened_dm: "Seu ticket ({name}) foi reaberto pela equipe.",
      ticket_feedback_thanks: "Obrigado pelo seu feedback."
    },
    fr: {
      case_prefix: "Dossier `{id}`:",
      ticket_closed_dm: "Votre ticket ({name}) a ete ferme par l'equipe. Si besoin, ouvrez-en un autre avec /ticket create.",
      ticket_reopened_dm: "Votre ticket ({name}) a ete rouvert par l'equipe.",
      ticket_feedback_thanks: "Merci pour votre retour."
    }
  };
  const table = dict[l] || dict.en;
  const template = table[key] || dict.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
}

function addIncident(record) {
  const incidents = loadIncidents();
  const row = {
    id: makeId("inc"),
    status: "open",
    createdAt: new Date().toISOString(),
    ...record
  };
  incidents.unshift(row);
  saveIncidents(incidents);
  const sev = String(row.severity || "low");
  const delta = sev === "critical" ? 15 : sev === "high" ? 10 : sev === "medium" ? 5 : 2;
  adjustUserRiskScore(row.userId || "", delta, `incident:${sev}`);
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

function loadRoleSyncRules() {
  const raw = readJsonFile(roleSyncFile, { rules: [] });
  const rules = Array.isArray(raw.rules) ? raw.rules : [];
  return rules
    .map((r) => ({
      sourceRoleId: String(r?.sourceRoleId || "").trim(),
      applyRoleIds: Array.isArray(r?.applyRoleIds) ? r.applyRoleIds.map((x) => String(x).trim()).filter(Boolean) : []
    }))
    .filter((r) => r.sourceRoleId && r.applyRoleIds.length);
}

function getKnowledgeRows() {
  const rows = [
    { topic: "rules", text: `Community rules and conduct policy: ${links.rules}` },
    { topic: "join", text: `Join guide and onboarding steps: ${links.join}` },
    { topic: "status", text: "Use /status and /statushistory for real-time and recent service state." },
    { topic: "modcall", text: "Use /modcall create for intake, /modcall status for updates, /modcall export for evidence bundle." },
    { topic: "rolesync", text: "Use /rolesync preview to inspect drift and /rolesync validate apply:true to repair mappings." },
    { topic: "handoff", text: "Use /handoff include_cases:true to generate shift transition summaries." }
  ];
  for (const [topic, steps] of Object.entries(PLAYBOOKS)) {
    rows.push({ topic: `playbook-${topic}`, text: `${topic} playbook: ${steps.join(" ")}` });
  }
  for (const row of loadKnowledgeIngest().slice(0, 500)) {
    rows.push({ topic: String(row.topic || "custom"), text: String(row.text || "") });
  }
  return rows;
}

function searchKnowledge(query, limit = 5) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const rows = getKnowledgeRows().map((row) => {
    const hay = `${row.topic} ${row.text}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (hay.includes(term)) score += 1;
    }
    if (hay.includes(q)) score += 2;
    return { ...row, score };
  });
  return rows.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

function buildRoleSyncPlan(member, rules) {
  const managedRoleIds = new Set();
  const desiredByRoleId = new Map();
  for (const rule of rules) {
    const hasSource = member.roles.cache.has(rule.sourceRoleId);
    for (const roleId of rule.applyRoleIds) {
      managedRoleIds.add(roleId);
      const currentDesired = desiredByRoleId.get(roleId) || false;
      desiredByRoleId.set(roleId, currentDesired || hasSource);
    }
  }

  const toAdd = [];
  const toRemove = [];
  for (const roleId of managedRoleIds) {
    const hasRole = member.roles.cache.has(roleId);
    const shouldHave = Boolean(desiredByRoleId.get(roleId));
    if (shouldHave && !hasRole) toAdd.push(roleId);
    if (!shouldHave && hasRole) toRemove.push(roleId);
  }
  return { toAdd, toRemove, managedCount: managedRoleIds.size };
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
  if (channelCount >= raidBurstThreshold) {
    const community = loadCommunity();
    if (!community.raidMode) {
      community.raidMode = true;
      saveCommunity(community);
      sendOpsAlert("raid-burst", `Auto-enabled raid mode after burst detected in channel ${channelKey} (${channelCount}/${abuseWindowSeconds}s).`).catch(() => {});
    }
  }
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

function getStaffRoleIdsForTicketing() {
  const policy = loadPermissionPolicy();
  const commandRoleIds = policy.commandRoleIds && typeof policy.commandRoleIds === "object" ? policy.commandRoleIds : {};
  const include = (key) => Array.isArray(commandRoleIds[key]) ? commandRoleIds[key] : [];
  const roleIds = new Set([
    ...ownerRoleIds,
    ...allowedRoleIds,
    ...include("admin"),
    ...include("mod"),
    ...include("modcall"),
    ...include("ticket"),
    modCallRoleId,
    seniorModRoleId,
    ticketSupportRoleId
  ].filter(Boolean));
  return Array.from(roleIds);
}

async function closeTicketConversation(interaction, channel) {
  if (!channel) return false;

  const isThread = channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread;
  const parent = isThread ? (channel.parent || null) : null;
  const host = parent && parent.type === ChannelType.GuildText ? parent : channel;
  const hostName = String(host?.name || "");
  const isTicketChannel = host?.type === ChannelType.GuildText && hostName.startsWith("ticket-");
  if (!isTicketChannel) return false;

  const topicSource = String(host?.topic || channel?.topic || "");
  const targetId = topicSource.match(/\((\d+)\)/)?.[1] || "";
  const tickets = loadTickets();
  let changed = false;
  for (const row of tickets) {
    if (row.status !== "open") continue;
    if (row.channelId === channel.id || row.channelId === host.id) {
      row.status = "closed";
      row.closedAt = new Date().toISOString();
      row.closedBy = interaction.user.id;
      changed = true;
    }
  }
  if (changed) saveTickets(tickets);

  const closedTicket = loadTickets().find((x) => (x.channelId === channel.id || x.channelId === host.id) && x.status === "closed");

  if (targetId) {
    const user = await interaction.client.users.fetch(targetId).catch(() => null);
    if (user) {
      const locale = getUserLocale(targetId);
      await user.send(formatLocalized(locale, "ticket_closed_dm", { name: host.name || "ticket" })).catch(() => {});
      const closedId = closedTicket?.id || "your-ticket";
      await user.send(`Feedback: run \`/ticket feedback ticket_id:${closedId} rating:5 note:...\` to rate support.`).catch(() => {});
    }
  }

  if (closedTicket && logChannelId) {
    const logChannel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      const summary = [
        "Ticket Auto Summary",
        `Ticket: \`${closedTicket.id || "unknown"}\``,
        `User: <@${closedTicket.userId || targetId || "unknown"}>`,
        `Subject: ${truncate(closedTicket.subject || "n/a", 120)}`,
        `Urgency: ${closedTicket.urgency || "normal"}`,
        `Category: ${closedTicket.triageCategory || "unknown"}`,
        `Closed by: <@${interaction.user.id}>`
      ].join("\n");
      await sendMessageWithGuards(logChannel, { content: summary }, "ticket.close.summary");
    }
  }

  await interaction.reply({ content: "Ticket chat closed and deleted.", ephemeral: true });
  const deleted = await channel.delete(`Ticket closed by ${interaction.user.tag}`).then(() => true).catch(() => false);
  if (!deleted) {
    await interaction.editReply({ content: "Ticket marked closed, but I could not delete this channel/thread. Check bot Manage Channels permission." }).catch(() => {});
  }
  return true;
}

function isTicketLikeChannel(channel) {
  if (!channel) return false;
  if (channel.type === ChannelType.GuildText) {
    return String(channel.name || "").startsWith("ticket-");
  }
  if (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread) {
    const parent = channel.parent || null;
    return parent?.type === ChannelType.GuildText && String(parent.name || "").startsWith("ticket-");
  }
  return false;
}

async function cleanupCaseConversations(guild, row, actorTag = "system") {
  if (!guild || !row) return { deleted: 0, details: [] };
  const targets = [];
  const details = [];

  if (row.threadId) {
    const thread = await guild.channels.fetch(row.threadId).catch(() => null);
    if (thread && (thread.type === ChannelType.PublicThread || thread.type === ChannelType.PrivateThread)) {
      targets.push(thread);
    }
  }

  if (row.sourceChannelId) {
    const source = await guild.channels.fetch(row.sourceChannelId).catch(() => null);
    if (source && isTicketLikeChannel(source)) {
      if (source.type === ChannelType.PublicThread || source.type === ChannelType.PrivateThread) {
        const parent = source.parent || null;
        if (parent && isTicketLikeChannel(parent)) targets.push(parent);
        else targets.push(source);
      } else {
        targets.push(source);
      }
    }
  }

  const unique = new Map();
  for (const c of targets) unique.set(c.id, c);

  let deleted = 0;
  for (const channel of unique.values()) {
    const ok = await channel.delete(`Case cleanup by ${actorTag}`).then(() => true).catch(() => false);
    if (ok) {
      deleted += 1;
      details.push(`#${channel.name || channel.id}`);
    }
  }
  return { deleted, details };
}

function getOncallPair() {
  const rows = loadOncall().filter((x) => x && x.userId);
  if (!rows.length) return { primary: null, backup: null };
  const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const primary = rows[day % rows.length];
  const backup = rows[(day + 1) % rows.length] || null;
  return { primary, backup };
}

function buildSlaBoard() {
  const data = loadModCallsState();
  const now = Date.now();
  const open = data.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled");
  const firstDue = open.filter((x) => !x.claimedBy).map((x) => ({
    id: x.id,
    dueMs: (new Date(x.createdAt || 0).getTime() + modCallFirstResponseSlaMinutes * 60 * 1000) - now
  }));
  const resolveDue = open.filter((x) => x.claimedBy).map((x) => ({
    id: x.id,
    dueMs: (new Date(x.createdAt || 0).getTime() + modCallResolutionSlaMinutes * 60 * 1000) - now
  }));
  const overdueFirst = firstDue.filter((x) => x.dueMs < 0).length;
  const overdueResolve = resolveDue.filter((x) => x.dueMs < 0).length;
  return {
    open: open.length,
    unclaimed: open.filter((x) => !x.claimedBy).length,
    overdueFirst,
    overdueResolve,
    hotCases: open
      .sort((a, b) => (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()))
      .slice(0, 8)
      .map((x) => `${x.id}:${x.priority || "normal"}:${x.claimedBy ? "claimed" : "unclaimed"}`)
  };
}

async function summarizeChannelActivity(channel, minutes = 30) {
  if (!channel || !channel.isTextBased()) return "Channel unavailable.";
  const maxMinutes = Math.max(5, Math.min(minutes, 180));
  const since = Date.now() - maxMinutes * 60 * 1000;
  const fetched = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!fetched || !fetched.size) return `No recent messages in the last ${maxMinutes}m.`;
  const rows = fetched.filter((m) => m.createdTimestamp >= since);
  if (!rows.size) return `No recent messages in the last ${maxMinutes}m.`;
  const participants = new Set();
  const keywords = {};
  let flagged = 0;
  for (const m of rows.values()) {
    if (m.author?.bot) continue;
    participants.add(m.author.id);
    const text = String(m.content || "").toLowerCase();
    if (/(kys|kill yourself|nigger|faggot|retard|rape|dox|swat|ddos|die)/i.test(text)) flagged += 1;
    for (const term of text.split(/\W+/).filter(Boolean)) {
      if (term.length < 4) continue;
      keywords[term] = (keywords[term] || 0) + 1;
    }
  }
  const top = Object.entries(keywords).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k).join(", ") || "none";
  return [
    `Window: ${maxMinutes}m`,
    `Messages: ${rows.size}`,
    `Participants: ${participants.size}`,
    `Flagged toxicity hits: ${flagged}`,
    `Top terms: ${top}`
  ].join("\n");
}

function safetyScoreForChannel(channelId) {
  const keyPrefix = `:${channelId || "unknown"}`;
  let toxicHits = 0;
  for (const [k, arr] of toxicityWindow.entries()) {
    if (k.endsWith(keyPrefix)) toxicHits += arr.length;
  }
  const incidents = loadIncidents().filter((x) => String(x.reason || "").includes(`#${channelId}`)).length;
  const score = Math.max(0, 100 - (toxicHits * 8 + incidents * 5));
  return { score, toxicHits, incidents };
}

async function notifyUrgentStaff(guild, payload) {
  if (!guild) return { sent: 0, failed: 0 };
  await guild.members.fetch();
  const staffRoleIds = new Set(getStaffRoleIdsForTicketing());
  const ownerIdSet = new Set([guild.ownerId, ...ownerUserIds]);
  const targets = guild.members.cache
    .filter((m) => !m.user.bot && (ownerIdSet.has(m.id) || m.roles.cache.some((r) => staffRoleIds.has(r.id))))
    .map((m) => m.user);

  let sent = 0;
  let failed = 0;
  const msg = [
    `🚨 ${payload.title || "Urgent Staff Alert"}`,
    payload.summary || "Urgent issue requires staff attention.",
    payload.link ? `Jump: ${payload.link}` : "",
    payload.reporterId ? `Reporter: <@${payload.reporterId}>` : ""
  ].filter(Boolean).join("\n");

  for (const user of targets) {
    const ok = await user.send(msg).then(() => true).catch(() => false);
    if (ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed };
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

function loadAdminSafeModeState() {
  const state = loadState();
  return {
    enabled: Boolean(state.adminSafeModeEnabled),
    updatedAt: state.adminSafeModeUpdatedAt || "",
    updatedBy: state.adminSafeModeUpdatedBy || ""
  };
}

function setAdminSafeMode(enabled, actorId = "") {
  const state = loadState();
  state.adminSafeModeEnabled = Boolean(enabled);
  state.adminSafeModeUpdatedAt = new Date().toISOString();
  state.adminSafeModeUpdatedBy = actorId;
  saveState(state);
}

function isSafeModeBlockedAdminAction(action) {
  if (!loadAdminSafeModeState().enabled) return false;
  return ["purge", "lockdown", "unlockdown", "rollback", "rolegrant", "rolerevoke"].includes(action);
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

const ORGANIZE_CATEGORY_BY_BUCKET = {
  information: "INFORMATION",
  community: "COMMUNITY",
  support: "SUPPORT",
  staff: "STAFF",
  voice: "VOICE"
};

function classifyChannelBucket(channel) {
  const name = String(channel?.name || "").toLowerCase();
  const isVoice = channel?.type === ChannelType.GuildVoice || channel?.type === ChannelType.GuildStageVoice;
  if (isVoice) return "voice";

  if (name.startsWith("ticket-") || name.includes("ticket") || name.includes("support") || name.includes("modcall")) {
    return "support";
  }
  if (/(staff|admin|moderator|mod-|mod_|ops|audit|secure|owner|internal|logs?)/i.test(name)) {
    return "staff";
  }
  if (/(rules|welcome|announc|status|updates?|news|faq|how-?to|server|changelog|guide|readme)/i.test(name)) {
    return "information";
  }
  return "community";
}

function normalizeChannelName(rawName) {
  const next = String(rawName || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
  return next || "channel";
}

function planGuildOrganization(guild, opts = {}) {
  const includeVoice = opts.includeVoice !== false;
  const normalizeNames = Boolean(opts.normalizeNames);
  const limit = Math.max(1, Math.min(Number(opts.limit || 30), 100));
  const actions = [];

  const channels = Array.from(guild.channels.cache.values())
    .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0));

  for (const channel of channels) {
    if (!channel || channel.type === ChannelType.GuildCategory) continue;
    if (channel.isThread?.()) continue;
    const isVoice = channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice;
    if (isVoice && !includeVoice) continue;
    if (typeof channel.setParent !== "function") continue;

    const bucket = classifyChannelBucket(channel);
    const desiredCategory = ORGANIZE_CATEGORY_BY_BUCKET[bucket] || ORGANIZE_CATEGORY_BY_BUCKET.community;
    const currentCategory = channel.parent?.type === ChannelType.GuildCategory
      ? String(channel.parent.name || "").toUpperCase()
      : "";
    const moveNeeded = currentCategory !== desiredCategory;

    let renameTo = "";
    if (normalizeNames && channel.type !== ChannelType.GuildAnnouncement) {
      const nextName = normalizeChannelName(channel.name);
      if (nextName && nextName !== channel.name) renameTo = nextName;
    }

    if (!moveNeeded && !renameTo) continue;
    actions.push({
      channelId: channel.id,
      channelName: channel.name,
      channelType: String(channel.type),
      bucket,
      fromCategory: currentCategory || "none",
      toCategory: desiredCategory,
      renameTo
    });
    if (actions.length >= limit) break;
  }

  return {
    includeVoice,
    normalizeNames,
    limit,
    actions
  };
}

async function ensureCategoryChannel(guild, categoryName, reason) {
  const upper = String(categoryName || "").toUpperCase();
  const existing = guild.channels.cache.find((c) =>
    c.type === ChannelType.GuildCategory && String(c.name || "").toUpperCase() === upper
  );
  if (existing) return existing;
  return guild.channels.create({
    name: categoryName,
    type: ChannelType.GuildCategory,
    reason
  }).catch(() => null);
}

async function applyGuildOrganizationPlan(guild, plan, actorTag = "system") {
  const requiredCats = Array.from(new Set(plan.actions.map((x) => x.toCategory)));
  const categories = {};
  for (const name of requiredCats) {
    const cat = await ensureCategoryChannel(guild, name, `Channel organization by ${actorTag}`);
    if (cat) categories[name] = cat;
  }

  let moved = 0;
  let renamed = 0;
  let failed = 0;
  const failures = [];

  for (const action of plan.actions) {
    const channel = await guild.channels.fetch(action.channelId).catch(() => null);
    if (!channel) {
      failed += 1;
      failures.push(`${action.channelName}: channel missing`);
      continue;
    }

    let ok = true;
    const targetCategory = categories[action.toCategory] || null;
    if (targetCategory && channel.parentId !== targetCategory.id) {
      const movedOk = await channel.setParent(targetCategory.id, { lockPermissions: false }).then(() => true).catch(() => false);
      if (movedOk) moved += 1;
      else ok = false;
    }

    if (action.renameTo && channel.name !== action.renameTo) {
      const renamedOk = await channel.setName(action.renameTo, `Channel organization by ${actorTag}`).then(() => true).catch(() => false);
      if (renamedOk) renamed += 1;
      else ok = false;
    }

    if (!ok) {
      failed += 1;
      if (failures.length < 10) failures.push(`${action.channelName}: insufficient permissions or conflict`);
    }
  }

  return { moved, renamed, failed, failures };
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
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await channel.send(payload);
    } catch (err) {
      const status = Number(err?.status || err?.code || 0);
      const retryable = status === 429 || status >= 500 || String(err?.message || "").toLowerCase().includes("timeout");
      if (!retryable || attempt === maxAttempts) {
        logEvent("warn", "dispatch.failed", {
          reqId,
          context,
          channelId: channel.id,
          attempt,
          error: truncate(err instanceof Error ? err.message : String(err), 220)
        });
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  return null;
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
    if (req.url === "/dashboard") {
      const jobs = loadJobs();
      const pendingJobs = jobs.filter((x) => x.status === "pending").length;
      const modState = loadModCallsState();
      const openModCases = modState.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled").length;
      const payload = {
        generatedAt: new Date().toISOString(),
        deployTag,
        mode: dryRunMode ? "dry-run" : (stagingMode ? "staging" : "live"),
        simulationMode: isSimulationModeEnabled(),
        metrics: {
          commandsTotal: metrics.commandsTotal,
          commandErrors: metrics.commandErrors,
          apiCalls: metrics.apiCalls,
          apiErrors: metrics.apiErrors,
          queuePending: pendingJobs,
          queueFailed: metrics.queueFailed,
          modCallsOpen: openModCases,
          modCallsCreated: metrics.modCallsCreated,
          modCallsClaimed: metrics.modCallsClaimed,
          modCallsClosed: metrics.modCallsClosed
        },
        analytics: computeCommandAnalytics(8, 7)
      };
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload, null, 2));
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
      `gh_bot_modcalls_open ${openModCases}`,
      "# HELP gh_bot_rolesync_updates_total Total role-sync updates made.",
      "# TYPE gh_bot_rolesync_updates_total counter",
      `gh_bot_rolesync_updates_total ${metrics.roleSyncUpdates}`,
      "# HELP gh_bot_command_latency_bucket Interaction duration buckets.",
      "# TYPE gh_bot_command_latency_bucket counter",
      `gh_bot_command_latency_bucket{le=\"200\"} ${metrics.commandLatency.le_200}`,
      `gh_bot_command_latency_bucket{le=\"500\"} ${metrics.commandLatency.le_500}`,
      `gh_bot_command_latency_bucket{le=\"1000\"} ${metrics.commandLatency.le_1000}`,
      `gh_bot_command_latency_bucket{le=\"+Inf\"} ${metrics.commandLatency.gt_1000}`
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
    let prevHash = "";
    if (fs.existsSync(auditLogFile)) {
      const lastLine = fs.readFileSync(auditLogFile, "utf-8").trim().split("\n").filter(Boolean).slice(-1)[0] || "";
      if (lastLine) {
        try {
          const parsed = JSON.parse(lastLine);
          prevHash = parsed.hash || "";
        } catch {}
      }
    }
    const payload = { ...entry, prevHash };
    payload.hash = sha256(JSON.stringify({
      reqId: payload.reqId || "",
      timeUtc: payload.timeUtc || "",
      command: payload.command || "",
      status: payload.status || "",
      userId: payload.userId || "",
      prevHash
    }));
    fs.appendFileSync(auditLogFile, `${JSON.stringify(payload)}\n`);
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

function verifyAuditChain(limit = 2000) {
  try {
    if (!fs.existsSync(auditLogFile)) return { ok: true, checked: 0, failedAt: -1 };
    const lines = fs.readFileSync(auditLogFile, "utf-8").trim().split("\n").filter(Boolean).slice(-limit);
    let prevHash = "";
    for (let i = 0; i < lines.length; i += 1) {
      const row = JSON.parse(lines[i]);
      const expected = sha256(JSON.stringify({
        reqId: row.reqId || "",
        timeUtc: row.timeUtc || "",
        command: row.command || "",
        status: row.status || "",
        userId: row.userId || "",
        prevHash
      }));
      if ((row.prevHash || "") !== prevHash || (row.hash || "") !== expected) {
        return { ok: false, checked: i + 1, failedAt: i + 1 };
      }
      prevHash = row.hash || "";
    }
    return { ok: true, checked: lines.length, failedAt: -1 };
  } catch {
    return { ok: false, checked: 0, failedAt: 0 };
  }
}

function computeCommandAnalytics(limit = 10, days = 7) {
  const max = Math.max(3, Math.min(Number(limit || 10), 20));
  const since = Date.now() - (Math.max(1, Number(days || 7)) * 24 * 60 * 60 * 1000);
  const rows = loadAuditEntries(5000).filter((x) => new Date(x.timeUtc || 0).getTime() >= since);
  const total = rows.length;
  const errors = rows.filter((x) => x.status === "error").length;
  const denied = rows.filter((x) => x.status === "denied").length;
  const byCommand = {};
  const byRole = { owner: 0, admin: 0, mod: 0, user: 0 };
  for (const row of rows) {
    const key = String(row.command || "unknown");
    if (!byCommand[key]) byCommand[key] = { total: 0, error: 0, avgMs: 0, _sum: 0 };
    byCommand[key].total += 1;
    if (row.status === "error") byCommand[key].error += 1;
    byCommand[key]._sum += Number(row.durationMs || 0);
    const note = String(row.note || "").toLowerCase();
    if (note.includes("owner")) byRole.owner += 1;
    else if (note.includes("admin")) byRole.admin += 1;
    else if (note.includes("mod")) byRole.mod += 1;
    else byRole.user += 1;
  }
  const top = Object.entries(byCommand)
    .map(([command, v]) => ({
      command,
      total: v.total,
      errorRate: v.total ? Math.round((v.error / v.total) * 1000) / 10 : 0,
      avgMs: v.total ? Math.round(v._sum / v.total) : 0
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, max);
  return { total, errors, denied, byRole, top };
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
  const method = ctx.method || "GET";
  const headers = { "X-Request-ID": reqId };
  const authHeader = getAdminAuthHeader();
  if (authHeader) headers.Authorization = authHeader;

  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const startedAt = Date.now();
    try {
      const res = await fetch(`${apiBase}${pathname}`, {
        method,
        headers: {
          ...headers,
          ...(ctx.body ? { "Content-Type": "application/json" } : {})
        },
        body: ctx.body ? JSON.stringify(ctx.body) : undefined
      });
      if (!res.ok) {
        const body = await res.text();
        const retryable = res.status === 429 || res.status >= 500;
        if (!retryable || attempt === 3) {
          bumpMetric("apiError");
          logEvent("warn", "admin.fetch.error", {
            reqId,
            pathname,
            status: res.status,
            attempt,
            durationMs: Date.now() - startedAt
          });
          throw new Error(`${res.status} ${body}`);
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 350));
        continue;
      }
      logEvent("info", "admin.fetch.ok", {
        reqId,
        pathname,
        method,
        status: res.status,
        attempt,
        durationMs: Date.now() - startedAt
      });
      if (res.status === 204) return null;
      const text = await res.text();
      if (!text) return null;
      return JSON.parse(text);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }
  bumpMetric("apiError");
  throw new Error(lastError || "Admin API request failed.");
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

function isOwnerOrAdminMember(guild, member) {
  if (!guild || !member) return false;
  const isOwner = member.id === guild.ownerId || ownerUserIds.includes(member.id) || hasRole(member, ownerRoleIds);
  if (isOwner) return true;
  const policy = loadPermissionPolicy();
  const adminRoleIds = Array.isArray(policy.commandRoleIds?.admin) ? policy.commandRoleIds.admin : [];
  return member.permissions.has(PermissionsBitField.Flags.Administrator) || hasRole(member, adminRoleIds);
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
    `Latency Buckets: <=200ms ${metrics.commandLatency.le_200}, <=500ms ${metrics.commandLatency.le_500}, <=1000ms ${metrics.commandLatency.le_1000}, >1000ms ${metrics.commandLatency.gt_1000}`,
    `API Calls: ${metrics.apiCalls} (${metrics.apiErrors} errors)`,
    `Scheduler: ${metrics.schedulerRuns} runs (${metrics.schedulerErrors} errors)`,
    `Queue: ${metrics.queueProcessed} processed, ${pendingJobs} pending, ${metrics.queueFailed} failed`,
    `Abuse Blocks: ${metrics.abuseBlocked}`,
    `Mod Calls: ${metrics.modCallsCreated} created, ${metrics.modCallsClaimed} claimed, ${metrics.modCallsClosed} closed`,
    `Role Sync Updates: ${metrics.roleSyncUpdates}`
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

function formatPermAuditMissing(missing) {
  return missing.length ? missing.join(", ") : "none";
}

async function runPermissionAudit(guild) {
  const botMember = await guild.members.fetch(client.user.id).catch(() => null);
  if (!botMember) return [{ label: "Bot Member", ok: false, missing: ["Unable to load bot member"] }];

  const channelChecks = [
    { id: announceChannelId, label: "Announcement" },
    { id: statusChannelId, label: "Status" },
    { id: logChannelId, label: "Log" },
    { id: modCallChannelId, label: "Modcall" },
    { id: ticketChannelId, label: "Ticket" }
  ].filter((x) => x.id);

  const requiredChannelPerms = [
    "ViewChannel",
    "SendMessages",
    "EmbedLinks",
    "AttachFiles",
    "ReadMessageHistory",
    "ManageMessages",
    "CreatePublicThreads",
    "SendMessagesInThreads"
  ];
  const rows = [];

  for (const check of channelChecks) {
    const channel = await guild.channels.fetch(check.id).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      rows.push({
        label: `${check.label} #${check.id}`,
        ok: false,
        missing: ["Channel not found or not text"],
        suggestion: `Verify channel id for ${check.label} and update bot .env if needed.`
      });
      continue;
    }
    const perms = channel.permissionsFor(botMember);
    const missing = requiredChannelPerms.filter((p) => !perms?.has(PermissionsBitField.Flags[p]));
    rows.push({
      label: `${check.label} #${channel.name || channel.id}`,
      ok: missing.length === 0,
      missing,
      suggestion: missing.length ? `Grant ${missing.join(", ")} to bot role in #${channel.name || channel.id}.` : ""
    });
  }

  const guildMissing = [];
  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) guildMissing.push("ManageRoles");
  if (!botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers)) guildMissing.push("ModerateMembers");
  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageChannels)) guildMissing.push("ManageChannels");
  rows.unshift({
    label: "Guild-wide Permissions",
    ok: guildMissing.length === 0,
    missing: guildMissing,
    suggestion: guildMissing.length ? `Grant guild permissions to bot role: ${guildMissing.join(", ")}.` : ""
  });
  return rows;
}

async function runStartupDiagnostics() {
  console.log("[diag] Starting startup diagnostics...");
  console.log(`[diag] Deploy tag: ${deployTag} | mode=${dryRunMode ? "dry-run" : (stagingMode ? "staging" : "live")}`);
  console.log(`[diag] Scheduler minutes: status=${autoStatusMinutes}, updates=${autoUpdatesMinutes}, transmissions=${autoTransmissionsMinutes}, mods=${autoModsMinutes}, activity=${autoActivityMinutes}, automation=${autoDiscordAutomationMinutes}`);
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

  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  await guild.members.fetch();
  await guild.roles.fetch();
  const onlineOnly = interaction.isChatInputCommand() ? (interaction.options.getBoolean("online_only") || false) : true;
  const hasPresenceData = guild.members.cache.some((m) => Boolean(m.presence));
  if (onlineOnly && !hasPresenceData) {
    await interaction.editReply({
      content: "Online filtering requires member presence data. Enable Presence Intent for the bot, then try again."
    });
    return;
  }
  const isOnline = (m) => !onlineOnly || (m.presence && m.presence.status !== "offline");

  const ownerRoleIdSet = new Set(ownerRoleIds);
  const ownerUserIdSet = new Set([guild.ownerId, ...ownerUserIds]);
  const adminIds = new Set(allowedRoleIds);
  const modIds = new Set([modCallRoleId, seniorModRoleId].filter(Boolean));

  const ownerMembers = guild.members.cache
    .filter((m) => (ownerUserIdSet.has(m.id) || m.roles.cache.some((r) => ownerRoleIdSet.has(r.id))) && isOnline(m))
    .map((m) => `<@${m.id}>`)
    .slice(0, 30);

  const adminMembers = guild.members.cache
    .filter((m) => m.roles.cache.some((r) => adminIds.has(r.id)) && isOnline(m))
    .map((m) => `<@${m.id}>`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 50);

  const modMembers = guild.members.cache
    .filter((m) => m.roles.cache.some((r) => modIds.has(r.id)) && isOnline(m))
    .map((m) => `<@${m.id}>`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 80);

  const embed = new EmbedBuilder()
    .setTitle(onlineOnly ? "Staff Directory (Online)" : "Staff Directory")
    .setDescription(onlineOnly ? "Currently online staff by role group" : "Current staff by role group")
    .addFields(
      { name: "Owners", value: ownerMembers.join(", ") || "None configured", inline: false },
      { name: "Admins", value: adminMembers.join(", ") || "None configured", inline: false },
      { name: "Moderators", value: modMembers.join(", ") || "None configured", inline: false }
    )
    .setColor(0x2563eb)
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
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

async function requireOwnerOrAdmin(interaction, policyKey = "admin") {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
    return null;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: "Unable to load your member profile.", ephemeral: true });
    return null;
  }
  const isOwner = member.id === interaction.guild.ownerId || ownerUserIds.includes(member.id) || hasRole(member, ownerRoleIds);
  if (!isOwnerOrAdminMember(interaction.guild, member)) {
    await interaction.reply({ content: "Owner/Admin only.", ephemeral: true });
    return null;
  }
  if (!isOwner && policyKey && !hasPolicyAccess(member, policyKey)) {
    await interaction.reply({ content: `Permission policy denied access to /${policyKey}.`, ephemeral: true });
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
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
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

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  try {
    const rules = loadRoleSyncRules();
    if (!rules.length) return;

    const sourceChanged = rules.some((rule) => oldMember.roles.cache.has(rule.sourceRoleId) !== newMember.roles.cache.has(rule.sourceRoleId));
    if (!sourceChanged) return;

    const plan = buildRoleSyncPlan(newMember, rules);
    let changed = false;
    for (const roleId of plan.toAdd) {
      await newMember.roles.add(roleId, "Role sync: source role mapping gained").catch(() => null);
      changed = true;
    }
    for (const roleId of plan.toRemove) {
      await newMember.roles.remove(roleId, "Role sync: source role mapping lost").catch(() => null);
      changed = true;
    }

    if (changed) {
      metrics.roleSyncUpdates += 1;
      logEvent("info", "rolesync.member.updated", { userId: newMember.id, guildId: newMember.guild.id });
    }
  } catch (err) {
    logEvent("error", "rolesync.member.update.failed", { error: err instanceof Error ? err.message : String(err) });
  }
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const toxicPattern = /(kys|kill yourself|nigger|faggot|retard|rape|dox|swat|ddos|die)/i;
  if (toxicPattern.test(message.content || "")) {
    const key = `${message.guild.id}:${message.channelId || "unknown"}`;
    const now = Date.now();
    const arr = toxicityWindow.get(key) || [];
    const next = arr.filter((t) => now - t < 10 * 60 * 1000);
    next.push(now);
    toxicityWindow.set(key, next);
    if (next.length >= toxicityAlertThreshold) {
      const channel = await client.channels.fetch(message.channelId).catch(() => null);
      await sendOpsAlert("toxicity-spike", `Potential toxicity spike in #${channel?.name || message.channelId}: ${next.length} flagged messages in 10m.`);
      toxicityWindow.set(key, []);
    }
  }

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

client.on("messageReactionAdd", async (reaction, user) => {
  try {
    if (user?.bot) return;
    const r = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
    if (!r || !r.message || !r.message.guild) return;
    const emoji = r.emoji?.name || "";
    if (emoji !== "⚠️") return;
    const queue = loadModQueue();
    const key = `${r.message.id}:${user.id}`;
    if (queue.some((x) => x.key === key)) return;
    const row = {
      id: makeId("mq"),
      key,
      messageId: r.message.id,
      channelId: r.message.channelId,
      guildId: r.message.guild.id,
      requestedBy: user.id,
      createdAt: new Date().toISOString(),
      status: "open"
    };
    queue.unshift(row);
    saveModQueue(queue.slice(0, 1000));
    const oncall = getOncallPair();
    const ping = oncall.primary ? `<@${oncall.primary.userId}>` : (modCallRoleId ? `<@&${modCallRoleId}>` : "staff");
    const channel = modCallChannelId ? await client.channels.fetch(modCallChannelId).catch(() => null) : null;
    if (channel && channel.isTextBased()) {
      await sendMessageWithGuards(channel, {
        content: `⚠️ Mod request queued by <@${user.id}> in <#${r.message.channelId}>. ${ping}\nMessage: https://discord.com/channels/${r.message.guild.id}/${r.message.channelId}/${r.message.id}`
      }, "modqueue.reaction");
    }
  } catch {}
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "ticket:intake") {
      const subject = interaction.fields.getTextInputValue("subject");
      const details = interaction.fields.getTextInputValue("details");
      const urgency = interaction.fields.getTextInputValue("urgency");
      await interaction.reply({
        content: `Received intake form. Run \`/ticket create subject:\"${truncate(subject, 80)}\" details:\"${truncate(details, 120)}\" urgency:${/(urgent|high)/i.test(urgency) ? "high" : "normal"}\` to open the private ticket.`,
        ephemeral: true
      });
      return;
    }
    return;
  }

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

    if (interaction.customId.startsWith("staffpanel:")) {
      const isStaff = isStaffMember(interaction, member) && hasPolicyAccess(member, "ops");
      if (!isStaff) {
        await interaction.reply({ content: "Only staff can use this panel.", ephemeral: true });
        return;
      }
      const action = interaction.customId.split(":")[1];
      const data = loadModCallsState();
      if (action === "staff") {
        await renderStaffList(interaction);
        return;
      }
      if (action === "coverage") {
        const onShiftIds = Object.entries(data.shifts).filter(([, v]) => v?.on).map(([id]) => id);
        const openCases = data.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled").length;
        await interaction.reply({ content: `On-shift: ${onShiftIds.length}\nOpen cases: ${openCases}`, ephemeral: true });
        return;
      }
      if (action === "opsstatus") {
        await interaction.reply({ content: summarizeMetrics(), ephemeral: true });
        return;
      }
      if (action === "rolesync") {
        await interaction.guild.members.fetch();
        const rules = loadRoleSyncRules();
        let drifted = 0;
        for (const row of interaction.guild.members.cache.values()) {
          if (row.user.bot) continue;
          const plan = buildRoleSyncPlan(row, rules);
          if (plan.toAdd.length || plan.toRemove.length) drifted += 1;
        }
        await interaction.reply({ content: `Role-sync quick check: ${drifted} member(s) drifted. Run \`/rolesync validate\` for details.`, ephemeral: true });
        return;
      }
      if (action === "modqueue") {
        const openRows = data.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled").slice(0, 10);
        if (!openRows.length) {
          await interaction.reply({ content: "No open moderation cases.", ephemeral: true });
          return;
        }
        await interaction.reply({ content: truncate(openRows.map(buildModCallSummaryRow).join("\n"), 1900), ephemeral: true });
        return;
      }
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
        if (action === "close") {
          const closed = await closeTicketConversation(interaction, interaction.channel);
          if (closed) return;
        }
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
        const cleanup = await cleanupCaseConversations(interaction.guild, row, interaction.user.tag);
        await interaction.reply({
          content: cleanup.deleted
            ? `Case \`${caseId}\` closed. Deleted linked ticket/chat channel(s): ${cleanup.details.join(", ")}`
            : `Case \`${caseId}\` closed.`,
          ephemeral: true
        });
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

    if (interaction.customId.startsWith("adminapprove:")) {
      const [, decision, approvalId] = interaction.customId.split(":");
      const isStaff = isStaffMember(interaction, member) && hasPolicyAccess(member, "admin");
      if (!isStaff) {
        await interaction.reply({ content: "Only staff with /admin access can approve this request.", ephemeral: true });
        return;
      }
      const approvals = loadPendingAdminApprovals();
      const row = approvals.find((x) => x.id === approvalId);
      if (!row || row.status !== "pending") {
        await interaction.reply({ content: "Approval request not found or already resolved.", ephemeral: true });
        return;
      }
      if (new Date(row.expiresAt).getTime() < Date.now()) {
        row.status = "expired";
        savePendingAdminApprovals(approvals);
        await interaction.reply({ content: "Approval request has expired.", ephemeral: true });
        return;
      }

      if (decision === "reject") {
        row.status = "rejected";
        row.rejectedBy = interaction.user.id;
        row.rejectedAt = new Date().toISOString();
        savePendingAdminApprovals(approvals);
        await interaction.reply({ content: `Rejected admin request \`${approvalId}\`.`, ephemeral: true });
        return;
      }

      if (interaction.user.id === row.requestedBy) {
        await interaction.reply({ content: "Requester cannot self-confirm high-risk actions.", ephemeral: true });
        return;
      }
      row.confirmations = ensureArray(row.confirmations);
      if (!row.confirmations.includes(interaction.user.id)) {
        row.confirmations.push(interaction.user.id);
      }
      if (row.confirmations.length < Number(row.requiredConfirmations || 1)) {
        savePendingAdminApprovals(approvals);
        await interaction.reply({ content: `Confirmation recorded. Waiting for ${row.requiredConfirmations - row.confirmations.length} more.`, ephemeral: true });
        return;
      }

      row.status = "approved";
      row.approvedAt = new Date().toISOString();
      row.approvedBy = interaction.user.id;
      savePendingAdminApprovals(approvals);
      if (isSafeModeBlockedAdminAction(row.action)) {
        row.status = "blocked_safemode";
        row.blockedAt = new Date().toISOString();
        row.blockedBy = interaction.user.id;
        savePendingAdminApprovals(approvals);
        await interaction.reply({ content: `Execution blocked: safe mode is enabled for \`${row.action}\`.`, ephemeral: true });
        return;
      }
      try {
        const result = await executeAdminAction(interaction, row.action, row.payload, row.requestedBy, "");
        addIncident({
          severity: "high",
          userId: row.requestedBy,
          reason: `admin action executed ${row.action} (${approvalId})`,
          createdBy: interaction.user.id,
          auto: true
        });
        await interaction.reply({ content: `Approved and executed \`${approvalId}\`: ${result}`, ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: `Approval succeeded, but execution failed: ${err instanceof Error ? err.message : String(err)}`, ephemeral: true });
      }
      return;
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
      const member = interaction.inGuild() && interaction.guild
        ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
        : null;
      const staffContext = Boolean(member && isStaffMember(interaction, member));
      const canSee = (entry) => {
        if (!entry.staffOnly) return true;
        if (!staffContext || !member) return false;
        if (!entry.policyKey) return true;
        return hasPolicyAccess(member, entry.policyKey);
      };
      const publicLines = HELP_CATALOG
        .filter((x) => !x.staffOnly)
        .map((x) => `\`${x.syntax}\` - ${x.desc}`);
      const staffLines = HELP_CATALOG
        .filter((x) => x.staffOnly && canSee(x))
        .map((x) => `\`${x.syntax}\` - ${x.desc}`);

      const helpContent = [
          "Grey Hour RP Bot Help",
          "",
          "**Public Commands You Can Use**",
          truncate(publicLines.join("\n"), 1200),
          ...(staffContext ? [
            "",
            "**Staff Commands You Can Use**",
            staffLines.length ? truncate(staffLines.join("\n"), 1200) : "No staff commands available for your current role policy."
          ] : []),
          "",
          "Tip: command visibility is role/policy aware."
        ].join("\n");

      await interaction.reply({
        content: truncate(helpContent, 1900),
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "diagnose") {
      const targetCommand = interaction.options.getString("command", true).replace(/^\//, "").trim().toLowerCase();
      const targetChannel = interaction.options.getChannel("channel") || interaction.channel;
      const inGuild = interaction.inGuild() && interaction.guild;
      const member = inGuild ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null) : null;
      const staff = Boolean(member && isStaffMember(interaction, member));
      const policyAllowed = Boolean(member && hasPolicyAccess(member, targetCommand));
      const cooldownWait = checkAndSetCooldown(interaction, targetCommand);
      const perms = (targetChannel && member && targetChannel.isTextBased()) ? targetChannel.permissionsFor(member) : null;
      const botMember = inGuild ? await interaction.guild.members.fetch(client.user.id).catch(() => null) : null;
      const botPerms = (targetChannel && botMember && targetChannel.isTextBased()) ? targetChannel.permissionsFor(botMember) : null;
      const required = ["ViewChannel", "SendMessages", "EmbedLinks", "ReadMessageHistory"];
      const userMissing = required.filter((p) => !perms?.has(PermissionsBitField.Flags[p]));
      const botMissing = required.filter((p) => !botPerms?.has(PermissionsBitField.Flags[p]));
      await interaction.reply({
        content: [
          `Diagnose /${targetCommand}`,
          `Guild context: ${inGuild ? "yes" : "no"}`,
          `Staff: ${staff ? "yes" : "no"}`,
          `Policy access: ${policyAllowed ? "allowed" : "denied/unknown"}`,
          `Cooldown: ${cooldownWait > 0 ? `${cooldownWait}s remaining` : "ready"}`,
          `Channel: ${targetChannel ? `<#${targetChannel.id}>` : "none"}`,
          `Your missing perms: ${userMissing.length ? userMissing.join(", ") : "none"}`,
          `Bot missing perms: ${botMissing.length ? botMissing.join(", ") : "none"}`
        ].join("\n"),
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "approve") {
      const staff = await requireStaff(interaction, "admin");
      if (!staff) return;
      const requestId = interaction.options.getString("request_id", true);
      const decision = interaction.options.getString("decision", true);
      const note = truncate(interaction.options.getString("note") || "", 220);
      const approvals = loadPendingAdminApprovals();
      const row = approvals.find((x) => x.id === requestId);
      if (!row) {
        await interaction.reply({ content: `Approval request not found: ${requestId}`, ephemeral: true });
        return;
      }
      if (row.status !== "pending") {
        await interaction.reply({ content: `Approval request is already ${row.status}.`, ephemeral: true });
        return;
      }
      if (decision === "deny") {
        row.status = "rejected";
        row.approvedBy = interaction.user.id;
        row.approvedAt = new Date().toISOString();
        row.approvalNote = note;
        savePendingAdminApprovals(approvals);
        await interaction.reply({ content: `Denied request \`${requestId}\`.`, ephemeral: true });
        return;
      }
      const result = await executeAdminAction(interaction, row.action, row.payload || {}, interaction.user.id, reqId).catch((e) => `Execution failed: ${e instanceof Error ? e.message : String(e)}`);
      row.status = "approved";
      row.approvedBy = interaction.user.id;
      row.approvedAt = new Date().toISOString();
      row.approvalNote = note;
      savePendingAdminApprovals(approvals);
      await interaction.reply({ content: `Approved \`${requestId}\`: ${truncate(String(result || "done"), 600)}`, ephemeral: true });
      return;
    }

    if (interaction.commandName === "oncall") {
      const staff = await requireStaff(interaction, "ops");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      const rows = loadOncall();
      if (sub === "add") {
        const user = interaction.options.getUser("user", true);
        const timezone = truncate(interaction.options.getString("timezone") || "UTC", 32);
        if (!rows.some((x) => x.userId === user.id)) {
          rows.push({ userId: user.id, timezone, addedAt: new Date().toISOString(), addedBy: interaction.user.id });
          saveOncall(rows.slice(0, 100));
        }
        await interaction.reply({ content: `On-call added: <@${user.id}> (${timezone})`, ephemeral: true });
        return;
      }
      if (sub === "list") {
        const lines = rows.length ? rows.map((x, i) => `${i + 1}. <@${x.userId}> (${x.timezone || "UTC"})`) : ["No on-call rota configured."];
        const pair = getOncallPair();
        if (pair.primary) lines.unshift(`Primary now: <@${pair.primary.userId}>`);
        if (pair.backup) lines.unshift(`Backup now: <@${pair.backup.userId}>`);
        await interaction.reply({ content: lines.join("\n"), ephemeral: true });
        return;
      }
      if (sub === "remove") {
        const user = interaction.options.getUser("user", true);
        saveOncall(rows.filter((x) => x.userId !== user.id));
        await interaction.reply({ content: `On-call removed: <@${user.id}>`, ephemeral: true });
        return;
      }
      if (sub === "ping") {
        const issue = truncate(interaction.options.getString("issue", true), 250);
        const pair = getOncallPair();
        const primary = pair.primary ? `<@${pair.primary.userId}>` : "none";
        const backup = pair.backup ? `<@${pair.backup.userId}>` : "none";
        const channel = modCallChannelId ? await client.channels.fetch(modCallChannelId).catch(() => null) : interaction.channel;
        if (channel && channel.isTextBased()) {
          await sendMessageWithGuards(channel, { content: `🚨 On-call ping\nIssue: ${issue}\nPrimary: ${primary}\nBackup: ${backup}` }, "oncall.ping", reqId);
        }
        await interaction.reply({ content: `On-call ping sent. Primary: ${primary} Backup: ${backup}`, ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "sla") {
      const staff = await requireStaff(interaction, "mod");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "board") {
        const board = buildSlaBoard();
        await interaction.reply({
          content: [
            "SLA Board",
            `Open cases: ${board.open}`,
            `Unclaimed: ${board.unclaimed}`,
            `Overdue first response: ${board.overdueFirst}`,
            `Overdue resolution: ${board.overdueResolve}`,
            `Hot cases: ${board.hotCases.join(", ") || "none"}`
          ].join("\n"),
          ephemeral: true
        });
        return;
      }
    }

    if (interaction.commandName === "summarize") {
      const staff = await requireStaff(interaction, "modcall");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "channel") {
        const target = interaction.options.getChannel("channel") || interaction.channel;
        const minutes = interaction.options.getInteger("minutes") || 30;
        const summary = await summarizeChannelActivity(target, minutes);
        await interaction.reply({ content: truncate(summary, 1900), ephemeral: true });
        return;
      }
      if (sub === "user") {
        const user = interaction.options.getUser("user", true);
        const incidents = loadIncidents().filter((x) => x.userId === user.id);
        const tickets = loadTickets().filter((x) => x.userId === user.id);
        const score = getUserRiskScore(user.id);
        await interaction.reply({
          content: [
            `Risk Summary for <@${user.id}>`,
            `Risk score: ${score}`,
            `Incidents: ${incidents.length}`,
            `Open incidents: ${incidents.filter((x) => x.status === "open").length}`,
            `Tickets: ${tickets.length}`,
            `Recent reasons: ${incidents.slice(0, 3).map((x) => truncate(x.reason || "", 80)).join(" | ") || "none"}`
          ].join("\n"),
          ephemeral: true
        });
        return;
      }
    }

    if (interaction.commandName === "safety") {
      const staff = await requireStaff(interaction, "incident");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "score") {
        const channel = interaction.options.getChannel("channel") || interaction.channel;
        const s = safetyScoreForChannel(channel?.id || "");
        await interaction.reply({
          content: `Safety score for <#${channel?.id || interaction.channelId}>: ${s.score}/100\nToxicity hits: ${s.toxicHits}\nIncident references: ${s.incidents}`,
          ephemeral: true
        });
        return;
      }
    }

    if (interaction.commandName === "drill") {
      const staff = await requireStaff(interaction, "ops");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      const rows = loadDrills();
      if (sub === "start") {
        const scenario = interaction.options.getString("scenario", true);
        const id = makeId("drill");
        rows.unshift({ id, scenario, startedBy: interaction.user.id, startedAt: new Date().toISOString(), score: null, notes: "" });
        saveDrills(rows.slice(0, 500));
        await interaction.reply({ content: `Drill started: \`${id}\` (${scenario}). Run /drill score when complete.`, ephemeral: true });
        return;
      }
      if (sub === "score") {
        const id = interaction.options.getString("id", true);
        const score = Math.max(0, Math.min(interaction.options.getInteger("score", true), 100));
        const notes = truncate(interaction.options.getString("notes") || "", 300);
        const row = rows.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Drill not found.", ephemeral: true });
          return;
        }
        row.score = score;
        row.notes = notes;
        row.scoredBy = interaction.user.id;
        row.scoredAt = new Date().toISOString();
        saveDrills(rows);
        await interaction.reply({ content: `Drill scored: \`${id}\` = ${score}/100`, ephemeral: true });
        return;
      }
      if (sub === "report") {
        const latest = rows.slice(0, 10);
        await interaction.reply({ content: latest.length ? latest.map((x) => `\`${x.id}\` ${x.scenario} score:${x.score ?? "pending"} by:<@${x.startedBy}>`).join("\n") : "No drills logged.", ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "vault") {
      const staff = await requireStaff(interaction, "modcall");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      const rows = loadVaultLinks();
      if (sub === "create") {
        const caseId = interaction.options.getString("case_id", true);
        const expiresHours = Math.max(1, Math.min(interaction.options.getInteger("expires_hours") || 24, 168));
        const createdAt = Date.now();
        const expiresAt = createdAt + expiresHours * 60 * 60 * 1000;
        const token = sha256(`${caseId}:${createdAt}:${interaction.user.id}:${Math.random()}`).slice(0, 32);
        const link = `${(dashboardBaseUrl || `http://${metricsHost}:${metricsPort || 9091}`).replace(/\/$/, "")}/evidence/${caseId}?token=${token}`;
        rows.unshift({ id: makeId("vault"), caseId, token, link, createdBy: interaction.user.id, createdAt: new Date(createdAt).toISOString(), expiresAt: new Date(expiresAt).toISOString() });
        saveVaultLinks(rows.slice(0, 2000));
        await interaction.reply({ content: `Evidence link created:\n${link}\nExpires: ${new Date(expiresAt).toISOString()}`, ephemeral: true });
        return;
      }
      if (sub === "list") {
        const caseId = interaction.options.getString("case_id") || "";
        const now = Date.now();
        const filtered = rows.filter((x) => !caseId || x.caseId === caseId).slice(0, 20);
        const lines = filtered.map((x) => `\`${x.id}\` case:\`${x.caseId}\` ${new Date(x.expiresAt).getTime() < now ? "expired" : "active"} by <@${x.createdBy}>`);
        await interaction.reply({ content: lines.length ? lines.join("\n") : "No vault links.", ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "kb") {
      const staff = await requireStaff(interaction, "modcall");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "ingest") {
        const topic = truncate(interaction.options.getString("topic", true), 80);
        const text = truncate(interaction.options.getString("text", true), 1500);
        const rows = loadKnowledgeIngest();
        rows.unshift({ id: makeId("kb"), topic, text, createdAt: new Date().toISOString(), createdBy: interaction.user.id });
        saveKnowledgeIngest(rows.slice(0, 2000));
        await interaction.reply({ content: `Knowledge ingested under topic \`${topic}\`.`, ephemeral: true });
        return;
      }
      if (sub === "search") {
        const query = interaction.options.getString("query", true);
        const hits = searchKnowledge(query, 8);
        await interaction.reply({ content: hits.length ? hits.map((h, i) => `${i + 1}. [${h.topic}] ${truncate(h.text, 200)}`).join("\n") : "No KB hits.", ephemeral: true });
        return;
      }
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
          { name: "Risk Score", value: String(getUserRiskScore(target.id)), inline: true },
          { name: "Roles", value: roles || "None", inline: false },
          { name: "Context", value: truncate(buildUserContextSummary(target.id), 400), inline: false }
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

    if (interaction.commandName === "lang") {
      const locale = interaction.options.getString("locale", true);
      const map = loadUserLocales();
      map[interaction.user.id] = locale;
      saveUserLocales(map);
      const names = { en: "English", es: "Spanish", pt: "Portuguese", fr: "French" };
      await interaction.reply({ content: `Language preference saved: ${names[locale] || locale}.`, ephemeral: true });
      return;
    }

    if (interaction.commandName === "voice") {
      const staff = await requireStaff(interaction, "mod");
      if (!staff) return;
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
        return;
      }
      const sub = interaction.options.getSubcommand();
      const source = interaction.member?.voice?.channel;
      if (!source || source.type !== ChannelType.GuildVoice) {
        await interaction.reply({ content: "Join a voice channel first.", ephemeral: true });
        return;
      }
      if (sub === "panic-move") {
        const target = interaction.options.getChannel("target", true);
        if (!target || target.type !== ChannelType.GuildVoice) {
          await interaction.reply({ content: "Target must be a voice channel.", ephemeral: true });
          return;
        }
        if (isSimulationModeEnabled()) {
          await interaction.reply({ content: `Simulation mode: would move ${source.members.size} users to <#${target.id}>.`, ephemeral: true });
          return;
        }
        let moved = 0;
        for (const member of source.members.values()) {
          const ok = await member.voice.setChannel(target, `panic-move by ${interaction.user.tag}`).then(() => true).catch(() => false);
          if (ok) moved += 1;
        }
        await interaction.reply({ content: `Moved ${moved} member(s) to <#${target.id}>.`, ephemeral: true });
        return;
      }
      if (sub === "mute-cooldown") {
        const minutes = Math.max(1, Math.min(30, interaction.options.getInteger("minutes") || 5));
        if (isSimulationModeEnabled()) {
          await interaction.reply({ content: `Simulation mode: would timeout ${source.members.size} users for ${minutes} minutes.`, ephemeral: true });
          return;
        }
        let affected = 0;
        for (const member of source.members.values()) {
          if (!member.moderatable) continue;
          const ok = await member.timeout(minutes * 60 * 1000, `voice mute-cooldown by ${interaction.user.tag}`).then(() => true).catch(() => false);
          if (ok) affected += 1;
        }
        await interaction.reply({ content: `Cooldown timeout applied to ${affected} member(s) for ${minutes} minute(s).`, ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "trustgraph") {
      const staff = await requireStaff(interaction, "incident");
      if (!staff) return;
      const user = interaction.options.getUser("user", true);
      const userId = user.id;
      const incidents = loadIncidents().filter((x) => x.userId === userId);
      const tickets = loadTickets().filter((x) => x.userId === userId);
      const modState = loadModCallsState();
      const cases = modState.cases.filter((x) => x.reporterId === userId || x.targetUserId === userId);
      const coTargets = {};
      for (const c of cases) {
        const other = c.reporterId === userId ? c.targetUserId : c.reporterId;
        if (other) coTargets[other] = (coTargets[other] || 0) + 1;
      }
      const topLinks = Object.entries(coTargets).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => `<@${id}>:${n}`).join(", ") || "none";
      await interaction.reply({
        content: [
          `Trust Graph: <@${userId}>`,
          `Risk score: ${getUserRiskScore(userId)}`,
          `Incidents: ${incidents.length}`,
          `Tickets: ${tickets.length}`,
          `Cases: ${cases.length}`,
          `Top linked users: ${topLinks}`
        ].join("\n"),
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "policy") {
      const staff = await requireStaff(interaction, "ops");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "test") {
        const user = interaction.options.getUser("user", true);
        const command = interaction.options.getString("command", true).replace(/^\//, "").trim();
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member) {
          await interaction.reply({ content: "User is not in this guild.", ephemeral: true });
          return;
        }
        const allowed = hasPolicyAccess(member, command);
        await interaction.reply({ content: `Policy test: <@${user.id}> ${allowed ? "CAN" : "CANNOT"} run \`/${command}\`.`, ephemeral: true });
        return;
      }
      if (sub === "suggest") {
        const audit = loadAuditEntries(2000);
        const denied = audit.filter((x) => x.status === "denied");
        const errored = audit.filter((x) => x.status === "error");
        const byCmd = {};
        for (const row of denied) {
          const cmd = String(row.command || "unknown");
          byCmd[cmd] = (byCmd[cmd] || 0) + 1;
        }
        const topDenied = Object.entries(byCmd).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const suggestions = [];
        if (topDenied.length) {
          suggestions.push(`Top denied commands: ${topDenied.map(([c, n]) => `/${c}(${n})`).join(", ")}`);
          suggestions.push("Consider adding explicit role mappings in permissions-policy.json for legitimate staff workflows.");
        }
        if (errored.length > 20) suggestions.push(`High command error volume detected (${errored.length}). Enable safe mode and review recent deploy changes.`);
        if (!suggestions.length) suggestions.push("No strong policy tuning signals found yet.");
        await interaction.reply({ content: suggestions.join("\n"), ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "copilot") {
      const staff = await requireStaff(interaction, "modcall");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "suggest") {
        const caseId = interaction.options.getString("case_id", true);
        const data = loadModCallsState();
        const row = data.cases.find((x) => x.id === caseId);
        if (!row) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        const suggestions = [];
        if (!row.claimedBy) suggestions.push("Assign or claim this case immediately.");
        if (!ensureArray(row.evidence).length) suggestions.push("Request evidence via /modcall evidence.");
        if (!ensureArray(row.history).some((h) => h.action === "status-update")) suggestions.push("Send reporter update via /modcall status.");
        if (row.priority === "critical") suggestions.push("Escalate to senior staff and apply quick controls.");
        if (!suggestions.length) suggestions.push("Case looks healthy. Continue with closure checklist.");
        await interaction.reply({ content: `Copilot suggestions for \`${caseId}\`:\n- ${suggestions.join("\n- ")}`, ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "shiftplan") {
      const staff = await requireStaff(interaction, "mod");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      const rows = loadShiftPlans();
      if (sub === "add") {
        const time = interaction.options.getString("time_utc", true);
        const note = interaction.options.getString("note") || "";
        if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
          await interaction.reply({ content: "time_utc must be HH:MM (UTC).", ephemeral: true });
          return;
        }
        const row = { id: makeId("shift"), userId: interaction.user.id, timeUtc: time, note: truncate(note, 200), createdAt: new Date().toISOString() };
        rows.unshift(row);
        saveShiftPlans(rows.slice(0, 1000));
        await interaction.reply({ content: `Shift reminder added: \`${row.id}\` at ${time} UTC.`, ephemeral: true });
        return;
      }
      if (sub === "list") {
        const mine = rows.filter((x) => x.userId === interaction.user.id).slice(0, 20);
        await interaction.reply({ content: mine.length ? mine.map((x) => `\`${x.id}\` • ${x.timeUtc} UTC • ${x.note || "no note"}`).join("\n") : "No shift reminders set.", ephemeral: true });
        return;
      }
      if (sub === "remove") {
        const id = interaction.options.getString("id", true);
        const next = rows.filter((x) => !(x.id === id && x.userId === interaction.user.id));
        saveShiftPlans(next);
        await interaction.reply({ content: `Shift reminder removed: ${id}`, ephemeral: true });
        return;
      }
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
        const triage = triageContent(`${category}\n${details}`);
        const target = interaction.options.getUser("target");
        const attachment = interaction.options.getAttachment("attachment");
        const id = makeId("mod");
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        const resolvedCategory = category === "general" ? triage.category : category;
        const priority = member && hasTrustedRole(member)
          ? "high"
          : (severity === "critical" || triage.urgency === "urgent" ? "critical" : "normal");
        if (isSimulationModeEnabled()) {
          await interaction.reply({
            content: [
              "Simulation mode is enabled. Modcall was analyzed but not created.",
              `Category: ${resolvedCategory}`,
              `Priority: ${priority}`,
              ...triage.actions.map((x) => `- ${x}`)
            ].join("\n"),
            ephemeral: true
          });
          return;
        }

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
          content: `🚨 ${mention} mod call \`${id}\` (${priority}) from <@${interaction.user.id}>${target ? ` • target <@${target.id}>` : ""}\nCategory: ${resolvedCategory}\nSeverity: ${severity}\n${truncate(details, 700)}`
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
          category: resolvedCategory,
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
        if (severity === "critical") {
          const dm = await notifyUrgentStaff(interaction.guild, {
            title: "Critical Modcall Alert",
            summary: `Critical case \`${id}\` opened: ${truncate(details || category || "No details", 160)}`,
            link: thread.url,
            reporterId: interaction.user.id
          });
          logEvent("info", "modcall.critical.dm", { caseId: id, sent: dm.sent, failed: dm.failed });
        }
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
          const closedTicket = await closeTicketConversation(interaction, interaction.channel);
          if (closedTicket) return;
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
        const cleanup = await cleanupCaseConversations(interaction.guild, row, interaction.user.tag);
        await interaction.reply({
          content: cleanup.deleted
            ? `Case \`${id}\` closed. Deleted linked ticket/chat channel(s): ${cleanup.details.join(", ")}`
            : `Case \`${id}\` closed.`,
          ephemeral: true
        });
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
        adjustUserRiskScore(row.reporterId || "", 3, "modcall.false-report-flag");
        saveModCallsState(data);
        await interaction.reply({ content: `Reporter on \`${id}\` flagged (${row.reporterFlags} total flags).`, ephemeral: true });
        return;
      }

      if (sub === "template") {
        const type = interaction.options.getString("type", true);
        const templates = {
          acknowledge: "Thanks for the report. A moderator is now reviewing your case and will update you shortly.",
          investigating: "We are actively investigating this case now. Please avoid engaging further while we review evidence.",
          resolution: "This issue has been reviewed and resolved. Please reply with additional evidence if needed.",
          insufficient_evidence: "We reviewed the report but do not yet have enough evidence to act. Please share additional details/screenshots if available."
        };
        const message = templates[type] || templates.acknowledge;
        await sendMessageWithGuards(interaction.channel, { content: `📝 **Staff Update**\n${message}` }, "modcall.template", reqId);
        await interaction.reply({ content: `Template posted (\`${type}\`).`, ephemeral: true });
        return;
      }

      if (sub === "export") {
        const id = interaction.options.getString("id", true);
        const row = data.cases.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        const incidents = loadIncidents().filter((x) => x.userId === row.reporterId || (row.targetUserId && x.userId === row.targetUserId)).slice(0, 25);
        let threadMessages = [];
        if (interaction.guild && row.threadId) {
          const thread = await interaction.guild.channels.fetch(row.threadId).catch(() => null);
          if (thread && thread.isTextBased()) {
            const fetched = await thread.messages.fetch({ limit: 100 }).catch(() => null);
            if (fetched) {
              threadMessages = fetched
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
                .map((m) => ({
                  id: m.id,
                  at: new Date(m.createdTimestamp).toISOString(),
                  authorId: m.author?.id || "",
                  authorTag: m.author?.tag || "",
                  content: truncate(m.content || "", 1800),
                  attachments: Array.from(m.attachments.values()).map((a) => ({
                    name: a.name || "",
                    url: a.url || "",
                    contentType: a.contentType || "",
                    size: a.size || 0
                  }))
                }));
            }
          }
        }
        const bundle = {
          exportedAt: new Date().toISOString(),
          exportedBy: interaction.user.id,
          case: row,
          incidents,
          threadMessages
        };
        const file = `modcase-${row.id}-bundle.json`;
        await interaction.editReply({
          content: `Exported case bundle for \`${row.id}\`.`,
          files: [{ attachment: Buffer.from(JSON.stringify(bundle, null, 2), "utf-8"), name: file }]
        });
        return;
      }

      if (sub === "wizard") {
        const scenario = interaction.options.getString("scenario") || "harassment";
        const steps = [
          `Modcall Wizard (${scenario})`,
          "1) Intake: gather who/what/where evidence.",
          "2) Create case with `/modcall create` and attach evidence.",
          "3) Claim or assign with `/modcall claim` or `/case assign-next`.",
          "4) Keep reporter updated via `/modcall status`.",
          "5) Apply controls (warn/timeout/lockdown) if needed.",
          "6) Close with `/modcall close` and clear resolution notes."
        ];
        await interaction.reply({ content: steps.join("\n"), ephemeral: true });
        return;
      }

      if (sub === "reopen") {
        const id = interaction.options.getString("id", true);
        const reason = interaction.options.getString("reason") || "Reopened for follow-up.";
        const row = data.cases.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        if (row.status !== "closed" && row.status !== "cancelled") {
          await interaction.reply({ content: `Case \`${id}\` is already open.`, ephemeral: true });
          return;
        }
        row.status = "open";
        row.closedAt = "";
        row.closedBy = "";
        row.closeReason = "";
        addCaseHistoryRow(row, "reopened", interaction.user.id, truncate(reason, 500));
        saveModCallsState(data);
        const thread = row.threadId ? await interaction.guild.channels.fetch(row.threadId).catch(() => null) : null;
        if (thread && thread.isTextBased()) {
          await sendMessageWithGuards(thread, { content: `♻️ Case reopened by <@${interaction.user.id}>. Reason: ${truncate(reason, 500)}` }, "modcall.reopen", reqId);
        }
        await notifyReporterUpdate(interaction.client, row, `Your case has been reopened: ${reason}`);
        await interaction.reply({ content: `Case \`${id}\` reopened.`, ephemeral: true });
        return;
      }

      if (sub === "priority") {
        const id = interaction.options.getString("id", true);
        const level = interaction.options.getString("level", true);
        const reason = interaction.options.getString("reason") || "Priority adjusted by staff.";
        const row = data.cases.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        row.priority = level;
        addCaseHistoryRow(row, "priority", interaction.user.id, `${level}: ${truncate(reason, 400)}`);
        saveModCallsState(data);
        const thread = row.threadId ? await interaction.guild.channels.fetch(row.threadId).catch(() => null) : null;
        if (thread && thread.isTextBased()) {
          await sendMessageWithGuards(thread, { content: `📌 Priority updated to **${level}** by <@${interaction.user.id}>. Reason: ${truncate(reason, 400)}` }, "modcall.priority", reqId);
        }
        await interaction.reply({ content: `Case \`${id}\` priority set to ${level}.`, ephemeral: true });
        return;
      }

      if (sub === "vault") {
        const id = interaction.options.getString("id", true);
        const row = data.cases.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        const stamp = Date.now();
        const token = sha256(`${id}:${stamp}:${interaction.user.id}`).slice(0, 24);
        const base = dashboardBaseUrl || (metricsPort ? `http://${metricsHost}:${metricsPort}` : "");
        const link = base ? `${base.replace(/\/$/, "")}/evidence/${id}?token=${token}` : `vault://${id}/${token}`;
        addCaseHistoryRow(row, "vault-link", interaction.user.id, `Evidence vault generated`);
        saveModCallsState(data);
        await interaction.reply({ content: `Evidence vault link for \`${id}\`:\n${link}\nExpires: ${new Date(stamp + 24 * 60 * 60 * 1000).toISOString()}`, ephemeral: true });
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

    if (interaction.commandName === "admin") {
      const staff = await requireStaff(interaction, "admin");
      if (!staff) {
        auditStatus = "denied";
        return;
      }
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "Admin actions only run in guild channels.", ephemeral: true });
        return;
      }
      const sub = interaction.options.getSubcommand();
      let action = sub;
      let payload = {};

      if (sub === "health") {
        await interaction.deferReply({ ephemeral: true });
        const approvals = loadPendingAdminApprovals();
        const pendingApprovals = approvals.filter((x) => x.status === "pending");
        const expiredApprovals = pendingApprovals.filter((x) => new Date(x.expiresAt || 0).getTime() < Date.now());
        const snapshots = loadAdminSnapshots();
        const backups = listDataBackups(1);
        const latestBackup = backups[0] || null;
        const backupCheck = latestBackup ? verifyBackupFile(latestBackup.file) : { ok: false, message: "No backups found." };
        const safeMode = loadAdminSafeModeState();
        const checks = await Promise.all([
          checkAdminApi(),
          checkTextChannel(logChannelId, "Log channel")
        ]);
        const allChecks = [
          ...checks,
          { ok: expiredApprovals.length === 0, summary: `Expired approvals: ${expiredApprovals.length}` },
          { ok: pendingApprovals.length < 25, summary: `Pending approvals: ${pendingApprovals.length}` },
          { ok: snapshots.length > 0, summary: `Snapshots available: ${snapshots.length}` },
          { ok: backupCheck.ok, summary: `Latest backup: ${latestBackup ? latestBackup.file : "none"} (${backupCheck.ok ? "verified" : backupCheck.message})` },
          { ok: true, summary: `Safe mode: ${safeMode.enabled ? "on" : "off"}` }
        ];
        const healthy = allChecks.every((x) => x.ok);
        const embed = new EmbedBuilder()
          .setTitle("Admin Control Plane Health")
          .setDescription(allChecks.map((x) => `${x.ok ? "✅" : "❌"} ${x.summary}`).join("\n"))
          .setColor(healthy ? 0x22c55e : 0xef4444)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      } else if (sub === "doctor") {
        await interaction.deferReply({ ephemeral: true });
        const approvals = loadPendingAdminApprovals();
        const pendingApprovals = approvals.filter((x) => x.status === "pending");
        const expiredApprovals = pendingApprovals.filter((x) => new Date(x.expiresAt || 0).getTime() < Date.now());
        const snapshots = loadAdminSnapshots();
        const backups = listDataBackups(1);
        const latestBackup = backups[0] || null;
        const backupCheck = latestBackup ? verifyBackupFile(latestBackup.file) : { ok: false, message: "No backups found." };
        const apiCheck = await checkAdminApi();
        const suggestions = [];
        if (!apiCheck.ok) suggestions.push("Admin API is failing. Verify ADMIN_API_BASE and auth credentials, then run `/health details:true`.");
        if (expiredApprovals.length > 0) suggestions.push(`Clean up ${expiredApprovals.length} expired admin approvals from state.`);
        if (pendingApprovals.length > 20) suggestions.push(`Pending approvals are high (${pendingApprovals.length}). Review and resolve stale requests.`);
        if (!backupCheck.ok) suggestions.push("Create a fresh backup with `/backup create` and verify it before critical admin actions.");
        if (!snapshots.length) suggestions.push("Create a rollback baseline with `/admin snapshot label:baseline`.");
        if (!suggestions.length) suggestions.push("No urgent issues detected. Continue normal operations.");
        await interaction.editReply({ content: suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n") });
        return;
      } else if (sub === "purge") {
        const amount = interaction.options.getInteger("amount", true);
        const channel = interaction.options.getChannel("channel") || interaction.channel;
        if (!channel || !channel.isTextBased()) {
          await interaction.reply({ content: "Invalid target channel.", ephemeral: true });
          return;
        }
        payload = { amount, channelId: channel.id };
      } else if (sub === "lockdown" || sub === "unlockdown") {
        const channel = interaction.options.getChannel("channel") || interaction.channel;
        if (!channel || !channel.isTextBased()) {
          await interaction.reply({ content: "Invalid target channel.", ephemeral: true });
          return;
        }
        payload = {
          channelId: channel.id,
          reason: interaction.options.getString("reason") || ""
        };
      } else if (sub === "rolegrant" || sub === "rolerevoke") {
        const user = interaction.options.getUser("user", true);
        const role = interaction.options.getRole("role", true);
        payload = { userId: user.id, roleId: role.id };
      } else if (sub === "snapshot") {
        payload = { label: interaction.options.getString("label") || "manual" };
      } else if (sub === "rollback") {
        payload = { snapshotId: interaction.options.getString("snapshot_id", true) };
      } else {
        await interaction.reply({ content: "Unsupported admin action.", ephemeral: true });
        return;
      }

      if (isSimulationModeEnabled()) {
        await interaction.reply({ content: `Simulation mode: would execute admin action \`${action}\` with payload ${truncate(JSON.stringify(payload), 300)}.`, ephemeral: true });
        return;
      }

      if (isSafeModeBlockedAdminAction(action)) {
        await interaction.reply({ content: `Safe mode is enabled. \`${action}\` is temporarily blocked.`, ephemeral: true });
        return;
      }

      if (isHighRiskAdminAction(action)) {
        const approvals = loadPendingAdminApprovals();
        const existing = approvals.find((x) => x.status === "pending" && x.requestedBy === interaction.user.id && x.action === action);
        if (existing) {
          await interaction.reply({ content: `You already have pending request \`${existing.id}\` for this action.`, ephemeral: true });
          return;
        }
        const record = createApprovalRecord(action, payload, interaction.user.id, interaction.guildId || "", interaction.channelId || "");
        approvals.unshift(record);
        savePendingAdminApprovals(approvals.slice(0, 200));
        await sendApprovalMessage(interaction, record, reqId);
        await interaction.reply({ content: `Approval request created: \`${record.id}\`. Waiting for second staff confirmation.`, ephemeral: true });
        return;
      }

      const result = await executeAdminAction(interaction, action, payload, interaction.user.id, reqId);
      addIncident({
        severity: "high",
        userId: interaction.user.id,
        reason: `admin action executed ${action}`,
        createdBy: interaction.user.id,
        auto: true
      });
      await interaction.reply({ content: result, ephemeral: true });
      return;
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
      if (sub === "verify") {
        const limit = Math.max(50, Math.min(interaction.options.getInteger("limit") || 1000, 5000));
        const result = verifyAuditChain(limit);
        await interaction.reply({
          content: result.ok
            ? `Audit chain verified. Checked ${result.checked} entries.`
            : `Audit chain verification FAILED at entry ${result.failedAt} (checked ${result.checked}).`,
          ephemeral: true
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
        const delta = severity === "critical" ? 15 : severity === "high" ? 10 : severity === "medium" ? 5 : 2;
        adjustUserRiskScore(user.id, delta, `incident-create:${severity}`);
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
        adjustUserRiskScore(row.userId || "", -2, "incident-resolved");
        await interaction.reply({ content: `Incident resolved: ${id}`, ephemeral: true });
        return;
      }

      if (sub === "link") {
        const id = interaction.options.getString("id", true);
        const caseId = interaction.options.getString("case_id", true);
        const note = interaction.options.getString("note") || "";
        const incident = incidents.find((x) => x.id === id);
        if (!incident) {
          await interaction.reply({ content: "Incident not found.", ephemeral: true });
          return;
        }
        const data = loadModCallsState();
        const modCase = data.cases.find((x) => x.id === caseId);
        if (!modCase) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        incident.linkedCases = ensureArray(incident.linkedCases);
        const exists = incident.linkedCases.some((x) => x.caseId === caseId);
        if (!exists) {
          incident.linkedCases.push({
            caseId,
            linkedAt: new Date().toISOString(),
            linkedBy: interaction.user.id,
            note: truncate(note, 400)
          });
          addCaseHistoryRow(modCase, "incident-linked", interaction.user.id, `Incident ${id}${note ? `: ${truncate(note, 200)}` : ""}`);
          saveModCallsState(data);
          saveIncidents(incidents);
        }
        await interaction.reply({ content: exists ? `Incident \`${id}\` is already linked to case \`${caseId}\`.` : `Linked incident \`${id}\` to case \`${caseId}\`.`, ephemeral: true });
        return;
      }

      if (sub === "correlate") {
        const user = interaction.options.getUser("user", true);
        const userId = user.id;
        const userIncidents = incidents.filter((x) => x.userId === userId);
        const data = loadModCallsState();
        const userCases = data.cases.filter((x) => x.reporterId === userId || x.targetUserId === userId);
        const tickets = loadTickets().filter((x) => x.userId === userId);
        const last90d = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const severeCount = userIncidents.filter((x) => ["high", "critical"].includes(String(x.severity)) && new Date(x.createdAt || 0).getTime() >= last90d).length;
        const reopenCount = userCases.filter((x) => ensureArray(x.history).some((h) => h.action === "reopened")).length;
        const abuseSignals = userCases.filter((x) => Number(x.reporterFlags || 0) > 0).length;
        const risk = getUserRiskScore(userId);
        await interaction.reply({
          content: [
            `Correlation for <@${userId}>`,
            `Risk score: ${risk}`,
            `Incidents: ${userIncidents.length} (${userIncidents.filter((x) => x.status === "open").length} open)`,
            `High/Critical incidents (90d): ${severeCount}`,
            `Mod cases: ${userCases.length} (${reopenCount} reopened)`,
            `Tickets: ${tickets.length}`,
            `Abuse signals: ${abuseSignals}`
          ].join("\n"),
          ephemeral: true
        });
        return;
      }

      if (sub === "report") {
        const id = interaction.options.getString("id", true);
        const row = incidents.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Incident not found.", ephemeral: true });
          return;
        }
        const data = loadModCallsState();
        const linked = ensureArray(row.linkedCases).map((x) => x.caseId);
        const linkedCases = data.cases.filter((x) => linked.includes(x.id));
        const timeline = linkedCases.flatMap((c) => ensureArray(c.history).map((h) => ({ caseId: c.id, ...h })))
          .sort((a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime())
          .slice(-20);
        const report = [
          `Post-Incident Report: ${row.id}`,
          `Target: <@${row.userId}>`,
          `Severity: ${row.severity}`,
          `Status: ${row.status}`,
          `Created: ${row.createdAt}`,
          row.resolvedAt ? `Resolved: ${row.resolvedAt}` : "Resolved: pending",
          `Reason: ${truncate(row.reason || "", 220)}`,
          `Linked Cases: ${linkedCases.length ? linkedCases.map((c) => c.id).join(", ") : "none"}`,
          "Timeline (latest):",
          timeline.length ? timeline.map((t) => `${t.at || "unknown"} • ${t.caseId} • ${t.action} • ${t.actorId ? `<@${t.actorId}>` : "system"}${t.note ? ` • ${truncate(t.note, 100)}` : ""}`).join("\n") : "No linked timeline events.",
          "Recommended Follow-up:",
          "- Validate role/policy controls for recurrence prevention.",
          "- Review SLA misses and assignment path.",
          "- Document any automation/playbook updates."
        ];
        await interaction.reply({ content: truncate(report.join("\n"), 1900), ephemeral: true });
        return;
      }

      if (sub === "postmortem_create") {
        const id = interaction.options.getString("id", true);
        const impact = interaction.options.getString("impact", true);
        const rootCause = interaction.options.getString("root_cause", true);
        const prevention = interaction.options.getString("prevention", true);
        const incident = incidents.find((x) => x.id === id);
        if (!incident) {
          await interaction.reply({ content: "Incident not found.", ephemeral: true });
          return;
        }
        const rows = loadPostmortems();
        const row = {
          id: makeId("pm"),
          incidentId: id,
          impact: truncate(impact, 600),
          rootCause: truncate(rootCause, 600),
          prevention: truncate(prevention, 600),
          status: "pending",
          createdBy: interaction.user.id,
          createdAt: new Date().toISOString(),
          approvedBy: "",
          approvedAt: ""
        };
        rows.unshift(row);
        savePostmortems(rows.slice(0, 500));
        await interaction.reply({ content: `Postmortem draft created: \`${row.id}\` (pending approval).`, ephemeral: true });
        return;
      }

      if (sub === "postmortem_approve") {
        const pmId = interaction.options.getString("postmortem_id", true);
        const rows = loadPostmortems();
        const row = rows.find((x) => x.id === pmId);
        if (!row) {
          await interaction.reply({ content: "Postmortem not found.", ephemeral: true });
          return;
        }
        row.status = "approved";
        row.approvedBy = interaction.user.id;
        row.approvedAt = new Date().toISOString();
        savePostmortems(rows);
        await interaction.reply({
          content: [
            `Postmortem approved: \`${row.id}\``,
            `Incident: \`${row.incidentId}\``,
            `Impact: ${row.impact}`,
            `Root Cause: ${row.rootCause}`,
            `Prevention: ${row.prevention}`
          ].join("\n"),
          ephemeral: true
        });
        return;
      }

      if (sub === "wizard") {
        const scenario = interaction.options.getString("scenario") || "harassment";
        const steps = [
          `Incident Wizard (${scenario})`,
          "1) Contain immediate harm and preserve evidence.",
          "2) Create incident record with `/incident create`.",
          "3) Link related cases using `/incident link`.",
          "4) Correlate user behavior with `/incident correlate`.",
          "5) Resolve with `/incident resolve` once actions complete.",
          "6) Draft postmortem for major incidents (`/incident postmortem_create`)."
        ];
        await interaction.reply({ content: steps.join("\n"), ephemeral: true });
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
        const dryRun = interaction.options.getBoolean("dry_run") || false;
        const verify = verifyBackupFile(file);
        if (!verify.ok) {
          await interaction.reply({ content: `Refusing restore. Backup verification failed: ${verify.message}`, ephemeral: true });
          return;
        }
        if (dryRun) {
          const payload = JSON.parse(fs.readFileSync(path.join(backupsDir, file), "utf-8"));
          const restoreKeys = Object.keys(payload.files || {}).filter((k) => payload.files[k] !== null && payload.files[k] !== undefined);
          await interaction.reply({ content: `Dry run passed for \`${file}\`. Would restore ${restoreKeys.length} data store(s): ${restoreKeys.join(", ") || "none"}.`, ephemeral: true });
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
        const safeMode = loadAdminSafeModeState();
        const simulation = isSimulationModeEnabled();
        const state = loadState();
        const lastSchedulerErr = state.lastSchedulerErrorAt || "none";
        const embed = new EmbedBuilder()
          .setTitle("Ops Status")
          .setDescription("Current operational state of the Discord bot")
          .addFields(
            { name: "Deploy", value: deployTag, inline: true },
            { name: "Mode", value: dryRunMode ? "dry-run" : (stagingMode ? "staging" : "live"), inline: true },
            { name: "Maintenance", value: maintenance.enabled ? `on - ${truncate(maintenance.message, 80)}` : "off", inline: false },
            { name: "Safe Mode", value: safeMode.enabled ? "on" : "off", inline: true },
            { name: "Simulation", value: simulation ? "on" : "off", inline: true },
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

      if (sub === "safemode") {
        const stateValue = interaction.options.getString("state", true);
        const enabled = stateValue === "on";
        setAdminSafeMode(enabled, interaction.user.id);
        await interaction.reply({ content: `Safe mode ${enabled ? "enabled" : "disabled"}.`, ephemeral: true });
        return;
      }

      if (sub === "simulation") {
        const stateValue = interaction.options.getString("state", true);
        const enabled = stateValue === "on";
        setSimulationModeEnabled(enabled, interaction.user.id);
        await interaction.reply({ content: `Simulation mode ${enabled ? "enabled" : "disabled"}.`, ephemeral: true });
        return;
      }

      if (sub === "dashboard") {
        const host = metricsHost || "127.0.0.1";
        const port = metricsPort || 0;
        const localBase = port ? `http://${host}:${port}` : "metrics server disabled";
        const external = dashboardBaseUrl ? `${dashboardBaseUrl.replace(/\/$/, "")}/dashboard` : "";
        await interaction.reply({
          content: [
            `Dashboard JSON: ${port ? `${localBase}/dashboard` : "disabled (set METRICS_PORT)"}`,
            `Metrics: ${port ? `${localBase}/metrics` : "disabled"}`,
            external ? `External dashboard URL: ${external}` : ""
          ].filter(Boolean).join("\n"),
          ephemeral: true
        });
        return;
      }

      if (sub === "remediate") {
        const recipe = interaction.options.getString("recipe", true);
        const target = interaction.options.getChannel("channel") || interaction.channel;
        if (!target || !target.isTextBased()) {
          await interaction.reply({ content: "Invalid remediation channel.", ephemeral: true });
          return;
        }
        if (isSimulationModeEnabled()) {
          await interaction.reply({ content: `Simulation mode: would run remediation recipe \`${recipe}\` in <#${target.id}>.`, ephemeral: true });
          return;
        }
        if (recipe === "raid") {
          await target.setRateLimitPerUser(30, `ops remediate raid by ${interaction.user.tag}`).catch(() => null);
          await target.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false }, { reason: `ops remediate raid by ${interaction.user.tag}` }).catch(() => null);
          await sendMessageWithGuards(target, { content: "🚨 Raid mitigation active. Channel temporarily locked while staff responds." }, "ops.remediate.raid", reqId);
        } else if (recipe === "spam") {
          await target.setRateLimitPerUser(15, `ops remediate spam by ${interaction.user.tag}`).catch(() => null);
          await sendMessageWithGuards(target, { content: "⚠️ Anti-spam controls applied (slowmode 15s)." }, "ops.remediate.spam", reqId);
        } else if (recipe === "harassment") {
          await target.setRateLimitPerUser(10, `ops remediate harassment by ${interaction.user.tag}`).catch(() => null);
          await sendMessageWithGuards(target, { content: "⚠️ Staff review in progress. Please remain civil and on-topic." }, "ops.remediate.harassment", reqId);
        }
        await interaction.reply({ content: `Remediation recipe \`${recipe}\` executed in <#${target.id}>.`, ephemeral: true });
        return;
      }

      if (sub === "inventory") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        const mode = interaction.options.getString("mode") || "summary";
        await interaction.guild.members.fetch();
        await interaction.guild.roles.fetch();
        await interaction.guild.channels.fetch();
        const inv = buildGuildInventory(interaction.guild);

        if (mode === "export") {
          const name = `guild-inventory-${interaction.guild.id}-${new Date().toISOString().slice(0, 10)}.json`;
          await interaction.editReply({
            content: `Exported inventory for ${interaction.guild.name}.`,
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
        await interaction.editReply({ content: summary });
        return;
      }

      if (sub === "organize") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const mode = interaction.options.getString("mode", true);
        const apply = mode === "apply";
        const includeVoice = interaction.options.getBoolean("include_voice");
        const normalizeNames = interaction.options.getBoolean("normalize_names") || false;
        const limit = Math.max(1, Math.min(interaction.options.getInteger("limit") || 30, 100));

        await interaction.deferReply({ ephemeral: true });
        await interaction.guild.channels.fetch();
        const plan = planGuildOrganization(interaction.guild, {
          includeVoice: includeVoice !== false,
          normalizeNames,
          limit
        });

        if (!plan.actions.length) {
          await interaction.editReply({
            content: "No organization changes needed. Your channels already match the current rules."
          });
          return;
        }

        const previewLines = plan.actions.slice(0, 20).map((x) =>
          `#${x.channelName}: ${x.fromCategory} -> ${x.toCategory}${x.renameTo ? ` | rename -> ${x.renameTo}` : ""}`
        );
        if (!apply || isSimulationModeEnabled()) {
          await interaction.editReply({
            content: [
              apply && isSimulationModeEnabled() ? "Simulation mode is enabled. Showing preview only." : "Organization preview:",
              `Planned channels: ${plan.actions.length}${plan.actions.length >= limit ? ` (limited to ${limit})` : ""}`,
              ...previewLines,
              plan.actions.length > 20 ? `...and ${plan.actions.length - 20} more` : "",
              "Run `/ops organize mode:apply` to execute."
            ].filter(Boolean).join("\n")
          });
          return;
        }

        const result = await applyGuildOrganizationPlan(interaction.guild, plan, interaction.user.tag);
        addIncident({
          severity: "low",
          userId: interaction.user.id,
          reason: `ops organize apply moved=${result.moved} renamed=${result.renamed} failed=${result.failed}`,
          createdBy: interaction.user.id,
          auto: true
        });
        await interaction.editReply({
          content: [
            "Organization applied.",
            `Planned: ${plan.actions.length}`,
            `Moved: ${result.moved}`,
            `Renamed: ${result.renamed}`,
            `Failed: ${result.failed}`,
            result.failures.length ? `Failures: ${result.failures.join(" | ")}` : ""
          ].filter(Boolean).join("\n")
        });
        return;
      }

      if (sub === "analytics") {
        const limit = Math.max(3, Math.min(interaction.options.getInteger("limit") || 10, 20));
        const report = computeCommandAnalytics(limit, 7);
        const lines = [
          "Command Analytics (last 7d)",
          `Total: ${report.total}`,
          `Errors: ${report.errors}`,
          `Denied: ${report.denied}`,
          "Top commands:"
        ];
        for (const row of report.top) {
          lines.push(`- /${row.command}: ${row.total} calls | err ${row.errorRate}% | avg ${row.avgMs}ms`);
        }
        await interaction.reply({ content: truncate(lines.join("\n"), 1900), ephemeral: true });
        return;
      }

      if (sub === "syncpanel") {
        await interaction.deferReply({ ephemeral: true });
        const jobs = loadJobs();
        const pendingJobs = jobs.filter((x) => x.status === "pending").length;
        const modState = loadModCallsState();
        const openCases = modState.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled").length;
        const payload = {
          generatedAt: new Date().toISOString(),
          deployTag,
          mode: dryRunMode ? "dry-run" : (stagingMode ? "staging" : "live"),
          simulationMode: isSimulationModeEnabled(),
          queue: { pending: pendingJobs, failed: metrics.queueFailed },
          modcalls: { open: openCases, created: metrics.modCallsCreated, closed: metrics.modCallsClosed },
          commands: { total: metrics.commandsTotal, errors: metrics.commandErrors },
          analytics: computeCommandAnalytics(8, 7)
        };
        try {
          await adminFetch("/api/admin/content/discord-ops", {
            reqId,
            method: "PUT",
            body: payload
          });
          await interaction.editReply({ content: "Ops snapshot synced to admin panel content (`/api/admin/content/discord-ops`)." });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await interaction.editReply({ content: `Sync failed: ${truncate(msg, 300)}` });
        }
        return;
      }

      if (sub === "disaster") {
        const stateValue = interaction.options.getString("state", true);
        const enabled = stateValue === "on";
        if (enabled) {
          const label = `disaster-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;
          const file = createDataBackup(label, interaction.user.id);
          setMaintenanceState(true, "Disaster recovery mode is active. Staff-only operations.", interaction.user.id);
          setAdminSafeMode(true, interaction.user.id);
          const community = loadCommunity();
          community.raidMode = true;
          saveCommunity(community);
          await interaction.reply({ content: `Disaster mode enabled. Backup created: \`${file}\`. Maintenance + safemode + raidmode enabled.`, ephemeral: true });
          return;
        }
        setMaintenanceState(false, "Maintenance disabled.", interaction.user.id);
        setAdminSafeMode(false, interaction.user.id);
        const community = loadCommunity();
        community.raidMode = false;
        saveCommunity(community);
        await interaction.reply({ content: "Disaster mode disabled. Maintenance + safemode + raidmode reset.", ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "rolesync") {
      const member = await requireStaff(interaction, "ops");
      if (!member) return;
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      if (sub === "preview" || sub === "validate") {
        const apply = sub === "validate" ? (interaction.options.getBoolean("apply") || false) : false;
        const rules = loadRoleSyncRules();
        if (!rules.length) {
          await interaction.reply({ content: "No role-sync rules configured.", ephemeral: true });
          return;
        }

        await interaction.deferReply({ ephemeral: true });
        await interaction.guild.members.fetch();
        const members = interaction.guild.members.cache.filter((m) => !m.user.bot);
        let scanned = 0;
        let driftedMembers = 0;
        let addCount = 0;
        let removeCount = 0;
        let appliedAdds = 0;
        let appliedRemoves = 0;
        const examples = [];

        for (const row of members.values()) {
          scanned += 1;
          const plan = buildRoleSyncPlan(row, rules);
          if (!plan.toAdd.length && !plan.toRemove.length) continue;
          driftedMembers += 1;
          addCount += plan.toAdd.length;
          removeCount += plan.toRemove.length;
          if (examples.length < 8) {
            examples.push(`<@${row.id}> +${plan.toAdd.length}/-${plan.toRemove.length}`);
          }
          if (!apply) continue;
          for (const roleId of plan.toAdd) {
            const ok = await row.roles.add(roleId, "Role sync validate/apply").then(() => true).catch(() => false);
            if (ok) appliedAdds += 1;
          }
          for (const roleId of plan.toRemove) {
            const ok = await row.roles.remove(roleId, "Role sync validate/apply").then(() => true).catch(() => false);
            if (ok) appliedRemoves += 1;
          }
        }

        if (apply && (appliedAdds || appliedRemoves)) {
          metrics.roleSyncUpdates += 1;
        }

        const lines = [
          `RoleSync ${apply ? "Validate+Apply" : "Validate"} complete.`,
          `Rules: ${rules.length}`,
          `Members scanned: ${scanned}`,
          `Drifted members: ${driftedMembers}`,
          `Planned changes: +${addCount} / -${removeCount}`
        ];
        if (apply) {
          lines.push(`Applied changes: +${appliedAdds} / -${appliedRemoves}`);
        }
        if (examples.length) {
          lines.push(`Examples: ${examples.join(", ")}`);
        }
        await interaction.editReply({ content: truncate(lines.join("\n"), 1900) });
        return;
      }
    }

    if (interaction.commandName === "case") {
      const staff = await requireStaff(interaction, "modcall");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      const data = loadModCallsState();

      if (sub === "assign-next") {
        const forcedId = interaction.options.getString("id") || "";
        const target = forcedId
          ? data.cases.find((x) => x.id === forcedId && x.status !== "closed" && x.status !== "cancelled")
          : data.cases.find((x) => !x.claimedBy && x.status !== "closed" && x.status !== "cancelled");
        if (!target) {
          await interaction.reply({ content: forcedId ? `Open case not found: \`${forcedId}\`.` : "No unassigned open cases found.", ephemeral: true });
          return;
        }
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }

        const onShiftIds = Object.entries(data.shifts).filter(([, v]) => v?.on).map(([id]) => id);
        const preferredExpertise = target.category || "";
        const assignTo = pickLeastBusyModerator(data, onShiftIds, { preferredExpertise });
        if (!assignTo) {
          await interaction.reply({ content: "No on-shift moderators are available for assignment.", ephemeral: true });
          return;
        }
        if (isSimulationModeEnabled()) {
          await interaction.reply({ content: `Simulation mode: would assign case \`${target.id}\` to <@${assignTo}>.`, ephemeral: true });
          return;
        }
        target.claimedBy = assignTo;
        target.claimedAt = target.claimedAt || new Date().toISOString();
        target.status = "claimed";
        if (!Number.isFinite(target.firstResponseMs)) {
          target.firstResponseMs = Math.max(0, Date.now() - new Date(target.createdAt || Date.now()).getTime());
        }
        addCaseHistoryRow(target, "auto-assigned", interaction.user.id, `Assigned to ${assignTo} via /case assign-next`);
        data.stats.claimed += 1;
        saveModCallsState(data);

        const thread = target.threadId ? await interaction.guild.channels.fetch(target.threadId).catch(() => null) : null;
        if (thread && thread.isTextBased()) {
          await sendMessageWithGuards(thread, { content: `🧭 Auto-assigned to <@${assignTo}> by <@${interaction.user.id}>.` }, "case.assign-next", reqId);
        }
        await notifyReporterUpdate(interaction.client, target, `Your case is now assigned to <@${assignTo}>.`);
        await interaction.reply({ content: `Case \`${target.id}\` assigned to <@${assignTo}>.`, ephemeral: true });
        return;
      }

      if (sub === "timeline") {
        const id = interaction.options.getString("id", true);
        const row = data.cases.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: "Case not found.", ephemeral: true });
          return;
        }
        const history = ensureArray(row.history).slice(-25).map((h) => `${h.at || "unknown"} • ${h.action} • ${h.actorId ? `<@${h.actorId}>` : "system"}${h.note ? ` • ${truncate(h.note, 120)}` : ""}`);
        const lines = [
          `Case: \`${row.id}\``,
          `Status: ${row.status}`,
          `Priority: ${row.priority || "normal"}`,
          `Reporter: <@${row.reporterId}>`,
          row.claimedBy ? `Claimed by: <@${row.claimedBy}>` : "Claimed by: unassigned",
          row.closedBy ? `Closed by: <@${row.closedBy}>` : "",
          `Created: ${row.createdAt || "unknown"}`,
          row.closedAt ? `Closed: ${row.closedAt}` : "",
          `Evidence count: ${ensureArray(row.evidence).length}`,
          "Timeline:",
          history.length ? history.join("\n") : "No timeline events."
        ].filter(Boolean);
        await interaction.reply({ content: truncate(lines.join("\n"), 1900), ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "staffpanel") {
      const staff = await requireStaff(interaction, "ops");
      if (!staff) return;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("staffpanel:staff").setLabel("Staff List").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("staffpanel:coverage").setLabel("Coverage").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("staffpanel:opsstatus").setLabel("Ops Status").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("staffpanel:rolesync").setLabel("RoleSync Check").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("staffpanel:modqueue").setLabel("Mod Queue").setStyle(ButtonStyle.Danger)
      );
      await interaction.reply({
        content: "Staff panel ready. Use the buttons below for common moderation actions.",
        components: [row],
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "staffquickstart") {
      const staff = await requireStaff(interaction, "ops");
      if (!staff) return;
      if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: "Invalid channel for quickstart post.", ephemeral: true });
        return;
      }
      const quickstart = [
        "## Staff Quickstart",
        "1) Intake + triage",
        "- `/modcall create` to open a case",
        "- `/case assign-next` to route to least-busy on-shift mod",
        "- `/modcall priority` for urgent escalation",
        "2) Live response",
        "- `/modcall status` to keep reporter updated",
        "- `/modcall evidence` to attach links/files",
        "- `/playbook topic:<harassment|cheating|spam|raid>` for SOP",
        "3) Operations + safety",
        "- `/ops status` and `/ops safemode on|off`",
        "- `/permissions audit` to detect missing bot perms",
        "- `/rolesync preview` then `/rolesync validate apply:true`",
        "4) Shift turnover",
        "- `/handoff include_cases:true`",
        "- `/staffstats` for performance snapshot",
        "5) Announcements",
        "- `/announce preset:maintenance everyone:true`",
        "- `/announcepreset preset:incident note:\"...\"`"
      ].join("\n");
      const posted = await sendMessageWithGuards(interaction.channel, { content: quickstart }, "staffquickstart.post", reqId);
      if (!posted) {
        await interaction.reply({ content: "Quickstart suppressed due to staging/dry-run mode.", ephemeral: true });
        return;
      }
      let pinStatus = "posted";
      try {
        await posted.pin("Staff quickstart guide");
        pinStatus = "posted and pinned";
      } catch {
        pinStatus = "posted (pin failed: missing permission or pin limit)";
      }
      await interaction.reply({ content: `Staff quickstart ${pinStatus}: ${posted.url}`, ephemeral: true });
      return;
    }

    if (interaction.commandName === "playbook") {
      const staff = await requireStaff(interaction, "modcall");
      if (!staff) return;
      const topic = interaction.options.getString("topic", true);
      const steps = PLAYBOOKS[topic] || [];
      if (!steps.length) {
        await interaction.reply({ content: "Playbook topic not found.", ephemeral: true });
        return;
      }
      const lines = [`**${topic.toUpperCase()} Playbook**`, ...steps.map((s, i) => `${i + 1}. ${s}`)];
      const maybeCaseId = interaction.options.getString("case_id") || "";
      const execute = interaction.options.getBoolean("execute") || false;
      if (execute && maybeCaseId) {
        const data = loadModCallsState();
        const row = data.cases.find((x) => x.id === maybeCaseId);
        if (row && interaction.guild) {
          addCaseHistoryRow(row, "playbook-executed", interaction.user.id, `Applied playbook ${topic}`);
          saveModCallsState(data);
          const thread = row.threadId ? await interaction.guild.channels.fetch(row.threadId).catch(() => null) : null;
          if (thread && thread.isTextBased()) {
            await sendMessageWithGuards(thread, { content: `📘 Playbook \`${topic}\` executed by <@${interaction.user.id}>.\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` }, "playbook.execute", reqId);
          }
          lines.push("", `Applied to case: \`${maybeCaseId}\``);
        } else {
          lines.push("", `Could not apply to case: \`${maybeCaseId}\` (not found).`);
        }
      }
      await interaction.reply({ content: lines.join("\n"), ephemeral: true });
      return;
    }

    if (interaction.commandName === "triage") {
      const staff = await requireStaff(interaction, "modcall");
      if (!staff) return;
      const text = interaction.options.getString("text", true);
      const triage = triageContent(text);
      const data = loadModCallsState();
      const dup = data.cases.find((x) => x.status !== "closed" && x.status !== "cancelled" && String(x.details || "").toLowerCase().includes(String(text).toLowerCase().slice(0, 40)));
      await interaction.reply({
        content: [
          `Triage Result`,
          `Category: ${triage.category}`,
          `Urgency: ${triage.urgency}`,
          `Suggested actions:`,
          ...triage.actions.map((x) => `- ${x}`),
          dup ? `Possible duplicate case: \`${dup.id}\`` : "Possible duplicate case: none"
        ].join("\n"),
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "handoff") {
      const staff = await requireStaff(interaction, "mod");
      if (!staff) return;
      const includeCases = interaction.options.getBoolean("include_cases") || false;
      const data = loadModCallsState();
      const openRows = data.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled");
      const unclaimed = openRows.filter((x) => !x.claimedBy);
      const pendingApprovals = loadPendingAdminApprovals().filter((x) => x.status === "pending").length;
      const onShiftIds = Object.entries(data.shifts).filter(([, v]) => v?.on).map(([id]) => id);
      const lines = [
        "Shift Handoff Summary",
        `On-shift moderators: ${onShiftIds.length ? onShiftIds.map((x) => `<@${x}>`).join(", ") : "none"}`,
        `Open cases: ${openRows.length}`,
        `Unclaimed cases: ${unclaimed.length}`,
        `Escalations total: ${data.stats.escalated || 0}`,
        `Pending admin approvals: ${pendingApprovals}`
      ];
      if (includeCases && openRows.length) {
        lines.push("Open case queue:");
        lines.push(openRows.slice(0, 12).map(buildModCallSummaryRow).join("\n"));
      }
      await interaction.reply({ content: truncate(lines.join("\n"), 1900), ephemeral: true });
      return;
    }

    if (interaction.commandName === "permissions") {
      const staff = await requireStaff(interaction, "ops");
      if (!staff) return;
      const sub = interaction.options.getSubcommand();
      if (sub === "audit") {
        const detailed = interaction.options.getBoolean("detailed") || false;
        await interaction.deferReply({ ephemeral: true });
        const rows = await runPermissionAudit(interaction.guild);
        const text = rows.map((x) =>
          `${x.ok ? "✅" : "❌"} ${x.label}: ${formatPermAuditMissing(x.missing)}${detailed && x.suggestion ? `\n  fix: ${x.suggestion}` : ""}`
        ).join("\n");
        await interaction.editReply({ content: truncate(text, 1900) });
        return;
      }
    }

    if (interaction.commandName === "staffstats") {
      const staff = await requireStaff(interaction, "mod");
      if (!staff) return;
      const target = interaction.options.getUser("user");
      const data = loadModCallsState();
      const stats = buildStaffStats(data, target?.id || "");
      const mean = (arr) => arr.length ? Math.floor(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
      if (target) {
        const row = stats[target.id] || { assigned: 0, closed: 0, reopened: 0, responseMs: [], resolutionMs: [] };
        await interaction.reply({
          content: [
            `Staff Stats: <@${target.id}>`,
            `Assigned: ${row.assigned}`,
            `Closed: ${row.closed}`,
            `Reopened involved: ${row.reopened}`,
            `Avg first response: ${Math.floor(mean(row.responseMs) / 1000)}s`,
            `Avg resolution: ${Math.floor(mean(row.resolutionMs) / 60000)}m`
          ].join("\n"),
          ephemeral: true
        });
        return;
      }
      const leaderboard = Object.entries(stats)
        .sort((a, b) => (b[1].closed || 0) - (a[1].closed || 0))
        .slice(0, 10)
        .map(([id, row]) => `<@${id}> closed:${row.closed} assigned:${row.assigned} avgResp:${Math.floor(mean(row.responseMs) / 1000)}s`);
      await interaction.reply({ content: leaderboard.length ? leaderboard.join("\n") : "No staff moderation stats available yet.", ephemeral: true });
      return;
    }

    if (interaction.commandName === "announcepreset") {
      const staff = await requireStaff(interaction, "announce");
      if (!staff) return;
      const preset = interaction.options.getString("preset", true);
      const note = interaction.options.getString("note") || "";
      const everyone = interaction.options.getBoolean("everyone") || false;
      const base = ANNOUNCE_PRESETS[preset] || "Staff announcement.";
      const content = `${everyone ? "@everyone\n" : ""}${base}${note ? `\n${truncate(note, 500)}` : ""}`;
      const channel = await client.channels.fetch(announceChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: "Announcement channel not configured.", ephemeral: true });
        return;
      }
      const sent = await sendMessageWithGuards(channel, { content }, "announcepreset.send", reqId);
      await interaction.reply({ content: sent ? `Preset announcement sent: ${preset}.` : "Announcement suppressed due to staging/dry-run mode.", ephemeral: true });
      return;
    }

    if (interaction.commandName === "knowledge") {
      const staff = await requireStaff(interaction, "modcall");
      if (!staff) return;
      const query = interaction.options.getString("query", true);
      const hits = searchKnowledge(query, 6);
      if (!hits.length) {
        await interaction.reply({ content: `No knowledge hits for: ${query}`, ephemeral: true });
        return;
      }
      const lines = hits.map((h, i) => `${i + 1}. [${h.topic}] ${truncate(h.text, 220)}`);
      await interaction.reply({ content: truncate(lines.join("\n"), 1900), ephemeral: true });
      return;
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

      if (sub === "wizard") {
        await interaction.reply({
          content: [
            "Ticket Wizard",
            "1) Summarize issue in one sentence.",
            "2) Add timeline and impacted users/systems.",
            "3) Attach evidence/screenshots if available.",
            "4) Use `/ticket create` with urgency and details.",
            "5) For structured intake, run `/ticket intake`."
          ].join("\n"),
          ephemeral: true
        });
        return;
      }

      if (sub === "intake") {
        const modal = new ModalBuilder()
          .setCustomId("ticket:intake")
          .setTitle("Ticket Intake Form");
        const subject = new TextInputBuilder()
          .setCustomId("subject")
          .setLabel("Subject")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(120);
        const details = new TextInputBuilder()
          .setCustomId("details")
          .setLabel("Details")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1200);
        const urgency = new TextInputBuilder()
          .setCustomId("urgency")
          .setLabel("Urgency (normal/high/urgent)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(16);
        modal.addComponents(
          new ActionRowBuilder().addComponents(subject),
          new ActionRowBuilder().addComponents(details),
          new ActionRowBuilder().addComponents(urgency)
        );
        await interaction.showModal(modal);
        return;
      }

      if (sub === "create") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const subject = interaction.options.getString("subject", true);
        const details = interaction.options.getString("details") || "No details provided.";
        const urgency = interaction.options.getString("urgency") || "normal";
        const triage = triageContent(`${subject}\n${details}`);
        const tickets = loadTickets();
        const duplicate = tickets.find((x) =>
          x.status === "open" &&
          x.userId === interaction.user.id &&
          (Date.now() - new Date(x.createdAt || 0).getTime()) < 24 * 60 * 60 * 1000 &&
          String(x.subject || "").toLowerCase() === String(subject || "").toLowerCase()
        );
        if (duplicate) {
          await interaction.reply({ content: `You already have a similar open ticket: <#${duplicate.channelId}>`, ephemeral: true });
          return;
        }
        if (isSimulationModeEnabled()) {
          await interaction.reply({
            content: [
              "Simulation mode is enabled. Ticket was analyzed but not created.",
              `Category: ${triage.category}`,
              `Urgency: ${triage.urgency}`,
              ...triage.actions.map((x) => `- ${x}`)
            ].join("\n"),
            ephemeral: true
          });
          return;
        }
        const intakeChannel = ticketChannelId
          ? await client.channels.fetch(ticketChannelId).catch(() => null)
          : interaction.channel;

        if (!intakeChannel || !intakeChannel.isTextBased()) {
          await interaction.reply({ content: "Ticket channel is not configured or invalid.", ephemeral: true });
          return;
        }

        const sanitizedUser = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 14) || "user";
        const suffix = Date.now().toString(36).slice(-5);
        const channelName = `ticket-${sanitizedUser}-${suffix}`.slice(0, 90);
        const staffRoleIds = getStaffRoleIdsForTicketing();
        const permissionOverwrites = [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.ManageChannels,
              PermissionsBitField.Flags.ManageMessages
            ]
          },
          ...staffRoleIds.map((roleId) => ({
            id: roleId,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.ManageMessages
            ]
          }))
        ];

        const ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: intakeChannel.parentId || null,
          topic: `Private ticket for ${interaction.user.tag} (${interaction.user.id}) | urgency:${urgency}`,
          permissionOverwrites,
          reason: `Private ticket by ${interaction.user.tag}`
        }).catch(() => null);

        if (!ticketChannel || !ticketChannel.isTextBased()) {
          await interaction.reply({ content: "Unable to create private ticket channel. Check bot Manage Channels/Manage Roles permissions.", ephemeral: true });
          return;
        }

        const staffMentions = staffRoleIds.map((id) => `<@&${id}>`).join(" ") || (ticketSupportRoleId ? `<@&${ticketSupportRoleId}>` : "Staff");
        await sendMessageWithGuards(ticketChannel, {
          content: [
            `🎫 **Private Support Ticket**`,
            `Reporter: <@${interaction.user.id}>`,
            `Urgency: **${urgency.toUpperCase()}**`,
            `Triage Category: **${triage.category}**`,
            `Subject: **${truncate(subject, 120)}**`,
            `Details: ${truncate(details, 1400)}`,
            `Staff: ${staffMentions}`,
            "",
            "**User Context Snapshot**",
            buildUserContextSummary(interaction.user.id)
          ].join("\n")
        }, "ticket.create.private", reqId);

        await sendMessageWithGuards(intakeChannel, {
          content: `🧾 Private ticket opened by <@${interaction.user.id}>: ${ticketChannel.toString()} (${urgency})`
        }, "ticket.create.audit", reqId);

        const urgentKeywords = /(urgent|asap|immediately|now|critical|emergency)/i;
        const isUrgent = urgency === "urgent" || urgency === "high" || triage.urgency === "urgent" || urgentKeywords.test(`${subject} ${details}`);
        if (isUrgent) {
          const dm = await notifyUrgentStaff(interaction.guild, {
            title: "Urgent Ticket Alert",
            summary: `New ${urgency} private ticket (${triage.category}): ${truncate(subject, 140)}`,
            link: ticketChannel.url,
            reporterId: interaction.user.id
          });
          logEvent("info", "ticket.urgent.dm", { sent: dm.sent, failed: dm.failed, ticketChannelId: ticketChannel.id });
        }

        tickets.unshift({
          id: makeId("tkt"),
          channelId: ticketChannel.id,
          userId: interaction.user.id,
          subject: truncate(subject, 140),
          details: truncate(details, 800),
          urgency,
          triageCategory: triage.category,
          status: "open",
          createdAt: new Date().toISOString(),
          createdBy: interaction.user.id
        });
        saveTickets(tickets.slice(0, 1000));

        await interaction.reply({ content: `Ticket created: ${ticketChannel.toString()} (private)`, ephemeral: true });
        return;
      }

      if (sub === "close") {
        const member = await requireStaff(interaction);
        if (!member) return;
        const channel = interaction.channel;
        if (!channel) {
          await interaction.reply({ content: "Invalid ticket channel.", ephemeral: true });
          return;
        }
        const closed = await closeTicketConversation(interaction, channel);
        if (closed) return;
        await interaction.reply({ content: "Run this inside a ticket channel/thread to close it.", ephemeral: true });
        return;
      }

      if (sub === "forceclose") {
        const member = await requireOwnerOrAdmin(interaction, "admin");
        if (!member) return;

        const target = interaction.options.getChannel("channel") || interaction.channel;
        if (!target) {
          await interaction.reply({ content: "Invalid channel target.", ephemeral: true });
          return;
        }

        const isThread = target.type === ChannelType.PublicThread || target.type === ChannelType.PrivateThread;
        const parent = isThread ? (target.parent || null) : null;
        const deleteTarget = (isThread && parent && isTicketLikeChannel(parent)) ? parent : target;
        const ticketLike = isTicketLikeChannel(target) || isTicketLikeChannel(deleteTarget);

        if (!ticketLike) {
          await interaction.reply({
            content: "Force close only works on ticket-like channels/threads (name starts with `ticket-`).",
            ephemeral: true
          });
          return;
        }

        const tickets = loadTickets();
        let updated = 0;
        for (const row of tickets) {
          if (row.status !== "open") continue;
          if (row.channelId === target.id || row.channelId === deleteTarget.id || (parent && row.channelId === parent.id)) {
            row.status = "closed";
            row.closedAt = new Date().toISOString();
            row.closedBy = interaction.user.id;
            row.forceClosed = true;
            updated += 1;
          }
        }
        if (updated) saveTickets(tickets);

        await interaction.reply({ content: `Force-closing ${deleteTarget.toString()}...`, ephemeral: true });
        const reason = truncate(interaction.options.getString("reason") || `Ticket force-closed by ${interaction.user.tag}`, 180);
        const deleted = await deleteTarget.delete(reason).then(() => true).catch(() => false);
        if (!deleted) {
          await interaction.editReply({
            content: "I marked what I could, but failed to delete the channel/thread. Check bot Manage Channels permission."
          }).catch(() => {});
          return;
        }
        await interaction.editReply({
          content: `Force-closed and deleted ${deleteTarget.toString()}.${updated ? ` Updated ${updated} ticket record(s).` : " No open ticket records were found (metadata-recovery path)."}`.trim()
        }).catch(() => {});
        return;
      }

      if (sub === "reopen") {
        const member = await requireStaff(interaction);
        if (!member) return;
        const id = interaction.options.getString("id", true);
        const tickets = loadTickets();
        const row = tickets.find((x) => x.id === id);
        if (!row) {
          await interaction.reply({ content: `Ticket not found: ${id}`, ephemeral: true });
          return;
        }
        row.status = "open";
        row.reopenedAt = new Date().toISOString();
        row.reopenedBy = interaction.user.id;
        saveTickets(tickets);
        if (row.userId) {
          const user = await interaction.client.users.fetch(row.userId).catch(() => null);
          if (user) {
            const locale = getUserLocale(row.userId);
            await user.send(formatLocalized(locale, "ticket_reopened_dm", { name: row.subject || row.id })).catch(() => {});
          }
        }
        await interaction.reply({ content: `Ticket reopened: \`${row.id}\``, ephemeral: true });
        return;
      }

      if (sub === "feedback") {
        const ticketId = interaction.options.getString("ticket_id", true);
        const rating = Math.max(1, Math.min(interaction.options.getInteger("rating", true), 5));
        const note = truncate(interaction.options.getString("note") || "", 400);
        const tickets = loadTickets();
        const row = tickets.find((x) => x.id === ticketId && x.userId === interaction.user.id);
        if (!row) {
          await interaction.reply({ content: "Ticket not found for your account.", ephemeral: true });
          return;
        }
        row.feedback = {
          rating,
          note,
          at: new Date().toISOString(),
          by: interaction.user.id
        };
        saveTickets(tickets);
        if (logChannelId) {
          const logChannel = await interaction.client.channels.fetch(logChannelId).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            await sendMessageWithGuards(logChannel, {
              content: `Ticket feedback: \`${ticketId}\` by <@${interaction.user.id}> • rating ${rating}/5${note ? ` • ${note}` : ""}`
            }, "ticket.feedback");
          }
        }
        const locale = getUserLocale(interaction.user.id);
        await interaction.reply({ content: formatLocalized(locale, "ticket_feedback_thanks"), ephemeral: true });
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

      const message = interaction.options.getString("message") || "";
      const preset = interaction.options.getString("preset") || "";
      const note = interaction.options.getString("note") || "";
      const everyone = interaction.options.getBoolean("everyone") || false;
      const presetMessage = preset ? (ANNOUNCE_PRESETS[preset] || "") : "";
      const body = [message || presetMessage, note].filter(Boolean).join("\n");
      if (!body) {
        await interaction.reply({ content: "Provide `message` or `preset`.", ephemeral: true });
        return;
      }
      const channel = await client.channels.fetch(announceChannelId).catch(() => null);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: "Announcement channel not configured", ephemeral: true });
        return;
      }
      const sent = await sendMessageWithGuards(channel, { content: everyone ? `@everyone\n${body}` : body }, "announce.send", reqId);
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

    if (interaction.commandName === "clear") {
      const member = await requireStaff(interaction, "purge");
      if (!member) return;
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const optChannel = interaction.options.getChannel("channel");
      const target = optChannel || interaction.channel;
      if (!target || !target.isTextBased()) {
        await interaction.reply({ content: "Target must be a text-based channel.", ephemeral: true });
        return;
      }

      if (sub === "messages") {
        const amount = interaction.options.getInteger("amount", true);
        const reason = truncate(interaction.options.getString("reason") || "No reason provided.", 220);
        const dryRun = interaction.options.getBoolean("dry_run") || false;
        if (amount < 1 || amount > 1000) {
          await interaction.reply({ content: "Amount must be between 1 and 1000.", ephemeral: true });
          return;
        }
        if (typeof target.bulkDelete !== "function") {
          await interaction.reply({ content: "Bulk delete is not supported for that channel type.", ephemeral: true });
          return;
        }
        if (dryRun || isSimulationModeEnabled()) {
          await interaction.reply({
            content: `Dry run: would clear up to ${amount} recent message(s) in <#${target.id}>. Reason: ${reason}`,
            ephemeral: true
          });
          return;
        }

        let remaining = amount;
        let deletedTotal = 0;
        while (remaining > 0) {
          const batchSize = Math.min(100, remaining);
          const deleted = await target.bulkDelete(batchSize, true).catch(() => null);
          if (!deleted || deleted.size === 0) break;
          deletedTotal += deleted.size;
          remaining -= deleted.size;
          if (deleted.size < batchSize) break;
        }

        if (!deletedTotal) {
          await interaction.reply({ content: "No messages were deleted. Messages older than 14 days cannot be bulk deleted.", ephemeral: true });
          return;
        }

        addIncident({
          severity: "medium",
          userId: interaction.user.id,
          reason: `clear messages ${deletedTotal} in #${target.id} (${reason})`,
          createdBy: interaction.user.id,
          auto: true
        });
        if (logChannelId) {
          const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle("Staff Clear Action")
              .setColor(0xf59e0b)
              .addFields(
                { name: "Mode", value: "messages", inline: true },
                { name: "Deleted", value: String(deletedTotal), inline: true },
                { name: "Channel", value: `<#${target.id}>`, inline: true },
                { name: "By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Reason", value: reason, inline: false }
              )
              .setTimestamp();
            await sendMessageWithGuards(logChannel, { embeds: [embed] }, "clear.messages.log", reqId);
          }
        }
        await interaction.reply({ content: `Cleared ${deletedTotal} message(s) in <#${target.id}>.`, ephemeral: true });
        return;
      }

      if (sub === "nuke") {
        const confirm = String(interaction.options.getString("confirm", true) || "").trim();
        const reason = truncate(interaction.options.getString("reason") || "No reason provided.", 220);
        const dryRun = interaction.options.getBoolean("dry_run") || false;
        if (confirm !== "NUKE") {
          await interaction.reply({ content: "Confirmation failed. Type `NUKE` exactly.", ephemeral: true });
          return;
        }
        if (target.type !== ChannelType.GuildText && target.type !== ChannelType.GuildAnnouncement) {
          await interaction.reply({ content: "Nuke supports server text/announcement channels only.", ephemeral: true });
          return;
        }
        if (dryRun || isSimulationModeEnabled()) {
          await interaction.reply({
            content: `Dry run: would nuke <#${target.id}> and recreate it. Reason: ${reason}`,
            ephemeral: true
          });
          return;
        }
        if (adminRequireSecondConfirmation) {
          const approvals = loadPendingAdminApprovals();
          const record = {
            id: makeId("apr"),
            action: "clear_nuke",
            payload: { channelId: target.id, reason },
            requestedBy: interaction.user.id,
            requestedAt: new Date().toISOString(),
            status: "pending",
            approvedBy: "",
            approvedAt: ""
          };
          approvals.unshift(record);
          savePendingAdminApprovals(approvals.slice(0, 300));
          if (logChannelId) {
            const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
            if (logChannel && logChannel.isTextBased()) {
              await sendMessageWithGuards(logChannel, {
                content: `🛂 Approval required for clear_nuke request \`${record.id}\` on <#${target.id}> by <@${interaction.user.id}>. Use /approve request_id:${record.id} decision:approve`
              }, "clear.nuke.approval", reqId);
            }
          }
          await interaction.reply({ content: `Nuke request queued for approval: \`${record.id}\`.`, ephemeral: true });
          return;
        }

        await interaction.reply({ content: `Nuking <#${target.id}>...`, ephemeral: true });
        const cloned = await target.clone({ reason: `Channel nuke by ${interaction.user.tag}` }).catch(() => null);
        if (!cloned) {
          await interaction.editReply({ content: "Failed to clone channel for nuke." });
          return;
        }

        await cloned.setPosition(target.position).catch(() => null);
        await target.delete(`Channel nuke by ${interaction.user.tag}`).catch(() => null);

        addIncident({
          severity: "high",
          userId: interaction.user.id,
          reason: `clear nuke channel ${target.id} -> ${cloned.id} (${reason})`,
          createdBy: interaction.user.id,
          auto: true
        });
        if (logChannelId) {
          const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle("Staff Clear Action")
              .setColor(0xef4444)
              .addFields(
                { name: "Mode", value: "nuke", inline: true },
                { name: "Old Channel", value: `\`${target.id}\``, inline: true },
                { name: "New Channel", value: `<#${cloned.id}>`, inline: true },
                { name: "By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Reason", value: reason, inline: false }
              )
              .setTimestamp();
            await sendMessageWithGuards(logChannel, { embeds: [embed] }, "clear.nuke.log", reqId);
          }
        }
        await interaction.editReply({ content: `Channel nuked successfully. New channel: <#${cloned.id}>` });
        return;
      }
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
    const cmd = interaction.commandName || "unknown";
    const streak = (commandErrorStreaks.get(cmd) || 0) + 1;
    commandErrorStreaks.set(cmd, streak);
    if (streak >= commandErrorStreakSafeModeThreshold && !loadAdminSafeModeState().enabled) {
      setAdminSafeMode(true, interaction.user?.id || "");
      await sendOpsAlert("auto-safemode", `Auto-enabled safe mode after ${streak} consecutive /${cmd} errors.`);
    }
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
    const cmd = interaction.commandName || "unknown";
    if (auditStatus !== "error") {
      commandErrorStreaks.set(cmd, 0);
    }
    const durationMs = Date.now() - auditStartedAt;
    if (durationMs <= 200) metrics.commandLatency.le_200 += 1;
    else if (durationMs <= 500) metrics.commandLatency.le_500 += 1;
    else if (durationMs <= 1000) metrics.commandLatency.le_1000 += 1;
    else metrics.commandLatency.gt_1000 += 1;

    logEvent("info", "command.complete", {
      reqId,
      command: interaction.commandName || "",
      status: auditStatus,
      durationMs
    });
    appendAuditEntry({
      reqId,
      timeUtc: new Date().toISOString(),
      durationMs,
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

async function runShiftPlanReminders() {
  bumpMetric("schedulerRun");

  if (!client.guilds.cache.size) return;
  const guild = client.guilds.cache.first();
  if (!guild) return;

  const rows = loadShiftPlans();
  if (!rows.length) return;

  const now = new Date();
  const hhmm = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const dayKey = now.toISOString().slice(0, 10);

  const state = loadState();
  const sent = state.shiftReminderSent && typeof state.shiftReminderSent === "object" ? state.shiftReminderSent : {};
  let changed = false;

  for (const row of rows) {
    const slot = String(row.timeUtc || "").trim();
    if (!slot || slot !== hhmm) continue;
    const id = String(row.id || "").trim();
    const userId = String(row.userId || "").trim();
    if (!id || !userId) continue;

    const key = `${id}:${dayKey}:${slot}`;
    if (sent[key]) continue;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      sent[key] = Date.now();
      changed = true;
      continue;
    }

    const content = [
      "Shift reminder",
      `Time: ${slot} UTC`,
      row.note ? `Note: ${truncate(String(row.note || ""), 180)}` : ""
    ].filter(Boolean).join("\n");
    const delivered = await member.send({ content }).then(() => true).catch(() => false);
    if (delivered && modChannelId) {
      const channel = await client.channels.fetch(modChannelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        await sendMessageWithGuards(channel, {
          content: `⏰ Shift reminder sent to <@${userId}> (${slot} UTC).${row.note ? ` Note: ${truncate(String(row.note || ""), 120)}` : ""}`
        }, "shiftplan.reminder");
      }
    }
    sent[key] = Date.now();
    changed = true;
  }

  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(sent)) {
    if (Number(ts) < cutoff) {
      delete sent[key];
      changed = true;
    }
  }

  if (changed) {
    state.shiftReminderSent = sent;
    saveState(state);
  }
}

function normalizeAutomationConfig(raw) {
  return {
    enabled: Boolean(raw?.enabled),
    defaultChannelId: String(raw?.defaultChannelId || "").trim(),
    quietHoursStartUtc: Number(raw?.quietHoursStartUtc ?? 0),
    quietHoursEndUtc: Number(raw?.quietHoursEndUtc ?? 0),
    rotatingTemplates: Array.isArray(raw?.rotatingTemplates) ? raw.rotatingTemplates : [],
    schedules: Array.isArray(raw?.schedules) ? raw.schedules : [],
    campaigns: Array.isArray(raw?.campaigns) ? raw.campaigns : [],
    manualDispatches: Array.isArray(raw?.manualDispatches) ? raw.manualDispatches : []
  };
}

function isInQuietHours(now, startUtc, endUtc) {
  const start = Math.max(0, Math.min(23, Number(startUtc || 0)));
  const end = Math.max(0, Math.min(23, Number(endUtc || 0)));
  if (start === end) return false;
  const hour = now.getUTCHours();
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function scheduleMatchesNow(schedule, now) {
  if (!schedule || schedule.enabled === false) return false;
  const rawTime = String(schedule.timeUtc || "").trim();
  const m = rawTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (now.getUTCHours() !== hh || now.getUTCMinutes() !== mm) return false;

  const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = dayMap[now.getUTCDay()];
  const days = Array.isArray(schedule.days) ? schedule.days : [];
  if (days.length === 0) return true;
  return days.includes(today);
}

function campaignSlotKey(cadence, now) {
  const c = String(cadence || "").trim().toLowerCase();
  if (c === "hourly") return `${now.toISOString().slice(0, 13)}`;
  if (c === "weekly") return isoWeekKey(now);
  if (c === "monthly") return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return now.toISOString().slice(0, 10);
}

function campaignMatchesNow(campaign, now) {
  if (!campaign || campaign.enabled === false) return false;
  const c = String(campaign.cadence || "").trim().toLowerCase();
  if (c === "weekly") return now.getUTCDay() === 1 && now.getUTCHours() === 18 && now.getUTCMinutes() === 0;
  if (c === "monthly") return now.getUTCDate() === 1 && now.getUTCHours() === 18 && now.getUTCMinutes() === 0;
  if (c === "hourly") return now.getUTCMinutes() === 0;
  if (c === "weekdays") {
    const d = now.getUTCDay();
    return d >= 1 && d <= 5 && now.getUTCHours() === 18 && now.getUTCMinutes() === 0;
  }
  return now.getUTCHours() === 18 && now.getUTCMinutes() === 0;
}

function getTemplateMessage(config, templateId) {
  if (!templateId) return "";
  const templates = Array.isArray(config.rotatingTemplates) ? config.rotatingTemplates : [];
  const found = templates.find((t) => t.id === templateId && t.enabled !== false);
  if (!found) return "";
  return String(found.message || "").trim();
}

function parseChannelId(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  const mentionMatch = value.match(/^<#(\d+)>$/);
  if (mentionMatch) return mentionMatch[1];
  const idMatch = value.match(/^(\d{10,30})$/);
  return idMatch ? idMatch[1] : "";
}

async function resolveAutomationChannelId(rawChannelId, fallbackChannelId) {
  const fallback = parseChannelId(fallbackChannelId) || announceChannelId;
  const parsed = parseChannelId(rawChannelId);
  const target = parsed || fallback;
  if (!target) return "";
  const channel = await client.channels.fetch(target).catch(() => null);
  if (!channel || !channel.isTextBased()) return fallback;
  return target;
}

function markAutomationSent(state, key) {
  const map = state.automationSent && typeof state.automationSent === "object" ? state.automationSent : {};
  map[key] = Date.now();

  const cutoff = Date.now() - (45 * 24 * 60 * 60 * 1000);
  for (const [k, ts] of Object.entries(map)) {
    if (Number(ts) < cutoff) delete map[k];
  }
  state.automationSent = map;
}

function automationAlreadySent(state, key) {
  const map = state.automationSent && typeof state.automationSent === "object" ? state.automationSent : {};
  return Boolean(map[key]);
}

async function runDiscordAutomation() {
  if (!announceChannelId) return;
  bumpMetric("schedulerRun");

  const raw = await adminFetch("/api/admin/content/discord-automation", { reqId: "scheduler-discord-automation" });
  const config = normalizeAutomationConfig(raw);
  if (!config.enabled) return;

  const now = new Date();
  if (isInQuietHours(now, config.quietHoursStartUtc, config.quietHoursEndUtc)) return;

  const state = loadState();
  let configChanged = false;
  const defaultChannelId = parseChannelId(config.defaultChannelId) || announceChannelId;

  for (const schedule of config.schedules) {
    if (!scheduleMatchesNow(schedule, now)) continue;
    const slot = `${schedule.id}:${now.toISOString().slice(0, 10)}:${String(schedule.timeUtc || "").trim()}`;
    const key = `automation:schedule:${slot}`;
    if (automationAlreadySent(state, key)) continue;

    const fromTemplate = getTemplateMessage(config, schedule.templateId);
    const body = String(fromTemplate || schedule.message || "").trim();
    if (!body) continue;
    const content = schedule.mentionEveryone ? `@everyone\n${body}` : body;
    const channelId = await resolveAutomationChannelId(schedule.channelId, defaultChannelId);
    if (!channelId) continue;

    enqueueJob({
      type: "automation-schedule",
      channelId,
      idempotencyKey: key,
      content,
      maxRetries: 6
    });
    markAutomationSent(state, key);
  }

  for (const campaign of config.campaigns) {
    if (!campaignMatchesNow(campaign, now)) continue;
    const slot = campaignSlotKey(campaign.cadence, now);
    const key = `automation:campaign:${campaign.id}:${slot}`;
    if (automationAlreadySent(state, key)) continue;

    const parts = [
      String(campaign.message || "").trim(),
      campaign.callToAction ? `\n${String(campaign.callToAction).trim()}` : ""
    ].filter(Boolean);
    const content = parts.join("\n").trim();
    if (!content) continue;
    const channelId = await resolveAutomationChannelId(campaign.channelId, defaultChannelId);
    if (!channelId) continue;

    enqueueJob({
      type: "automation-campaign",
      channelId,
      idempotencyKey: key,
      content,
      maxRetries: 6
    });
    markAutomationSent(state, key);
  }

  const pendingDispatches = [];
  for (const dispatch of config.manualDispatches) {
    const sourceType = dispatch?.sourceType === "campaign" ? "campaign" : "schedule";
    const sourceId = String(dispatch?.sourceId || "").trim();
    const dispatchId = String(dispatch?.id || "").trim();
    const key = dispatchId
      ? `automation:manual:${dispatchId}`
      : `automation:manual:${sourceType}:${sourceId}:${String(dispatch?.createdUtc || "")}`;
    if (automationAlreadySent(state, key)) continue;

    const message = String(dispatch?.message || "").trim();
    if (!message) continue;
    const mentionEveryone = Boolean(dispatch?.mentionEveryone);
    const content = mentionEveryone ? `@everyone\n${message}` : message;
    const channelId = await resolveAutomationChannelId(dispatch?.channelId, defaultChannelId);
    if (!channelId) continue;

    enqueueJob({
      type: "automation-manual",
      channelId,
      idempotencyKey: key,
      content,
      maxRetries: 6
    });
    markAutomationSent(state, key);
    configChanged = true;
  }

  if (config.manualDispatches.length) {
    config.manualDispatches = pendingDispatches;
    configChanged = true;
  }

  saveState(state);
  if (configChanged) {
    try {
      await adminFetch("/api/admin/content/discord-automation", {
        reqId: "scheduler-discord-automation-save",
        method: "PUT",
        body: config
      });
    } catch {}
  }
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

  const tickets = loadTickets();
  const ticketCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  let staleClosed = 0;
  for (const row of tickets) {
    const created = new Date(row.createdAt || 0).getTime();
    if (row.status === "open" && Number.isFinite(created) && created < ticketCutoff) {
      row.status = "stale";
      row.closedAt = new Date().toISOString();
      row.closeReason = "auto-stale-retention";
      staleClosed += 1;
    }
  }
  const keptTickets = tickets.filter((row) => {
    const ts = new Date(row.createdAt || 0).getTime();
    return Number.isFinite(ts) && ts >= (Date.now() - 180 * 24 * 60 * 60 * 1000);
  });
  if (staleClosed || keptTickets.length !== tickets.length) {
    saveTickets(keptTickets);
    logEvent("info", "retention.tickets.pruned", { staleClosed, removed: tickets.length - keptTickets.length });
  }

  const vault = loadVaultLinks();
  const keptVault = vault.filter((x) => new Date(x.expiresAt || 0).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (keptVault.length !== vault.length) saveVaultLinks(keptVault);

  const queue = loadModQueue();
  const keptQueue = queue.filter((x) => new Date(x.createdAt || 0).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (keptQueue.length !== queue.length) saveModQueue(keptQueue);

  const drills = loadDrills();
  const keptDrills = drills.filter((x) => new Date(x.startedAt || 0).getTime() > Date.now() - 365 * 24 * 60 * 60 * 1000);
  if (keptDrills.length !== drills.length) saveDrills(keptDrills);
}

async function runModCallEscalations() {
  bumpMetric("schedulerRun");
  const data = loadModCallsState();
  const now = Date.now();
  const openRows = data.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled");
  const closedRows = data.cases.filter((x) => x.status === "closed");
  if (!openRows.length && !closedRows.length) return;

  const onShiftMentions = Object.entries(data.shifts || {})
    .filter(([, row]) => row?.on)
    .map(([id]) => `<@${id}>`);

  for (const row of openRows) {
    const createdAtMs = new Date(row.createdAt || 0).getTime();
    if (Number.isFinite(createdAtMs) && !row.claimedBy) {
      const firstResponseDue = createdAtMs + modCallFirstResponseSlaMinutes * 60 * 1000;
      if (now >= firstResponseDue && !row.firstResponseReminderAt) {
        row.firstResponseReminderAt = new Date().toISOString();
        addCaseHistoryRow(row, "sla-first-response", "", `First response SLA exceeded (${modCallFirstResponseSlaMinutes}m)`);
        if (row.threadId) {
          const thread = await client.channels.fetch(row.threadId).catch(() => null);
          if (thread && thread.isTextBased()) {
            await sendMessageWithGuards(thread, { content: `⏰ First response SLA exceeded (${modCallFirstResponseSlaMinutes}m). ${onShiftMentions.join(" ") || (modCallRoleId ? `<@&${modCallRoleId}>` : "Moderators")}` }, "modcall.sla.first-response");
          }
        }
      }
    }
    if (row.claimedBy && Number.isFinite(createdAtMs) && row.status !== "closed") {
      const resolutionDue = createdAtMs + modCallResolutionSlaMinutes * 60 * 1000;
      if (now >= resolutionDue) {
        const last = row.resolutionReminderAt ? new Date(row.resolutionReminderAt).getTime() : 0;
        if (!last || now - last >= modCallEscalateRepeatMinutes * 60 * 1000) {
          row.resolutionReminderAt = new Date().toISOString();
          addCaseHistoryRow(row, "sla-resolution", "", `Resolution SLA exceeded (${modCallResolutionSlaMinutes}m)`);
          if (row.threadId) {
            const thread = await client.channels.fetch(row.threadId).catch(() => null);
            if (thread && thread.isTextBased()) {
              await sendMessageWithGuards(thread, { content: `⏳ Resolution SLA exceeded (${modCallResolutionSlaMinutes}m). Claimed by <@${row.claimedBy}>.` }, "modcall.sla.resolution");
            }
          }
        }
      }
    }

    if (row.claimedBy) continue;
    const nextAt = nextEscalationAt(row);
    if (now < nextAt) continue;

    row.escalationCount = Number(row.escalationCount || 0) + 1;
    row.lastEscalatedAt = new Date().toISOString();
    addCaseHistoryRow(row, "escalated", "", `Escalation #${row.escalationCount}`);
    data.stats.escalated += 1;

    const escalationMatrix = {
      1: onShiftMentions.length ? onShiftMentions.join(" ") : (modCallRoleId ? `<@&${modCallRoleId}>` : "Moderators"),
      2: seniorModRoleId ? `<@&${seniorModRoleId}>` : (modCallRoleId ? `<@&${modCallRoleId}>` : "Moderators"),
      3: ownerRoleIds.length ? ownerRoleIds.map((id) => `<@&${id}>`).join(" ") : (seniorModRoleId ? `<@&${seniorModRoleId}>` : "Moderators")
    };
    const mention = escalationMatrix[Math.min(3, row.escalationCount)] || escalationMatrix[3];
    const text = `⏱️ Unclaimed mod case \`${row.id}\` needs response (${row.escalationCount} escalation${row.escalationCount === 1 ? "" : "s"}). ${mention}`;

    if (row.threadId) {
      const thread = await client.channels.fetch(row.threadId).catch(() => null);
      if (thread && thread.isTextBased()) {
        await sendMessageWithGuards(thread, { content: text }, "modcall.escalation");
      }
    }
    await sendOpsAlert("modcall-escalation", `Case ${row.id} escalated (${row.escalationCount}).`);
    if (row.escalationCount >= 3 && client.guilds.cache.size > 0) {
      const guild = client.guilds.cache.first();
      await notifyUrgentStaff(guild, {
        title: "Escalation Matrix Alert",
        summary: `Case ${row.id} has reached escalation level ${row.escalationCount}.`,
        reporterId: row.reporterId
      });
    }
    await notifyReporterUpdate(client, row, "Your case has been escalated for faster moderator response.");
  }

  for (const row of closedRows) {
    if (!row.reporterId || !row.closedAt) continue;
    if (row.followupSentAt) continue;
    const closedAtMs = new Date(row.closedAt).getTime();
    if (!Number.isFinite(closedAtMs)) continue;
    const dueMs = closedAtMs + modCallFollowupHours * 60 * 60 * 1000;
    if (now < dueMs) continue;
    row.followupSentAt = new Date().toISOString();
    await notifyReporterUpdate(client, row, "Checking in after your recent case closure. Reply if the issue has resumed and staff can reopen.");
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
  const coaching = [];
  if (avgResponse > modCallFirstResponseSlaMinutes * 60 * 1000) coaching.push("First response average is above SLA; tighten assignment discipline.");
  if (avgResolution > modCallResolutionSlaMinutes * 60 * 1000) coaching.push("Resolution average is above SLA; improve escalation + handoff coverage.");
  if ((data.stats.falseReports || 0) > 10) coaching.push("False-report volume is elevated; increase reporter verification prompts.");
  if (!coaching.length) coaching.push("Great week. Keep current response and closure tempo.");

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
      `Top closers: ${topMods}`,
      `Coaching: ${coaching.join(" ")}`
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

async function runVoiceRaidProtections() {
  bumpMetric("schedulerRun");
  const community = loadCommunity();
  if (!community.raidMode) return;
  for (const guild of client.guilds.cache.values()) {
    await guild.channels.fetch();
    for (const channel of guild.channels.cache.values()) {
      if (!channel || channel.type !== ChannelType.GuildVoice) continue;
      if (channel.members.size < voiceRaidMemberThreshold) continue;
      const current = Number(channel.userLimit || 0);
      const target = Math.min(99, Math.max(4, voiceRaidMemberThreshold));
      if (!current || current > target) {
        await channel.setUserLimit(target, "Auto voice raid protection").catch(() => null);
      }
      await sendOpsAlert("voice-raid-protection", `Voice raid protection triggered in #${channel.name}: ${channel.members.size} members.`);
    }
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
  const initialDelayMs = 15000;
  setTimeout(() => safeScheduler(postStatusUpdate), initialDelayMs);
  setTimeout(() => safeScheduler(postLatestUpdate), initialDelayMs);
  setTimeout(() => safeScheduler(postLatestTransmission), initialDelayMs);
  setTimeout(() => safeScheduler(postModsChange), initialDelayMs);
  setTimeout(() => safeScheduler(postActivityLog), initialDelayMs);
  setTimeout(() => safeScheduler(runDiscordAutomation), initialDelayMs);
  setTimeout(() => safeScheduler(runModCallEscalations), initialDelayMs);
  setTimeout(() => safeScheduler(runOpsWatchdog), initialDelayMs);
  setTimeout(() => safeScheduler(runShiftPlanReminders), initialDelayMs);
  setTimeout(() => safeScheduler(runVoiceRaidProtections), initialDelayMs);

  setInterval(() => safeScheduler(postStatusUpdate), intervalMs(autoStatusMinutes));
  setInterval(() => safeScheduler(postLatestUpdate), intervalMs(autoUpdatesMinutes));
  setInterval(() => safeScheduler(postLatestTransmission), intervalMs(autoTransmissionsMinutes));
  setInterval(() => safeScheduler(postModsChange), intervalMs(autoModsMinutes));
  setInterval(() => safeScheduler(postActivityLog), intervalMs(autoActivityMinutes));
  setInterval(() => safeScheduler(runDiscordAutomation), intervalMs(autoDiscordAutomationMinutes));
  setInterval(() => safeScheduler(runReminders), 60 * 1000);
  setInterval(() => safeScheduler(runDailyReminder), 60 * 1000);
  setInterval(() => safeScheduler(runDailySummary), 60 * 1000);
  setInterval(() => safeScheduler(runCommunityMaintenance), 5 * 60 * 1000);
  setInterval(() => safeScheduler(runBackupMaintenance), 60 * 60 * 1000);
  setInterval(() => safeScheduler(runRetentionMaintenance), 60 * 60 * 1000);
  setInterval(() => safeScheduler(runModCallEscalations), 60 * 1000);
  setInterval(() => safeScheduler(runModWeeklyDigest), 60 * 1000);
  setInterval(() => safeScheduler(runOpsWatchdog), 60 * 1000);
  setInterval(() => safeScheduler(runShiftPlanReminders), 60 * 1000);
  setInterval(() => safeScheduler(runVoiceRaidProtections), 60 * 1000);
}

client.login(token);
