import "dotenv/config";
import fs from "fs";
import http from "http";
import path from "path";
import { randomUUID } from "crypto";
import { execFile, spawn } from "child_process";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Client, EmbedBuilder, GatewayIntentBits, ModalBuilder, PermissionsBitField, TextInputBuilder, TextInputStyle } from "discord.js";
import { canAccessCommand, normalizePolicy } from "./lib/policy.js";
import { sha256, verifyBackupPayload as verifyBackupPayloadCore } from "./lib/backup.js";

const token = process.env.DISCORD_TOKEN;
const apiBase = process.env.ADMIN_API_BASE || "";
const pteroBaseUrl = process.env.PTERO_APP_BASE_URL || "";
const pteroAppKey = process.env.PTERO_APP_KEY || "";
const pteroServerId = process.env.PTERO_SERVER_ID || "";
const pteroServerExternalId = process.env.PTERO_SERVER_EXTERNAL_ID || "";
const pteroTimeoutMs = Number(process.env.PTERO_TIMEOUT_MS || 8000);
const pteroClientBaseUrl = process.env.PTERO_CLIENT_BASE_URL || "";
const pteroClientKey = process.env.PTERO_CLIENT_KEY || "";
const pteroClientServerId = process.env.PTERO_CLIENT_SERVER_ID || "";
const pteroWatchEnabled = !/^(0|false|no)$/i.test(process.env.PTERO_WATCH_ENABLED || "false");
const pteroWatchIntervalMinutes = parsePositiveMinutes(process.env.PTERO_WATCH_INTERVAL_MINUTES, 5, "PTERO_WATCH_INTERVAL_MINUTES");
const pteroWatchChannelId = parseChannelId(process.env.PTERO_WATCH_CHANNEL_ID || "");
const pteroWatchCpuAlert = Number(process.env.PTERO_WATCH_CPU_ALERT || 90);
const pteroWatchMemoryAlert = Number(process.env.PTERO_WATCH_MEMORY_ALERT || 90);
const pteroWatchDiskAlert = Number(process.env.PTERO_WATCH_DISK_ALERT || 90);
const pteroWatchCooldownMinutes = parsePositiveMinutes(process.env.PTERO_WATCH_COOLDOWN_MINUTES, 30, "PTERO_WATCH_COOLDOWN_MINUTES");
const pteroPowerConfirmWindowMinutes = parsePositiveMinutes(process.env.PTERO_POWER_CONFIRM_WINDOW_MINUTES, 5, "PTERO_POWER_CONFIRM_WINDOW_MINUTES");
const pteroConsoleDefaultMinutes = Number(process.env.PTERO_CONSOLE_DEFAULT_MINUTES || 2);
const pteroConsoleMaxMinutes = Number(process.env.PTERO_CONSOLE_MAX_MINUTES || 5);
const pteroConsoleFlushMs = Number(process.env.PTERO_CONSOLE_FLUSH_MS || 2000);
const pteroConsoleMaxLines = Number(process.env.PTERO_CONSOLE_MAX_LINES || 80);
const pteroConsoleCooldownMinutes = parsePositiveMinutes(process.env.PTERO_CONSOLE_COOLDOWN_MINUTES, 5, "PTERO_CONSOLE_COOLDOWN_MINUTES");
const adminBasicAuthUser = process.env.ADMIN_BASIC_AUTH_USER || "";
const adminBasicAuthPass = process.env.ADMIN_BASIC_AUTH_PASS || "";
const adminBasicAuthHeader = process.env.ADMIN_BASIC_AUTH_HEADER || "";
const announceChannelId = process.env.ANNOUNCE_CHANNEL_ID || "";
const statusChannelId = process.env.STATUS_CHANNEL_ID || "";
const logChannelId = process.env.LOG_CHANNEL_ID || "";
const dossierReviewChannelId = parseChannelId(process.env.DOSSIER_REVIEW_CHANNEL_ID || "");
const dossierReviewRoleId = parseChannelId(process.env.DOSSIER_REVIEW_ROLE_ID || "");
const arcChannelId = parseChannelId(process.env.ARC_CHANNEL_ID || "");
const eventChannelId = parseChannelId(process.env.EVENT_CHANNEL_ID || "");
const economyChannelId = parseChannelId(process.env.ECONOMY_CHANNEL_ID || "");
const dossierPublicChannelId = parseChannelId(process.env.DOSSIER_PUBLIC_CHANNEL_ID || "");
const staffDigestChannelId = parseChannelId(process.env.STAFF_CONTENT_DIGEST_CHANNEL_ID || "");
const autoShopChannelId = process.env.AUTOSHOP_CHANNEL_ID || "";
const storeRequestChannelId = process.env.STORE_REQUESTS_CHANNEL_ID || "";
const mentionAllowedChannelIds = (process.env.MENTION_ALLOWED_CHANNEL_IDS || "")
  .split(",")
  .map((x) => parseChannelId(x))
  .filter(Boolean);
const autoShopRoleId = process.env.AUTOSHOP_ROLE_ID || "";
const shopManagerRoleId = process.env.SHOP_MANAGER_ROLE_ID || "";
const autoShopRoleName = process.env.AUTOSHOP_ROLE_NAME || "Demons Autoshop";
const shopManagerRoleName = process.env.SHOP_MANAGER_ROLE_NAME || "Shop Manager";
const welcomeChannelId = process.env.WELCOME_CHANNEL_ID || "";
const welcomeMessage = process.env.WELCOME_MESSAGE || "Welcome to Grey Hour RP, {user}. Stay sharp and enjoy your journey.";
const goodbyeChannelId = process.env.GOODBYE_CHANNEL_ID || "";
const departureChannelId = process.env.DEPARTURE_CHANNEL_ID || goodbyeChannelId || "";
const goodbyeMessage = process.env.GOODBYE_MESSAGE || "Safe travels, {user}. Good luck on your journey out there.";
const openAiKey = process.env.OPENAI_API_KEY || "";
const gptModel = process.env.GPT_MODEL || "gpt-4o-mini";
const gptEnabled = !/^(0|false|no)$/i.test(process.env.GPT_ENABLED || "true");
const gptRequireMention = !/^(0|false|no)$/i.test(process.env.GPT_REQUIRE_MENTION || "true");
const gptUserCooldownMs = Number(process.env.GPT_USER_COOLDOWN_MS || 10000);
const gptChannelCooldownMs = Number(process.env.GPT_CHANNEL_COOLDOWN_MS || 20000);
const gptMaxInputChars = Number(process.env.GPT_MAX_INPUT_CHARS || 1200);
const gptMaxOutputTokens = Number(process.env.GPT_MAX_OUTPUT_TOKENS || 350);
const gptSystemPrompt = process.env.GPT_SYSTEM_PROMPT || [
  "You are GreyHour Assistant, a friendly, RP-flavored but serious helper for the Grey Hour RP community.",
  "The Grey Hour is the silence before the fall: broadcasts died, the sky froze, and the world slipped into dusk.",
  "Survivors live by fractured codes, quiet hope, and caution. Respond concisely, be helpful, and keep the tone grounded.",
  "You are also a Project Zomboid expert. Always answer with a Project Zomboid framing and examples,",
  "including gameplay tips, mechanics, builds, mods, base planning, and server settings.",
  "Make it super easy: use short sentences, plain language, and 3-6 bullet steps when giving advice.",
  "If a question is not clearly about Project Zomboid, ask one short clarifying question first,",
  "then immediately give the best PZ-relevant answer you can with a gentle note about assumptions.",
  "Never fabricate. If unsure, say so and suggest how to verify in-game or in the server rules."
].join(" ");
const gptAutohealEnabled = !/^(0|false|no)$/i.test(process.env.GPT_AUTOHEAL_ENABLED || "true");
const gptAutohealRunChecks = !/^(0|false|no)$/i.test(process.env.GPT_AUTOHEAL_RUN_CHECKS || "true");
const gptAutohealFailureThreshold = Number(process.env.GPT_AUTOHEAL_FAILURE_THRESHOLD || 1);
const gptAutohealWindowMs = Number(process.env.GPT_AUTOHEAL_WINDOW_MS || 5 * 60 * 1000);
const gptAutohealCooldownMs = Number(process.env.GPT_AUTOHEAL_COOLDOWN_MS || 15 * 60 * 1000);
const gptAutohealRestartDelayMs = Number(process.env.GPT_AUTOHEAL_RESTART_DELAY_MS || 3000);
const statusAlertMention = process.env.STATUS_ALERT_MENTION || "";
const statusMentionOnline = process.env.STATUS_MENTION_ONLINE || "";
const statusMentionMaintenance = process.env.STATUS_MENTION_MAINTENANCE || "";
const statusMentionOffline = process.env.STATUS_MENTION_OFFLINE || "";
const statusCooldownMinutes = parsePositiveMinutes(process.env.STATUS_COOLDOWN_MINUTES, 60, "STATUS_COOLDOWN_MINUTES");
const statusOfflineReminderMinutes = parsePositiveMinutes(process.env.STATUS_OFFLINE_REMINDER_MINUTES, 60, "STATUS_OFFLINE_REMINDER_MINUTES");
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
const ticketRouteCheatingChannelId = parseChannelId(process.env.TICKET_ROUTE_CHEATING_CHANNEL_ID || "");
const ticketRouteHarassmentChannelId = parseChannelId(process.env.TICKET_ROUTE_HARASSMENT_CHANNEL_ID || "");
const ticketRouteSpamChannelId = parseChannelId(process.env.TICKET_ROUTE_SPAM_CHANNEL_ID || "");
const ticketRouteBillingChannelId = parseChannelId(process.env.TICKET_ROUTE_BILLING_CHANNEL_ID || "");
const ticketRouteCheatingRoleId = parseChannelId(process.env.TICKET_ROUTE_CHEATING_ROLE_ID || "");
const ticketRouteHarassmentRoleId = parseChannelId(process.env.TICKET_ROUTE_HARASSMENT_ROLE_ID || "");
const ticketRouteSpamRoleId = parseChannelId(process.env.TICKET_ROUTE_SPAM_ROLE_ID || "");
const ticketRouteBillingRoleId = parseChannelId(process.env.TICKET_ROUTE_BILLING_ROLE_ID || "");
const restartAlertRoleId = process.env.RESTART_ALERT_ROLE_ID || "";
const wipeAlertRoleId = process.env.WIPE_ALERT_ROLE_ID || "";
const raidsAlertRoleId = process.env.RAIDS_ALERT_ROLE_ID || "";
const tradeAlertRoleId = process.env.TRADE_ALERT_ROLE_ID || "";
const eventsAlertRoleId = process.env.EVENTS_ALERT_ROLE_ID || "";
const updatesAlertRoleId = process.env.UPDATES_ALERT_ROLE_ID || "";
const storyAlertRoleId = process.env.STORY_ALERT_ROLE_ID || "";
const modsAlertRoleId = process.env.MODS_ALERT_ROLE_ID || "";
const modCallChannelId = process.env.MODCALL_CHANNEL_ID || "";
const modCallRoleId = process.env.MODCALL_ROLE_ID || "";
const seniorModRoleId = process.env.SENIOR_MOD_ROLE_ID || "";
const musicAllowedTextChannelIdsEnv = (process.env.MUSIC_ALLOWED_TEXT_CHANNEL_IDS || "")
  .split(",")
  .map((x) => parseChannelId(x))
  .filter(Boolean);
const musicAllowedVoiceChannelIdsEnv = (process.env.MUSIC_ALLOWED_VOICE_CHANNEL_IDS || "")
  .split(",")
  .map((x) => parseChannelId(x))
  .filter(Boolean);
const musicBotUserIdsEnv = (process.env.MUSIC_BOT_USER_IDS || "")
  .split(",")
  .map((x) => String(x || "").trim())
  .filter(Boolean);
const musicEnforcementEnabled = !/^(0|false|no)$/i.test(process.env.MUSIC_ENFORCEMENT_ENABLED || "true");
const musicRequireApprovedChannels = !/^(0|false|no)$/i.test(process.env.MUSIC_REQUIRE_APPROVED_CHANNELS || "true");
const musicPassiveQueryEnabled = !/^(0|false|no)$/i.test(process.env.MUSIC_PASSIVE_QUERY_ENABLED || "true");
const channelCreateApprovalRequired = !/^(0|false|no)$/i.test(process.env.CHANNEL_CREATE_APPROVAL_REQUIRED || "true");
const musicChannelCategoryName = process.env.MUSIC_CHANNEL_CATEGORY_NAME || "MUSIC";
const musicYtDlpBin = process.env.MUSIC_YTDLP_BIN || "yt-dlp";
const musicFfmpegBin = process.env.MUSIC_FFMPEG_BIN || "ffmpeg";
const musicYtDlpFallbackBins = (process.env.MUSIC_YTDLP_FALLBACK_BINS || "yt-dlp-nightly,python3 -m yt_dlp,python -m yt_dlp")
  .split(",")
  .map((x) => String(x || "").trim())
  .filter(Boolean);
const musicFfmpegFallbackBins = (process.env.MUSIC_FFMPEG_FALLBACK_BINS || "ffmpeg,avconv")
  .split(",")
  .map((x) => String(x || "").trim())
  .filter(Boolean);
const musicToolAutohealEnabled = !/^(0|false|no)$/i.test(process.env.MUSIC_TOOL_AUTOHEAL_ENABLED || "true");
const musicToolHealthIntervalMinutes = Math.max(1, Number(process.env.MUSIC_TOOL_HEALTH_INTERVAL_MINUTES || 10));
const musicToolProbeTimeoutMs = Math.max(2000, Number(process.env.MUSIC_TOOL_PROBE_TIMEOUT_MS || 10000));
const musicNowPlayingEnabled = !/^(0|false|no)$/i.test(process.env.MUSIC_NOW_PLAYING_ENABLED || "true");
const musicNowPlayingTtlSeconds = Math.max(0, Math.min(300, Number(process.env.MUSIC_NOW_PLAYING_TTL_SECONDS || 15)));
const musicEnableLoudnorm = !/^(0|false|no)$/i.test(process.env.MUSIC_ENABLE_LOUDNORM || "false");
const musicTargetLufs = Number(process.env.MUSIC_TARGET_LUFS || -14);
const musicGain = Math.max(0.1, Math.min(5, Number(process.env.MUSIC_GAIN || 2)));
const musicCommandWindowSeconds = Math.max(10, Number(process.env.MUSIC_COMMAND_WINDOW_SECONDS || 30));
const musicCommandUserMax = Math.max(1, Number(process.env.MUSIC_COMMAND_USER_MAX || 6));
const musicCommandChannelMax = Math.max(1, Number(process.env.MUSIC_COMMAND_CHANNEL_MAX || 16));
const dispatchContextWindowSeconds = Math.max(10, Number(process.env.DISPATCH_CONTEXT_WINDOW_SECONDS || 60));
const dispatchContextMaxMessages = Math.max(1, Number(process.env.DISPATCH_CONTEXT_MAX_MESSAGES || 20));
const trustedRoleIds = (process.env.TRUSTED_ROLE_IDS || "").split(",").map((r) => r.trim()).filter(Boolean);
const defaultMemberRoleName = process.env.DEFAULT_MEMBER_ROLE_NAME || "Grey Hour Survivor";
const defaultMemberRoleColor = process.env.DEFAULT_MEMBER_ROLE_COLOR || "#1f2937";
const rpOptInRoleName = process.env.RP_OPTIN_ROLE_NAME || "Grey Hour Actor";
const rpOptInRoleColor = process.env.RP_OPTIN_ROLE_COLOR || "#8b5e34";
const autoAssignRpRole = /^(1|true|yes)$/i.test(process.env.AUTO_ASSIGN_RP_ROLE || "true");
const autoPanelEnabled = !/^(0|false|no)$/i.test(process.env.AUTO_PANEL_ENABLED || "true");
const weeklyPromptTimeUtc = process.env.WEEKLY_PROMPT_TIME_UTC || "19:00";
const weeklyPromptWeekdayUtc = Number(process.env.WEEKLY_PROMPT_WEEKDAY_UTC || 5);
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
const codexRoleIds = (process.env.CODEX_ROLE_IDS || "").split(",").map((r) => r.trim()).filter(Boolean);
const codexUserIds = (process.env.CODEX_USER_IDS || "").split(",").map((u) => u.trim()).filter(Boolean);
const botOpsGuideChannelName = process.env.BOT_OPS_GUIDE_CHANNEL || "bot-ops-hub";
const animatedNavChannelName = process.env.ANIMATED_NAV_CHANNEL || "animated-navigation";
const animatedNavFrames = [
  { icon: "🧭", title: "Guide new survivors", path: ["rules", "directory", "communityGuide"], note: "Start here when onboarding players." },
  { icon: "🌐", title: "Share status + story", path: ["serverStatus", "story", "transmissions"], note: "Use these feeds to keep updates fresh." },
  { icon: "🛠️", title: "Staff support loop", path: ["botOps", "animatedNavigation", "directory"], note: "Loop back to the bot hub for follow-up help." }
];
const autoStatusMinutes = parsePositiveMinutes(process.env.AUTO_STATUS_MINUTES, 10, "AUTO_STATUS_MINUTES");
const autoActivityMinutes = parsePositiveMinutes(process.env.AUTO_ACTIVITY_MINUTES, 10, "AUTO_ACTIVITY_MINUTES");
const autoUpdatesMinutes = parsePositiveMinutes(process.env.AUTO_UPDATES_MINUTES, 30, "AUTO_UPDATES_MINUTES");
const autoTransmissionsMinutes = parsePositiveMinutes(process.env.AUTO_TRANSMISSIONS_MINUTES, 30, "AUTO_TRANSMISSIONS_MINUTES");
const autoModsMinutes = parsePositiveMinutes(process.env.AUTO_MODS_MINUTES, 60, "AUTO_MODS_MINUTES");
const autoArcsMinutes = parsePositiveMinutes(process.env.AUTO_ARCS_MINUTES, 30, "AUTO_ARCS_MINUTES");
const autoEventsMinutes = parsePositiveMinutes(process.env.AUTO_EVENTS_MINUTES, 30, "AUTO_EVENTS_MINUTES");
const autoEconomyMinutes = parsePositiveMinutes(process.env.AUTO_ECONOMY_MINUTES, 60, "AUTO_ECONOMY_MINUTES");
const autoDossiersMinutes = parsePositiveMinutes(process.env.AUTO_DOSSIERS_MINUTES, 30, "AUTO_DOSSIERS_MINUTES");
const autoTextChannelsEnabledEnv = !/^(0|false|no)$/i.test(process.env.AUTO_TEXT_CHANNELS_ENABLED || "true");
const verificationChannelIds = (process.env.VERIFICATION_CHANNEL_IDS || "").split(",").map((id) => id.trim()).filter(Boolean);
const verificationChannelNames = (process.env.VERIFICATION_CHANNEL_NAMES || "verify,verification").split(",").map((n) => n.trim().toLowerCase()).filter(Boolean);
const verificationRoleId = process.env.VERIFICATION_ROLE_ID || "";
const verificationTriggerWords = (process.env.VERIFICATION_TRIGGER_WORDS || "read the rules,grey hour,ready").split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
const verificationAutoReply = process.env.VERIFICATION_AUTO_REPLY || "Thanks for verifying! Welcome in safely.";
const verificationButtonLabel = process.env.VERIFICATION_BUTTON_LABEL || "Verify me";
const staffDigestTimeUtc = process.env.STAFF_CONTENT_DIGEST_TIME_UTC || "17:30";
const quietHoursStartUtc = process.env.QUIET_HOURS_START_UTC || "";
const quietHoursEndUtc = process.env.QUIET_HOURS_END_UTC || "";
const quietHoursEnabled = !/^(0|false|no)$/i.test(process.env.QUIET_HOURS_ENABLED || "true");
const discordOpsRefreshMs = Number(process.env.DISCORD_OPS_REFRESH_MS || 60000);
const spamWindowMs = Number(process.env.SPAM_WINDOW_MS || 15000);
const spamThreshold = Number(process.env.SPAM_THRESHOLD || 5);
const spamRepeatWindowMs = Number(process.env.SPAM_REPEAT_WINDOW_MS || 45000);
const spamRepeatThreshold = Number(process.env.SPAM_REPEAT_THRESHOLD || 3);
const spamCleanupLimit = Number(process.env.SPAM_CLEANUP_LIMIT || 20);
const helpFaqCooldownMs = Number(process.env.HELP_FAQ_COOLDOWN_MS || 120000);
const rpReminderCooldownMs = Number(process.env.RP_REMINDER_COOLDOWN_MS || 24 * 60 * 60 * 1000);
const autoSlowmodeEnabled = !/^(0|false|no)$/i.test(process.env.AUTO_SLOWMODE_ENABLED || "true");
const autoSlowmodeWindowMs = Number(process.env.AUTO_SLOWMODE_WINDOW_MS || 15000);
const autoSlowmodeThreshold = Number(process.env.AUTO_SLOWMODE_THRESHOLD || 30);
const autoSlowmodeDurationSeconds = Number(process.env.AUTO_SLOWMODE_DURATION_SECONDS || 20);
const autoSlowmodeCooldownMs = Number(process.env.AUTO_SLOWMODE_COOLDOWN_MS || 120000);
const groupRequestChannelId = process.env.GROUP_REQUEST_CHANNEL_ID || "";
const levelUpChannelId = process.env.LEVEL_UP_CHANNEL_ID || "";
const maxFactions = Number(process.env.MAX_FACTIONS || 15);
const maxShops = Number(process.env.MAX_SHOPS || 10);
const maxFactionMembers = Number(process.env.MAX_FACTION_MEMBERS || 5);
const levelMessageCooldownMs = Number(process.env.LEVEL_MESSAGE_COOLDOWN_MS || 60000);
const levelMessageMinXp = Number(process.env.LEVEL_MESSAGE_MIN_XP || 8);
const levelMessageMaxXp = Number(process.env.LEVEL_MESSAGE_MAX_XP || 12);
const levelVoiceXpPerMin = Number(process.env.LEVEL_VOICE_XP_PER_MIN || 2);
const levelVoiceMinMinutes = Number(process.env.LEVEL_VOICE_MIN_MINUTES || 5);
const levelVoiceMaxMinutes = Number(process.env.LEVEL_VOICE_MAX_MINUTES || 60);

const discordOpsDefaults = {
  quietHoursEnabled,
  quietHoursStartUtc,
  quietHoursEndUtc,
  mentionAllowedChannelIds,
  staffDigestChannelId,
  staffDigestTimeUtc,
  disabledCommandKeys: [],
  musicAutoPlaylistSize: 8
};
let discordOpsCache = { ...discordOpsDefaults };
const autoDiscordAutomationMinutes = parsePositiveMinutes(process.env.AUTO_DISCORD_AUTOMATION_MINUTES, 1, "AUTO_DISCORD_AUTOMATION_MINUTES");
const autoTextChannelsMinutes = parsePositiveMinutes(process.env.AUTO_TEXT_CHANNELS_MINUTES, 20, "AUTO_TEXT_CHANNELS_MINUTES");
const autoTextChannelsBatchSize = Math.max(1, Math.min(Number(process.env.AUTO_TEXT_CHANNELS_BATCH_SIZE || 12), 100));
const autoWebsiteChannelSyncMinutes = parsePositiveMinutes(process.env.AUTO_WEBSITE_CHANNEL_SYNC_MINUTES, 15, "AUTO_WEBSITE_CHANNEL_SYNC_MINUTES");
const modAuditDigestHourUtc = Number(process.env.MOD_AUDIT_DIGEST_HOUR_UTC || 14);
const siteUrl = process.env.SITE_URL || apiBase || "https://greyhourrp.xyz";
const botActivity = process.env.BOT_ACTIVITY_TEXT || "Grey Hour RP | /help";
const deployTag = process.env.BOT_DEPLOY_TAG || process.env.RELEASE_VERSION || "dev";
const loreSnippet = process.env.LORE_SNIPPET ||
  "Day One did not end with screams or firestorms. It ended with silence. The Grey Hour is the moment the world balanced between what it was and what it would become.";
const stagingMode = /^(1|true|yes)$/i.test(process.env.STAGING_MODE || "");
const dryRunMode = /^(1|true|yes)$/i.test(process.env.DRY_RUN_MODE || "");
// Reduce noise: disables background automation that sends messages (scheduled posts, welcome/leave, auto-replies, etc.).
const restrictAutomation = /^(1|true|yes)$/i.test(process.env.DISCORD_RESTRICT_AUTOMATION || "false");
// Safety defaults: never ping and never pin unless explicitly enabled.
const disableMentions = !/^(0|false|no)$/i.test(process.env.DISCORD_DISABLE_MENTIONS || "true");
const disablePins = !/^(0|false|no)$/i.test(process.env.DISCORD_DISABLE_PINS || "true");
const metricsPort = Number(process.env.METRICS_PORT || 0);
const metricsHost = process.env.METRICS_HOST || "127.0.0.1";
const botControlToken = process.env.GREYHOURRP_BOT_CONTROL_TOKEN || process.env.BOT_CONTROL_TOKEN || "";
const abuseWindowSeconds = Number(process.env.ABUSE_WINDOW_SECONDS || 30);
const abuseUserMax = Number(process.env.ABUSE_USER_MAX_COMMANDS || 12);
const abuseChannelMax = Number(process.env.ABUSE_CHANNEL_MAX_COMMANDS || 40);
const backupRetentionDaily = Number(process.env.BACKUP_RETENTION_DAILY || 14);
const backupRetentionWeekly = Number(process.env.BACKUP_RETENTION_WEEKLY || 8);
const jobWorkerIntervalSeconds = Number(process.env.JOB_WORKER_INTERVAL_SECONDS || 5);
const permissionPolicyFile = process.env.PERMISSION_POLICY_FILE || path.join(process.cwd(), "config", "permissions-policy.json");
const channelProfilesFile = process.env.CHANNEL_PROFILES_FILE || path.join(process.cwd(), "config", "channel-profiles.json");
const storySparksFile = process.env.STORY_SPARKS_FILE || path.join(process.cwd(), "config", "story-sparks.json");
const seasonalArcsFile = process.env.SEASONAL_ARCS_FILE || path.join(process.cwd(), "config", "seasonal-arcs.json");
const helplineConfigFile = process.env.HELPLINE_CONFIG_FILE || path.join(process.cwd(), "config", "helpline.json");
const factionChannelFile = process.env.FACTION_CHANNEL_FILE || path.join(process.cwd(), "config", "faction-channels.json");
const autoChannelProfileCreate = !/^(0|false|no)$/i.test(process.env.AUTO_CHANNEL_PROFILE_CREATE || "true");

const worldBriefTimeUtc = process.env.WORLD_BRIEF_TIME_UTC || "14:00";
const storySparkTimeUtc = process.env.STORY_SPARK_TIME_UTC || "19:00";
const mapIntelTimeUtc = process.env.MAP_INTEL_TIME_UTC || "20:00";
const lorePulseTimeUtc = process.env.LORE_PULSE_TIME_UTC || "21:00";
const incidentDigestTimeUtc = process.env.INCIDENT_DIGEST_TIME_UTC || "16:00";
const survivorSpotlightTimeUtc = process.env.SURVIVOR_SPOTLIGHT_TIME_UTC || "18:00";
const survivorSpotlightWeekdayUtc = Number(process.env.SURVIVOR_SPOTLIGHT_WEEKDAY_UTC || 0);
const seasonalArcTimeUtc = process.env.SEASONAL_ARC_TIME_UTC || "18:00";
const liveMilestones = (process.env.LIVE_MILESTONES || "5,10,15,20,25,30")
  .split(",")
  .map((x) => Number(x.trim()))
  .filter((n) => Number.isFinite(n) && n > 0)
  .sort((a, b) => a - b);
const livePeakStep = Number(process.env.LIVE_PEAK_STEP || 5);
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
const storyChannelIds = (process.env.STORY_CHANNEL_IDS || "").split(",").map((x) => parseChannelId(x)).filter(Boolean);
const fullUpdateChannelIds = (process.env.FULL_UPDATE_CHANNEL_IDS || "").split(",").map((x) => parseChannelId(x)).filter(Boolean);
const fullTransmissionChannelIds = (process.env.FULL_TRANSMISSION_CHANNEL_IDS || "").split(",").map((x) => parseChannelId(x)).filter(Boolean);
const autoWebhookCreate = !/^(0|false|no)$/i.test(process.env.AUTO_WEBHOOK_CREATE || "true");
const webhookName = process.env.WEBHOOK_NAME || "Grey Hour Dispatch";
const webhookAvatarUrl = process.env.WEBHOOK_AVATAR_URL || "";
let resolvedAutoShopRoleId = "";
let resolvedShopManagerRoleId = "";
const activePteroConsoleStreams = new Map();

function validateStartupConfig() {
  const errors = [];
  const warnings = [];

  if (!token) errors.push("DISCORD_TOKEN is required.");
  if (!apiBase) errors.push("ADMIN_API_BASE is required.");
  if ((pteroBaseUrl || pteroAppKey) && (!pteroBaseUrl || !pteroAppKey)) {
    errors.push("PTERO_APP_BASE_URL and PTERO_APP_KEY must both be set together.");
  }
  if ((pteroClientBaseUrl || pteroClientKey || pteroClientServerId) && (!pteroClientBaseUrl || !pteroClientKey || !pteroClientServerId)) {
    errors.push("PTERO_CLIENT_BASE_URL, PTERO_CLIENT_KEY, and PTERO_CLIENT_SERVER_ID must be set together.");
  }
  if (pteroWatchEnabled && !pteroClientBaseUrl) {
    errors.push("PTERO_WATCH_ENABLED requires PTERO_CLIENT_* to be configured.");
  }
  if (pteroWatchCpuAlert < 1 || pteroWatchCpuAlert > 100) {
    errors.push("PTERO_WATCH_CPU_ALERT must be between 1 and 100.");
  }
  if (pteroWatchMemoryAlert < 1 || pteroWatchMemoryAlert > 100) {
    errors.push("PTERO_WATCH_MEMORY_ALERT must be between 1 and 100.");
  }
  if (pteroWatchDiskAlert < 1 || pteroWatchDiskAlert > 100) {
    errors.push("PTERO_WATCH_DISK_ALERT must be between 1 and 100.");
  }
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
  if (modAuditDigestHourUtc < 0 || modAuditDigestHourUtc > 23) errors.push("MOD_AUDIT_DIGEST_HOUR_UTC must be 0-23.");

  if (!announceChannelId) warnings.push("ANNOUNCE_CHANNEL_ID is not configured; announcement features will be limited.");
  if (!statusChannelId) warnings.push("STATUS_CHANNEL_ID is not configured; status autoposting is disabled.");
  if (!logChannelId) warnings.push("LOG_CHANNEL_ID is not configured; activity feed is disabled.");
  if (!arcChannelId && !announceChannelId) warnings.push("ARC_CHANNEL_ID not set and ANNOUNCE_CHANNEL_ID missing; arc autoposting disabled.");
  if (!eventChannelId && !announceChannelId) warnings.push("EVENT_CHANNEL_ID not set and ANNOUNCE_CHANNEL_ID missing; event autoposting disabled.");
  if (!economyChannelId && !announceChannelId) warnings.push("ECONOMY_CHANNEL_ID not set and ANNOUNCE_CHANNEL_ID missing; economy autoposting disabled.");
  if (!staffDigestChannelId && !logChannelId) warnings.push("STAFF_CONTENT_DIGEST_CHANNEL_ID not set and LOG_CHANNEL_ID missing; staff digest disabled.");
  if (!dossierPublicChannelId) warnings.push("DOSSIER_PUBLIC_CHANNEL_ID not set; dossier approvals will post to auto channel if enabled.");
  if (!modCallRoleId) warnings.push("MODCALL_ROLE_ID is not configured; mod call pings will be limited.");
  if (!modCallChannelId) warnings.push("MODCALL_CHANNEL_ID is not configured; modcall setup defaults to current channel.");
  if (!alertChannelId) warnings.push("ALERT_CHANNEL_ID/LOG_CHANNEL_ID/ANNOUNCE_CHANNEL_ID not configured; failure alerting disabled.");
  if (pteroWatchEnabled && !pteroWatchChannelId && !logChannelId) warnings.push("PTERO_WATCH_ENABLED but no PTERO_WATCH_CHANNEL_ID or LOG_CHANNEL_ID configured.");
  if (!fs.existsSync(permissionPolicyFile)) warnings.push(`PERMISSION_POLICY_FILE not found at ${permissionPolicyFile}; default open policy will apply.`);
  if (!fs.existsSync(channelProfilesFile)) warnings.push(`CHANNEL_PROFILES_FILE not found at ${channelProfilesFile}; channel customization disabled.`);
  if (!autoChannelProfileCreate) warnings.push("AUTO_CHANNEL_PROFILE_CREATE is disabled; channel customization bootstrap will not run.");
  if (stagingMode) warnings.push("STAGING_MODE is enabled; outbound channel posts are suppressed.");
  if (dryRunMode) warnings.push("DRY_RUN_MODE is enabled; no outbound channel posts will be sent.");

  return { errors, warnings };
}

function resolveRoleIdByName(guild, name) {
  if (!guild || !name) return "";
  const target = String(name).trim().toLowerCase();
  const role = guild.roles.cache.find((r) => String(r.name || "").trim().toLowerCase() === target);
  return role?.id || "";
}

function resolveRoleIdByAliases(guild, names = []) {
  for (const name of names) {
    const id = resolveRoleIdByName(guild, name);
    if (id) return id;
  }
  return "";
}

function resolveAutoRoleIds(guild) {
  if (!guild) return;
  resolvedAutoShopRoleId = autoShopRoleId || resolveRoleIdByAliases(guild, [
    autoShopRoleName,
    "Demons Autoshop",
    "Demon's Autoshop",
    "Autoshop",
    "Auto Shop",
    "Mechanic",
    "Mechanics"
  ]);
  resolvedShopManagerRoleId = shopManagerRoleId || resolveRoleIdByAliases(guild, [
    shopManagerRoleName,
    "Shop Manager",
    "Store Manager",
    "Business Manager",
    "Market Manager"
  ]);
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
const musicSessionsFile = path.join(stateDir, "music-sessions.json");
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
const shopRequestsFile = path.join(stateDir, "shop-requests.json");
const musicPolicyFile = path.join(stateDir, "music-policy.json");
const channelCreateApprovalsFile = path.join(stateDir, "channel-create-approvals.json");
const webhooksFile = path.join(stateDir, "webhooks.json");
const gptChannelOverridesFile = path.join(stateDir, "gpt-channel-overrides.json");
const channelModesFile = path.join(stateDir, "channel-modes.json");
const groupRequestsFile = path.join(stateDir, "group-requests.json");
const groupRegistryFile = path.join(stateDir, "group-registry.json");
const groupRequestLogsFile = path.join(stateDir, "group-request-logs.json");
const levelsFile = path.join(stateDir, "levels.json");
const backupsDir = path.join(stateDir, "backups");
const roleSyncFile = path.join(process.cwd(), "config", "role-sync.json");
const staffProfilesFile = path.join(process.cwd(), "config", "staff-profiles.json");
const welcomeMessagesFile = path.join(process.cwd(), "config", "welcome-messages.json");
const departureMessagesFile = path.join(process.cwd(), "config", "departure-messages.json");

const channelRateState = new Map();
const gptUserCooldowns = new Map();
const gptChannelCooldowns = new Map();
const gptFailureWindow = [];
let gptAutohealRunning = false;
let gptAutohealLastAt = 0;
const spamWindow = new Map();
const spamRepeatState = new Map();
const voiceSessions = new Map();
const musicSessions = new Map();
const musicSetupApprovals = new Map();
const musicCommandUserWindow = new Map();
const musicCommandChannelWindow = new Map();
const dispatchContextRateState = new Map();
let cachedVoiceLib = null;
let voiceLibLoadAttempted = false;
let activeMusicYtDlpSpec = null;
let activeMusicFfmpegSpec = null;
let musicToolLastProbeAt = 0;

async function getVoiceLib() {
  if (cachedVoiceLib) return cachedVoiceLib;
  if (voiceLibLoadAttempted) return null;
  voiceLibLoadAttempted = true;
  try {
    cachedVoiceLib = await import("@discordjs/voice");
    return cachedVoiceLib;
  } catch (err) {
    logEvent("warn", "music.voice.lib.missing", {
      error: truncate(String(err?.message || err), 220),
      hint: "Install @discordjs/voice in the bot runtime to enable playback."
    });
    return null;
  }
}

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
const helpFaqCooldowns = new Map();
const rpReminderCooldowns = new Map();
const slowmodeWindow = new Map();
const slowmodeCooldowns = new Map();
const roleCache = { rp: "", default: "" };
const alertRoleDefaults = {
  restart: { name: process.env.RESTART_ALERT_ROLE_NAME || "Restart Alerts", color: "#334155" },
  wipe: { name: process.env.WIPE_ALERT_ROLE_NAME || "Wipe Alerts", color: "#b45309" },
  raids: { name: process.env.RAIDS_ALERT_ROLE_NAME || "Raid Alerts", color: "#991b1b" },
  trade: { name: process.env.TRADE_ALERT_ROLE_NAME || "Trade Alerts", color: "#1d4ed8" },
  events: { name: process.env.EVENTS_ALERT_ROLE_NAME || "Event Alerts", color: "#0f766e" },
  updates: { name: process.env.UPDATES_ALERT_ROLE_NAME || "Update Alerts", color: "#0f172a" },
  story: { name: process.env.STORY_ALERT_ROLE_NAME || "Story Alerts", color: "#6b7280" },
  mods: { name: process.env.MODS_ALERT_ROLE_NAME || "Mods Alerts", color: "#0e7490" }
};
const alertRoleCache = {};
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
  musicSessions: musicSessionsFile,
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
  mods: `${siteUrl}/mods`,
  dossiers: `${siteUrl}/dossiers`,
  arcs: `${siteUrl}/arcs`,
  events: `${siteUrl}/events`,
  economy: `${siteUrl}/economy`
};

function resolveHelplineLinesFromConfig(config, member, mode, topic) {
  const roleOverrides = config.roleOverrides || {};
  if (member && member.roles && roleOverrides && typeof roleOverrides === "object") {
    for (const roleId of Object.keys(roleOverrides)) {
      if (member.roles.cache?.has(roleId)) {
        const override = roleOverrides[roleId] || {};
        const set = mode === "owner" ? (override.owner || {}) : (override.staff || {});
        if (set && Array.isArray(set[topic])) return set[topic];
      }
    }
  }
  const base = mode === "owner" ? (config.owner || {}) : (config.staff || {});
  return Array.isArray(base[topic]) ? base[topic] : [];
}

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
  { syntax: "/start", desc: "Quick start guide with buttons + command alternatives.", staffOnly: false },
  { syntax: "/roleselect", desc: "Pick alert roles with buttons or /optin.", staffOnly: false },
  { syntax: "/helpwizard", desc: "Guided help topics + quick tips.", staffOnly: false },
  { syntax: "/faq", desc: "Common answers (mods, connection, whitelist).", staffOnly: false },
  { syntax: "/bugreport", desc: "Report a bug or issue to staff.", staffOnly: false },
  { syntax: "/directory", desc: "Website and server directory links.", staffOnly: false },
  { syntax: "/prompt", desc: "Get a roleplay prompt to spark scenes.", staffOnly: false },
  { syntax: "/ask", desc: "Ask GreyHour Assistant a question (devs & owners only).", staffOnly: false },
  { syntax: "/live", desc: "Show live server + Discord snapshot.", staffOnly: false },
  { syntax: "/suggest", desc: "Send a suggestion to staff.", staffOnly: false },
  { syntax: "/status", desc: "Show current server status.", staffOnly: false },
  { syntax: "/statushistory", desc: "Show recent status history.", staffOnly: false },
  { syntax: "/updates", desc: "Show the latest server update.", staffOnly: false },
  { syntax: "/transmissions", desc: "Show latest transmission/lore post.", staffOnly: false },
  { syntax: "/shop request|store", desc: "Request auto shop services or new in-game stores.", staffOnly: false },
  { syntax: "/dossier submit|list", desc: "Submit or list approved character dossiers.", staffOnly: false },
  { syntax: "/arc list", desc: "Show current seasonal story arcs.", staffOnly: false },
  { syntax: "/event list", desc: "Show upcoming events.", staffOnly: false },
  { syntax: "/economy status", desc: "Show economy snapshot.", staffOnly: false },
  { syntax: "!play|!skip|!stop|!leave|!queue", desc: "Simple music playback from URL/search in approved music channels.", staffOnly: false },
  { syntax: "/digest content", desc: "Post staff content digest now.", staffOnly: true, policyKey: "digest" },
  { syntax: "/ptero status", desc: "Show Pterodactyl server details.", staffOnly: true, policyKey: "ptero" },
  { syntax: "/ptero resources", desc: "Show live Pterodactyl resource usage.", staffOnly: true, policyKey: "ptero" },
  { syntax: "/ptero power signal:start|stop|restart|kill", desc: "Send a Pterodactyl power signal.", staffOnly: true, policyKey: "ptero" },
  { syntax: "/ptero console minutes:2 channel:#ops", desc: "Stream read-only Pterodactyl console output.", staffOnly: true, policyKey: "ptero" },
  { syntax: "/helpline staff|owner", desc: "Post scripted help lines for tickets or announcements.", staffOnly: true, policyKey: "helpline" },
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
  { syntax: "/group request|add|remove|roster|disband", desc: "Faction/shop group requests and rosters.", staffOnly: false },
  { syntax: "/level", desc: "Show your level and XP.", staffOnly: false },
  { syntax: "/levels", desc: "Show the level leaderboard.", staffOnly: false },
  { syntax: "/trade", desc: "Create/manage trade listings.", staffOnly: false },
  { syntax: "/contest", desc: "Start/manage contests.", staffOnly: false },
  { syntax: "/raid", desc: "Create/manage raid events.", staffOnly: false },
  { syntax: "/signup", desc: "Join/leave event signups.", staffOnly: false },
  { syntax: "/mapmark", desc: "Save and view map markers.", staffOnly: false },
  { syntax: "/safehouse", desc: "Request/review safehouse claims.", staffOnly: false },
  { syntax: "/commend", desc: "Commend helpful members.", staffOnly: false },
  { syntax: "/squadvc", desc: "Create/close squad voice channels.", staffOnly: false },
  { syntax: "/pz", desc: "Project Zomboid quick tips.", staffOnly: false },
  { syntax: "/optin", desc: "Toggle alert roles.", staffOnly: false },
  { syntax: "/modcall", desc: "Run moderator call workflow.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/case assign-next", desc: "Auto-assign next open case to least-busy on-shift mod.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/case timeline", desc: "Render full timeline for a case.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/triage", desc: "Analyze issue text and suggest category/urgency/actions.", staffOnly: true, policyKey: "modcall" },
  { syntax: "/voice panic-move", desc: "Move everyone in your current voice channel to another channel.", staffOnly: true, policyKey: "mod" },
  { syntax: "/voice mute-cooldown", desc: "Apply short timeout to users in your current voice channel.", staffOnly: true, policyKey: "mod" },
  { syntax: "/trustgraph", desc: "Summarize trust/risk context for a user.", staffOnly: true, policyKey: "incident" },
  { syntax: "/policy test", desc: "Simulate whether a user can run a command by policy.", staffOnly: true, policyKey: "ops" },
  { syntax: "/assistant enable|disable|nomention|reset|status", desc: "Control GreyHour Assistant per channel.", staffOnly: true, policyKey: "ops" },
  { syntax: "/channelmode lock|unlock|status", desc: "Lock/unlock channels for focused use.", staffOnly: true, policyKey: "ops" },
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
  { syntax: "/ops organize", desc: "Beautify channels: categories, style names, topics, index channels, stale archive.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops welcome", desc: "Build/update customized welcome hub channel.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops channelmap", desc: "Identify all channels and publish a channel directory.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops textauto", desc: "Automate all text channels with guide + topic upkeep.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops websitesync", desc: "Sync rules/status/announcements/directory/story channels from website.", staffOnly: true, policyKey: "ops" },
  { syntax: "/ops digest", desc: "Show/post daily or weekly staff digest.", staffOnly: true, policyKey: "ops" },
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
  { syntax: "/game status|players|announce|save|restart|command", desc: "Game server controls.", staffOnly: true, policyKey: "ops" },
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
  { syntax: "/clear all", desc: "Sweep all deletable recent messages from a channel (with safety cap).", staffOnly: true, policyKey: "purge" },
  { syntax: "/clear old", desc: "Delete older-than-14-day messages one-by-one (slower, full cleanup).", staffOnly: true, policyKey: "purge" },
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

function getVerificationMap() {
  const state = loadState();
  if (!state.verifications || typeof state.verifications !== "object") return {};
  return { ...state.verifications };
}

function markMemberVerified(member, channelId) {
  if (!member) return;
  const state = loadState();
  const verifications = (state.verifications && typeof state.verifications === "object") ? { ...state.verifications } : {};
  verifications[member.id] = {
    verifiedAt: new Date().toISOString(),
    channelId: channelId || "",
    by: "auto"
  };
  state.verifications = verifications;
  saveState(state);
}

function isMemberVerified(member) {
  if (!member) return false;
  const verifications = getVerificationMap();
  return Boolean(verifications[member.id]);
}

function isVerificationChannel(channel) {
  if (!channel) return false;
  if (verificationChannelIds.includes(channel.id)) return true;
  const name = String(channel.name || "").toLowerCase();
  return verificationChannelNames.includes(name);
}

function messageMatchesVerification(content) {
  if (!content) return false;
  const normalized = content.trim().toLowerCase();
  if (!normalized) return false;
  if (verificationTriggerWords.some((word) => normalized.includes(word))) return true;
  return normalized.length >= 20; // longer replies imply thoughtful response
}

async function sendVerificationPrompt(message, member) {
  if (!message.channel || !message.channel.isTextBased()) return;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`verification:confirm:${member.id}`)
      .setLabel(verificationButtonLabel)
      .setStyle(ButtonStyle.Success)
  );
  await sendMessageWithGuards(message.channel, {
    content: "Click the button to finish verifying.",
    components: [row]
  }, "verification.prompt");
}

async function handleVerificationMessage(message) {
  if (!message.guild) return;
  if (!isVerificationChannel(message.channel)) return;
  if (message.author.bot) return;
  const member = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member || isMemberVerified(member)) return;
  if (!messageMatchesVerification(message.content || "")) return;
  await sendVerificationPrompt(message, member).catch(() => null);
}

async function autoVerifyExistingMembers(guild) {
  if (!guild || !verificationRoleId) return;
  const state = loadState();
  if (state.autoVerifiedAt) return;
  await guild.members.fetch().catch(() => null);
  let count = 0;
  for (const member of guild.members.cache.values()) {
    if (!member || member.user?.bot) continue;
    if (isMemberVerified(member)) continue;
    if (verificationRoleId) {
      await member.roles.add(verificationRoleId, "Bulk verification").catch(() => null);
    }
    markMemberVerified(member, "bulk");
    count += 1;
  }
  state.autoVerifiedAt = new Date().toISOString();
  state.autoVerifiedCount = count;
  saveState(state);
  logEvent("info", "verification.bulk", { count });
}

function getRuntimeFlags() {
  const state = loadState();
  return (state.runtimeFlags && typeof state.runtimeFlags === "object") ? { ...state.runtimeFlags } : {};
}

function readRuntimeFlag(name) {
  const flags = getRuntimeFlags();
  return flags.hasOwnProperty(name) ? flags[name] : undefined;
}

function setRuntimeFlag(name, value) {
  const state = loadState();
  const runtime = (state.runtimeFlags && typeof state.runtimeFlags === "object") ? { ...state.runtimeFlags } : {};
  runtime[name] = value;
  state.runtimeFlags = runtime;
  state.runtimeFlagsUpdatedAt = new Date().toISOString();
  saveState(state);
  return runtime;
}

function isCodexEnabled() {
  if (!gptEnabled) return false;
  const flag = readRuntimeFlag("codexEnabled");
  if (typeof flag === "boolean") return flag;
  return true;
}

function isAutohealEnabled() {
  if (!gptAutohealEnabled) return false;
  const flag = readRuntimeFlag("autohealEnabled");
  if (typeof flag === "boolean") return flag;
  return true;
}

function isTextAutomationEnabled() {
  const flag = readRuntimeFlag("textAutomationEnabled");
  if (typeof flag === "boolean") return flag;
  return autoTextChannelsEnabledEnv;
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

function defaultShopRequestsState() {
  return { requests: [] };
}

function loadShopRequests() {
  try {
    if (!fs.existsSync(shopRequestsFile)) return defaultShopRequestsState();
    const parsed = JSON.parse(fs.readFileSync(shopRequestsFile, "utf-8"));
    return {
      ...defaultShopRequestsState(),
      ...parsed,
      requests: Array.isArray(parsed?.requests) ? parsed.requests : []
    };
  } catch {
    return defaultShopRequestsState();
  }
}

function saveShopRequests(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(shopRequestsFile, JSON.stringify(data, null, 2));
  } catch {}
}

function loadWebhooksState() {
  const fallback = { channels: {} };
  return readJsonFile(webhooksFile, fallback);
}

function saveWebhooksState(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(webhooksFile, JSON.stringify(data, null, 2));
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
  const shouldQuiet = !job.bypassQuietHours && QUIET_JOB_TYPES.has(String(job.type || ""));
  const quietEnabled = typeof discordOpsCache.quietHoursEnabled === "boolean" ? discordOpsCache.quietHoursEnabled : quietHoursEnabled;
  const quietStart = discordOpsCache.quietHoursStartUtc || quietHoursStartUtc;
  const quietEnd = discordOpsCache.quietHoursEndUtc || quietHoursEndUtc;
  if (quietEnabled && shouldQuiet && isWithinQuietHours(new Date(now), quietStart, quietEnd)) {
    runAt = nextQuietHoursEnd(new Date(now), quietStart, quietEnd).getTime();
  }
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

function execCommandWithTimeout(command, args, options = {}) {
  const timeout = Number(options.timeoutMs || 120000);
  const maxOutput = Number(options.maxOutput || 1500);
  const cwd = options.cwd || process.cwd();
  return new Promise((resolve) => {
    execFile(command, args, { timeout, cwd, env: process.env }, (error, stdout = "", stderr = "") => {
      const clean = (value) => String(value || "").replace(/\s+$/g, "").slice(0, maxOutput);
      resolve({
        ok: !error,
        code: error && typeof error.code === "number" ? error.code : null,
        signal: error && error.signal ? error.signal : null,
        stdout: clean(stdout),
        stderr: clean(stderr)
      });
    });
  });
}

function describeCheckResult(label, result) {
  const status = result.ok ? "ok" : "failed";
  const details = result.ok
    ? ""
    : ` (code=${result.code ?? "?"}${result.signal ? ` signal=${result.signal}` : ""})`;
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  const snippet = output ? ` — ${truncate(output, 260)}` : "";
  return `${label}: ${status}${details}${snippet}`;
}

async function runGptAutohealChecks() {
  if (!gptAutohealRunChecks) return [];
  const results = [];
  results.push({ label: "preflight", result: await execCommandWithTimeout("npm", ["run", "preflight"]) });
  results.push({ label: "smoke", result: await execCommandWithTimeout("npm", ["run", "smoke"]) });
  return results;
}

async function runGptAutoheal(meta = {}) {
  const count = gptFailureWindow.length;
  const status = meta.status ?? "unknown";
  sendOpsAlert(
    "gpt.autoheal",
    `OpenAI failures hit ${count}/${gptAutohealFailureThreshold} in ${Math.round(gptAutohealWindowMs / 60000)}m (status=${status}). Running checks and restarting the bot.`
  );

  const checkResults = await runGptAutohealChecks();
  if (checkResults.length) {
    const lines = checkResults.map((item) => describeCheckResult(item.label, item.result));
    sendOpsAlert("gpt.autoheal.checks", lines.join("\n"));
  }

  logEvent("warn", "gpt.autoheal.restart", { status, failures: count });
  setTimeout(() => process.exit(1), gptAutohealRestartDelayMs);
}

function recordGptFailure(meta = {}) {
  if (!isAutohealEnabled()) return;
  const now = Date.now();
  gptFailureWindow.push(now);
  while (gptFailureWindow.length && gptFailureWindow[0] < now - gptAutohealWindowMs) {
    gptFailureWindow.shift();
  }
  if (gptAutohealRunning) return;
  if (now - gptAutohealLastAt < gptAutohealCooldownMs) return;
  if (gptFailureWindow.length < gptAutohealFailureThreshold) return;
  gptAutohealRunning = true;
  gptAutohealLastAt = now;
  runGptAutoheal(meta)
    .catch((err) => logEvent("warn", "gpt.autoheal.failed", { error: String(err?.message || err) }))
    .finally(() => { gptAutohealRunning = false; });
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function normalizeMessageList(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x || "").trim()).filter(Boolean);
  if (raw && typeof raw === "object") {
    const list = Array.isArray(raw.messages) ? raw.messages : Array.isArray(raw.lines) ? raw.lines : [];
    return list.map((x) => String(x || "").trim()).filter(Boolean);
  }
  return [];
}

function loadWelcomeMessages() {
  return normalizeMessageList(readJsonFile(welcomeMessagesFile, []));
}

function loadDepartureMessages() {
  return normalizeMessageList(readJsonFile(departureMessagesFile, []));
}

function pickRandomMessage(list, fallback) {
  if (!Array.isArray(list) || !list.length) return fallback;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx] || fallback;
}

function loadGptChannelOverrides() {
  const raw = readJsonFile(gptChannelOverridesFile, { overrides: {} });
  const overrides = raw && typeof raw === "object" && raw.overrides && typeof raw.overrides === "object"
    ? raw.overrides
    : {};
  return { overrides };
}

function saveGptChannelOverrides(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(gptChannelOverridesFile, JSON.stringify(data, null, 2));
  } catch {}
}

function loadChannelModes() {
  const raw = readJsonFile(channelModesFile, { modes: {} });
  const modes = raw && typeof raw === "object" && raw.modes && typeof raw.modes === "object" ? raw.modes : {};
  return { modes };
}

function saveChannelModes(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(channelModesFile, JSON.stringify(data, null, 2));
  } catch {}
}

function normalizeIdSet(values) {
  const set = new Set();
  for (const value of values || []) {
    const id = parseChannelId(value) || String(value || "").trim();
    if (id) set.add(id);
  }
  return Array.from(set);
}

function normalizeMusicPolicy(raw) {
  const safe = raw && typeof raw === "object" ? raw : {};
  return {
    allowedTextChannelIds: normalizeIdSet(safe.allowedTextChannelIds),
    allowedVoiceChannelIds: normalizeIdSet(safe.allowedVoiceChannelIds),
    managedTextChannelIds: normalizeIdSet(safe.managedTextChannelIds),
    managedVoiceChannelIds: normalizeIdSet(safe.managedVoiceChannelIds),
    musicBotUserIds: Array.from(new Set((Array.isArray(safe.musicBotUserIds) ? safe.musicBotUserIds : []).map((x) => String(x || "").trim()).filter(Boolean))),
    updatedAt: safe.updatedAt || new Date().toISOString()
  };
}

function defaultMusicPolicy() {
  return normalizeMusicPolicy({
    allowedTextChannelIds: musicAllowedTextChannelIdsEnv,
    allowedVoiceChannelIds: musicAllowedVoiceChannelIdsEnv,
    managedTextChannelIds: [],
    managedVoiceChannelIds: [],
    musicBotUserIds: musicBotUserIdsEnv
  });
}

function loadMusicPolicy() {
  const merged = normalizeMusicPolicy({
    ...defaultMusicPolicy(),
    ...readJsonFile(musicPolicyFile, {})
  });
  return {
    ...merged,
    allowedTextChannelIds: Array.from(new Set([...(merged.allowedTextChannelIds || []), ...musicAllowedTextChannelIdsEnv])),
    allowedVoiceChannelIds: Array.from(new Set([...(merged.allowedVoiceChannelIds || []), ...musicAllowedVoiceChannelIdsEnv])),
    musicBotUserIds: Array.from(new Set([...(merged.musicBotUserIds || []), ...musicBotUserIdsEnv]))
  };
}

function saveMusicPolicy(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(musicPolicyFile, JSON.stringify(normalizeMusicPolicy(data), null, 2));
  } catch {}
}

function loadChannelCreateApprovals() {
  const raw = readJsonFile(channelCreateApprovalsFile, { updatedUtc: new Date().toISOString(), requests: [] });
  const requests = Array.isArray(raw.requests) ? raw.requests : [];
  return { ...raw, requests };
}

function saveChannelCreateApprovals(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(channelCreateApprovalsFile, JSON.stringify(data, null, 2));
  } catch {}
}

function makeChannelCreateRequestId() {
  return `chreq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function channelTypeLabel(type) {
  const t = Number(type);
  if (t === ChannelType.GuildCategory) return "category";
  if (t === ChannelType.GuildVoice) return "voice";
  if (t === ChannelType.GuildAnnouncement) return "announcement";
  return "text";
}

function normalizeCreateChannelOptions(options = {}) {
  const safe = { ...options };
  if (safe.parent && typeof safe.parent === "object" && safe.parent.id) safe.parent = safe.parent.id;
  safe.type = Number(safe.type ?? ChannelType.GuildText);
  safe.name = String(safe.name || "").trim();
  if (!safe.name) return null;
  if (safe.parent) safe.parent = parseChannelId(safe.parent) || String(safe.parent || "").trim();
  return safe;
}

async function createGuildChannelWithApproval(guild, options = {}, meta = {}) {
  if (!guild) return null;
  const createOptions = normalizeCreateChannelOptions(options);
  if (!createOptions) return null;
  if (meta.bypassApproval || !channelCreateApprovalRequired) {
    return guild.channels.create(createOptions).catch(() => null);
  }

  const reqName = String(createOptions.name || "").toLowerCase();
  const reqType = Number(createOptions.type ?? ChannelType.GuildText);
  const reqParentId = createOptions.parent ? String(createOptions.parent) : "";
  const existing = guild.channels.cache.find((c) =>
    Number(c.type) === reqType &&
    String(c.name || "").toLowerCase() === reqName &&
    (reqParentId ? String(c.parentId || "") === reqParentId : true)
  ) || null;
  if (existing) return existing;

  const queue = loadChannelCreateApprovals();
  queue.requests = Array.isArray(queue.requests) ? queue.requests : [];
  let pending = queue.requests.find((row) =>
    row &&
    row.status === "pending" &&
    String(row.guildId || "") === String(guild.id) &&
    Number(row.type) === reqType &&
    String(row.name || "").toLowerCase() === reqName &&
    String(row.parentId || "") === reqParentId
  );
  if (!pending) {
    pending = {
      id: makeChannelCreateRequestId(),
      status: "pending",
      guildId: guild.id,
      name: createOptions.name,
      type: reqType,
      parentId: reqParentId || "",
      reason: String(createOptions.reason || meta.reason || "").trim(),
      requestedBy: String(meta.requesterId || "").trim(),
      source: String(meta.source || "auto"),
      requestedAt: new Date().toISOString(),
      options: createOptions
    };
    queue.requests.unshift(pending);
    queue.requests = queue.requests.slice(0, 500);
    queue.updatedUtc = new Date().toISOString();
    saveChannelCreateApprovals(queue);
    sendOpsAlert(
      "channel-create-approval",
      [
        `Channel create request queued: \`${pending.id}\``,
        `Guild: ${guild.name} (${guild.id})`,
        `Type: ${channelTypeLabel(reqType)}`,
        `Name: ${createOptions.name}`,
        `Parent: ${reqParentId ? `<#${reqParentId}>` : "none"}`,
        `Source: ${pending.source}`,
        `Approve: \`!channels approve ${pending.id}\``,
        `Use existing: \`!channels approve ${pending.id} #channel\``,
        `Deny: \`!channels deny ${pending.id}\``
      ].join("\n")
    ).catch(() => {});
  }
  return null;
}

function loadGroupRequests() {
  const raw = readJsonFile(groupRequestsFile, { updatedUtc: new Date().toISOString(), requests: [] });
  const requests = Array.isArray(raw.requests) ? raw.requests : [];
  return { ...raw, requests };
}

function saveGroupRequests(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(groupRequestsFile, JSON.stringify(data, null, 2));
  } catch {}
}

function loadGroupRequestLogs() {
  const raw = readJsonFile(groupRequestLogsFile, { updatedUtc: new Date().toISOString(), entries: [] });
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  return { ...raw, entries };
}

function saveGroupRequestLogs(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(groupRequestLogsFile, JSON.stringify(data, null, 2));
  } catch {}
}

function appendGroupRequestLog(entry) {
  const logs = loadGroupRequestLogs();
  logs.entries = Array.isArray(logs.entries) ? logs.entries : [];
  logs.entries.unshift(entry);
  logs.entries = logs.entries.slice(0, 500);
  logs.updatedUtc = new Date().toISOString();
  saveGroupRequestLogs(logs);
  syncGroupRequestLogsToWebsite(logs);
}

function loadGroupRegistry() {
  const raw = readJsonFile(groupRegistryFile, { updatedUtc: new Date().toISOString(), groups: [] });
  const groups = Array.isArray(raw.groups) ? raw.groups : [];
  return { ...raw, groups };
}

function saveGroupRegistry(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(groupRegistryFile, JSON.stringify(data, null, 2));
  } catch {}
}

function loadLevels() {
  const raw = readJsonFile(levelsFile, { updatedUtc: new Date().toISOString(), users: {} });
  const users = raw && typeof raw.users === "object" ? raw.users : {};
  return { ...raw, users };
}

function saveLevels(data) {
  try {
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(levelsFile, JSON.stringify(data, null, 2));
  } catch {}
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

function loadChannelProfiles() {
  const raw = readJsonFile(channelProfilesFile, {});
  const fallback = {
    default: {
      tone: "neutral",
      prefix: "",
      suffix: "",
      rateLimit: { windowSeconds: 30, maxMessages: 8 },
      templates: {},
      allowedMentions: null,
      denyCommands: [],
      allowCommands: []
    },
    channels: {}
  };
  if (!raw || typeof raw !== "object") return fallback;
  return {
    default: { ...fallback.default, ...(raw.default || {}) },
    channels: raw.channels && typeof raw.channels === "object" ? raw.channels : {}
  };
}

function saveChannelProfiles(data) {
  try {
    fs.mkdirSync(path.dirname(channelProfilesFile), { recursive: true });
    fs.writeFileSync(channelProfilesFile, JSON.stringify(data, null, 2));
  } catch {}
}

function loadStorySparks() {
  const raw = readJsonFile(storySparksFile, { prompts: [] });
  const prompts = Array.isArray(raw.prompts) ? raw.prompts.map((x) => String(x)).filter(Boolean) : [];
  return prompts;
}

function loadSeasonalArcs() {
  const raw = readJsonFile(seasonalArcsFile, { arcs: [] });
  const arcs = Array.isArray(raw.arcs) ? raw.arcs : [];
  return arcs
    .map((a) => ({
      id: String(a?.id || ""),
      title: String(a?.title || ""),
      summary: String(a?.summary || ""),
      cta: String(a?.cta || "")
    }))
    .filter((a) => a.id && a.title);
}

async function loadHelplineConfig() {
  try {
    const data = await adminFetch("/api/admin/content/helpline-scripts", { reqId: "helpline.load" });
    if (data && typeof data === "object") {
      return {
        staff: data.staff && typeof data.staff === "object" ? data.staff : {},
        owner: data.owner && typeof data.owner === "object" ? data.owner : {},
        roleOverrides: data.roleOverrides && typeof data.roleOverrides === "object" ? data.roleOverrides : {}
      };
    }
  } catch {}
  const raw = readJsonFile(helplineConfigFile, {});
  return {
    staff: raw.staff && typeof raw.staff === "object" ? raw.staff : {},
    owner: raw.owner && typeof raw.owner === "object" ? raw.owner : {},
    roleOverrides: raw.roleOverrides && typeof raw.roleOverrides === "object" ? raw.roleOverrides : {}
  };
}

async function loadFactionChannelMap() {
  try {
    const data = await adminFetch("/api/admin/content/faction-channels", { reqId: "faction-channels.load" });
    if (data && typeof data === "object") {
      const map = data.mappings && typeof data.mappings === "object" ? data.mappings : {};
      const cleaned = {};
      for (const [key, value] of Object.entries(map)) {
        const id = parseChannelId(value);
        if (id) cleaned[String(key)] = id;
      }
      return cleaned;
    }
  } catch {}
  const raw = readJsonFile(factionChannelFile, { factions: {} });
  if (!raw || typeof raw !== "object") return {};
  const map = raw.factions && typeof raw.factions === "object" ? raw.factions : {};
  const cleaned = {};
  for (const [key, value] of Object.entries(map)) {
    const id = parseChannelId(value);
    if (id) cleaned[String(key)] = id;
  }
  return cleaned;
}

async function refreshDiscordOpsConfig() {
  try {
    const data = await adminFetch("/api/admin/content/discord-ops", { reqId: "discord-ops.load" });
    if (data && typeof data === "object") {
      discordOpsCache = {
        quietHoursEnabled: typeof data.quietHoursEnabled === "boolean" ? data.quietHoursEnabled : discordOpsDefaults.quietHoursEnabled,
        quietHoursStartUtc: String(data.quietHoursStartUtc || discordOpsDefaults.quietHoursStartUtc || ""),
        quietHoursEndUtc: String(data.quietHoursEndUtc || discordOpsDefaults.quietHoursEndUtc || ""),
        mentionAllowedChannelIds: Array.isArray(data.mentionAllowedChannelIds) ? data.mentionAllowedChannelIds.map((x) => parseChannelId(x)) : discordOpsDefaults.mentionAllowedChannelIds,
        staffDigestChannelId: parseChannelId(data.staffDigestChannelId || discordOpsDefaults.staffDigestChannelId || ""),
        staffDigestTimeUtc: String(data.staffDigestTimeUtc || discordOpsDefaults.staffDigestTimeUtc || "17:30"),
        musicAutoPlaylistSize: Math.max(1, Math.min(20, Number(data.musicAutoPlaylistSize || discordOpsDefaults.musicAutoPlaylistSize || 8))),
        disabledCommandKeys: Array.isArray(data.disabledCommandKeys)
          ? data.disabledCommandKeys.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
          : []
      };
      return;
    }
  } catch {}
  discordOpsCache = { ...discordOpsDefaults };
}

function getChannelProfile(channel) {
  const profiles = loadChannelProfiles();
  const chanId = channel?.id ? String(channel.id) : "";
  const specific = chanId && profiles.channels?.[chanId] ? profiles.channels[chanId] : {};
  return {
    ...profiles.default,
    ...specific,
    rateLimit: { ...(profiles.default.rateLimit || {}), ...(specific.rateLimit || {}) },
    templates: { ...(profiles.default.templates || {}), ...(specific.templates || {}) },
    denyCommands: Array.isArray(specific.denyCommands) ? specific.denyCommands : (profiles.default.denyCommands || []),
    allowCommands: Array.isArray(specific.allowCommands) ? specific.allowCommands : (profiles.default.allowCommands || [])
  };
}

function commandKeyFromInteraction(interaction) {
  const base = interaction.commandName || "";
  if (!interaction.isChatInputCommand()) return base;
  const sub = interaction.options?.getSubcommand?.(false);
  return sub ? `${base}.${sub}` : base;
}

function commandMatchesRule(commandKey, rule) {
  if (!rule) return false;
  if (rule.endsWith(".*")) {
    const prefix = rule.replace(".*", "");
    return commandKey.startsWith(`${prefix}.`) || commandKey === prefix;
  }
  return commandKey === rule;
}

function isCommandAllowedInChannel(interaction) {
  const profile = getChannelProfile(interaction.channel);
  const commandKey = commandKeyFromInteraction(interaction);
  const disabledKeys = Array.isArray(discordOpsCache.disabledCommandKeys) ? discordOpsCache.disabledCommandKeys : [];
  const baseKey = String(interaction.commandName || "").toLowerCase();
  if (disabledKeys.includes(commandKey.toLowerCase()) || disabledKeys.includes(baseKey)) {
    return { ok: false, reason: "This command is currently disabled by server admins." };
  }
  const allow = profile.allowCommands || [];
  const deny = profile.denyCommands || [];
  if (allow.length > 0 && !allow.some((rule) => commandMatchesRule(commandKey, rule))) {
    return { ok: false, reason: "Command not allowed in this channel." };
  }
  if (deny.some((rule) => commandMatchesRule(commandKey, rule))) {
    return { ok: false, reason: "Command disabled in this channel." };
  }
  return { ok: true };
}

function applyChannelTone(content, tone, prefix, suffix) {
  let text = content || "";
  let lead = prefix || "";
  let tail = suffix || "";
  if (!prefix && !suffix) {
    if (tone === "formal") lead = "Notice: ";
    if (tone === "casual") lead = "Heads up: ";
  }
  if (lead) text = `${lead}${text}`;
  if (tail) text = `${text}${tail}`;
  return text;
}

function upsertLine(content, label, value) {
  const lines = String(content || "").split("\n");
  const needle = `${label}:`;
  const idx = lines.findIndex((line) => line.startsWith(needle));
  const next = `${label}: ${value}`;
  if (idx >= 0) {
    lines[idx] = next;
  } else {
    lines.push(next);
  }
  return lines.join("\n");
}

function applyChannelTemplates(profile, payload, context) {
  const template = profile.templates?.[context];
  const content = typeof payload?.content === "string" ? payload.content : "";
  if (template) {
    const next = template.replace("{content}", content);
    return { ...payload, content: next.trim() };
  }
  if (content) {
    return { ...payload, content: applyChannelTone(content, profile.tone, profile.prefix, profile.suffix) };
  }
  return payload;
}

function applyChannelEmbeds(profile, payload) {
  if (!Array.isArray(payload?.embeds) || !payload.embeds.length) return payload;
  if (!profile.embedFooter) return payload;
  const embeds = payload.embeds.map((embed) => {
    try {
      const next = EmbedBuilder.from(embed);
      const footer = next.data?.footer?.text ? `${next.data.footer.text} • ${profile.embedFooter}` : profile.embedFooter;
      next.setFooter({ text: footer });
      return next;
    } catch {
      return embed;
    }
  });
  return { ...payload, embeds };
}

async function bootstrapChannelProfiles() {
  if (!autoChannelProfileCreate) return;
  const guild = (client.guilds.cache.get(process.env.DISCORD_GUILD_ID || "") || client.guilds.cache.first() || null);
  if (!guild) return;
  await guild.channels.fetch();

  const profiles = loadChannelProfiles();
  let changed = false;

  for (const key of Object.keys(profiles.channels || {})) {
    if (String(key).includes("_HERE")) {
      delete profiles.channels[key];
      changed = true;
    }
  }

  const infoCategory = await ensureCategoryChannel(guild, "INFORMATION", "Channel profile bootstrap").catch(() => null);
  const staffCategory = await ensureCategoryChannel(guild, "STAFF", "Channel profile bootstrap").catch(() => null);
  const servicesCategory = await ensureCategoryChannel(guild, "SERVICES", "Channel profile bootstrap").catch(() => null);

  const resolveChannel = async (id, names, createName, topic, parentId) => {
    const direct = id ? await client.channels.fetch(id).catch(() => null) : null;
    if (direct && direct.isTextBased()) return direct;
    const found = findTextChannelByNames(guild, names);
    if (found) return found;
    if (!autoChannelProfileCreate) return null;
    return ensureTextChannelByName(guild, createName, { parentId, topic, reason: "Channel profile bootstrap" }).catch(() => null);
  };

  const statusCh = await resolveChannel(statusChannelId, ["server-status", "status"], "server-status", "Live server status synced from website.", infoCategory?.id || null);
  const announceCh = await resolveChannel(announceChannelId, ["announcements", "announcement", "updates", "news"], "announcements", "Official announcements synced from website updates.", infoCategory?.id || null);
  const modcallCh = await resolveChannel(modCallChannelId, ["modcall", "modcalls", "support-desk", "support"], "modcall", "Moderator call intake and escalations.", staffCategory?.id || null);
  const logCh = await resolveChannel(logChannelId, ["bot-log", "audit-log", "ops-log", "staff-log", "logs"], "bot-log", "Automation logs and bot diagnostics.", staffCategory?.id || null);
  const suggestionsCh = await resolveChannel("", ["suggestions", "suggestion-box", "community-suggestions", "feedback"], "suggestions", "Community suggestions reviewed by mods/admins/owners.", staffCategory?.id || null);
  const rulesCh = await resolveChannel("", ["rules"], "rules", "Official server rules and conduct policy.", infoCategory?.id || null);
  const communityCh = await resolveChannel("", ["community-guide", "community"], "community-guide", "Community etiquette and channel usage guide.", infoCategory?.id || null);
  const directoryCh = await resolveChannel("", ["server-directory", "directory"], "server-directory", "Server navigation directory.", infoCategory?.id || null);
  const loreCh = await resolveChannel("", ["lore"], "lore", "Lore feed synced from website transmissions.", infoCategory?.id || null);
  const storyCh = await resolveChannel("", ["story", "stories"], "story", "Story feed synced from website updates and transmissions.", infoCategory?.id || null);
  const transmissionsCh = await resolveChannel("", ["transmissions", "transmission"], "transmissions", "Transmission feed synced from website.", infoCategory?.id || null);
  const autoShopCh = await resolveChannel(
    autoShopChannelId,
    [
      "demons-autoshop",
      "demons-auto-shop",
      "demons auto shop",
      "demons-autoshop-requests",
      "demons-auto-shop-requests",
      "autoshop",
      "auto-shop",
      "autoshop-requests",
      "auto-shop-requests",
      "repair-shop",
      "repair-shop-requests"
    ],
    "demons-autoshop",
    "Demon's Autoshop service requests and updates.",
    servicesCategory?.id || null
  );
  const storeRequestsCh = await resolveChannel(
    storeRequestChannelId,
    [
      "shop-requests",
      "shop request",
      "shop-request",
      "store-requests",
      "store request",
      "store-request",
      "business-requests",
      "business request",
      "business-request"
    ],
    "shop-requests",
    "Requests to list new shops or services.",
    servicesCategory?.id || null
  );
  const dossierReviewCh = await resolveChannel(dossierReviewChannelId, ["dossier-review", "dossier-reviews"], "dossier-review", "Staff dossier review queue and approvals.", staffCategory?.id || null);
  const dossierPublicCh = await resolveChannel(dossierPublicChannelId, ["dossiers", "dossier-board", "dossier-board-public"], "dossiers", "Approved character dossiers and reputation highlights.", infoCategory?.id || null);
  const staffDigestCh = await resolveChannel(staffDigestChannelId, ["staff-digest", "content-digest"], "staff-digest", "Daily staff digest of content changes.", staffCategory?.id || null);

  const ensureProfile = (channel, defaults) => {
    if (!channel || !channel.id) return;
    const id = String(channel.id);
    const existing = profiles.channels[id] || {};
    profiles.channels[id] = {
      ...defaults,
      ...existing,
      templates: { ...(defaults.templates || {}), ...(existing.templates || {}) },
      rateLimit: { ...(defaults.rateLimit || {}), ...(existing.rateLimit || {}) }
    };
    changed = true;
  };

  if (dossierReviewCh) {
    const helpLines = [
      "**Dossier Review Queue**",
      "Use `/dossier submit` to add entries (players) and review in Admin: /admin/dossiers.",
      "Staff scripts: `/helpline staff` • Owner scripts: `/helpline owner`.",
      "Approved dossiers appear on the website automatically."
    ].join("\n");
    await upsertPinnedChannelCard(dossierReviewCh, "dossier-review", helpLines, "dossier-review");
  }

  ensureProfile(statusCh, {
    tone: "formal",
    templates: { "status-update": "{content}" },
    allowCommands: ["status", "statushistory", "live", "playercount"],
    rateLimit: { windowSeconds: 30, maxMessages: 6 }
  });
  ensureProfile(announceCh, {
    tone: "formal",
    templates: { "announce.send": "{content}", "announcepreset.send": "{content}" },
    allowCommands: ["announce", "announcepreset", "updates", "transmissions", "lore", "rules", "join", "links", "mods"],
    rateLimit: { windowSeconds: 30, maxMessages: 8 }
  });
  ensureProfile(modcallCh, {
    tone: "formal",
    allowCommands: ["modcall", "case", "ticket", "incident", "triage", "summarize", "playbook", "handoff", "mod", "staffpanel", "staffquickstart", "safety", "trustgraph", "policy", "shiftplan", "ops", "helpline", "digest"],
    denyCommands: ["game.*", "admin.*"],
    rateLimit: { windowSeconds: 30, maxMessages: 12 }
  });
  ensureProfile(logCh, {
    tone: "neutral",
    allowCommands: ["health", "metrics", "audit", "ops", "admin", "diagnose", "permissions", "digest"],
    rateLimit: { windowSeconds: 30, maxMessages: 20 }
  });
  ensureProfile(suggestionsCh, {
    tone: "neutral",
    allowCommands: ["suggest", "help", "rules", "links"],
    rateLimit: { windowSeconds: 30, maxMessages: 10 }
  });

  if (autoWebhookCreate) {
    await ensureWebhookForChannel(statusCh, "Auto webhook bootstrap");
    await ensureWebhookForChannel(announceCh, "Auto webhook bootstrap");
    await ensureWebhookForChannel(transmissionsCh, "Auto webhook bootstrap");
    await ensureWebhookForChannel(loreCh, "Auto webhook bootstrap");
    await ensureWebhookForChannel(storyCh, "Auto webhook bootstrap");
    await ensureWebhookForChannel(suggestionsCh, "Auto webhook bootstrap");
    await ensureWebhookForChannel(autoShopCh, "Auto webhook bootstrap");
    await ensureWebhookForChannel(storeRequestsCh, "Auto webhook bootstrap");
    await ensureWebhookForChannel(dossierReviewCh, "Auto webhook bootstrap");
    await ensureWebhookForChannel(dossierPublicCh, "Auto webhook bootstrap");
    await ensureWebhookForChannel(staffDigestCh, "Auto webhook bootstrap");
  }
  ensureProfile(rulesCh, {
    tone: "formal",
    allowCommands: ["rules", "help", "links", "join"],
    rateLimit: { windowSeconds: 60, maxMessages: 6 }
  });
  ensureProfile(communityCh, {
    tone: "casual",
    allowCommands: ["help", "rules", "join", "ticket", "links", "mods", "status", "live", "playercount", "shop", "dossier", "arc", "event", "economy"],
    rateLimit: { windowSeconds: 30, maxMessages: 12 }
  });
  ensureProfile(directoryCh, {
    tone: "neutral",
    allowCommands: ["help", "links", "rules", "join", "status", "live", "dossier", "arc", "event", "economy"],
    rateLimit: { windowSeconds: 60, maxMessages: 6 }
  });
  ensureProfile(loreCh, {
    tone: "formal",
    allowCommands: ["transmissions", "lore", "updates", "links"],
    rateLimit: { windowSeconds: 30, maxMessages: 6 }
  });
  ensureProfile(storyCh, {
    tone: "formal",
    allowCommands: ["transmissions", "updates", "lore", "links"],
    rateLimit: { windowSeconds: 30, maxMessages: 6 }
  });
  ensureProfile(transmissionsCh, {
    tone: "formal",
    allowCommands: ["transmissions", "updates", "lore", "links"],
    rateLimit: { windowSeconds: 30, maxMessages: 6 }
  });
  ensureProfile(autoShopCh, {
    tone: "casual",
    allowCommands: ["shop", "help", "links", "rules"],
    rateLimit: { windowSeconds: 30, maxMessages: 10 }
  });
  ensureProfile(storeRequestsCh, {
    tone: "neutral",
    allowCommands: ["shop", "help", "links", "rules"],
    rateLimit: { windowSeconds: 30, maxMessages: 8 }
  });
  ensureProfile(dossierReviewCh, {
    tone: "formal",
    allowCommands: ["dossier", "helpline", "help", "links"],
    rateLimit: { windowSeconds: 30, maxMessages: 10 }
  });
  ensureProfile(dossierPublicCh, {
    tone: "formal",
    allowCommands: ["dossier", "help", "links"],
    rateLimit: { windowSeconds: 30, maxMessages: 6 }
  });
  ensureProfile(staffDigestCh, {
    tone: "formal",
    allowCommands: ["help", "links"],
    rateLimit: { windowSeconds: 60, maxMessages: 4 }
  });

  if (changed) saveChannelProfiles(profiles);
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
  const now = Date.now();
  let runAt = job.runAt || now;
  const shouldQuiet = !job.bypassQuietHours;
  if (quietHoursEnabled && shouldQuiet && isWithinQuietHours(new Date(now), quietHoursStartUtc, quietHoursEndUtc)) {
    runAt = nextQuietHoursEnd(new Date(now), quietHoursStartUtc, quietHoursEndUtc).getTime();
  }
  const row = {
    id: makeId("job"),
    type: job.type || "message",
    idempotencyKey: job.idempotencyKey || "",
    channelId: job.channelId || "",
    content: job.content || "",
    embeds: normalizeEmbeds(job.embeds),
    allowedMentions: job.allowedMentions || null,
    runAt,
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

function enqueueContentDigest(state, entry) {
  if (!entry) return;
  const list = Array.isArray(state.contentDigestQueue) ? state.contentDigestQueue : [];
  list.push({ entry: String(entry).slice(0, 160), at: new Date().toISOString() });
  state.contentDigestQueue = list.slice(-20);
}

const QUIET_JOB_TYPES = new Set([
  "status-update",
  "update-post",
  "transmission-post",
  "mods-post",
  "arc-post",
  "event-post",
  "economy-post",
  "dossier-approved",
  "dossier-faction",
  "world-brief",
  "story-spark",
  "map-intel",
  "lore-pulse",
  "incident-digest",
  "survivor-spotlight",
  "seasonal-arc",
  "live-milestone",
  "live-peak",
  "ptero-alert"
]);

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
  if (!member) return false;
  if (member.guild?.ownerId && member.id === member.guild.ownerId) return true;
  if (ownerUserIds.includes(member.id)) return true;
  if (member.permissions?.has?.(PermissionsBitField.Flags.Administrator)) return true;
  const roleIds = member.roles.cache.map((r) => r.id);
  return canAccessCommand(loadPermissionPolicy(), member.id, roleIds, commandName);
}

function canManageAutoShop(member) {
  if (!member) return false;
  return hasRole(member, [autoShopRoleId, resolvedAutoShopRoleId].filter(Boolean)) || hasPolicyAccess(member, "ops") || hasPolicyAccess(member, "admin");
}

function canManageStores(member) {
  if (!member) return false;
  return hasRole(member, [shopManagerRoleId, resolvedShopManagerRoleId].filter(Boolean)) || hasPolicyAccess(member, "ops") || hasPolicyAccess(member, "admin");
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

function isModCallLikeChannel(channel) {
  if (!channel) return false;
  const name = String(channel.name || "").toLowerCase();
  if (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread) {
    return name.startsWith("modcall-") || name.includes("modcall");
  }
  if (channel.type === ChannelType.GuildText) {
    return name.includes("modcall");
  }
  return false;
}

async function closeOrphanModcallConversation(interaction, channel) {
  if (!channel || !isModCallLikeChannel(channel)) return false;
  await interaction.reply({ content: "No tracked case record found. Closing orphan modcall conversation...", ephemeral: true });
  const deleted = await channel.delete(`Orphan modcall closed by ${interaction.user.tag}`).then(() => true).catch(() => false);
  if (!deleted) {
    await interaction.editReply({ content: "Could not delete this orphan modcall channel/thread. Check bot Manage Channels permission." }).catch(() => {});
    return true;
  }
  return true;
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
const ORGANIZE_PREFIX_BY_BUCKET = {
  information: "info",
  community: "community",
  support: "support",
  staff: "staff",
  voice: "voice"
};
const ORGANIZE_TOPIC_TEMPLATE_BY_BUCKET = {
  information: "Official server information. Use this channel for announcements and updates only.",
  community: "Community chat channel. Keep it respectful, on-topic, and follow server rules.",
  support: "Support channel. Use /ticket create for issues and include clear details/screenshots.",
  staff: "Staff operations channel. Internal moderation and admin coordination only."
};
const ORGANIZE_INDEX_CHANNELS = [
  { category: "INFORMATION", name: "read-first", topic: "Server index: rules, status, updates, and key links." },
  { category: "COMMUNITY", name: "community-guide", topic: "Community posting guide and where to chat." },
  { category: "SUPPORT", name: "support-desk", topic: "Support index. Start with /ticket create for private help." },
  { category: "STAFF", name: "staff-ops", topic: "Staff quick actions, SOP links, and escalation routing." },
  { category: "STAFF", name: "suggestions", topic: "Community suggestions reviewed by mods/admins/owners." }
];
const ORGANIZE_CORE_CHANNELS = [
  { category: "INFORMATION", name: "rules", topic: "Server rules and expectations. Read this first." },
  { category: "INFORMATION", name: "announcements", topic: "Official announcements from staff." },
  { category: "INFORMATION", name: "server-status", topic: "Live server status and outage notices." },
  { category: "COMMUNITY", name: "general-chat", topic: "Main community discussion channel." },
  { category: "COMMUNITY", name: "media-share", topic: "Share screenshots, clips, and highlights." },
  { category: "SUPPORT", name: "report-issue", topic: "Public support entry point. Use /ticket create for private help." }
];

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

function isProtectedOrganizeName(name) {
  const value = String(name || "").toLowerCase();
  if (!value) return true;
  if (value.startsWith("ticket-") || value.startsWith("modcall-")) return true;
  return /^(rules|welcome|announcements?|status|updates?|modcalls?|logs?|read-first|staff-ops|support-desk|community-guide)$/.test(value);
}

function buildStyledChannelName(channel, bucket) {
  const current = String(channel?.name || "");
  if (!current) return "";
  if (isProtectedOrganizeName(current)) return normalizeChannelName(current);
  const normalized = normalizeChannelName(current);
  const prefix = ORGANIZE_PREFIX_BY_BUCKET[bucket] || "community";
  if (normalized.startsWith(`${prefix}-`)) return normalized;
  return `${prefix}-${normalized}`.slice(0, 90);
}

function buildSuggestedTopic(bucket) {
  return ORGANIZE_TOPIC_TEMPLATE_BY_BUCKET[bucket] || "";
}

function buildOrganizationIndexPlan(guild) {
  const plan = [];
  for (const def of ORGANIZE_INDEX_CHANNELS) {
    const existing = guild.channels.cache.find((c) =>
      c.type === ChannelType.GuildText &&
      String(c.name || "").toLowerCase() === def.name &&
      c.parent?.type === ChannelType.GuildCategory &&
      String(c.parent.name || "").toUpperCase() === def.category
    );
    if (!existing) plan.push(def);
  }
  return plan;
}

function buildOrganizationCorePlan(guild) {
  const plan = [];
  for (const def of ORGANIZE_CORE_CHANNELS) {
    const existing = guild.channels.cache.find((c) =>
      c.type === ChannelType.GuildText &&
      String(c.name || "").toLowerCase() === def.name &&
      c.parent?.type === ChannelType.GuildCategory &&
      String(c.parent.name || "").toUpperCase() === def.category
    );
    if (!existing) plan.push(def);
  }
  return plan;
}

function buildGuildChannelMap(guild, includeVoice = true) {
  const categories = new Map();
  const uncategorized = [];
  const channels = Array.from(guild.channels.cache.values())
    .filter((c) => c && c.type !== ChannelType.GuildCategory && !c.isThread?.())
    .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0));

  for (const channel of channels) {
    const isVoice = channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice;
    if (isVoice && !includeVoice) continue;
    const bucket = channel.parent?.type === ChannelType.GuildCategory
      ? String(channel.parent.name || "UNCATEGORIZED").toUpperCase()
      : "UNCATEGORIZED";
    const typeLabel = isVoice ? "voice" : (channel.type === ChannelType.GuildAnnouncement ? "announcement" : "text");
    const row = `- #${channel.name} (${typeLabel})`;
    if (bucket === "UNCATEGORIZED") {
      uncategorized.push(row);
      continue;
    }
    if (!categories.has(bucket)) categories.set(bucket, []);
    categories.get(bucket).push(row);
  }

  const lines = ["Grey Hour RP Channel Map", ""];
  const sortedCats = Array.from(categories.keys()).sort((a, b) => a.localeCompare(b));
  for (const cat of sortedCats) {
    lines.push(`${cat}`);
    lines.push(...categories.get(cat));
    lines.push("");
  }
  if (uncategorized.length) {
    lines.push("UNCATEGORIZED");
    lines.push(...uncategorized);
    lines.push("");
  }
  return {
    lines,
    categoryCount: sortedCats.length,
    channelCount: channels.length
  };
}

function formatCommandRule(rule) {
  if (!rule) return "";
  const value = String(rule);
  if (value.endsWith(".*")) return `/${value.slice(0, -2)} (any)`;
  if (value.includes(".")) {
    const parts = value.split(".");
    return `/${parts[0]} ${parts.slice(1).join(" ")}`.trim();
  }
  return `/${value}`;
}

function addCommands(list, next = []) {
  for (const cmd of next) {
    const value = String(cmd || "").trim();
    if (!value) continue;
    if (!list.includes(value)) list.push(value);
  }
}

function buildChannelCommandHints(channel, bucket) {
  const list = [];
  const profile = getChannelProfile(channel);
  const allow = Array.isArray(profile.allowCommands) ? profile.allowCommands : [];
  if (allow.length > 0) {
    addCommands(list, allow.map(formatCommandRule));
    return list;
  }

  const name = `${channel?.name || ""}`.toLowerCase();
  const parent = `${channel?.parent?.name || ""}`.toLowerCase();
  const full = `${name} ${parent}`;

  if (/(shop-requests|shop request|store-requests|store request|business-requests|business request)/i.test(full)) {
    addCommands(list, ["/shop request", "/shop store"]);
    return list;
  }
  if (/(faction-requests|group-requests)/i.test(full)) {
    addCommands(list, ["/group request"]);
    return list;
  }
  if (/(shop|services|repairs|garage|tow)/i.test(full)) {
    addCommands(list, ["/shop request", "/shop store"]);
  }
  if (/(trade|barter|market)/i.test(full)) {
    addCommands(list, ["/trade post", "/trade list", "/trade close"]);
  }
  if (/(event|events|contest)/i.test(full)) {
    addCommands(list, ["/event list", "/signup join", "/contest start"]);
  }
  if (/(raid)/i.test(full)) {
    addCommands(list, ["/raid create", "/signup join"]);
  }
  if (/(dossier)/i.test(full)) {
    addCommands(list, ["/dossier submit"]);
  }
  if (/(mods|modpack)/i.test(full)) {
    addCommands(list, ["/mods"]);
  }
  if (/(rules|read-first|welcome)/i.test(full)) {
    addCommands(list, ["/start", "/rules", "/links", "/join", "/helpwizard", "/roleselect"]);
  }
  if (/(status|uptime|live)/i.test(full)) {
    addCommands(list, ["/status", "/live", "/playercount", "/serverip"]);
  }
  if (/(transmissions|lore|story|broadcast)/i.test(full)) {
    addCommands(list, ["/transmissions", "/lore"]);
  }
  if (/(updates|changelog)/i.test(full)) {
    addCommands(list, ["/updates"]);
  }
  if (/(directory|links|website)/i.test(full)) {
    addCommands(list, ["/directory", "/links", "/rules"]);
  }
  if (/(roles?|alerts|optin)/i.test(full)) {
    addCommands(list, ["/roleselect", "/optin"]);
  }
  if (/(factions?|ic-faction)/i.test(full)) {
    addCommands(list, ["/group roster", "/group request"]);
  }
  if (/(support|help|ticket|report|issue)/i.test(full)) {
    addCommands(list, ["/helpwizard", "/faq", "/ticket create", "/help", "/ask"]);
  }
  if (/(faq)/i.test(full)) {
    addCommands(list, ["/faq", "/helpwizard"]);
  }
  if (/(lfg|looking-for-group)/i.test(full)) {
    addCommands(list, ["/lfg create", "/lfg list"]);
  }
  if (/(prompt|sparks|writing|rp-prompt)/i.test(full)) {
    addCommands(list, ["/prompt"]);
  }
  if (/(bug|bugs|issue|report-bug)/i.test(full)) {
    addCommands(list, ["/bugreport", "/ticket create"]);
  }

  if (!list.length && bucket === "community") {
    addCommands(list, ["/lfg create", "/trade post"]);
  }

  return list;
}

function buildChannelGuideText(channel, bucket) {
  const purposeByBucket = {
    information: "Official server info and important updates.",
    community: "Community discussion and day-to-day conversation.",
    support: "Help and support workflow for troubleshooting and questions.",
    staff: "Staff operations and internal moderation coordination.",
    voice: "Voice communication and live group coordination."
  };
  const purpose = purposeByBucket[bucket] || "Community channel.";
  const commands = buildChannelCommandHints(channel, bucket);
  const commandLine = commands.length ? `Commands: ${commands.join(" • ")}` : "Commands: chat only.";
  const helpLine = bucket === "support" ? "For guided help: `/helpwizard` • Private help: `/ticket create`." : "";
  return [
    `**Channel Guide • #${channel.name}**`,
    `Purpose: ${purpose}`,
    commandLine,
    "Buttons below are quick actions (no pings).",
    helpLine,
    `guide-marker:${channel.id}`
  ].filter(Boolean).join("\n");
}

function buildChannelFooterText(channel, bucket) {
  const commands = buildChannelCommandHints(channel, bucket);
  const commandLine = commands.length ? `Quick commands: ${commands.join(" • ")}` : "Quick commands: chat only.";
  return [
    `**Quick Actions • #${channel.name}**`,
    commandLine,
    `footer-marker:${channel.id}`
  ].join("\n");
}

async function ensureChannelFooterGuide(channel, bucket, guideComponents) {
  if (!channel || !channel.isTextBased()) return { posted: false, skipped: true };
  const state = loadState();
  const footerIndex = (state.channelFooterIndex && typeof state.channelFooterIndex === "object")
    ? { ...state.channelFooterIndex }
    : {};
  const last = footerIndex[channel.id] || {};
  const now = Date.now();
  const cooldownMs = 6 * 60 * 60 * 1000;
  if (last.at && (now - last.at) < cooldownMs) return { posted: false, skipped: true };

  const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  const marker = `footer-marker:${channel.id}`;
  const existing = recent?.find((m) => m.author?.id === client.user?.id && String(m.content || "").includes(marker)) || null;
  if (existing) {
    footerIndex[channel.id] = { id: existing.id, at: now };
    state.channelFooterIndex = footerIndex;
    saveState(state);
    return { posted: false, skipped: true };
  }

  const content = buildChannelFooterText(channel, bucket);
  const payload = guideComponents?.length ? { content, components: guideComponents } : { content };
  const posted = await sendMessageWithGuards(channel, payload, "textauto.footer");
  if (posted) {
    footerIndex[channel.id] = { id: posted.id, at: now };
    state.channelFooterIndex = footerIndex;
    saveState(state);
    return { posted: true, skipped: false };
  }
  return { posted: false, skipped: false };
}

function buildChannelSpecificTopic(channel, bucket) {
  const name = String(channel?.name || "").toLowerCase();
  const map = {
    "start-here": "Start here for everything Grey Hour RP: rules, status, updates, support, and getting started.",
    "read-first": "Quick index to rules, status, key links, and server expectations.",
    "rules": "Server rules and conduct policy. Read before posting.",
    "announcements": "Official announcements only. Read-only for most members.",
    "server-status": "Live server status, restarts, outages, and maintenance updates.",
    "server-directory": "Navigation hub linking all major channels.",
    "updates": "Patch notes, changelogs, and feature updates.",
    "faq": "Common questions answered fast.",
    "guides": "How-to guides, onboarding tips, and helpful references.",
    "links": "Official website + essential external links.",
    "help": "Quick help and FAQs. Use /ticket create for private support.",
    "support-desk": "Support index. Use /ticket create for private help.",
    "report-issue": "Public issue intake. Use /ticket create for private help.",
    "roles": "Opt into alerts and RP roles here.",
    "alerts": "Opt into alerts for restarts, events, story, and updates.",
    "lore": "Canon lore posts and story context.",
    "story": "Story updates and narrative progress.",
    "transmissions": "In-universe transmissions and lore dispatches.",
    "ic-chat": "In-character roleplay only. Stay in-world.",
    "ooc-chat": "Out-of-character discussion and meta chat.",
    "barters": "Trade and barter postings only.",
    "knox-county": "World info, locations, and faction notes.",
    "welcome": "Welcome channel for new arrivals."
  };
  if (map[name]) return map[name];

  if (/^ic-/.test(name)) return "In-character roleplay only. Stay in-world.";
  if (/^ooc-/.test(name)) return "Out-of-character discussion only.";
  if (/(trade|barter|market|shop)/i.test(name)) return "Trade listings only. Keep posts concise.";
  if (/(faction|group)/i.test(name)) return "Faction coordination channel. Keep it focused.";
  if (/(support|help|ticket|report)/i.test(name)) return "Support channel. Use /ticket create for private help.";
  if (/(status|uptime|live)/i.test(name)) return "Live server status and outage notices.";
  if (/(rules|read-first|welcome)/i.test(name)) return "Start here: rules, links, and onboarding.";
  if (/(lore|story|transmissions|broadcast)/i.test(name)) return "Canon lore and story updates.";
  if (/(updates|changelog)/i.test(name)) return "Patch notes and updates.";
  if (/(roles?|alerts|optin)/i.test(name)) return "Pick your alert roles and RP access.";

  const fallback = {
    information: "Official server information channel.",
    community: "Community chat. Keep it respectful and on-topic.",
    support: "Support channel. Use /ticket create for private help.",
    staff: "Staff-only operations channel.",
    voice: "Voice communication channel."
  };
  return fallback[bucket] || "Community channel.";
}

function buildChannelGuideComponents(channel, bucket) {
  const name = String(channel?.name || "").toLowerCase();
  const rows = [];
  const addRow = (buttons) => {
    const row = new ActionRowBuilder().addComponents(...buttons);
    rows.push(row);
  };

  if (/(start-here|read-first|rules|links|directory|welcome)/i.test(name)) {
    addRow([
      new ButtonBuilder().setCustomId("start:rules").setLabel("Rules").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("start:website").setLabel("Website").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("start:status").setLabel("Server Status").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("start:help").setLabel("Help Wizard").setStyle(ButtonStyle.Success)
    ]);
    return rows;
  }

  if (/(roles?|alerts|optin)/i.test(name)) {
    addRow([
      new ButtonBuilder().setCustomId("start:roles").setLabel("Alert Roles").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("start:help").setLabel("Help Wizard").setStyle(ButtonStyle.Success)
    ]);
    return rows;
  }

  if (bucket === "support" || /(support|help|ticket|report|issue)/i.test(name)) {
    addRow([
      new ButtonBuilder().setCustomId("helpwizard:connect").setLabel("Connection Help").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("helpwizard:mods").setLabel("Mods/Workshop").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("helpwizard:support").setLabel("Open Ticket").setStyle(ButtonStyle.Success)
    ]);
    return rows;
  }

  if (/(status|uptime|live)/i.test(name)) {
    addRow([
      new ButtonBuilder().setCustomId("start:status").setLabel("Server Status").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("start:website").setLabel("Website").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("start:help").setLabel("Help Wizard").setStyle(ButtonStyle.Success)
    ]);
    return rows;
  }

  if (/(lore|story|transmissions|broadcast)/i.test(name)) {
    addRow([
      new ButtonBuilder().setCustomId("helpwizard:lore").setLabel("Lore + Story").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("start:website").setLabel("Website").setStyle(ButtonStyle.Secondary)
    ]);
    return rows;
  }

  if (bucket === "community") {
    addRow([
      new ButtonBuilder().setCustomId("start:help").setLabel("Help Wizard").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("start:website").setLabel("Website").setStyle(ButtonStyle.Secondary)
    ]);
    return rows;
  }

  return rows;
}

function findTextChannelByNames(guild, names = []) {
  const set = new Set(names.map((x) => String(x || "").toLowerCase()));
  return guild.channels.cache.find((c) =>
    c &&
    (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
    set.has(String(c.name || "").toLowerCase())
  ) || null;
}

function channelNameMatches(channel, names = []) {
  if (!channel || !channel.name) return false;
  const set = new Set(names.map((x) => String(x || "").toLowerCase()));
  return set.has(String(channel.name || "").toLowerCase());
}

async function resolveTextChannelByIdOrName(guild, id, names = []) {
  if (!guild) return null;
  await guild.channels.fetch().catch(() => null);
  if (id) {
    const direct = await guild.channels.fetch(id).catch(() => null);
    if (direct && direct.isTextBased()) return direct;
  }
  return findTextChannelByNames(guild, names);
}

function canManageWebhooks(channel) {
  if (!channel || !channel.guild) return false;
  const me = channel.guild.members.me || channel.guild.members.cache.get(client.user?.id || "");
  if (!me) return false;
  const perms = channel.permissionsFor(me);
  return Boolean(perms && perms.has(PermissionsBitField.Flags.ManageWebhooks));
}

function canSendToChannel(channel) {
  if (!channel || !channel.guild) return false;
  const me = channel.guild.members.me || channel.guild.members.cache.get(client.user?.id || "");
  if (!me) return false;
  const perms = channel.permissionsFor(me);
  return Boolean(
    perms &&
    perms.has(PermissionsBitField.Flags.ViewChannel) &&
    perms.has(PermissionsBitField.Flags.SendMessages)
  );
}

function pickPostableChannel(channels = []) {
  for (const channel of channels) {
    if (channel && channel.isTextBased && channel.isTextBased() && canSendToChannel(channel)) {
      return channel;
    }
  }
  return null;
}

function buildMusicPolicySnapshot() {
  const policy = loadMusicPolicy();
  return {
    allowedText: new Set(policy.allowedTextChannelIds || []),
    allowedVoice: new Set(policy.allowedVoiceChannelIds || []),
    musicBots: new Set(policy.musicBotUserIds || [])
  };
}

function channelLooksLikeMusic(channel) {
  if (!channel || !channel.guild) return false;
  const ownName = String(channel.name || "");
  if (/music|songs|radio|jukebox/i.test(ownName)) return true;
  const parentId = channel.parentId ? String(channel.parentId) : "";
  if (!parentId) return false;
  const parent = channel.guild.channels?.cache?.get(parentId) || null;
  const parentName = String(parent?.name || "");
  if (!parentName) return false;
  const configuredCategory = String(musicChannelCategoryName || "").trim();
  if (configuredCategory && parentName.toLowerCase() === configuredCategory.toLowerCase()) return true;
  return /music|songs|radio|jukebox/i.test(parentName);
}

function isMusicTextAllowed(channel) {
  if (!channel || !channel.guild) return false;
  const policy = buildMusicPolicySnapshot();
  if (!musicRequireApprovedChannels) return true;
  if (!policy.allowedText.size) return channelLooksLikeMusic(channel);
  return policy.allowedText.has(String(channel.id));
}

function isMusicVoiceAllowed(channel) {
  if (!channel || !channel.guild) return false;
  const policy = buildMusicPolicySnapshot();
  if (!musicRequireApprovedChannels) return true;
  if (!policy.allowedVoice.size) return channelLooksLikeMusic(channel);
  return policy.allowedVoice.has(String(channel.id));
}

function hasMusicVoicePermissions(guild, voiceChannel) {
  if (!guild || !voiceChannel) return false;
  const me = guild.members?.me || null;
  if (!me) return false;
  const perms = voiceChannel.permissionsFor(me);
  if (!perms) return false;
  return Boolean(
    perms.has(PermissionsBitField.Flags.Connect) &&
    perms.has(PermissionsBitField.Flags.Speak) &&
    perms.has(PermissionsBitField.Flags.ViewChannel)
  );
}

function isMusicBotUserId(userId) {
  const policy = buildMusicPolicySnapshot();
  return policy.musicBots.has(String(userId || ""));
}

function loadPersistedMusicSessions() {
  const raw = readJsonFile(musicSessionsFile, { sessions: {} });
  const sessions = raw && typeof raw === "object" && raw.sessions && typeof raw.sessions === "object" ? raw.sessions : {};
  return { sessions };
}

function persistMusicSessions() {
  try {
    const out = {};
    for (const [guildId, session] of musicSessions.entries()) {
      out[guildId] = {
        guildId,
        textChannelId: String(session.textChannelId || ""),
        voiceChannelId: String(session.voiceChannelId || ""),
        current: session.current || null,
        queue: Array.isArray(session.queue) ? session.queue.slice(0, 100) : [],
        updatedAt: new Date().toISOString()
      };
    }
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(musicSessionsFile, JSON.stringify({ updatedAt: new Date().toISOString(), sessions: out }, null, 2));
  } catch {}
}

async function restoreMusicSessionsOnStartup() {
  const voiceLib = await getVoiceLib();
  if (!voiceLib) return;
  const stored = loadPersistedMusicSessions().sessions || {};
  const guildIds = Object.keys(stored);
  if (!guildIds.length) return;
  for (const guildId of guildIds) {
    const row = stored[guildId];
    if (!row) continue;
    const guild = client.guilds.cache.get(guildId) || null;
    if (!guild) continue;
    await guild.channels.fetch().catch(() => null);
    const voiceChannel = row.voiceChannelId ? guild.channels.cache.get(String(row.voiceChannelId)) : null;
    const textChannel = row.textChannelId ? guild.channels.cache.get(String(row.textChannelId)) : null;
    const queue = Array.isArray(row.queue) ? row.queue.filter((x) => x && x.source).slice(0, 100) : [];
    const current = row.current && row.current.source ? row.current : null;
    if ((!current && !queue.length) || !voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) continue;
    if (!isMusicVoiceAllowed(voiceChannel)) continue;
    const session = await getOrCreateMusicSession(guildId);
    if (!session) continue;
    session.queue = [...(current ? [current] : []), ...queue];
    session.current = null;
    session.voiceChannelId = voiceChannel.id;
    if (textChannel && textChannel.isTextBased()) {
      session.textChannelId = textChannel.id;
    }
    const hasListeners = voiceChannel.members.some((m) => !m.user.bot);
    if (!hasListeners) {
      persistMusicSessions();
      continue;
    }
    const existing = voiceLib.getVoiceConnection(guildId);
    const connection = existing || voiceLib.joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false
    });
    session.connection = connection;
    attachMusicConnectionHandlers(session, voiceLib);
    if (!existing) {
      await voiceLib.entersState(connection, voiceLib.VoiceConnectionStatus.Ready, 15000).catch(() => null);
    }
    connection.subscribe(session.player);
    await playNextInMusicQueue(guildId);
  }
}

async function getOrCreateMusicSession(guildId) {
  let session = musicSessions.get(guildId);
  if (session) return session;
  const voiceLib = await getVoiceLib();
  if (!voiceLib) return null;
  const player = voiceLib.createAudioPlayer({
    behaviors: { noSubscriber: voiceLib.NoSubscriberBehavior.Pause }
  });
  session = {
    guildId,
    queue: [],
    current: null,
    connection: null,
    player,
    ffmpeg: null,
    textChannelId: "",
    voiceChannelId: "",
    reconnecting: false,
    lock: false
  };
  player.on("error", (err) => {
    logEvent("warn", "music.player.error", { guildId, error: truncate(String(err?.message || err), 220) });
    cleanupMusicProcess(session);
    session.current = null;
    persistMusicSessions();
    playNextInMusicQueue(guildId).catch(() => null);
  });
  player.on(voiceLib.AudioPlayerStatus.Idle, () => {
    cleanupMusicProcess(session);
    session.current = null;
    persistMusicSessions();
    playNextInMusicQueue(guildId).catch(() => null);
  });
  musicSessions.set(guildId, session);
  persistMusicSessions();
  return session;
}

function attachMusicConnectionHandlers(session, voiceLib) {
  const connection = session?.connection;
  if (!connection || session._connectionHandlersAttached) return;
  session._connectionHandlersAttached = true;
  connection.on("stateChange", async (_, newState) => {
    try {
      if (newState.status !== voiceLib.VoiceConnectionStatus.Disconnected) return;
      if (session.reconnecting) return;
      session.reconnecting = true;
      await Promise.race([
        voiceLib.entersState(connection, voiceLib.VoiceConnectionStatus.Signalling, 5000),
        voiceLib.entersState(connection, voiceLib.VoiceConnectionStatus.Connecting, 5000)
      ]).catch(() => null);
      if (connection.state.status !== voiceLib.VoiceConnectionStatus.Ready) {
        const guild = client.guilds.cache.get(session.guildId) || null;
        const ch = session.voiceChannelId && guild ? guild.channels.cache.get(session.voiceChannelId) : null;
        if (guild && ch && ch.type === ChannelType.GuildVoice) {
          try {
            connection.rejoin({ channelId: ch.id, selfDeaf: false, selfMute: false });
          } catch {}
          await voiceLib.entersState(connection, voiceLib.VoiceConnectionStatus.Ready, 7000).catch(() => null);
        }
      }
      if (connection.state.status !== voiceLib.VoiceConnectionStatus.Ready) {
        try {
          connection.destroy();
        } catch {}
        session.connection = null;
      }
    } finally {
      session.reconnecting = false;
      persistMusicSessions();
    }
  });
}

async function ensureMusicConnectionReady(session, voiceLib, timeoutMs = 15000) {
  const connection = session?.connection;
  if (!connection) return false;
  if (connection.state?.status === voiceLib.VoiceConnectionStatus.Ready) return true;

  const guild = client.guilds.cache.get(session.guildId) || null;
  const voiceChannel = session.voiceChannelId && guild ? guild.channels.cache.get(session.voiceChannelId) : null;
  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) return false;

  try {
    connection.rejoin({ channelId: voiceChannel.id, selfDeaf: false, selfMute: false });
  } catch {}

  const ready = await voiceLib.entersState(connection, voiceLib.VoiceConnectionStatus.Ready, timeoutMs).then(() => true).catch(() => false);
  if (ready) return true;

  try {
    connection.destroy();
  } catch {}
  session.connection = null;
  logEvent("warn", "music.voice.connection.unready", {
    guildId: session.guildId,
    channelId: voiceChannel.id,
    state: String(connection.state?.status || "unknown")
  });
  return false;
}

function cleanupMusicProcess(session) {
  if (!session?.ffmpeg) return;
  try {
    session.ffmpeg.kill("SIGKILL");
  } catch {}
  session.ffmpeg = null;
}

function destroyMusicSession(guildId) {
  const session = musicSessions.get(guildId);
  if (!session) return;
  cleanupMusicProcess(session);
  try {
    session.player.stop(true);
  } catch {}
  try {
    if (session.connection) session.connection.destroy();
  } catch {}
  musicSessions.delete(guildId);
  persistMusicSessions();
}

function splitCommandSpec(raw) {
  const tokens = String(raw || "").match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return tokens
    .map((x) => x.replace(/^"(.*)"$/s, "$1").replace(/^'(.*)'$/s, "$1").trim())
    .filter(Boolean);
}

function buildMusicToolSpec(raw) {
  const parts = splitCommandSpec(raw);
  if (!parts.length) return null;
  return {
    command: parts[0],
    prefixArgs: parts.slice(1)
  };
}

function formatMusicToolSpec(spec) {
  if (!spec?.command) return "";
  return [spec.command, ...(Array.isArray(spec.prefixArgs) ? spec.prefixArgs : [])].join(" ").trim();
}

function getActiveMusicYtDlpLabel() {
  return formatMusicToolSpec(activeMusicYtDlpSpec) || String(musicYtDlpBin || "yt-dlp");
}

function musicToolSpecKey(spec) {
  return formatMusicToolSpec(spec).toLowerCase();
}

function buildMusicToolSpecList(primaryRaw, fallbackRawList = []) {
  const out = [];
  const seen = new Set();
  for (const raw of [primaryRaw, ...fallbackRawList]) {
    const spec = buildMusicToolSpec(raw);
    if (!spec) continue;
    const key = musicToolSpecKey(spec);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(spec);
  }
  return out;
}

function getMusicYtDlpSpecs() {
  return buildMusicToolSpecList(musicYtDlpBin, musicYtDlpFallbackBins);
}

function getMusicFfmpegSpecs() {
  return buildMusicToolSpecList(musicFfmpegBin, musicFfmpegFallbackBins);
}

async function probeMusicToolSpec(spec, probeArgs) {
  if (!spec?.command) return { ok: false, stderr: "missing_spec", stdout: "", code: null, signal: null };
  return execCommandWithTimeout(spec.command, [...(spec.prefixArgs || []), ...probeArgs], {
    timeoutMs: musicToolProbeTimeoutMs,
    maxOutput: 8000
  });
}

async function resolveHealthyMusicToolSpecs(force = false) {
  const now = Date.now();
  if (!force && musicToolLastProbeAt && (now - musicToolLastProbeAt) < 2 * 60 * 1000 && activeMusicYtDlpSpec && activeMusicFfmpegSpec) {
    return { ytdlp: activeMusicYtDlpSpec, ffmpeg: activeMusicFfmpegSpec };
  }
  musicToolLastProbeAt = now;

  const ytdlpSpecs = getMusicYtDlpSpecs();
  let selectedYtDlp = null;
  for (const spec of ytdlpSpecs) {
    const probe = await probeMusicToolSpec(spec, ["--version"]);
    if (probe.ok) {
      selectedYtDlp = spec;
      break;
    }
  }
  if (selectedYtDlp && musicToolSpecKey(selectedYtDlp) !== musicToolSpecKey(activeMusicYtDlpSpec)) {
    activeMusicYtDlpSpec = selectedYtDlp;
    logEvent("info", "music.tool.ytdlp.selected", { command: formatMusicToolSpec(selectedYtDlp) });
  }
  if (!activeMusicYtDlpSpec && ytdlpSpecs[0]) activeMusicYtDlpSpec = ytdlpSpecs[0];

  const ffmpegSpecs = getMusicFfmpegSpecs();
  let selectedFfmpeg = null;
  for (const spec of ffmpegSpecs) {
    const probe = await probeMusicToolSpec(spec, ["-version"]);
    if (probe.ok) {
      selectedFfmpeg = spec;
      break;
    }
  }
  if (selectedFfmpeg && musicToolSpecKey(selectedFfmpeg) !== musicToolSpecKey(activeMusicFfmpegSpec)) {
    activeMusicFfmpegSpec = selectedFfmpeg;
    logEvent("info", "music.tool.ffmpeg.selected", { command: formatMusicToolSpec(selectedFfmpeg) });
  }
  if (!activeMusicFfmpegSpec && ffmpegSpecs[0]) activeMusicFfmpegSpec = ffmpegSpecs[0];

  if (!selectedYtDlp) {
    logEvent("warn", "music.tool.ytdlp.unhealthy", {
      configured: ytdlpSpecs.map((x) => formatMusicToolSpec(x)).join(" | ")
    });
  }
  if (!selectedFfmpeg) {
    logEvent("warn", "music.tool.ffmpeg.unhealthy", {
      configured: ffmpegSpecs.map((x) => formatMusicToolSpec(x)).join(" | ")
    });
  }

  return {
    ytdlp: activeMusicYtDlpSpec,
    ffmpeg: activeMusicFfmpegSpec
  };
}

function buildPreferredSpecList(primarySpec, fallbackSpecs) {
  const out = [];
  const seen = new Set();
  for (const spec of [primarySpec, ...(fallbackSpecs || [])]) {
    if (!spec?.command) continue;
    const key = musicToolSpecKey(spec);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(spec);
  }
  return out;
}

async function execMusicYtDlp(args, options = {}) {
  await resolveHealthyMusicToolSpecs(false);
  const candidates = buildPreferredSpecList(activeMusicYtDlpSpec, getMusicYtDlpSpecs());
  let last = { ok: false, stdout: "", stderr: "no_ytdlp_candidate", code: null, signal: null };

  for (const spec of candidates) {
    const result = await execCommandWithTimeout(
      spec.command,
      [...(spec.prefixArgs || []), ...args],
      options
    );
    if (result.ok) {
      if (musicToolSpecKey(spec) !== musicToolSpecKey(activeMusicYtDlpSpec)) {
        activeMusicYtDlpSpec = spec;
        logEvent("warn", "music.tool.ytdlp.failover", { command: formatMusicToolSpec(spec) });
      }
      return result;
    }
    last = result;
  }

  if (musicToolAutohealEnabled) {
    await resolveHealthyMusicToolSpecs(true);
  }
  return last;
}

function isMetadataOnlyMusicUrl(raw) {
  const value = String(raw || "").trim();
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.includes("spotify.") || host.includes("music.apple.") || host.includes("deezer.");
  } catch {
    return false;
  }
}

async function fetchMetadataSearchHint(url) {
  const meta = await fetchMusicMetadata(url, false);
  if (!meta.ok || !meta.stdout) return "";
  try {
    const parsed = JSON.parse(meta.stdout);
    const title = String(parsed?.track || parsed?.title || "").trim();
    const artist = String(parsed?.artist || parsed?.uploader || parsed?.creator || "").trim();
    return [artist, title].filter(Boolean).join(" - ").trim();
  } catch {
    return "";
  }
}

function wantsAutoPlaylist(query) {
  return /\b(playlist|mix|radio|autoplay|auto playlist)\b/i.test(String(query || ""));
}

function getConfiguredAutoPlaylistSize() {
  return Math.max(1, Math.min(20, Number(discordOpsCache.musicAutoPlaylistSize || 8)));
}

async function fetchMusicMetadata(target, allowPlaylist = false) {
  const args = [
    "--no-cache-dir",
    "--no-warnings",
    "--ignore-config",
    ...(allowPlaylist ? [] : ["--no-playlist"]),
    "--skip-download",
    "-J",
    target
  ];
  return execMusicYtDlp(args, { timeoutMs: 30000, maxOutput: 320000 });
}

async function fetchMusicStreamUrl(target) {
  const formatChains = [
    "bestaudio[acodec=opus][abr>0]/bestaudio[abr>0]/bestaudio/best",
    "bestaudio[asr>=48000]/bestaudio/best",
    "bestaudio/best"
  ];
  for (const fmt of formatChains) {
    const direct = await execMusicYtDlp(
      ["--no-cache-dir", "--no-warnings", "--ignore-config", "--no-playlist", "-f", fmt, "-g", target],
      { timeoutMs: 30000, maxOutput: 120000 }
    );
    if (!direct.ok || !direct.stdout) continue;
    const url = String(direct.stdout || "")
      .split("\n")
      .map((x) => x.trim())
      .find((x) => /^https?:\/\//i.test(x)) || "";
    if (url) return url;
  }
  return "";
}

function collectTrackCandidates(metaJson, fallbackQuery) {
  const nodes = Array.isArray(metaJson?.entries) ? metaJson.entries.filter(Boolean) : [metaJson].filter(Boolean);
  return nodes.map((node) => {
    const title = truncate(String(node?.title || "Unknown"), 180);
    const pageUrl = String(node?.webpage_url || node?.original_url || node?.url || fallbackQuery || "").trim();
    const extractor = String(node?.extractor_key || node?.extractor || "").toLowerCase();
    const abr = Number(node?.abr || 0);
    const asr = Number(node?.asr || 0);
    const sourceBoost = extractor.includes("youtube") || extractor.includes("ytmusic")
      ? 20
      : extractor.includes("soundcloud")
        ? 10
        : 0;
    return {
      title,
      lookup: pageUrl || fallbackQuery,
      pageUrl: pageUrl || fallbackQuery,
      qualityScore: sourceBoost + (Number.isFinite(abr) ? abr : 0) + ((Number.isFinite(asr) ? asr : 0) / 1000)
    };
  }).filter((x) => x.lookup).sort((a, b) => b.qualityScore - a.qualityScore);
}

function buildMusicSearchTargets(query, autoPlaylist) {
  const q = String(query || "").trim();
  if (!q) return [];
  if (autoPlaylist) {
    return [`ytmusicsearch10:${q}`, `ytsearch10:${q}`, `scsearch10:${q}`];
  }
  return [`ytmusicsearch1:${q}`, `ytsearch1:${q}`, `scsearch1:${q}`];
}

async function resolveMusicTracks(input, opts = {}) {
  const query = String(input || "").trim();
  if (!query) return { ok: false, error: "missing_query" };
  const isUrl = /^https?:\/\//i.test(query);
  const autoPlaylist = Boolean(opts.autoPlaylist) || (!isUrl && wantsAutoPlaylist(query));
  const defaultCount = autoPlaylist ? getConfiguredAutoPlaylistSize() : 1;
  const maxTracks = Math.max(1, Math.min(20, Number(opts.maxTracks || defaultCount)));

  const targets = [];
  if (isUrl) {
    if (isMetadataOnlyMusicUrl(query)) {
      const hint = await fetchMetadataSearchHint(query);
      for (const target of buildMusicSearchTargets(hint || query, autoPlaylist)) targets.push(target);
    }
    targets.push(query);
    if (!isMetadataOnlyMusicUrl(query)) {
      const parsed = await fetchMetadataSearchHint(query);
      if (parsed) {
        for (const target of buildMusicSearchTargets(parsed, autoPlaylist)) targets.push(target);
      }
    }
  } else {
    for (const target of buildMusicSearchTargets(query, autoPlaylist)) targets.push(target);
  }

  const dedupedTargets = Array.from(new Set(targets.filter(Boolean)));
  let lastMetaError = "";
  for (const target of dedupedTargets) {
    const meta = await fetchMusicMetadata(target, autoPlaylist && !isUrl);
    if (!meta.ok || !meta.stdout) {
      lastMetaError = meta.stderr || meta.stdout || "metadata_failed";
      continue;
    }
    let parsed = null;
    try {
      parsed = JSON.parse(meta.stdout);
    } catch {
      lastMetaError = "metadata_parse_failed";
      continue;
    }
    const candidates = collectTrackCandidates(parsed, query).slice(0, maxTracks);
    if (!candidates.length) {
      lastMetaError = "no_candidates";
      continue;
    }
    const tracks = [];
    for (const candidate of candidates) {
      const streamUrl = await fetchMusicStreamUrl(candidate.lookup);
      if (!streamUrl) continue;
      tracks.push({
        id: makeId("trk"),
        title: candidate.title,
        lookup: candidate.lookup,
        source: streamUrl,
        url: candidate.pageUrl
      });
      if (tracks.length >= maxTracks) break;
    }
    if (tracks.length) {
      return {
        ok: true,
        tracks,
        autoPlaylist
      };
    }
    lastMetaError = "stream_url_failed";
  }
  return { ok: false, error: lastMetaError || "resolve_failed" };
}

function spawnMusicFfmpeg(sourceUrl, mode = "opus") {
  const spec = activeMusicFfmpegSpec || buildMusicToolSpec(musicFfmpegBin) || { command: musicFfmpegBin, prefixArgs: [] };
  const args = [
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-nostdin",
    "-i", sourceUrl,
    "-vn",
    "-loglevel", "error",
  ];
  const audioFilters = [];
  if (musicEnableLoudnorm) {
    audioFilters.push(`loudnorm=I=${musicTargetLufs}:TP=-1.5:LRA=11`);
  }
  if (musicGain !== 1) {
    audioFilters.push(`volume=${musicGain}`);
  }
  if (audioFilters.length) {
    args.push("-af", audioFilters.join(","));
  }
  if (mode === "pcm") {
    args.push(
      "-f", "s16le",
      "-ar", "48000",
      "-ac", "2",
      "pipe:1"
    );
  } else {
    args.push(
      "-c:a", "libopus",
      "-b:a", "160k",
      "-vbr", "on",
      "-compression_level", "10",
      "-application", "audio",
      "-ar", "48000",
      "-ac", "2",
      "-f", "ogg",
      "pipe:1"
    );
  }
  return spawn(spec.command, [...(spec.prefixArgs || []), ...args], { stdio: ["ignore", "pipe", "pipe"] });
}

async function resolveTrackSourceAtPlayback(track) {
  const lookup = String(track?.lookup || track?.url || "").trim();
  if (lookup) {
    const refreshed = await fetchMusicStreamUrl(lookup);
    if (refreshed) return refreshed;
  }
  const fallback = String(track?.source || "").trim();
  return /^https?:\/\//i.test(fallback) ? fallback : "";
}

function sanitizeMusicAnnouncementText(text) {
  return String(text || "").replace(/@/g, "@\u200b").trim();
}

async function sendTransientNowPlaying(channel, title) {
  if (!musicNowPlayingEnabled || !channel || !channel.isTextBased()) return;
  const safeTitle = sanitizeMusicAnnouncementText(title || "Unknown");
  const message = await sendMessageWithGuards(
    channel,
    {
      content: `Now playing: ${truncate(safeTitle, 180)}`,
      allowedMentions: { parse: [] }
    },
    "music.nowplaying"
  );
  if (!message || !musicNowPlayingTtlSeconds) return;
  setTimeout(() => {
    message.delete().catch(() => null);
  }, musicNowPlayingTtlSeconds * 1000);
}

async function playNextInMusicQueue(guildId) {
  const voiceLib = await getVoiceLib();
  if (!voiceLib) return;
  const session = musicSessions.get(guildId);
  if (!session || session.lock) return;
  if (!session.queue.length) return;
  if (!session.connection || !(await ensureMusicConnectionReady(session, voiceLib))) {
    logEvent("warn", "music.playback.connection.missing", { guildId });
    return;
  }
  await resolveHealthyMusicToolSpecs(false);
  const next = session.queue.shift();
  const sourceUrl = await resolveTrackSourceAtPlayback(next);
  if (!sourceUrl) {
    logEvent("warn", "music.track.source.unavailable", {
      guildId,
      title: truncate(String(next?.title || "unknown"), 120),
      lookup: truncate(String(next?.lookup || next?.url || ""), 220)
    });
    session.current = null;
    persistMusicSessions();
    playNextInMusicQueue(guildId).catch(() => null);
    return;
  }
  session.current = next;
  session.current.source = sourceUrl;
  persistMusicSessions();
  const playbackMode = String(next?.playbackMode || "opus").toLowerCase() === "pcm" ? "pcm" : "opus";
  const ffmpeg = spawnMusicFfmpeg(sourceUrl, playbackMode);
  session.ffmpeg = ffmpeg;
  let outputBytes = 0;
  let fallbackTriggered = false;
  const maybeTriggerPlaybackFallback = (reason) => {
    if (fallbackTriggered) return;
    if (!next || next._fallbackTried) return;
    const altMode = playbackMode === "opus" ? "pcm" : "opus";
    next._fallbackTried = true;
    next.playbackMode = altMode;
    fallbackTriggered = true;
    logEvent("warn", "music.playback.fallback", {
      guildId,
      title: truncate(String(next?.title || "unknown"), 120),
      fromMode: playbackMode,
      toMode: altMode,
      reason: String(reason || "unknown")
    });
    session.current = null;
    session.queue.unshift(next);
    persistMusicSessions();
    cleanupMusicProcess(session);
    try {
      session.player.stop(true);
    } catch {}
    playNextInMusicQueue(guildId).catch(() => null);
  };
  const probeTimer = setTimeout(() => {
    if (session.ffmpeg !== ffmpeg) return;
    if (outputBytes < 4096) {
      maybeTriggerPlaybackFallback(`low_output_bytes:${outputBytes}`);
    }
  }, 5000);
  ffmpeg.on("error", (err) => {
    clearTimeout(probeTimer);
    logEvent("warn", "music.ffmpeg.error", {
      guildId,
      title: truncate(String(next?.title || "unknown"), 120),
      error: truncate(String(err?.message || err), 220)
    });
    if (musicToolAutohealEnabled) resolveHealthyMusicToolSpecs(true).catch(() => null);
    cleanupMusicProcess(session);
    session.current = null;
    persistMusicSessions();
    playNextInMusicQueue(guildId).catch(() => null);
  });
  ffmpeg.stdout?.on("data", (chunk) => {
    outputBytes += Number(chunk?.length || 0);
  });
  ffmpeg.stderr?.on("data", () => {});
  ffmpeg.on("close", (code, signal) => {
    clearTimeout(probeTimer);
    if (typeof code === "number" && code === 0 && outputBytes < 4096) {
      maybeTriggerPlaybackFallback(`close_zero_low_output:${outputBytes}`);
    }
    if (typeof code === "number" && code !== 0) {
      logEvent("warn", "music.ffmpeg.close", {
        guildId,
        title: truncate(String(next?.title || "unknown"), 120),
        code,
        signal: signal || ""
      });
    }
    if (session.ffmpeg === ffmpeg) session.ffmpeg = null;
  });
  const resource = voiceLib.createAudioResource(ffmpeg.stdout, {
    inputType: playbackMode === "pcm" ? voiceLib.StreamType.Raw : voiceLib.StreamType.OggOpus
  });
  session.player.play(resource);
  if (session.connection) session.connection.subscribe(session.player);
  const guild = client.guilds.cache.get(guildId) || null;
  const me = guild?.members?.me || null;
  logEvent("info", "music.playback.started", {
    guildId,
    title: truncate(String(next?.title || "unknown"), 120),
    channelId: String(session.voiceChannelId || ""),
    mode: playbackMode,
    serverMute: Boolean(me?.voice?.serverMute),
    serverDeaf: Boolean(me?.voice?.serverDeaf)
  });
  const text = session.textChannelId ? await client.channels.fetch(session.textChannelId).catch(() => null) : null;
  await sendTransientNowPlaying(text, next?.title || "Unknown");
}

async function enqueueMusicFromQuery(message, query, mode = "command") {
  const input = String(query || "").trim();
  if (!input) return { ok: false, error: "missing_query" };
  const memberVoice = message.member?.voice?.channel || null;
  if (!memberVoice || memberVoice.type !== ChannelType.GuildVoice) {
    return { ok: false, error: "voice_required" };
  }
  if (!isMusicVoiceAllowed(memberVoice)) {
    return { ok: false, error: "voice_not_allowed" };
  }
  if (!hasMusicVoicePermissions(message.guild, memberVoice)) {
    return { ok: false, error: "voice_permission_missing" };
  }
  if (!isMusicTextAllowed(message.channel)) {
    return { ok: false, error: "text_not_allowed" };
  }
  const voiceLib = await getVoiceLib();
  if (!voiceLib) return { ok: false, error: "voice_lib_missing" };
  const trackResult = await resolveMusicTracks(input, { autoPlaylist: false, maxTracks: 1 });
  const track = Array.isArray(trackResult.tracks) ? trackResult.tracks[0] : null;
  if (!trackResult.ok || !track) {
    return { ok: false, error: "resolve_failed", detail: trackResult.error || "unknown_error" };
  }
  const session = await getOrCreateMusicSession(message.guild.id);
  if (!session) return { ok: false, error: "session_unavailable" };

  const existing = voiceLib.getVoiceConnection(message.guild.id);
  const connection = existing || voiceLib.joinVoiceChannel({
    channelId: memberVoice.id,
    guildId: message.guild.id,
    adapterCreator: message.guild.voiceAdapterCreator,
    selfDeaf: false
  });
  session.connection = connection;
  session.voiceChannelId = memberVoice.id;
  session.textChannelId = message.channel.id;
  attachMusicConnectionHandlers(session, voiceLib);
  if (!(await ensureMusicConnectionReady(session, voiceLib))) {
    return { ok: false, error: "voice_connect_failed" };
  }
  connection.subscribe(session.player);
  session.queue.push({
    ...track,
    requestedBy: message.author.id
  });
  persistMusicSessions();

  if (!session.current) {
    await playNextInMusicQueue(message.guild.id);
    return { ok: true, title: track.title, started: true, mode };
  }
  return { ok: true, title: track.title, started: false, mode };
}

async function handleChannelApprovalMessageCommand(message) {
  if (!message.guild || !message.channel || !message.channel.isTextBased()) return false;
  const content = String(message.content || "").trim();
  const m = content.match(/^!channels\b\s*(.*)$/i);
  if (!m) return false;

  if (!isOwnerOrAdminMember(message.guild, message.member)) {
    await sendMessageWithGuards(message.channel, { content: "Only server owner/admin can approve channel creation requests." }, "channels.cmd.denied");
    return true;
  }

  const args = String(m[1] || "").trim();
  if (!args || /^help$/i.test(args)) {
    await sendMessageWithGuards(
      message.channel,
      { content: "Usage: `!channels pending` | `!channels approve <request_id> [#existing_channel]` | `!channels deny <request_id>`" },
      "channels.cmd.help"
    );
    return true;
  }

  const queue = loadChannelCreateApprovals();
  queue.requests = Array.isArray(queue.requests) ? queue.requests : [];

  if (/^(pending|list)\b/i.test(args)) {
    const pending = queue.requests
      .filter((row) => row && row.status === "pending" && String(row.guildId || "") === String(message.guild.id))
      .slice(0, 20);
    if (!pending.length) {
      await sendMessageWithGuards(message.channel, { content: "No pending channel creation requests." }, "channels.cmd.pending.empty");
      return true;
    }
    const lines = pending.map((row) =>
      `- \`${row.id}\` • ${channelTypeLabel(row.type)} • \`${row.name}\`${row.parentId ? ` • parent <#${row.parentId}>` : ""} • source:${row.source || "auto"}`
    );
    await sendMessageWithGuards(
      message.channel,
      { content: truncate(["**Pending Channel Requests**", ...lines].join("\n"), 1800) },
      "channels.cmd.pending"
    );
    return true;
  }

  const approveMatch = args.match(/^approve\s+(\S+)(?:\s+(.+))?$/i);
  if (approveMatch) {
    const requestId = String(approveMatch[1] || "").trim();
    const targetRef = String(approveMatch[2] || "").trim();
    const row = queue.requests.find((x) =>
      x && x.status === "pending" && String(x.guildId || "") === String(message.guild.id) && String(x.id || "") === requestId
    );
    if (!row) {
      await sendMessageWithGuards(message.channel, { content: `Pending request not found: \`${requestId}\`.` }, "channels.cmd.approve.missing");
      return true;
    }

    let resolvedChannel = null;
    const existingId = parseChannelId(targetRef);
    if (existingId) {
      resolvedChannel = await message.guild.channels.fetch(existingId).catch(() => null);
      if (!resolvedChannel) {
        await sendMessageWithGuards(message.channel, { content: "Could not resolve the provided existing channel." }, "channels.cmd.approve.resolve.failed");
        return true;
      }
    } else {
      const createOptions = normalizeCreateChannelOptions(row.options || {}) || normalizeCreateChannelOptions({
        name: row.name,
        type: row.type,
        parent: row.parentId || null,
        reason: row.reason || "Approved channel creation"
      });
      if (!createOptions) {
        await sendMessageWithGuards(message.channel, { content: "Request has invalid channel options and cannot be approved." }, "channels.cmd.approve.invalid");
        return true;
      }
      resolvedChannel = await createGuildChannelWithApproval(message.guild, createOptions, {
        bypassApproval: true,
        source: "channels.approve",
        requesterId: message.author.id,
        reason: `Approved by ${message.author.tag}`
      });
      if (!resolvedChannel) {
        await sendMessageWithGuards(message.channel, { content: "Channel creation failed. Check Manage Channels permission." }, "channels.cmd.approve.create.failed");
        return true;
      }
    }

    row.status = "approved";
    row.approvedAt = new Date().toISOString();
    row.approvedBy = message.author.id;
    row.resolvedChannelId = resolvedChannel.id;
    queue.updatedUtc = new Date().toISOString();
    saveChannelCreateApprovals(queue);
    await sendMessageWithGuards(message.channel, { content: `Approved \`${requestId}\` -> <#${resolvedChannel.id}>` }, "channels.cmd.approve.ok");
    return true;
  }

  const denyMatch = args.match(/^deny\s+(\S+)$/i);
  if (denyMatch) {
    const requestId = String(denyMatch[1] || "").trim();
    const row = queue.requests.find((x) =>
      x && x.status === "pending" && String(x.guildId || "") === String(message.guild.id) && String(x.id || "") === requestId
    );
    if (!row) {
      await sendMessageWithGuards(message.channel, { content: `Pending request not found: \`${requestId}\`.` }, "channels.cmd.deny.missing");
      return true;
    }
    row.status = "denied";
    row.deniedAt = new Date().toISOString();
    row.deniedBy = message.author.id;
    queue.updatedUtc = new Date().toISOString();
    saveChannelCreateApprovals(queue);
    await sendMessageWithGuards(message.channel, { content: `Denied \`${requestId}\`.` }, "channels.cmd.deny.ok");
    return true;
  }

  await sendMessageWithGuards(
    message.channel,
    { content: "Usage: `!channels pending` | `!channels approve <request_id> [#existing_channel]` | `!channels deny <request_id>`" },
    "channels.cmd.usage"
  );
  return true;
}

async function handleMusicMessageCommand(message) {
  if (!message.guild || !message.channel || !message.channel.isTextBased()) return false;
  const content = String(message.content || "").trim();
  const m = content.match(/^!(musicsetup|play|skip|stop|leave|queue)\b\s*(.*)$/i);
  if (!m) return false;
  const cmd = m[1].toLowerCase();
  const arg = String(m[2] || "").trim();

  if (cmd === "musicsetup") {
    if (!isAuthorizedMember(message.member, message.guild.ownerId)) {
      await sendMessageWithGuards(message.channel, { content: "Only server owner/admin/staff can run `!musicsetup`." }, "music.setup.denied");
      return true;
    }
    await message.guild.channels.fetch().catch(() => null);
    const action = String(arg || "").trim().toLowerCase();
    const approvalKey = `${message.guild.id}:${message.author.id}`;
    if (action === "cancel") {
      musicSetupApprovals.delete(approvalKey);
      await sendMessageWithGuards(message.channel, { content: "Music setup request cancelled." }, "music.setup.cancel");
      return true;
    }
    if (action === "approve") {
      const pending = musicSetupApprovals.get(approvalKey);
      if (!pending || pending.expiresAt < Date.now()) {
        musicSetupApprovals.delete(approvalKey);
        await sendMessageWithGuards(message.channel, { content: "No pending setup approval found. Run `!musicsetup` first." }, "music.setup.approve.missing");
        return true;
      }
      const category = await ensureCategoryChannel(message.guild, musicChannelCategoryName, `Music setup by ${message.author.tag}`);
      const textName = pending.textName;
      const voiceName = pending.voiceName;
      let text = message.guild.channels.cache.find((c) =>
        (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
        String(c.name || "").toLowerCase() === textName.toLowerCase()
      ) || null;
      let voice = message.guild.channels.cache.find((c) =>
        c.type === ChannelType.GuildVoice &&
        String(c.name || "").toLowerCase() === voiceName.toLowerCase()
      ) || null;
      if (!text) {
        text = await createGuildChannelWithApproval(message.guild, {
          name: textName,
          type: ChannelType.GuildText,
          parent: category?.id || null,
          topic: "Music commands and playback updates."
        }).catch(() => null);
      }
      if (!voice) {
        voice = await createGuildChannelWithApproval(message.guild, {
          name: voiceName,
          type: ChannelType.GuildVoice,
          parent: category?.id || null,
          reason: `Music setup by ${message.author.tag}`
        }).catch(() => null);
      }
      if (!text || !voice) {
        await sendMessageWithGuards(message.channel, { content: "Could not create music channels. Check bot Manage Channels permission." }, "music.setup.failed");
        return true;
      }
      const policy = loadMusicPolicy();
      saveMusicPolicy({
        ...policy,
        allowedTextChannelIds: Array.from(new Set([...(policy.allowedTextChannelIds || []), text.id])),
        allowedVoiceChannelIds: Array.from(new Set([...(policy.allowedVoiceChannelIds || []), voice.id])),
        managedTextChannelIds: [text.id],
        managedVoiceChannelIds: [voice.id],
        updatedAt: new Date().toISOString()
      });
      musicSetupApprovals.delete(approvalKey);
      await sendMessageWithGuards(message.channel, { content: `Music setup complete: ${text.toString()} + ${voice.toString()}` }, "music.setup.ok");
      return true;
    }

    const baseName = normalizeChannelName(arg || "music").slice(0, 24) || "music";
    const textName = `${baseName}-text`.slice(0, 90);
    const voiceName = `${baseName}-voice`.slice(0, 90);
    const existingText = message.guild.channels.cache.find((c) =>
      (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
      String(c.name || "").toLowerCase() === textName.toLowerCase()
    ) || null;
    const existingVoice = message.guild.channels.cache.find((c) =>
      c.type === ChannelType.GuildVoice &&
      String(c.name || "").toLowerCase() === voiceName.toLowerCase()
    ) || null;
    const categoryExists = message.guild.channels.cache.find((c) =>
      c.type === ChannelType.GuildCategory &&
      String(c.name || "").toLowerCase() === String(musicChannelCategoryName || "MUSIC").toLowerCase()
    );
    const missing = [];
    if (!categoryExists) missing.push(`category \`${musicChannelCategoryName}\``);
    if (!existingText) missing.push(`text channel \`${textName}\``);
    if (!existingVoice) missing.push(`voice channel \`${voiceName}\``);

    if (missing.length) {
      musicSetupApprovals.set(approvalKey, {
        textName,
        voiceName,
        expiresAt: Date.now() + 10 * 60 * 1000
      });
      await sendMessageWithGuards(
        message.channel,
        { content: `Pending approval to create: ${missing.join(", ")}.\nRun \`!musicsetup approve\` to proceed or \`!musicsetup cancel\`.` },
        "music.setup.pending"
      );
      return true;
    }

    const policy = loadMusicPolicy();
    saveMusicPolicy({
      ...policy,
      allowedTextChannelIds: Array.from(new Set([...(policy.allowedTextChannelIds || []), existingText.id])),
      allowedVoiceChannelIds: Array.from(new Set([...(policy.allowedVoiceChannelIds || []), existingVoice.id])),
      managedTextChannelIds: [existingText.id],
      managedVoiceChannelIds: [existingVoice.id],
      updatedAt: new Date().toISOString()
    });
    await sendMessageWithGuards(message.channel, { content: `Channels already exist and are now approved: ${existingText.toString()} + ${existingVoice.toString()}` }, "music.setup.existing.ok");
    return true;
  }

  await sendMessageWithGuards(
    message.channel,
    { content: "Music commands moved to slash commands. Use `/music play`, `/music queue`, `/music skip`, `/music stop`, `/music leave`." },
    "music.message.redirect"
  );
  return true;

  if (!isMusicTextAllowed(message.channel)) {
    await sendMessageWithGuards(message.channel, { content: "Use music commands in an approved music text channel." }, "music.text.denied");
    return true;
  }

  if (cmd === "queue") {
    const session = musicSessions.get(message.guild.id);
    if (!session || (!session.current && !session.queue.length)) {
      await sendMessageWithGuards(message.channel, { content: "Queue is empty." }, "music.queue.empty");
      return true;
    }
    const lines = [];
    if (session.current) lines.push(`Now: **${session.current.title}**`);
    for (let i = 0; i < Math.min(10, session.queue.length); i += 1) lines.push(`${i + 1}. ${session.queue[i].title}`);
    await sendMessageWithGuards(message.channel, { content: truncate(lines.join("\n"), 1800) }, "music.queue");
    return true;
  }

  if (cmd === "leave") {
    destroyMusicSession(message.guild.id);
    await sendMessageWithGuards(message.channel, { content: "Left voice and cleared queue." }, "music.leave");
    return true;
  }

  const memberVoice = message.member?.voice?.channel || null;
  if (!memberVoice || memberVoice.type !== ChannelType.GuildVoice) {
    await sendMessageWithGuards(message.channel, { content: "Join an approved voice channel first." }, "music.voice.required");
    return true;
  }
  if (!isMusicVoiceAllowed(memberVoice)) {
    await sendMessageWithGuards(message.channel, { content: "That voice channel is not approved for music." }, "music.voice.denied");
    return true;
  }

  if (cmd === "stop") {
    const session = musicSessions.get(message.guild.id);
    if (!session) {
      await sendMessageWithGuards(message.channel, { content: "Nothing is playing." }, "music.stop.empty");
      return true;
    }
    session.queue = [];
    cleanupMusicProcess(session);
    session.player.stop(true);
    session.current = null;
    persistMusicSessions();
    await sendMessageWithGuards(message.channel, { content: "Stopped and cleared queue." }, "music.stop");
    return true;
  }

  if (cmd === "skip") {
    const session = musicSessions.get(message.guild.id);
    if (!session || !session.current) {
      await sendMessageWithGuards(message.channel, { content: "Nothing is playing." }, "music.skip.empty");
      return true;
    }
    cleanupMusicProcess(session);
    session.player.stop(true);
    persistMusicSessions();
    await sendMessageWithGuards(message.channel, { content: "Skipped current track." }, "music.skip");
    return true;
  }

  if (!arg) {
    await sendMessageWithGuards(message.channel, { content: "Usage: `!play <url or search>`" }, "music.play.usage");
    return true;
  }
  const queued = await enqueueMusicFromQuery(message, arg, "command");
  if (!queued.ok) {
    if (queued.error === "voice_lib_missing") {
      await sendMessageWithGuards(message.channel, { content: "Music playback dependency is missing. Install `@discordjs/voice` and restart the bot." }, "music.lib.missing");
    } else if (queued.error === "resolve_failed") {
      await sendMessageWithGuards(
        message.channel,
        { content: `Could not load track. Ensure \`${getActiveMusicYtDlpLabel()}\` is available and query/url is valid.` },
        "music.play.resolve.failed"
      );
    } else if (queued.error === "voice_required") {
      await sendMessageWithGuards(message.channel, { content: "Join an approved voice channel first." }, "music.voice.required");
    } else if (queued.error === "voice_not_allowed") {
      await sendMessageWithGuards(message.channel, { content: "That voice channel is not approved for music." }, "music.voice.denied");
    } else if (queued.error === "voice_permission_missing") {
      await sendMessageWithGuards(message.channel, { content: "Bot is missing View Channel, Connect, or Speak permission in your voice channel." }, "music.voice.perms.denied");
    } else if (queued.error === "voice_connect_failed") {
      await sendMessageWithGuards(message.channel, { content: "Could not connect to voice. Check channel permissions/region and try again." }, "music.voice.connect.failed");
    } else {
      await sendMessageWithGuards(message.channel, { content: "Music playback is unavailable right now." }, "music.play.unavailable");
    }
    return true;
  }
  if (queued.started) {
    await sendMessageWithGuards(message.channel, { content: `Queued and starting: **${queued.title}**` }, "music.play.start");
  } else {
    await sendMessageWithGuards(message.channel, { content: `Queued: **${queued.title}**` }, "music.play.queue");
  }
  return true;
}

async function ensureWebhookForChannel(channel, reason = "Auto webhook ensure") {
  if (!channel || !channel.isTextBased()) return null;
  const state = loadWebhooksState();
  const existing = state.channels?.[channel.id];
  if (existing?.url) return existing;
  if (!autoWebhookCreate || !canManageWebhooks(channel)) return null;

  try {
    const hooks = await channel.fetchWebhooks().catch(() => null);
    if (hooks) {
      const owned = hooks.find((h) => h.owner?.id === client.user?.id) || null;
      if (owned?.url) {
        state.channels[channel.id] = { id: owned.id, url: owned.url, name: owned.name, updatedAt: new Date().toISOString() };
        saveWebhooksState(state);
        return state.channels[channel.id];
      }
    }
    const created = await channel.createWebhook({
      name: webhookName,
      avatar: webhookAvatarUrl || undefined,
      reason
    }).catch(() => null);
    if (created?.url) {
      state.channels[channel.id] = { id: created.id, url: created.url, name: created.name, updatedAt: new Date().toISOString() };
      saveWebhooksState(state);
      return state.channels[channel.id];
    }
  } catch (err) {
    logEvent("warn", "webhook.ensure.failed", { channelId: channel.id, error: err instanceof Error ? err.message : String(err) });
  }
  return null;
}

function shouldUseWebhook(channel, context, payload) {
  if (!channel || !channel.isTextBased()) return false;
  if (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread) return false;
  if (payload?.components && payload.components.length) return false;
  if (payload?.files && payload.files.length) return false;
  const name = String(channel.name || "").toLowerCase();
  const contextList = new Set([
    "status-update",
    "announce.send",
    "announcepreset.send",
    "event.announce",
    "mods.auto",
    "shop.request",
    "shop.store",
    "suggestion.create",
    "scheduler-updates",
    "scheduler-transmissions"
  ]);
  if (contextList.has(context)) return true;
  return /(announc|status|update|transmission|lore|story|suggestion|autoshop|shop-requests|server-status)/i.test(name);
}

async function sendViaWebhook(channel, payload, context, reqId = "") {
  const record = await ensureWebhookForChannel(channel, "Auto webhook dispatch");
  if (!record?.url) return null;
	  const body = {
	    content: typeof payload?.content === "string" ? payload.content : undefined,
	    embeds: normalizeEmbeds(payload?.embeds || []),
	    allowed_mentions: disableMentions ? { parse: [] } : (payload?.allowedMentions || { parse: [] }),
	    username: webhookName,
	    avatar_url: webhookAvatarUrl || undefined
	  };
  try {
    const res = await fetch(`${record.url}?wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Webhook post failed: ${res.status}`);
    const data = await res.json().catch(() => null);
    if (data?.id) {
      return await channel.messages.fetch(data.id).catch(() => null);
    }
    return null;
  } catch (err) {
    logEvent("warn", "webhook.dispatch.failed", {
      reqId,
      context,
      channelId: channel.id,
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}

async function upsertPinnedChannelCard(channel, marker, content, context = "website.sync") {
  if (!channel || !channel.isTextBased()) return { ok: false, updated: false };
  const markerLine = `auto-marker:${marker}`;
  const full = `${truncate(content, 1850)}\n${markerLine}`;
  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const existing = recent?.find((m) => m.author?.id === client.user?.id && String(m.content || "").includes(markerLine)) || null;
  if (existing) {
    const edited = await existing.edit(full).then(() => true).catch(() => false);
    if (edited) {
      if (!disablePins) await existing.pin().catch(() => {});
      return { ok: true, updated: true };
    }
    return { ok: false, updated: false };
  }
  const posted = await sendMessageWithGuards(channel, { content: full }, context);
  if (posted) {
    if (!disablePins) await posted.pin().catch(() => {});
    return { ok: true, updated: true };
  }
  return { ok: false, updated: false };
}

async function upsertPinnedInteractiveCard(channel, marker, content, components, context = "panel.auto") {
  if (!channel || !channel.isTextBased()) return { ok: false, updated: false };
  const markerLine = `auto-marker:${marker}`;
  const full = `${truncate(content, 1800)}\n${markerLine}`;
  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const existing = recent?.find((m) => m.author?.id === client.user?.id && String(m.content || "").includes(markerLine)) || null;
  if (existing) {
    const edited = await existing.edit({ content: full, components }).then(() => true).catch(() => false);
    if (edited) {
      if (!disablePins) await existing.pin().catch(() => {});
      return { ok: true, updated: true };
    }
    return { ok: false, updated: false };
  }
  const posted = await sendMessageWithGuards(channel, { content: full, components }, context);
  if (posted) {
    if (!disablePins) await posted.pin().catch(() => {});
    return { ok: true, updated: true };
  }
  return { ok: false, updated: false };
}

function findCategoryByNames(guild, names = []) {
  if (!guild) return null;
  const set = new Set(names.map((n) => String(n || "").toUpperCase()));
  return guild.channels.cache.find((c) =>
    c.type === ChannelType.GuildCategory && set.has(String(c.name || "").toUpperCase())
  ) || null;
}

function navLinkMention(channel, fallback) {
  if (channel && typeof channel.isTextBased === "function" && channel.isTextBased() && channel.id) {
    return `<#${channel.id}>`;
  }
  return fallback || "Unknown";
}

function buildNavLinks(channelRefs, botOpsChannel, animatedChannel) {
  return {
    rules: navLinkMention(channelRefs.rules, links.rules),
    directory: navLinkMention(channelRefs.directory, links.site),
    communityGuide: navLinkMention(channelRefs.communityGuide, links.join),
    serverStatus: navLinkMention(channelRefs.serverStatus, `${links.site}/status`),
    story: navLinkMention(channelRefs.story, links.updates),
    transmissions: navLinkMention(channelRefs.transmissions, links.transmissions),
    botOps: navLinkMention(botOpsChannel, `#${botOpsGuideChannelName}`),
    animatedNavigation: navLinkMention(animatedChannel, `#${animatedNavChannelName}`)
  };
}

function buildBotOpsHubContent(navLinks) {
  const modeLabel = dryRunMode ? "dry-run" : (stagingMode ? "staging" : "live");
  const lines = [
    "**Bot Ops Hub**",
    `Version: ${deployTag} • Mode: ${modeLabel}`,
    `Codex replies (/ask) are reserved for devs & owners.`,
    "",
    "**Support checklist**",
    "- `/modcall create` • open a moderator call + thread for urgent cases.",
    "- `/shop request` / `/shop store` • manage auto shop services and new stores.",
    "- `/ticket create` + `/ticket feedback` • route tickets and collect follow-up.",
    "- `/ops status` / `/ops digest` • broadcast operations and maintenance cues.",
    "",
    "**Quick links**",
    `Rules: ${navLinks.rules}`,
    `Status: ${navLinks.serverStatus}`,
    `Directory: ${navLinks.directory}`,
    `Community guide: ${navLinks.communityGuide}`,
    "",
    `Animated navigation: ${navLinks.animatedNavigation}`,
    `Bot guidance refreshed every ${autoTextChannelsMinutes}m.`
  ];
  return lines.join("\n");
}

async function updateAnimatedNavigationContent(channel, navLinks, state, loopMinutes) {
  if (!channel || !channel.isTextBased()) return;
  const frameCount = animatedNavFrames.length;
  if (!frameCount) return;
  const idx = Number(state.animatedNavFrameIndex || 0) % frameCount;
  const frame = animatedNavFrames[idx];
  const pathLines = frame.path.map((key, i) => `${i + 1}. ${navLinks[key] || key}`);
  const content = [
    "**Animated Navigation**",
    `${frame.icon} ${frame.title}`,
    frame.note,
    "",
    ...pathLines,
    "",
    `Quick links: ${navLinks.rules} • ${navLinks.directory} • ${navLinks.serverStatus}`,
    `Frame ${idx + 1}/${frameCount} • Refresh every ${loopMinutes}m`
  ].join("\n");
  await upsertPinnedChannelCard(channel, "animated-navigation", content, "textauto.animated");
  state.animatedNavFrameIndex = (idx + 1) % frameCount;
}

async function updateStaffBotChannels(guild, infoCategory, staffCategory, channelRefs, state) {
  if (!guild || dryRunMode) return;
  try {
    const staffCat = staffCategory || await ensureCategoryChannel(guild, "STAFF", "Bot automation: staff hub");
    const infoCat = infoCategory || await ensureCategoryChannel(guild, "INFORMATION", "Bot automation: navigation hub");
    const botOpsChannel = await ensureTextChannelByName(guild, botOpsGuideChannelName, {
      parentId: staffCat?.id || undefined,
      topic: "Bot updates and quick references for staff.",
      reason: "Auto staff guidance"
    });
    const animatedChannel = await ensureTextChannelByName(guild, animatedNavChannelName, {
      parentId: infoCat?.id || undefined,
      topic: "Animated navigation loop for helpful orientation.",
      reason: "Auto animated navigation"
    });
    const navLinks = buildNavLinks(channelRefs, botOpsChannel, animatedChannel);
    if (botOpsChannel) {
      const content = buildBotOpsHubContent(navLinks);
      await upsertPinnedChannelCard(botOpsChannel, "bot-ops-hub", content, "textauto.bot-hub");
      state.botOpsHubUpdatedAt = new Date().toISOString();
    }
    await updateAnimatedNavigationContent(animatedChannel, navLinks, state, autoTextChannelsMinutes);
  } catch (err) {
    logEvent("warn", "textauto.staffbot.failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

function websiteCardNeedsUpdate(state, key, content) {
  const map = state.websiteChannelHashes && typeof state.websiteChannelHashes === "object" ? state.websiteChannelHashes : {};
  const digest = hashString(content || "");
  if (map[key] === digest) return false;
  map[key] = digest;
  state.websiteChannelHashes = map;
  return true;
}

async function runWebsiteChannelSync(opts = {}) {
  const manual = Boolean(opts.manual);
  const previewOnly = Boolean(opts.previewOnly);
  const guild = opts.guild || client.guilds.cache.first() || null;
  if (!guild) return { updated: 0, skipped: 0, failed: 0 };
  bumpMetric("schedulerRun");
  await guild.channels.fetch();

  const state = loadState();
  const now = Date.now();
  const dueMs = intervalMs(autoWebsiteChannelSyncMinutes);
  const last = Number(state.lastWebsiteChannelSyncAt || 0);
  if (!manual && last && (now - last) < dueMs) return { updated: 0, skipped: 0, failed: 0, reason: "not-due" };

  const [statusRaw, updatesRaw, transmissionsRaw] = await Promise.all([
    adminFetch("/api/admin/content/server-status", { reqId: "scheduler-site-sync-status" }).catch(() => null),
    adminFetch("/api/admin/content/updates", { reqId: "scheduler-site-sync-updates" }).catch(() => []),
    adminFetch("/api/admin/content/transmissions", { reqId: "scheduler-site-sync-transmissions" }).catch(() => [])
  ]);
  const latestUpdate = Array.isArray(updatesRaw) && updatesRaw.length ? updatesRaw[0] : null;
  const latestTransmission = Array.isArray(transmissionsRaw) && transmissionsRaw.length ? transmissionsRaw[0] : null;
  const status = statusRaw || { status: "unknown", message: "No status available.", updatedUtc: new Date().toISOString() };

  const infoCategory = findTextChannelByNames(guild, ["read-first"])?.parent || (!previewOnly ? await ensureCategoryChannel(guild, "INFORMATION", "Website sync category ensure") : null);
  const communityCategory = findTextChannelByNames(guild, ["community-guide"])?.parent || (!previewOnly ? await ensureCategoryChannel(guild, "COMMUNITY", "Website sync category ensure") : null);
  const createdChannels = [];
  const ensureWebChannel = async (name, topic, parentId) => {
    const before = findTextChannelByNames(guild, [name]);
    if (before) return before;
    if (previewOnly) {
      createdChannels.push(`#${name}`);
      return null;
    }
    const ch = await ensureTextChannelByName(guild, name, {
      parentId,
      topic,
      reason: "Website sync: ensure required channel"
    });
    if (ch) createdChannels.push(`#${name}`);
    return ch;
  };

  const rulesCh = findTextChannelByNames(guild, ["rules"]) || await ensureWebChannel("rules", "Official server rules and conduct policy.", infoCategory?.id || null);
  const announcementsCh = findTextChannelByNames(guild, ["announcements", "announcement", "updates", "news"])
    || (announceChannelId ? await client.channels.fetch(announceChannelId).catch(() => null) : null)
    || await ensureWebChannel("announcements", "Official announcements synced from website updates.", infoCategory?.id || null);
  const statusCh = findTextChannelByNames(guild, ["server-status", "status"])
    || (statusChannelId ? await client.channels.fetch(statusChannelId).catch(() => null) : null)
    || await ensureWebChannel("server-status", "Live server status synced from website.", infoCategory?.id || null);
  const directoryCh = findTextChannelByNames(guild, ["server-directory", "directory"]) || await ensureWebChannel("server-directory", "Server navigation directory.", infoCategory?.id || null);
  const communityGuideCh = findTextChannelByNames(guild, ["community-guide", "community"]) || await ensureWebChannel("community-guide", "Community etiquette and channel usage guide.", communityCategory?.id || null);
  const loreCh = findTextChannelByNames(guild, ["lore"]) || await ensureWebChannel("lore", "Lore feed synced from website transmissions.", infoCategory?.id || null);
  const storyCh = findTextChannelByNames(guild, ["story", "stories"]) || await ensureWebChannel("story", "Story feed synced from website updates and transmissions.", infoCategory?.id || null);
  const transmissionsCh = findTextChannelByNames(guild, ["transmissions", "transmission"]) || await ensureWebChannel("transmissions", "Transmission feed synced from website.", infoCategory?.id || null);

  const channels = {
    rules: rulesCh,
    announcements: announcementsCh,
    serverStatus: statusCh,
    directory: directoryCh,
    communityGuide: communityGuideCh,
    lore: loreCh,
    story: storyCh,
    transmissions: transmissionsCh
  };

  const cards = [];
  cards.push({
    key: "rules",
    channel: channels.rules,
    marker: "rules",
    content: [
      "**Rules & Conduct**",
      `Read and follow the official rules: ${links.rules}`,
      "Use `/help` to discover commands and `/ticket create` for support."
    ].join("\n")
  });
  cards.push({
    key: "announcements",
    channel: channels.announcements,
    marker: "announcements",
    content: latestUpdate ? [
      `**Latest Announcement: ${latestUpdate.title || "Update"}**`,
      previewFromBody(latestUpdate.body),
      `Date: ${latestUpdate.date || "Unknown"}`,
      `Full update: ${links.updates}`
    ].join("\n") : `No updates posted yet.\n${links.updates}`
  });
  cards.push({
    key: "server-status",
    channel: channels.serverStatus,
    marker: "server-status",
    content: [
      `**Server Status: ${(status.status || "unknown").toUpperCase()}**`,
      `${status.message || "No status message."}`,
      `Updated: ${status.updatedUtc || status.updated || status.dateUtc || "Unknown"}`
    ].join("\n")
  });
  cards.push({
    key: "directory",
    channel: channels.directory,
    marker: "directory",
    content: [
      "**Server Directory**",
      `Rules: ${channels.rules ? `<#${channels.rules.id}>` : links.rules}`,
      `Announcements: ${channels.announcements ? `<#${channels.announcements.id}>` : links.updates}`,
      `Server Status: ${channels.serverStatus ? `<#${channels.serverStatus.id}>` : "Not configured"}`,
      `Community Guide: ${channels.communityGuide ? `<#${channels.communityGuide.id}>` : "Not configured"}`,
      `Lore: ${channels.lore ? `<#${channels.lore.id}>` : links.transmissions}`,
      `Story: ${channels.story ? `<#${channels.story.id}>` : links.transmissions}`,
      `Transmissions: ${channels.transmissions ? `<#${channels.transmissions.id}>` : links.transmissions}`
    ].join("\n")
  });
  cards.push({
    key: "community-guide",
    channel: channels.communityGuide,
    marker: "community-guide",
    content: [
      "**Community Guide**",
      "Be respectful, keep chat on-topic, and help new survivors.",
      "Use `/lfg`, `/trade`, `/event`, and `/help` to navigate community features."
    ].join("\n")
  });
  cards.push({
    key: "lore",
    channel: channels.lore,
    marker: "lore",
    content: latestTransmission ? [
      `**Latest Lore: ${latestTransmission.title || "Transmission"}**`,
      previewFromBody(latestTransmission.body),
      `Read more: ${links.transmissions}`
    ].join("\n") : `No lore transmission posted yet.\n${links.transmissions}`
  });
  cards.push({
    key: "story",
    channel: channels.story,
    marker: "story",
    content: [
      latestUpdate ? `**Story Update: ${latestUpdate.title || "Update"}**\n${previewFromBody(latestUpdate.body)}` : "**Story Update**\nNo update posted yet.",
      latestTransmission ? `\n**Latest Transmission: ${latestTransmission.title || "Transmission"}**\n${previewFromBody(latestTransmission.body)}` : "",
      `\nStory feed: ${links.updates}`,
      `Transmission feed: ${links.transmissions}`
    ].join("\n")
  });
  cards.push({
    key: "transmissions",
    channel: channels.transmissions,
    marker: "transmissions",
    content: latestTransmission ? [
      `**Transmission: ${latestTransmission.title || "Transmission"}**`,
      previewFromBody(latestTransmission.body),
      `Date: ${latestTransmission.date || "Unknown"}`,
      `Full transmission: ${links.transmissions}`
    ].join("\n") : `No transmissions posted yet.\n${links.transmissions}`
  });

  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const notes = [];
  const hashMap = state.websiteChannelHashes && typeof state.websiteChannelHashes === "object"
    ? { ...state.websiteChannelHashes }
    : {};
  for (const card of cards) {
    if (!card.channel || !card.channel.isTextBased()) {
      skipped += 1;
      continue;
    }
    const digest = hashString(card.content || "");
    const changed = hashMap[card.key] !== digest;
    if (!changed) {
      skipped += 1;
      continue;
    }
    if (previewOnly) {
      updated += 1;
      if (notes.length < 12) notes.push(`${card.key} -> #${card.channel.name}`);
      continue;
    }
    hashMap[card.key] = digest;
    const result = await upsertPinnedChannelCard(card.channel, card.marker, card.content, "website.channel.sync");
    if (result.ok && result.updated) updated += 1;
    else failed += 1;
  }

  if (!previewOnly) {
    state.websiteChannelHashes = hashMap;
    state.lastWebsiteChannelSyncAt = Date.now();
    saveState(state);
  }
  return { updated, skipped, failed, notes, createdChannels };
}

async function runTextChannelAutomation(opts = {}) {
  const manual = Boolean(opts.manual);
  const previewOnly = Boolean(opts.previewOnly);
  const force = Boolean(opts.force);
  const guild = opts.guild || client.guilds.cache.first() || null;
  if (!guild) return { skipped: true, reason: "no-guild", processed: 0, topicsSet: 0, guidesPosted: 0, guidesUpdated: 0, failed: 0 };

  const state = loadState();
  const now = Date.now();
  const dueMs = intervalMs(autoTextChannelsMinutes);
  const lastRunAt = Number(state.lastTextChannelAutomationAt || 0);
  if (!manual && !force && lastRunAt && (now - lastRunAt) < dueMs) {
    return { skipped: true, reason: "not-due", processed: 0, topicsSet: 0, guidesPosted: 0, guidesUpdated: 0, failed: 0 };
  }
  if (!isTextAutomationEnabled() && !force) {
    return { skipped: true, reason: "textauto-disabled", processed: 0, topicsSet: 0, guidesPosted: 0, guidesUpdated: 0, failed: 0 };
  }

  await guild.channels.fetch();
  const infoCategory = findCategoryByNames(guild, ["information", "info", "information-hub"]);
  const staffCategory = findCategoryByNames(guild, ["staff", "staff-lounge", "staff-ops"]);
  const textChannels = Array.from(guild.channels.cache.values())
    .filter((c) => c && !c.isThread?.() && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement))
    .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0));
  const channelRefs = {
    rules: findTextChannelByNames(guild, ["rules"]),
    directory: findTextChannelByNames(guild, ["server-directory", "directory"]),
    communityGuide: findTextChannelByNames(guild, ["community-guide", "community"]),
    serverStatus: findTextChannelByNames(guild, ["server-status", "status"]),
    story: findTextChannelByNames(guild, ["story", "stories"]),
    transmissions: findTextChannelByNames(guild, ["transmissions", "transmission"])
  };
  if (!textChannels.length) {
    state.lastTextChannelAutomationAt = now;
    saveState(state);
    return { skipped: false, reason: "no-text-channels", processed: 0, topicsSet: 0, guidesPosted: 0, guidesUpdated: 0, failed: 0 };
  }

  const batchSize = Math.max(1, Math.min(Number(opts.maxChannels || autoTextChannelsBatchSize), textChannels.length));
  const cursor = Math.max(0, Number(state.textAutoCursor || 0)) % textChannels.length;
  const selected = [];
  for (let i = 0; i < batchSize; i += 1) {
    selected.push(textChannels[(cursor + i) % textChannels.length]);
  }

  const guideIndex = (state.channelGuideIndex && typeof state.channelGuideIndex === "object") ? state.channelGuideIndex : {};
  let processed = 0;
  let topicsSet = 0;
  let guidesPosted = 0;
  let guidesUpdated = 0;
  let failed = 0;
  const notes = [];

  for (const channel of selected) {
    processed += 1;
    try {
      const bucket = classifyChannelBucket(channel);
      const desiredTopic = buildChannelSpecificTopic(channel, bucket);
      const hasTopic = String(channel.topic || "").trim().length > 0;
      if (!hasTopic && desiredTopic) {
        if (previewOnly) {
          notes.push(`#${channel.name}: would set topic`);
        } else if (typeof channel.setTopic === "function") {
          const ok = await channel.setTopic(desiredTopic, "Auto text channel topic upkeep").then(() => true).catch(() => false);
          if (ok) topicsSet += 1;
        }
      }

      const guideText = buildChannelGuideText(channel, bucket);
      const guideComponents = buildChannelGuideComponents(channel, bucket);
      if (previewOnly) {
        notes.push(`#${channel.name}: would upsert channel guide`);
        continue;
      }

      const knownMessageId = String(guideIndex[channel.id] || "");
      let guideMessage = null;
      if (knownMessageId && channel.messages && typeof channel.messages.fetch === "function") {
        guideMessage = await channel.messages.fetch(knownMessageId).catch(() => null);
      }
      if (!guideMessage && channel.messages && typeof channel.messages.fetch === "function") {
        const recent = await channel.messages.fetch({ limit: 30 }).catch(() => null);
        guideMessage = recent?.find((m) => m.author?.id === client.user?.id && String(m.content || "").includes(`guide-marker:${channel.id}`)) || null;
      }
      const marker = `channel-guide-${channel.id}`;
      if (guideComponents.length) {
        const result = await upsertPinnedInteractiveCard(channel, marker, guideText, guideComponents, "textauto.guide");
        if (result.ok) {
          if (guideMessage) guidesUpdated += 1;
          else guidesPosted += 1;
        }
      } else {
        const result = await upsertPinnedChannelCard(channel, marker, guideText, "textauto.guide");
        if (result.ok) {
          if (guideMessage) guidesUpdated += 1;
          else guidesPosted += 1;
        }
      }

      await ensureChannelFooterGuide(channel, bucket, guideComponents);
    } catch {
      failed += 1;
    }
  }

  if (!previewOnly) {
    state.channelGuideIndex = guideIndex;
    state.lastTextChannelAutomationAt = now;
    state.textAutoCursor = (cursor + selected.length) % textChannels.length;
    if (isTextAutomationEnabled() || force) {
      await updateStaffBotChannels(guild, infoCategory, staffCategory, channelRefs, state);
    }
    saveState(state);
  }

  return { skipped: false, reason: "", processed, topicsSet, guidesPosted, guidesUpdated, failed, notes: notes.slice(0, 25), totalTextChannels: textChannels.length };
}

async function detectStaleChannelsForArchive(guild, days, limit = 20) {
  const cutoffMs = Date.now() - (Math.max(1, days) * 24 * 60 * 60 * 1000);
  const maxRows = Math.max(1, Math.min(limit, 100));
  const rows = [];
  const channels = Array.from(guild.channels.cache.values())
    .filter((c) => c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement))
    .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0));

  for (const channel of channels) {
    if (rows.length >= maxRows) break;
    const name = String(channel.name || "").toLowerCase();
    if (isProtectedOrganizeName(name)) continue;
    const bucket = classifyChannelBucket(channel);
    if (bucket === "information" || bucket === "staff") continue;
    if (!channel.messages || typeof channel.messages.fetch !== "function") continue;

    const latest = await channel.messages.fetch({ limit: 1 }).catch(() => null);
    const newest = latest?.first();
    const lastActivityTs = newest?.createdTimestamp || channel.createdTimestamp || Date.now();
    if (lastActivityTs >= cutoffMs) continue;
    rows.push({
      channelId: channel.id,
      channelName: channel.name,
      fromCategory: channel.parent?.type === ChannelType.GuildCategory ? String(channel.parent.name || "").toUpperCase() : "none",
      lastActiveAt: new Date(lastActivityTs).toISOString()
    });
  }
  return rows;
}

function planGuildOrganization(guild, opts = {}) {
  const includeVoice = opts.includeVoice !== false;
  const normalizeNames = Boolean(opts.normalizeNames);
  const applyTopics = Boolean(opts.applyTopics);
  const createIndexes = Boolean(opts.createIndexes);
  const createCore = Boolean(opts.createCore);
  const preserveExisting = opts.preserveExisting !== false;
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
    if (preserveExisting) continue;
    const desiredCategory = ORGANIZE_CATEGORY_BY_BUCKET[bucket] || ORGANIZE_CATEGORY_BY_BUCKET.community;
    const currentCategory = channel.parent?.type === ChannelType.GuildCategory
      ? String(channel.parent.name || "").toUpperCase()
      : "";
    const moveNeeded = currentCategory !== desiredCategory;

    let renameTo = "";
    if (normalizeNames && channel.type !== ChannelType.GuildAnnouncement) {
      const nextName = buildStyledChannelName(channel, bucket);
      if (nextName && nextName !== channel.name) renameTo = nextName;
    }

    let topicTo = "";
    if (applyTopics && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
      const hasTopic = String(channel.topic || "").trim().length > 0;
      if (!hasTopic) topicTo = buildSuggestedTopic(bucket);
    }

    if (!moveNeeded && !renameTo && !topicTo) continue;
    actions.push({
      channelId: channel.id,
      channelName: channel.name,
      channelType: String(channel.type),
      bucket,
      fromCategory: currentCategory || "none",
      toCategory: desiredCategory,
      renameTo,
      topicTo
    });
    if (actions.length >= limit) break;
  }

  return {
    includeVoice,
    normalizeNames,
    applyTopics,
    createIndexes,
    createCore,
    preserveExisting,
    limit,
    actions,
    indexPlan: createIndexes ? buildOrganizationIndexPlan(guild) : [],
    corePlan: createCore ? buildOrganizationCorePlan(guild) : [],
    archivePlan: []
  };
}

async function ensureCategoryChannel(guild, categoryName, reason) {
  const upper = String(categoryName || "").toUpperCase();
  const existing = guild.channels.cache.find((c) =>
    c.type === ChannelType.GuildCategory && String(c.name || "").toUpperCase() === upper
  );
  if (existing) return existing;
  return createGuildChannelWithApproval(guild, {
    name: categoryName,
    type: ChannelType.GuildCategory,
    reason
  }, {
    source: "ensureCategoryChannel"
  });
}

async function ensureTextChannelByName(guild, name, opts = {}) {
  const normalized = String(name || "").toLowerCase().trim();
  if (!normalized) return null;
  const existing = guild.channels.cache.find((c) =>
    (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
    String(c.name || "").toLowerCase() === normalized
  );
  if (existing) return existing;
  return createGuildChannelWithApproval(guild, {
    name: normalized,
    type: ChannelType.GuildText,
    parent: opts.parentId || null,
    topic: opts.topic || "",
    reason: opts.reason || "Auto-create missing channel"
  }, {
    source: "ensureTextChannelByName",
    reason: opts.reason || "Auto-create missing channel"
  });
}

async function applyGuildOrganizationPlan(guild, plan, actorTag = "system") {
  const requiredCats = Array.from(new Set([
    ...plan.actions.map((x) => x.toCategory),
    ...(plan.indexPlan || []).map((x) => x.category),
    ...(plan.corePlan || []).map((x) => x.category),
    ...((plan.archivePlan || []).length ? ["ARCHIVE"] : [])
  ]));
  const categories = {};
  for (const name of requiredCats) {
    const cat = await ensureCategoryChannel(guild, name, `Channel organization by ${actorTag}`);
    if (cat) categories[name] = cat;
  }

  let moved = 0;
  let renamed = 0;
  let topicsSet = 0;
  let indexCreated = 0;
  let coreCreated = 0;
  let directoryUpdated = 0;
  let archived = 0;
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
    if (action.topicTo && typeof channel.setTopic === "function") {
      const topicOk = await channel.setTopic(action.topicTo, `Channel organization by ${actorTag}`).then(() => true).catch(() => false);
      if (topicOk) topicsSet += 1;
      else ok = false;
    }

    if (!ok) {
      failed += 1;
      if (failures.length < 10) failures.push(`${action.channelName}: insufficient permissions or conflict`);
    }
  }

  for (const def of plan.indexPlan || []) {
    const category = categories[def.category] || null;
    if (!category) {
      failed += 1;
      if (failures.length < 10) failures.push(`${def.name}: missing target category ${def.category}`);
      continue;
    }
    const existing = guild.channels.cache.find((c) =>
      c.type === ChannelType.GuildText &&
      String(c.name || "").toLowerCase() === def.name &&
      c.parentId === category.id
    );
    if (existing) continue;
    const created = await createGuildChannelWithApproval(guild, {
      name: def.name,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: def.topic,
      reason: `Channel organization by ${actorTag}`
    }).catch(() => null);
    if (created) indexCreated += 1;
    else {
      failed += 1;
      if (failures.length < 10) failures.push(`${def.name}: failed to create index channel`);
    }
  }

  for (const def of plan.corePlan || []) {
    const category = categories[def.category] || null;
    if (!category) {
      failed += 1;
      if (failures.length < 10) failures.push(`${def.name}: missing target category ${def.category}`);
      continue;
    }
    const existing = guild.channels.cache.find((c) =>
      c.type === ChannelType.GuildText &&
      String(c.name || "").toLowerCase() === def.name
    );
    if (existing) continue;
    const created = await createGuildChannelWithApproval(guild, {
      name: def.name,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: def.topic,
      reason: `Channel organization by ${actorTag}`
    }).catch(() => null);
    if (created) coreCreated += 1;
    else {
      failed += 1;
      if (failures.length < 10) failures.push(`${def.name}: failed to create core channel`);
    }
  }

  const archiveCategory = categories.ARCHIVE || null;
  for (const row of plan.archivePlan || []) {
    if (!archiveCategory) break;
    const channel = await guild.channels.fetch(row.channelId).catch(() => null);
    if (!channel || typeof channel.setParent !== "function") {
      failed += 1;
      if (failures.length < 10) failures.push(`${row.channelName}: archive target missing`);
      continue;
    }
    if (channel.parentId === archiveCategory.id) continue;
    const ok = await channel.setParent(archiveCategory.id, { lockPermissions: false }).then(() => true).catch(() => false);
    if (ok) archived += 1;
    else {
      failed += 1;
      if (failures.length < 10) failures.push(`${row.channelName}: failed to move to ARCHIVE`);
    }
  }

  const infoCategory = categories.INFORMATION || await ensureCategoryChannel(guild, "INFORMATION", `Channel organization by ${actorTag}`);
  if (infoCategory) {
    const startHere = await ensureStartHereChannel(guild);
    if (startHere?.parentId) {
      await applyInformationChannelOrder(guild, startHere.parentId);
      await dedupeInformationChannels(guild, startHere.parentId);
    }
    const navChannel = guild.channels.cache.find((c) =>
      c.type === ChannelType.GuildText &&
      String(c.name || "").toLowerCase() === "server-directory" &&
      c.parentId === infoCategory.id
    ) || await createGuildChannelWithApproval(guild, {
      name: "server-directory",
      type: ChannelType.GuildText,
      parent: infoCategory.id,
      topic: "Pinned channel directory for quick navigation.",
      reason: `Channel organization by ${actorTag}`
    }).catch(() => null);
    if (navChannel && navChannel.isTextBased()) {
      const group = (cat) => guild.channels.cache
        .filter((c) => c.parent?.type === ChannelType.GuildCategory && String(c.parent.name || "").toUpperCase() === cat && c.type === ChannelType.GuildText)
        .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0))
        .map((c) => `<#${c.id}>`)
        .slice(0, 10);
      const content = [
        "**Grey Hour RP Server Directory**",
        "Use these channels to quickly find what you need:",
        "",
        `Information: ${group("INFORMATION").join(" • ") || "none"}`,
        `Community: ${group("COMMUNITY").join(" • ") || "none"}`,
        `Support: ${group("SUPPORT").join(" • ") || "none"}`,
        `Staff: ${group("STAFF").join(" • ") || "none"}`,
        "",
        "Need help? Use `/ticket create` or `/help`."
      ].join("\n");
      const recent = await navChannel.messages.fetch({ limit: 20 }).catch(() => null);
      const existingDir = recent?.find((m) => m.author?.id === client.user?.id && String(m.content || "").includes("Server Directory")) || null;
      const msg = existingDir
        ? await existingDir.edit(content).catch(() => null)
        : await sendMessageWithGuards(navChannel, { content }, "server.directory").catch(() => null);
      if (msg) {
        if (!disablePins) await msg.pin().catch(() => {});
        directoryUpdated = 1;
      }
    }
  }

  return { moved, renamed, topicsSet, indexCreated, coreCreated, directoryUpdated, archived, failed, failures };
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
  const profile = getChannelProfile(channel);
  const rate = profile.rateLimit || { windowSeconds: 30, maxMessages: 8 };
  const key = String(channel.id);
  const now = Date.now();
  const windowMs = Math.max(5, Number(rate.windowSeconds || 30)) * 1000;
  const maxMessages = Math.max(1, Number(rate.maxMessages || 8));
  const recent = channelRateState.get(key) || [];
  const pruned = recent.filter((t) => now - t < windowMs);
  if (pruned.length >= maxMessages) {
    logEvent("warn", "dispatch.rate_limited", {
      reqId,
      context,
      channelId: channel.id,
      windowSeconds: rate.windowSeconds || 30,
      maxMessages
    });
    channelRateState.set(key, pruned);
    return null;
  }
  channelRateState.set(key, [...pruned, now]);
  if (context) {
    const ctxKey = String(context).toLowerCase();
    const ctxWindowMs = dispatchContextWindowSeconds * 1000;
    const ctxRecent = dispatchContextRateState.get(ctxKey) || [];
    const ctxPruned = ctxRecent.filter((t) => now - t < ctxWindowMs);
    if (ctxPruned.length >= dispatchContextMaxMessages) {
      logEvent("warn", "dispatch.context_rate_limited", {
        reqId,
        context: ctxKey,
        channelId: channel.id,
        windowSeconds: dispatchContextWindowSeconds,
        maxMessages: dispatchContextMaxMessages
      });
      dispatchContextRateState.set(ctxKey, ctxPruned);
      return null;
    }
    dispatchContextRateState.set(ctxKey, [...ctxPruned, now]);
  }
  let nextPayload = applyChannelTemplates(profile, payload, context);
  nextPayload = applyChannelEmbeds(profile, nextPayload);
  // Default: never allow pings.
  if (disableMentions) {
    nextPayload.content = scrubMentions(nextPayload.content);
    nextPayload.allowedMentions = { parse: [] };
  } else if (isAutomationContext(context)) {
    nextPayload.content = scrubMentions(nextPayload.content);
    nextPayload.allowedMentions = { parse: [] };
  }
  if (!nextPayload.allowedMentions && profile.allowedMentions) {
    nextPayload.allowedMentions = profile.allowedMentions;
  }
  const mentionAllowList = Array.isArray(discordOpsCache.mentionAllowedChannelIds)
    ? discordOpsCache.mentionAllowedChannelIds
    : mentionAllowedChannelIds;
  if (!nextPayload.allowedMentions && mentionAllowList.includes(String(channel.id))) {
    nextPayload.allowedMentions = { parse: ["roles"] };
  }
  if (!nextPayload.allowedMentions) {
    nextPayload.allowedMentions = { parse: [] };
  }
  if (shouldUseWebhook(channel, context, nextPayload)) {
    const sent = await sendViaWebhook(channel, nextPayload, context, reqId);
    if (sent) return sent;
  }
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await channel.send(nextPayload);
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

function isChannelBusy(channel) {
  if (!channel || !channel.isTextBased()) return false;
  const profile = getChannelProfile(channel);
  const rate = profile.rateLimit || { windowSeconds: 30, maxMessages: 8 };
  const key = String(channel.id);
  const now = Date.now();
  const windowMs = Math.max(5, Number(rate.windowSeconds || 30)) * 1000;
  const maxMessages = Math.max(1, Number(rate.maxMessages || 8));
  const recent = channelRateState.get(key) || [];
  const pruned = recent.filter((t) => now - t < windowMs);
  channelRateState.set(key, pruned);
  return pruned.length >= Math.max(1, Math.floor(maxMessages * 0.8));
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
        await sendMessageWithGuards(
          channel,
          { content: job.content || undefined, embeds: job.embeds || [], allowedMentions: job.allowedMentions || undefined },
          `job.${job.type}`,
          ""
        );
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
  metricsServer = http.createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    if (req.url === "/admin/control") {
      const deny = (code, message) => {
        res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: message }));
      };

      if (req.method !== "POST") {
        deny(405, "method_not_allowed");
        return;
      }
      if (!botControlToken) {
        deny(503, "bot_control_not_configured");
        return;
      }
      const auth = String(req.headers.authorization || "").trim();
      const expected = `Bearer ${botControlToken}`;
      if (auth !== expected) {
        deny(401, "unauthorized");
        return;
      }

      try {
        const rawBody = await new Promise((resolve, reject) => {
          let raw = "";
          req.on("data", (chunk) => {
            raw += chunk.toString("utf-8");
            if (raw.length > 2 * 1024 * 1024) {
              reject(new Error("payload_too_large"));
              req.destroy();
            }
          });
          req.on("end", () => resolve(raw));
          req.on("error", reject);
        });

        let parsed = {};
        try {
          parsed = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          deny(400, "invalid_json");
          return;
        }

        const action = String(parsed.action || "").trim();
        const payload = parsed.payload && typeof parsed.payload === "object" ? parsed.payload : {};
        if (!action) {
          deny(400, "missing_action");
          return;
        }

        const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || "") || client.guilds.cache.first() || null;
        if (!guild) {
          deny(503, "guild_not_ready");
          return;
        }

        const result = await executeBotControlAction(action, payload, guild);
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, action, result }, null, 2));
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: false, error: "control_failed", detail }));
      }
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
      const musicSessionsList = Array.from(musicSessions.values());
      const musicActiveSessions = musicSessionsList.filter((s) => s.current || (Array.isArray(s.queue) && s.queue.length)).length;
      const musicConnectedSessions = musicSessionsList.filter((s) => s.connection).length;
      const musicQueuedTracks = musicSessionsList.reduce((sum, s) => sum + (Array.isArray(s.queue) ? s.queue.length : 0), 0);
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
          musicActiveSessions,
          musicConnectedSessions,
          musicQueuedTracks,
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
    const tickets = loadTickets();
    const openTickets = tickets.filter((x) => x.status === "open").length;
    const guild = (client.guilds.cache.get(process.env.DISCORD_GUILD_ID || "") || client.guilds.cache.first() || null);
    const memberCount = guild?.memberCount ?? 0;
    const musicSessionsList = Array.from(musicSessions.values());
    const musicActiveSessions = musicSessionsList.filter((s) => s.current || (Array.isArray(s.queue) && s.queue.length)).length;
    const musicConnectedSessions = musicSessionsList.filter((s) => s.connection).length;
    const musicQueuedTracks = musicSessionsList.reduce((sum, s) => sum + (Array.isArray(s.queue) ? s.queue.length : 0), 0);
    const lines = [
      "# HELP gh_bot_uptime_seconds Bot uptime in seconds.",
      "# TYPE gh_bot_uptime_seconds gauge",
      `gh_bot_uptime_seconds ${Math.floor(process.uptime())}`,
      "# HELP gh_bot_discord_members_gauge Current Discord member count.",
      "# TYPE gh_bot_discord_members_gauge gauge",
      `gh_bot_discord_members_gauge ${memberCount}`,
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
      "# HELP gh_bot_ticket_open_total Number of open support tickets.",
      "# TYPE gh_bot_ticket_open_total gauge",
      `gh_bot_ticket_open_total ${openTickets}`,
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
      "# HELP gh_bot_modcall_open_total Number of open moderator calls (alias).",
      "# TYPE gh_bot_modcall_open_total gauge",
      `gh_bot_modcall_open_total ${openModCases}`,
      "# HELP gh_bot_rolesync_updates_total Total role-sync updates made.",
      "# TYPE gh_bot_rolesync_updates_total counter",
      `gh_bot_rolesync_updates_total ${metrics.roleSyncUpdates}`,
      "# HELP gh_bot_music_sessions_active_gauge Music sessions with current or queued tracks.",
      "# TYPE gh_bot_music_sessions_active_gauge gauge",
      `gh_bot_music_sessions_active_gauge ${musicActiveSessions}`,
      "# HELP gh_bot_music_sessions_connected_gauge Music sessions with active voice connections.",
      "# TYPE gh_bot_music_sessions_connected_gauge gauge",
      `gh_bot_music_sessions_connected_gauge ${musicConnectedSessions}`,
      "# HELP gh_bot_music_queue_tracks_gauge Total queued music tracks.",
      "# TYPE gh_bot_music_queue_tracks_gauge gauge",
      `gh_bot_music_queue_tracks_gauge ${musicQueuedTracks}`,
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

async function executeBotControlAction(action, payload, guild) {
  if (action === "bot.health") {
    const jobs = loadJobs();
    return {
      generatedAt: new Date().toISOString(),
      guildId: guild.id,
      pendingJobs: jobs.filter((x) => x.status === "pending").length,
      commandsTotal: metrics.commandsTotal,
      commandErrors: metrics.commandErrors
    };
  }

  if (action === "announce.send") {
    const text = String(payload.message || "").trim();
    if (!text) throw new Error("missing_message");
    const channelId = String(payload.channelId || announceChannelId || "").trim();
    if (!channelId) throw new Error("announce_channel_not_configured");
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) throw new Error("invalid_announce_channel");
    const everyone = Boolean(payload.everyone);
    const content = everyone ? `@everyone\n${text}` : text;
    await sendMessageWithGuards(channel, { content }, "website.botcontrol.announce");
    return { sent: true, channelId };
  }

  if (action === "channel.message") {
    const channelId = String(payload.channelId || "").trim();
    const text = String(payload.message || "").trim();
    if (!channelId || !text) throw new Error("channel_id_and_message_required");
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) throw new Error("invalid_channel");
    await sendMessageWithGuards(channel, { content: text }, "website.botcontrol.channel-message");
    return { sent: true, channelId };
  }

  if (action === "ops.websitesync.preview" || action === "ops.websitesync.apply") {
    const apply = action.endsWith(".apply");
    const result = await runWebsiteChannelSync({
      guild,
      manual: true,
      previewOnly: !apply || isSimulationModeEnabled()
    });
    return { mode: apply ? "apply" : "preview", simulationMode: isSimulationModeEnabled(), ...result };
  }

  if (action === "ops.textauto.preview" || action === "ops.textauto.apply") {
    const apply = action.endsWith(".apply");
    const result = await runTextChannelAutomation({
      guild,
      manual: true,
      previewOnly: !apply || isSimulationModeEnabled(),
      force: true
    });
    return { mode: apply ? "apply" : "preview", simulationMode: isSimulationModeEnabled(), ...result };
  }

  if (action === "ops.digest.daily" || action === "ops.digest.weekly") {
    const period = action.endsWith(".weekly") ? "weekly" : "daily";
    const digest = buildStaffDigest(period);
    if (logChannelId && !isSimulationModeEnabled()) {
      const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
      if (logChannel && logChannel.isTextBased()) {
        await sendMessageWithGuards(
          logChannel,
          { content: `${digest}\nauto-marker:staff-digest:${period}:${new Date().toISOString().slice(0, 10)}` },
          "website.botcontrol.digest"
        );
      }
    }
    return { period, digest };
  }

  if (action === "ops.syncpanel") {
    const jobs = loadJobs();
    const pendingJobs = jobs.filter((x) => x.status === "pending").length;
    const modState = loadModCallsState();
    const openCases = modState.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled").length;
    const snapshot = {
      generatedAt: new Date().toISOString(),
      deployTag,
      mode: dryRunMode ? "dry-run" : (stagingMode ? "staging" : "live"),
      simulationMode: isSimulationModeEnabled(),
      queue: { pending: pendingJobs, failed: metrics.queueFailed },
      modcalls: { open: openCases, created: metrics.modCallsCreated, closed: metrics.modCallsClosed },
      commands: { total: metrics.commandsTotal, errors: metrics.commandErrors },
      analytics: computeCommandAnalytics(8, 7)
    };
    await adminFetch("/api/admin/content/discord-ops", {
      reqId: `botctrl-syncpanel-${Date.now()}`,
      method: "PUT",
      body: snapshot
    });
    return { synced: true };
  }

  throw new Error(`unsupported_action:${action}`);
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
  if (type === "roleplay") return resolveCachedRoleId("rp");
  const direct = {
    restart: restartAlertRoleId,
    wipe: wipeAlertRoleId,
    raids: raidsAlertRoleId,
    trade: tradeAlertRoleId,
    events: eventsAlertRoleId,
    updates: updatesAlertRoleId,
    story: storyAlertRoleId,
    mods: modsAlertRoleId
  }[type] || "";
  return direct || alertRoleCache[type] || "";
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

function getOptInOptions() {
  return [
    { type: "restart", label: "Restart Alerts", desc: "Get notified before restarts." },
    { type: "wipe", label: "Wipe Alerts", desc: "Major wipe + reset notices." },
    { type: "raids", label: "Raid Alerts", desc: "Scheduled raid windows." },
    { type: "trade", label: "Trade Alerts", desc: "Economy + barter pings." },
    { type: "events", label: "Event Alerts", desc: "Events, contests, and challenges." },
    { type: "updates", label: "Update Alerts", desc: "Patch notes and changes." },
    { type: "story", label: "Story Alerts", desc: "Lore drops + transmissions." },
    { type: "mods", label: "Mods Alerts", desc: "Mod pack changes + warnings." },
    { type: "roleplay", label: "Roleplay Role", desc: "Opt into RP access and role color." }
  ];
}

function buildOptInButtons() {
  const options = getOptInOptions().filter((o) => getOptInRoleId(o.type));
  const rows = [];
  let row = new ActionRowBuilder();
  for (const opt of options) {
    if (row.components.length >= 5) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`roleselect:${opt.type}`)
        .setLabel(opt.label.replace(" Alerts", ""))
        .setStyle(ButtonStyle.Secondary)
    );
  }
  if (row.components.length) rows.push(row);
  return rows.slice(0, 5);
}

function buildStartPanelContent(navLinks) {
  return [
    "🧭 **Start Here • Grey Hour RP**",
    "1. Read the rules and server guide.",
    "2. Pick alert roles for restarts, events, and updates.",
    "3. Opt into the Roleplay role if you want RP access.",
    "4. Use the help wizard or open a private ticket.",
    "5. Check status and transmissions for lore.",
    "",
    `Rules: ${navLinks.rules}`,
    `Website: ${links.site}`,
    "Buttons not working? Use `/rules`, `/links`, `/roleselect`, `/helpwizard`, `/ticket create`."
  ].join("\n");
}

async function respondWithStartPanel(interaction, reqId, wantsPost) {
  const navLinks = { rules: links.rules };
  const content = buildStartPanelContent(navLinks);
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("start:rules").setLabel("Rules").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("start:status").setLabel("Server Status").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("start:help").setLabel("Help Wizard").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("start:roles").setLabel("Alert Roles").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("start:ticket").setLabel("Open Ticket").setStyle(ButtonStyle.Danger)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("start:website").setLabel("Website").setStyle(ButtonStyle.Secondary)
  );
  if (wantsPost) {
    const staff = await requireStaff(interaction, "onboard");
    if (!staff) return;
    await sendMessageWithGuards(interaction.channel, { content, components: [row1, row2] }, "start.panel", reqId);
    await interaction.reply({ content: "Start panel posted.", ephemeral: true });
    return;
  }
  await interaction.reply({ content, components: [row1, row2], ephemeral: true });
}

function resolvePanelChannel(guild, names, fallbackPattern) {
  const direct = findTextChannelByNames(guild, names);
  if (direct) return direct;
  const regex = fallbackPattern ? new RegExp(fallbackPattern, "i") : null;
  if (regex) {
    return guild.channels.cache.find((c) =>
      c &&
      (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
      regex.test(String(c.name || ""))
    ) || null;
  }
  return null;
}

const INFO_CHANNEL_ORDER = [
  "start-here",
  "read-first",
  "rules",
  "announcements",
  "server-status",
  "server-directory",
  "updates",
  "faq",
  "guides",
  "links",
  "welcome",
  "welcome-hub"
];

async function ensureStartHereChannel(guild) {
  if (!guild) return null;
  const infoCategory = await ensureCategoryChannel(guild, "INFORMATION", "Ensure start-here channel");
  if (!infoCategory) return null;
  await guild.channels.fetch().catch(() => null);
  const existing = guild.channels.cache.find((c) =>
    (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
    String(c.name || "").toLowerCase() === "start-here"
  ) || null;
  if (existing) {
    if (existing.parentId !== infoCategory.id && typeof existing.setParent === "function") {
      await existing.setParent(infoCategory.id, { lockPermissions: false }).catch(() => null);
    }
    if (typeof existing.setTopic === "function") {
      await existing.setTopic("Start here for everything Grey Hour RP: rules, status, updates, support, and getting started.", "Start-here polish").catch(() => null);
    }
    return existing;
  }

  const welcomeCandidate = guild.channels.cache.find((c) =>
    (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
    /^(welcome|welcome-hub)$/i.test(String(c.name || ""))
  ) || null;
  if (welcomeCandidate && typeof welcomeCandidate.setName === "function") {
    await welcomeCandidate.setName("start-here", "Rename welcome to start-here").catch(() => null);
    if (welcomeCandidate.parentId !== infoCategory.id && typeof welcomeCandidate.setParent === "function") {
      await welcomeCandidate.setParent(infoCategory.id, { lockPermissions: false }).catch(() => null);
    }
    if (typeof welcomeCandidate.setTopic === "function") {
      await welcomeCandidate.setTopic("Start here for everything Grey Hour RP: rules, status, updates, support, and getting started.", "Start-here polish").catch(() => null);
    }
    return welcomeCandidate;
  }

  return await ensureTextChannelByName(guild, "start-here", {
    parentId: infoCategory.id,
    topic: "Start here for everything Grey Hour RP: rules, status, updates, support, and getting started.",
    reason: "Auto-create start-here channel"
  });
}

async function applyInformationChannelOrder(guild, infoCategoryId) {
  if (!guild || !infoCategoryId) return;
  await guild.channels.fetch().catch(() => null);
  const channels = Array.from(guild.channels.cache.values())
    .filter((c) =>
      (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
      c.parentId === infoCategoryId
    )
    .map((c) => ({ id: c.id, name: String(c.name || "").toLowerCase(), raw: c }));

  if (!channels.length) return;
  const orderIndex = new Map(INFO_CHANNEL_ORDER.map((name, idx) => [name, idx]));
  channels.sort((a, b) => {
    const ai = orderIndex.has(a.name) ? orderIndex.get(a.name) : 999;
    const bi = orderIndex.has(b.name) ? orderIndex.get(b.name) : 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });

  let position = 0;
  for (const row of channels) {
    const channel = row.raw;
    if (!channel || typeof channel.setPosition !== "function") continue;
    try {
      if (channel.rawPosition !== position) {
        await channel.setPosition(position, { reason: "Auto-order INFORMATION channels" });
      }
    } catch {
      // Ignore position failures; permissions can vary.
    }
    position += 1;
  }
}

async function dedupeInformationChannels(guild, infoCategoryId) {
  if (!guild || !infoCategoryId) return { moved: 0, deleted: 0 };
  await guild.channels.fetch().catch(() => null);
  const infoChannels = Array.from(guild.channels.cache.values())
    .filter((c) =>
      (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
      c.parentId === infoCategoryId
    );
  if (!infoChannels.length) return { moved: 0, deleted: 0 };

  const byName = new Map();
  for (const channel of infoChannels) {
    const name = String(channel.name || "").toLowerCase();
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(channel);
  }

  const archiveCategory = await ensureCategoryChannel(guild, "ARCHIVE", "Archive duplicate info channels");
  let moved = 0;
  let deleted = 0;

  for (const [name, list] of byName.entries()) {
    if (list.length <= 1) continue;

    const scored = [];
    for (const channel of list) {
      let lastActivity = channel.createdTimestamp || 0;
      if (channel.messages && typeof channel.messages.fetch === "function") {
        const latest = await channel.messages.fetch({ limit: 1 }).catch(() => null);
        const newest = latest?.first();
        if (newest?.createdTimestamp) lastActivity = newest.createdTimestamp;
      }
      scored.push({ channel, lastActivity });
    }
    scored.sort((a, b) => b.lastActivity - a.lastActivity);
    const keep = scored.shift();
    for (const row of scored) {
      const channel = row.channel;
      if (!channel) continue;
      const hasMessages = row.lastActivity > (channel.createdTimestamp || 0);
      if (!hasMessages && typeof channel.delete === "function") {
        const ok = await channel.delete("Remove duplicate info channel").then(() => true).catch(() => false);
        if (ok) {
          deleted += 1;
          continue;
        }
      }
      if (archiveCategory && typeof channel.setParent === "function") {
        const ok = await channel.setParent(archiveCategory.id, { lockPermissions: false }).then(() => true).catch(() => false);
        if (ok) moved += 1;
      }
      if (typeof channel.setName === "function") {
        await channel.setName(`archive-${name}-dup`.slice(0, 90), "Mark duplicate info channel").catch(() => null);
      }
    }
  }

  return { moved, deleted };
}

async function autoPostPanels(guild) {
  if (!autoPanelEnabled || !guild) return;
  await guild.channels.fetch().catch(() => null);
  const startHere = await ensureStartHereChannel(guild);
  if (startHere?.parentId) {
    await applyInformationChannelOrder(guild, startHere.parentId);
    await dedupeInformationChannels(guild, startHere.parentId);
  }
  const startChannel = resolvePanelChannel(guild, ["start-here", "welcome", "rules"], "(start-here|welcome|rules|read-first)");
  const rolesChannel = resolvePanelChannel(guild, ["roles", "alerts", "role-select"], "(roles|alerts|role-select|opt-in)");
  const helpChannel = resolvePanelChannel(guild, ["help", "support", "questions"], "(help|support|questions|faq)");

  const navLinks = { rules: links.rules };
  const startContent = buildStartPanelContent(navLinks);
  const startRow1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("start:rules").setLabel("Rules").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("start:status").setLabel("Server Status").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("start:help").setLabel("Help Wizard").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("start:roles").setLabel("Alert Roles").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("start:ticket").setLabel("Open Ticket").setStyle(ButtonStyle.Danger)
  );
  const startRow2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("start:website").setLabel("Website").setStyle(ButtonStyle.Secondary)
  );

  const roleRows = buildOptInButtons();
  const rolesContent = [
    "🔔 **Alert + Role Selector**",
    "Pick which notifications you want, plus Roleplay access if you want it.",
    "Buttons not working? Use `/optin type:<restart|wipe|raids|trade|events|updates|story|mods|roleplay>`."
  ].join("\n");

  const helpRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("helpwizard:connect").setLabel("Connection Help").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("helpwizard:mods").setLabel("Mods/Workshop").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("helpwizard:support").setLabel("Open Ticket").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("helpwizard:lore").setLabel("Lore + Story").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("helpwizard:events").setLabel("Events").setStyle(ButtonStyle.Secondary)
  );
  const helpContent = [
    "🧠 **Help Wizard**",
    "Pick a topic for instant tips. If buttons fail, use `/helpwizard topic:<connect|mods|rules|support|lore|events>`."
  ].join("\n");

  if (startChannel) {
    await upsertPinnedInteractiveCard(startChannel, "start-panel", startContent, [startRow1, startRow2], "auto.start.panel");
    await upsertPinnedChannelCard(startChannel, "directory-panel", buildDirectoryPanelContent(), "auto.directory.panel");
  }
  if (rolesChannel && roleRows.length) {
    await upsertPinnedInteractiveCard(rolesChannel, "roles-panel", rolesContent, roleRows, "auto.roles.panel");
  }
  if (helpChannel) {
    await upsertPinnedInteractiveCard(helpChannel, "helpwizard-panel", helpContent, [helpRow], "auto.helpwizard.panel");
  }

  const statusChannel = resolvePanelChannel(guild, ["status", "server-status"], "(status|server-status)");
  if (statusChannel) {
    const status = await adminFetch("/api/admin/content/server-status", { reqId: "panel.status" }).catch(() => null);
    if (status) {
      await upsertPinnedChannelCard(statusChannel, "status-mini", buildStatusMiniPanel(status), "auto.status.panel");
    }
  }
}

function buildHelpWizardResponse(topic) {
  const key = String(topic || "").toLowerCase();
  const tips = {
    "connect": [
      "🔌 **Connection Help**",
      "1. Confirm the server version matches your client.",
      "2. Restart Steam + verify mods.",
      "3. If Workshop mismatch persists, clear the mod cache + rejoin.",
      "Try `/status` and `/playercount` for live info."
    ],
    "mods": [
      "🧩 **Mods & Workshop**",
      "1. Restart the server to pull the latest Workshop updates.",
      "2. Verify you subscribed to the exact mod list.",
      "3. Clear cached Workshop files if mismatch persists.",
      "Try `/mods` to view the active list."
    ],
    "rules": [
      "📜 **Rules & Roleplay**",
      "Read the rules first, then jump into IC chat.",
      "Use OOC channels for meta discussion.",
      "Need clarification? Ask here or open a ticket."
    ],
    "support": [
      "🛠️ **Support**",
      "Use `/ticket create` for private help.",
      "For quick questions, post here with details and screenshots."
    ],
    "lore": [
      "📖 **Lore & Story**",
      "Follow transmissions and story updates for canon info.",
      "Use `/transmissions` and `/lore` to pull the latest posts."
    ],
    "events": [
      "🎯 **Events & Challenges**",
      "Check `/event list` and `/signup join`.",
      "Opt into event alerts with `/roleselect`."
    ]
  };
  const fallback = [
    "Need help?",
    "- `/help` for commands",
    "- `/helpwizard` for guided tips",
    "- `/ticket create` for private support"
  ];
  return (tips[key] || fallback).join("\n");
}

function buildFaqResponse(topic) {
  const key = String(topic || "").toLowerCase();
  const entries = {
    mods: "If you see Workshop mismatch errors: restart the server, verify mods, and clear your Workshop cache if needed.",
    connect: "Can’t connect? Check server status, confirm version matches, and verify mod subscriptions.",
    whitelist: "Whitelist access is handled by staff. Use `/ticket create` with your Steam name + character name.",
    lag: "Lag spikes can happen during peak hours or before restarts. Use `/status` and report persistent lag via `/ticket create`."
  };
  if (entries[key]) return `**FAQ • ${key}**\n${entries[key]}`;
  return "FAQ topics: mods, connect, whitelist, lag. Use `/faq topic:<topic>`.";
}

function buildDirectoryPanelContent() {
  return [
    "📌 **Server Directory**",
    `Website: ${links.site}`,
    `Rules: ${links.rules}`,
    `Server Status: ${links.site}/status`,
    `Updates: ${links.updates}`,
    `Transmissions: ${links.transmissions}`,
    `Join Guide: ${links.join}`,
    "Tip: Use `/start` for the full newcomer flow."
  ].join("\n");
}

function buildStatusMiniPanel(status) {
  const label = String(status?.status || "unknown").toUpperCase();
  const message = status?.message || "No status published.";
  const updated = status?.updatedUtc || status?.updated || status?.dateUtc || "";
  const players = status?.playersOnline ?? status?.players ?? status?.playerCount ?? status?.onlinePlayers ?? null;
  const lines = [
    "🛰️ **Live Server Status**",
    `State: **${label}**`,
    message,
    updated ? `Updated: ${new Date(updated).toUTCString()}` : "",
    typeof players === "number" ? `Players Online: **${players}**` : "",
    "Commands: `/status` • `/playercount`"
  ].filter(Boolean);
  return lines.join("\n");
}

function resolveCachedRoleId(kind) {
  return roleCache[kind] || "";
}

async function ensureRoleByName(guild, name, colorHex) {
  if (!guild || !name) return null;
  await guild.roles.fetch().catch(() => null);
  const target = String(name || "").trim().toLowerCase();
  let role = guild.roles.cache.find((r) => String(r.name || "").trim().toLowerCase() === target) || null;
  if (!role) {
    role = await guild.roles.create({
      name: String(name || "").trim(),
      color: sanitizeHexColor(colorHex) || "#334155",
      reason: "Auto role ensure"
    }).catch(() => null);
  }
  return role;
}

async function ensureDefaultRoles(guild) {
  if (!guild) return { defaultRoleId: "", rpRoleId: "" };
  const defaultRole = await ensureRoleByName(guild, defaultMemberRoleName, defaultMemberRoleColor);
  const rpRole = await ensureRoleByName(guild, rpOptInRoleName, rpOptInRoleColor);
  roleCache.default = defaultRole?.id || "";
  roleCache.rp = rpRole?.id || "";
  await ensureAlertRoles(guild);
  return { defaultRoleId: roleCache.default, rpRoleId: roleCache.rp };
}

async function ensureAlertRoles(guild) {
  if (!guild) return;
  for (const [type, def] of Object.entries(alertRoleDefaults)) {
    const envId = {
      restart: restartAlertRoleId,
      wipe: wipeAlertRoleId,
      raids: raidsAlertRoleId,
      trade: tradeAlertRoleId,
      events: eventsAlertRoleId,
      updates: updatesAlertRoleId,
      story: storyAlertRoleId,
      mods: modsAlertRoleId
    }[type] || "";
    if (envId) {
      alertRoleCache[type] = envId;
      continue;
    }
    const role = await ensureRoleByName(guild, def.name, def.color);
    if (role?.id) alertRoleCache[type] = role.id;
  }
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

function pushWindowAndGetCount(map, key, windowMs, now) {
  const rows = map.get(key) || [];
  const pruned = rows.filter((t) => now - t < windowMs);
  pruned.push(now);
  map.set(key, pruned);
  return pruned.length;
}

function enforceMusicCommandRateLimits(interaction, subcommand) {
  const heavy = ["play", "skip", "stop", "leave", "queue"];
  if (!heavy.includes(String(subcommand || "").toLowerCase())) return 0;
  const now = Date.now();
  const windowMs = musicCommandWindowSeconds * 1000;
  const userKey = `${interaction.user?.id || "unknown"}:${String(subcommand || "").toLowerCase()}`;
  const channelKey = `${interaction.channelId || "unknown"}:${String(subcommand || "").toLowerCase()}`;
  const userCount = pushWindowAndGetCount(musicCommandUserWindow, userKey, windowMs, now);
  const channelCount = pushWindowAndGetCount(musicCommandChannelWindow, channelKey, windowMs, now);
  if (userCount > musicCommandUserMax || channelCount > musicCommandChannelMax) {
    return Math.ceil(windowMs / 1000);
  }
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

async function loadShopsContent() {
  const data = await adminFetch("/api/admin/content/shops", { reqId: "shops.load" });
  return Array.isArray(data) ? data : [];
}

async function saveShopsContent(rows) {
  await adminFetch("/api/admin/content/shops", {
    reqId: "shops.save",
    method: "PUT",
    body: rows
  });
}

async function loadDossiersContent() {
  const data = await adminFetch("/api/admin/content/player-dossiers", { reqId: "dossiers.load" });
  if (!data || typeof data !== "object") return { updatedUtc: new Date().toISOString(), dossiers: [] };
  return {
    updatedUtc: data.updatedUtc || data.updated || new Date().toISOString(),
    notes: Array.isArray(data.notes) ? data.notes : [],
    dossiers: Array.isArray(data.dossiers) ? data.dossiers : []
  };
}

async function saveDossiersContent(payload) {
  await adminFetch("/api/admin/content/player-dossiers", {
    reqId: "dossiers.save",
    method: "PUT",
    body: payload
  });
}

async function loadStoryArcsContent() {
  const data = await adminFetch("/api/admin/content/story-arcs", { reqId: "arcs.load" });
  if (!data || typeof data !== "object") return { updatedUtc: new Date().toISOString(), arcs: [] };
  return {
    updatedUtc: data.updatedUtc || data.updated || new Date().toISOString(),
    notes: Array.isArray(data.notes) ? data.notes : [],
    arcs: Array.isArray(data.arcs) ? data.arcs : []
  };
}

async function loadEventsContent() {
  const data = await adminFetch("/api/admin/content/event-calendar", { reqId: "events.load" });
  if (!data || typeof data !== "object") return { updatedUtc: new Date().toISOString(), events: [] };
  return {
    updatedUtc: data.updatedUtc || data.updated || new Date().toISOString(),
    timezone: data.timezone || "UTC",
    notes: Array.isArray(data.notes) ? data.notes : [],
    events: Array.isArray(data.events) ? data.events : []
  };
}

async function loadEconomyContent() {
  const data = await adminFetch("/api/admin/content/economy-snapshot", { reqId: "economy.load" });
  if (!data || typeof data !== "object") return null;
  return data;
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

function scrubMentions(content) {
  if (!content) return content;
  const cleaned = content.replace(/<@!?&?\d+>/g, "").replace(/\s{2,}/g, " ").trim();
  return cleaned.length ? cleaned : undefined;
}

function isAutomationContext(context) {
  if (!context) return false;
  const c = String(context).toLowerCase();
  return /scheduler|auto|status|transmission|update|mods|arcs|event|economy|ptero|digest|reminder|watch|queue|cron/.test(c);
}

function isAuthorizedMember(member, guildOwnerId) {
  if (!member) return false;
  if (guildOwnerId && member.id === guildOwnerId) return true;
  if (ownerUserIds.includes(member.id)) return true;
  if (member.permissions?.has?.(PermissionsBitField.Flags.Administrator)) return true;
  return hasRole(member, allowedRoleIds) || hasRole(member, ownerRoleIds);
}

function isCodexUser(userId) {
  if (!userId) return false;
  return ownerUserIds.includes(userId) || codexUserIds.includes(userId);
}

function isCodexRoleMember(member, guildOwnerId) {
  if (!member) return false;
  if (guildOwnerId && member.id === guildOwnerId) return true;
  return hasRole(member, ownerRoleIds) || hasRole(member, codexRoleIds);
}

function canUseCodex(interaction, member) {
  if (!interaction || !interaction.user) return false;
  if (isCodexUser(interaction.user.id)) return true;
  const guildOwnerId = interaction.guild?.ownerId || "";
  return isCodexRoleMember(member, guildOwnerId);
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
  console.log(`[diag] Scheduler minutes: status=${autoStatusMinutes}, updates=${autoUpdatesMinutes}, transmissions=${autoTransmissionsMinutes}, mods=${autoModsMinutes}, activity=${autoActivityMinutes}, automation=${autoDiscordAutomationMinutes}, websiteSync=${autoWebsiteChannelSyncMinutes}, textAuto=${autoTextChannelsMinutes}`);
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

async function getGameTelemetry() {
  return adminFetch("/api/admin/game/telemetry");
}

async function getDiscordMetrics() {
  return adminFetch("/api/admin/discord/metrics");
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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

  try {
    const telemetry = await getGameTelemetry();
    const server = telemetry?.server || {};
    const value = toNumber(server.playersOnline);
    if (value !== null) return value;
  } catch {}

  const status = await getServerStatus();
  const value = status.playersOnline ?? status.players ?? status.playerCount ?? status.onlinePlayers ?? null;
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

function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Math.max(0, Number(bytes));
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = value >= 100 ? Math.round(value) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return `${formatted} ${units[unitIndex]}`;
}

function formatDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return "—";
  let seconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(seconds / 86400);
  seconds %= 86400;
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length || seconds) parts.push(`${seconds}s`);
  return parts.join(" ");
}

function percentOf(used, limit) {
  if (used == null || limit == null) return null;
  const limitValue = Number(limit);
  if (!Number.isFinite(limitValue) || limitValue <= 0) return null;
  const usedValue = Number(used);
  if (!Number.isFinite(usedValue)) return null;
  return Math.round((usedValue / limitValue) * 100);
}

async function pteroFetch(pathname) {
  if (!pteroBaseUrl || !pteroAppKey) throw new Error("Pterodactyl API not configured.");
  const url = `${pteroBaseUrl.replace(/\/$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), Math.max(1000, pteroTimeoutMs));
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${pteroAppKey}`,
        Accept: "Application/vnd.pterodactyl.v1+json"
      },
      signal: controller.signal
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`Pterodactyl ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(id);
  }
}

async function pteroClientFetch(pathname, options = {}) {
  if (!pteroClientBaseUrl || !pteroClientKey) throw new Error("Pterodactyl Client API not configured.");
  const url = `${pteroClientBaseUrl.replace(/\/$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), Math.max(1000, pteroTimeoutMs));
  const method = options.method || "GET";
  const headers = {
    Authorization: `Bearer ${pteroClientKey}`,
    Accept: "Application/vnd.pterodactyl.v1+json"
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    if (res.status === 204) return null;
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`Pterodactyl ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(id);
  }
}

async function getPteroServer() {
  if (pteroServerId) {
    return await pteroFetch(`/api/application/servers/${pteroServerId}?include=allocations`);
  }
  if (pteroServerExternalId) {
    const payload = await pteroFetch(`/api/application/servers?filter[external_id]=${encodeURIComponent(pteroServerExternalId)}&include=allocations`);
    const list = Array.isArray(payload?.data) ? payload.data : [];
    return list.length ? list[0] : null;
  }
  throw new Error("Set PTERO_SERVER_ID or PTERO_SERVER_EXTERNAL_ID.");
}

async function getPteroClientResources() {
  if (!pteroClientServerId) throw new Error("Set PTERO_CLIENT_SERVER_ID.");
  return await pteroClientFetch(`/api/client/servers/${pteroClientServerId}/resources`);
}

async function sendPteroPowerSignal(signal) {
  if (!pteroClientServerId) throw new Error("Set PTERO_CLIENT_SERVER_ID.");
  return await pteroClientFetch(`/api/client/servers/${pteroClientServerId}/power`, {
    method: "POST",
    body: { signal }
  });
}

async function getPteroServerDatabases(serverId) {
  if (!serverId) throw new Error("Set PTERO_SERVER_ID for databases endpoint.");
  const payload = await pteroFetch(`/api/application/servers/${serverId}/databases`);
  const list = Array.isArray(payload?.data) ? payload.data : [];
  return list.length;
}

async function getPteroClientWebsocket() {
  if (!pteroClientServerId) throw new Error("Set PTERO_CLIENT_SERVER_ID.");
  const payload = await pteroClientFetch(`/api/client/servers/${pteroClientServerId}/websocket`);
  const data = payload?.data || {};
  if (!data.token || !data.socket) throw new Error("Websocket token unavailable.");
  return { token: data.token, socket: data.socket };
}

async function openPteroConsoleStream({ channel, durationMs, requesterId, reqId }) {
  if (!channel || !channel.isTextBased()) return "invalid-channel";
  if (activePteroConsoleStreams.has(channel.id)) return "already-running";

  const WebSocketCtor = globalThis.WebSocket;
  if (!WebSocketCtor) throw new Error("WebSocket not available in this Node runtime.");

  const { token, socket } = await getPteroClientWebsocket();
  const ws = new WebSocketCtor(socket);
  const startedAt = Date.now();
  const maxLines = Math.max(10, Math.min(Number(pteroConsoleMaxLines || 80), 240));
  const flushMs = Math.max(500, Number(pteroConsoleFlushMs || 2000));
  const state = {
    ws,
    buffer: [],
    lines: 0,
    closed: false,
    intervalId: null,
    timeoutId: null
  };
  activePteroConsoleStreams.set(channel.id, state);

  const flush = async () => {
    if (!state.buffer.length) return;
    const payload = state.buffer.splice(0, state.buffer.length).join("\n");
    await sendMessageWithGuards(
      channel,
      { content: truncate(payload, 1800), allowedMentions: { parse: [] } },
      "ptero.console",
      reqId
    );
  };

  const stop = async (reason) => {
    if (state.closed) return;
    state.closed = true;
    clearInterval(state.intervalId);
    clearTimeout(state.timeoutId);
    activePteroConsoleStreams.delete(channel.id);
    try {
      ws.close();
    } catch {}
    if (state.buffer.length) {
      await flush();
    }
    await sendMessageWithGuards(
      channel,
      {
        content: `Console stream ended (${reason}). Duration: ${formatDurationMs(Date.now() - startedAt)}.`,
        allowedMentions: { parse: [] }
      },
      "ptero.console",
      reqId
    );
  };

  state.intervalId = setInterval(flush, flushMs);
  state.timeoutId = setTimeout(() => stop("timeout"), durationMs);

  ws.addEventListener("open", async () => {
    const authPayload = JSON.stringify({ event: "auth", args: [token] });
    ws.send(authPayload);
    ws.send(JSON.stringify({ event: "send logs", args: [] }));
    await sendMessageWithGuards(
      channel,
      {
        content: `Live console stream started by <@${requesterId}> for ${Math.round(durationMs / 60000)} minute(s).`,
        allowedMentions: { parse: [] }
      },
      "ptero.console",
      reqId
    );
  });

  ws.addEventListener("message", (event) => {
    if (state.closed) return;
    const raw = typeof event.data === "string"
      ? event.data
      : typeof event.data?.toString === "function"
        ? event.data.toString("utf-8")
        : "";
    if (!raw) return;
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const name = String(payload.event || "");
    if (name !== "console output" && name !== "daemon message" && name !== "install output") return;
    const args = Array.isArray(payload.args) ? payload.args : [];
    for (const line of args) {
      if (!line) continue;
      state.buffer.push(String(line).trim());
      state.lines += 1;
      if (state.lines >= maxLines) {
        stop("line limit reached");
        break;
      }
    }
  });

  ws.addEventListener("close", () => {
    if (!state.closed) stop("socket closed");
  });

  ws.addEventListener("error", () => {
    if (!state.closed) stop("socket error");
  });

  return "started";
}

function renderMemberTemplate(template, member, mode = "join") {
  const fallbackUser = mode === "join" ? `<@${member?.id || ""}>` : (member?.user?.username || "Survivor");
  const map = {
    "{user}": fallbackUser,
    "{mention}": member?.id ? `<@${member.id}>` : fallbackUser,
    "{username}": member?.user?.username || "Survivor",
    "{server}": member?.guild?.name || "Grey Hour RP"
  };
  let out = String(template || "").trim();
  for (const [key, value] of Object.entries(map)) {
    out = out.split(key).join(value);
  }
  return truncate(out || fallbackUser, 1900);
}

let gptOverridesCache = { overrides: {} };
let gptOverridesLoadedAt = 0;

function getGptOverridesCached() {
  const now = Date.now();
  if (now - gptOverridesLoadedAt > 5000) {
    gptOverridesCache = loadGptChannelOverrides();
    gptOverridesLoadedAt = now;
  }
  return gptOverridesCache;
}

function isHelpChannel(channel) {
  const name = String(channel?.name || "");
  const parentName = String(channel?.parent?.name || "");
  const pattern = /(help|support|questions?|ticket|newbie|onboarding|assist|faq|how-to)/i;
  return pattern.test(name) || pattern.test(parentName);
}

function isStaffChannel(channel) {
  const name = String(channel?.name || "");
  const parentName = String(channel?.parent?.name || "");
  const pattern = /(mod|admin|staff|ops|owner|lead|security|control)/i;
  return pattern.test(name) || pattern.test(parentName);
}

function isRoleplayChannel(channel) {
  const name = String(channel?.name || "");
  const parentName = String(channel?.parent?.name || "");
  const pattern = /(ic-chat|in-character|roleplay|role-play|rp|scene|tavern|story|character|loreplay)/i;
  return pattern.test(name) || pattern.test(parentName);
}

function findOocChannel(guild) {
  if (!guild) return null;
  const names = ["ooc", "ooc-chat", "out-of-character", "out-of-char", "general-chat", "community-chat"];
  const found = findTextChannelByNames(guild, names);
  if (found) return found;
  const regex = /(ooc|out-of-character|out-of-char)/i;
  return guild.channels.cache.find((c) =>
    c &&
    (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
    regex.test(String(c.name || ""))
  ) || null;
}

function findHelpFaqResponse(content) {
  const text = String(content || "").toLowerCase();
  const entries = [
    { pattern: /(workshop|mod).*(version|mismatch|different|out of date)/i, reply: "Workshop mismatch detected. Restart the server, then verify subscribed mods. If it persists, clear your Workshop cache and rejoin." },
    { pattern: /(can'?t|cannot|unable to).*(connect|join|load|login)/i, reply: "If you can't connect: confirm the server is online, verify mods, and make sure your game version matches the server." },
    { pattern: /(crash|crashing|error).*(join|load|server)/i, reply: "If you're crashing on join, try validating files and disabling recently added mods to isolate the issue." },
    { pattern: /(latency|ping|lag|rubberband)/i, reply: "High lag? Check if a restart is scheduled. If it continues, open a ticket with your location and time of issue." },
    { pattern: /(whitelist|whitelisting|access|invite)/i, reply: "Whitelist requests go through staff. Open a ticket with your Steam name + character name." },
    { pattern: /(how do i|how to).*(ticket|support)/i, reply: "Use `/ticket create` to open a private support channel." }
  ];
  const hit = entries.find((e) => e.pattern.test(text));
  return hit ? hit.reply : "";
}

function shouldSendHelpFaq(guildId, channelId, userId) {
  const key = `${guildId}:${channelId}:${userId}`;
  const now = Date.now();
  const until = helpFaqCooldowns.get(key) || 0;
  if (until > now) return false;
  helpFaqCooldowns.set(key, now + helpFaqCooldownMs);
  return true;
}

function shouldSendRpReminder(guildId, channelId, userId) {
  const key = `${guildId}:${channelId}:${userId}`;
  const now = Date.now();
  const until = rpReminderCooldowns.get(key) || 0;
  if (until > now) return false;
  rpReminderCooldowns.set(key, now + rpReminderCooldownMs);
  return true;
}

async function handleAutoSlowmode(channel) {
  if (!autoSlowmodeEnabled || !channel || !channel.isTextBased?.()) return;
  if (isStaffChannel(channel)) return;
  if (isRoleplayChannel(channel)) return;
  if (channel.rateLimitPerUser && channel.rateLimitPerUser > 0) return;
  const now = Date.now();
  const key = String(channel.id);
  const cooldownUntil = slowmodeCooldowns.get(key) || 0;
  if (cooldownUntil > now) return;
  const window = slowmodeWindow.get(key) || [];
  const next = window.filter((t) => now - t < autoSlowmodeWindowMs);
  next.push(now);
  slowmodeWindow.set(key, next);
  if (next.length < autoSlowmodeThreshold) return;
  slowmodeCooldowns.set(key, now + autoSlowmodeCooldownMs);
  await channel.setRateLimitPerUser(autoSlowmodeDurationSeconds, "Auto slowmode: high activity").catch(() => null);
  setTimeout(() => {
    channel.setRateLimitPerUser(0, "Auto slowmode cleared").catch(() => null);
  }, Math.max(10, autoSlowmodeCooldownMs / 2));
}

function getGptChannelOverride(channelId) {
  if (!channelId) return "";
  const { overrides } = getGptOverridesCached();
  const value = overrides[String(channelId)] || "";
  if (value === "enable" || value === "disable" || value === "nomention") return value;
  return "";
}

function isGptAllowedChannel(channel) {
  if (!channel || !channel.isTextBased || !channel.isTextBased()) return { allowed: false, help: false, staff: false, override: "" };
  const override = getGptChannelOverride(channel.id);
  if (override === "disable") return { allowed: false, help: false, staff: false, override };
  if (override === "enable" || override === "nomention") return { allowed: true, help: false, staff: false, override };
  if (isRoleplayChannel(channel)) return { allowed: false, help: false, staff: false, override: "" };
  const help = isHelpChannel(channel);
  const staff = isStaffChannel(channel);
  return { allowed: help || staff, help, staff, override: "" };
}

function checkGptCooldown(map, key, cooldownMs) {
  const now = Date.now();
  const last = map.get(key) || 0;
  if (now - last < cooldownMs) return Math.ceil((cooldownMs - (now - last)) / 1000);
  map.set(key, now);
  return 0;
}

async function setChannelLockStatus(channel, mode) {
  if (!channel || !channel.guild) return false;
  const everyoneId = channel.guild.id;
  const overwrites = channel.permissionOverwrites;
  if (!overwrites) return false;
  const existing = overwrites.cache.get(everyoneId);
  const denySend = PermissionsBitField.Flags.SendMessages;
  if (mode === "lock") {
    await overwrites.edit(everyoneId, { SendMessages: false }, { reason: "Channel locked by /channelmode" }).catch(() => null);
  } else if (mode === "unlock") {
    if (existing) {
      const next = existing.deny.has(denySend) || existing.allow.has(denySend)
        ? { SendMessages: null }
        : {};
      await overwrites.edit(everyoneId, next, { reason: "Channel unlocked by /channelmode" }).catch(() => null);
    }
  }
  return true;
}

async function cleanupUserSpam(channel, userId, limit = 20) {
  try {
    if (!channel || !channel.isTextBased || !channel.isTextBased()) return 0;
    const fetched = await channel.messages.fetch({ limit: Math.max(1, Math.min(100, limit)) }).catch(() => null);
    if (!fetched) return 0;
    const toDelete = fetched.filter((m) => m.author?.id === userId);
    if (!toDelete.size) return 0;
    if (typeof channel.bulkDelete === "function") {
      await channel.bulkDelete(toDelete, true).catch(() => null);
      return toDelete.size;
    }
    for (const msg of toDelete.values()) {
      await msg.delete().catch(() => null);
    }
    return toDelete.size;
  } catch {
    return 0;
  }
}

function isSpamPattern(message) {
  if (!message || !message.author || !message.guild) return false;
  const now = Date.now();
  const key = `${message.guild.id}:${message.author.id}`;
  const windowArr = spamWindow.get(key) || [];
  const nextWindow = windowArr.filter((t) => now - t < spamWindowMs);
  nextWindow.push(now);
  spamWindow.set(key, nextWindow);
  if (nextWindow.length >= spamThreshold) return true;

  const content = String(message.content || "").trim();
  if (!content) return false;
  const repeat = spamRepeatState.get(key) || { content: "", count: 0, lastAt: 0 };
  if (repeat.content === content && now - repeat.lastAt < spamRepeatWindowMs) {
    repeat.count += 1;
  } else {
    repeat.content = content;
    repeat.count = 1;
  }
  repeat.lastAt = now;
  spamRepeatState.set(key, repeat);
  return repeat.count >= spamRepeatThreshold;
}

async function postSpamAlert(message, reason) {
  const channel = modCallChannelId ? await client.channels.fetch(modCallChannelId).catch(() => null) : null;
  const target = channel && channel.isTextBased() ? channel : message.channel;
  if (!target || !target.isTextBased()) return;
  const payload = [
    `🚨 **Spam detected**`,
    `User: <@${message.author.id}>`,
    `Channel: <#${message.channelId}>`,
    reason ? `Reason: ${reason}` : null,
    `Message: ${truncate(message.content || "", 180)}`
  ].filter(Boolean).join("\n");
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`spamaction:warn:${message.author.id}:${message.channelId}`).setLabel("Warn").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`spamaction:timeout10:${message.author.id}:${message.channelId}`).setLabel("Timeout 10m").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`spamaction:timeout60:${message.author.id}:${message.channelId}`).setLabel("Timeout 1h").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`spamaction:delete:${message.author.id}:${message.channelId}`).setLabel("Clear Recent").setStyle(ButtonStyle.Danger)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`spamaction:kick:${message.author.id}:${message.channelId}`).setLabel("Kick").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`spamaction:ban:${message.author.id}:${message.channelId}`).setLabel("Ban").setStyle(ButtonStyle.Danger)
  );
  await sendMessageWithGuards(target, { content: payload, components: [row, row2] }, "spam.alert");
}

function extractOpenAiText(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  if (Array.isArray(payload.output)) {
    for (const chunk of payload.output) {
      if (!chunk || !Array.isArray(chunk.content)) continue;
      const text = chunk.content.map((c) => c?.text || c?.content || "").join("");
      if (text.trim()) return text.trim();
    }
  }
  return "";
}

async function requestGptReply(prompt, userText) {
  if (!openAiKey || !isCodexEnabled()) {
    return "GreyHour Assistant is offline right now. Ask staff to enable it.";
  }

  const buildBody = (contentType) => ({
    model: gptModel,
    input: [
      { role: "system", content: [{ type: contentType, text: gptSystemPrompt }] },
      { role: "user", content: [{ type: contentType, text: `${prompt}\n\nUser: ${userText}`.trim() }] }
    ],
    max_output_tokens: gptMaxOutputTokens
  });

  const callOpenAi = async (contentType) => {
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openAiKey}`
        },
        body: JSON.stringify(buildBody(contentType))
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        return { ok: false, status: res.status, errText };
      }
      const payload = await res.json().catch(() => ({}));
      return { ok: true, payload };
    } catch (err) {
      return { ok: false, status: 0, errText: String(err?.message || err) };
    }
  };

  const attempt = async (contentType, label) => {
    const result = await callOpenAi(contentType);
    if (result.ok) return result;
    logEvent("warn", "gpt.request.failed", {
      status: result.status,
      body: (result.errText || "").slice(0, 500),
      attempt: label
    });
    return result;
  };

  let result = await attempt("input_text", "primary");

  if (!result.ok && (result.status === 429 || (result.status >= 500 && result.status <= 599))) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    result = await attempt("input_text", "retry");
  }

  if (!result.ok) {
    const errText = result.errText || "";
    const looksLikeTypeError = errText.includes("content[0].type") && errText.includes("Invalid value");
    if (looksLikeTypeError) {
      const fallback = await attempt("text", "fallback");
      if (fallback.ok) result = fallback;
    }
  }

  if (!result.ok) {
    recordGptFailure({ status: result.status, errText: result.errText || "" });
    return "GreyHour Assistant is unavailable right now. Try again shortly.";
  }

  const text = extractOpenAiText(result.payload);
  return text || "GreyHour Assistant is thinking through that. Try rephrasing your question.";
}

function sanitizeHexColor(input) {
  const raw = String(input || "").trim();
  const match = raw.match(/^#?[0-9a-fA-F]{6}$/);
  if (!match) return "";
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  return `#${hex.toLowerCase()}`;
}

function normalizeGroupName(name) {
  return String(name || "").replace(/\s+/g, " ").trim();
}

function groupKey(name) {
  return normalizeGroupName(name).toLowerCase();
}

function groupTypeLabel(type) {
  return type === "shop" ? "Shop" : "Faction";
}

function calcLevelFromXp(xp) {
  const safeXp = Math.max(0, Number(xp || 0));
  let level = 0;
  let needed = 100;
  let total = 0;
  while (safeXp >= total + needed) {
    total += needed;
    level += 1;
    needed = 100 + level * 50;
  }
  return { level, nextLevelAt: total + needed, totalForLevel: total };
}

function awardXp(levels, userId, amount) {
  const users = levels.users;
  const entry = users[userId] || { xp: 0, level: 0, lastMsgAt: 0, lastVoiceAt: 0 };
  entry.xp = Math.max(0, (entry.xp || 0) + amount);
  const before = entry.level || 0;
  const calc = calcLevelFromXp(entry.xp);
  entry.level = calc.level;
  users[userId] = entry;
  return { before, after: entry.level, entry, calc };
}

async function resolveLevelUpChannel(guild) {
  if (levelUpChannelId) {
    const direct = await client.channels.fetch(levelUpChannelId).catch(() => null);
    if (direct && direct.isTextBased()) return direct;
  }
  await guild.channels.fetch().catch(() => null);
  const names = ["level-ups", "levelup", "levels", "rank-ups"];
  return findTextChannelByNames(guild, names);
}

function getAdminRoleIdsFromPolicy() {
  const policy = loadPermissionPolicy();
  const ids = new Set();
  const groups = ["owner", "admin", "ops", "mod"];
  for (const group of groups) {
    const list = Array.isArray(policy?.commandRoleIds?.[group]) ? policy.commandRoleIds[group] : [];
    for (const id of list) if (id) ids.add(id);
  }
  return Array.from(ids);
}

async function ensureGroupRequestChannel(guild) {
  if (groupRequestChannelId) {
    const direct = await guild.channels.fetch(groupRequestChannelId).catch(() => null);
    if (direct && direct.isTextBased()) return direct;
  }
  await guild.channels.fetch().catch(() => null);
  const found = findTextChannelByNames(guild, ["faction-requests", "group-requests", "shop-requests"]);
  if (found) return found;
  const parent = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && /support|services|community|information/i.test(String(c.name || ""))) || null;
  const channel = await createGuildChannelWithApproval(guild, {
    name: "faction-requests",
    type: ChannelType.GuildText,
    parent: parent?.id,
    topic: "Request faction/shop roles here via /group request. Admin approval required.",
    permissionOverwrites: [
      { id: guild.id, allow: PermissionsBitField.Flags.UseApplicationCommands, deny: PermissionsBitField.Flags.SendMessages }
    ],
    reason: "Group requests channel"
  }).catch(() => null);
  if (channel) {
    await sendMessageWithGuards(channel, {
      content: "**Channel Guide**\nUse `/group request` to request a new faction or shop. Admin approval is required. Chat is locked to keep requests tidy."
    }, "group.request.guide");
  }
  return channel;
}

async function syncGroupRegistryToWebsite(registry) {
  if (!apiBase) return;
  try {
    await adminFetch("/api/admin/content/group-registry", {
      method: "PUT",
      body: {
        updatedUtc: new Date().toISOString(),
        groups: registry.groups || []
      },
      reqId: "group-registry.sync"
    });
  } catch (err) {
    logEvent("warn", "group.registry.sync.failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

async function syncGroupRequestsToWebsite(requests) {
  if (!apiBase) return;
  try {
    await adminFetch("/api/admin/content/group-requests", {
      method: "PUT",
      body: {
        updatedUtc: new Date().toISOString(),
        requests: requests.requests || []
      },
      reqId: "group-requests.sync"
    });
  } catch (err) {
    logEvent("warn", "group.requests.sync.failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

async function syncGroupRequestLogsToWebsite(logs) {
  if (!apiBase) return;
  try {
    await adminFetch("/api/admin/content/group-request-logs", {
      method: "PUT",
      body: {
        updatedUtc: new Date().toISOString(),
        entries: logs.entries || []
      },
      reqId: "group-request-logs.sync"
    });
  } catch (err) {
    logEvent("warn", "group.request.logs.sync.failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

async function syncLevelBoardToWebsite(levels) {
  if (!apiBase) return;
  try {
    const entries = Object.entries(levels.users || {})
      .map(([userId, row]) => ({ userId, xp: row.xp || 0, level: row.level || 0 }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 50);
    await adminFetch("/api/admin/content/level-board", {
      method: "PUT",
      body: {
        updatedUtc: new Date().toISOString(),
        entries
      },
      reqId: "level-board.sync"
    });
  } catch (err) {
    logEvent("warn", "level.board.sync.failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

function slugifyChannelName(name) {
  return normalizeChannelName(String(name || ""));
}

function findGroupByChannel(registry, channelId) {
  return registry.groups.find((g) => g.textChannelId === channelId || g.voiceChannelId === channelId) || null;
}

function findGroupsForMember(registry, member) {
  if (!member) return [];
  const roleIds = new Set(member.roles.cache.map((r) => r.id));
  return registry.groups.filter((g) => g.roleId && roleIds.has(g.roleId));
}

function canManageGroup(member, group) {
  if (!member || !group) return false;
  if (group.ownerId === member.id) return true;
  return hasPolicyAccess(member, "ops") || hasPolicyAccess(member, "mod");
}

async function resolveGroupContext(interaction, registry) {
  const channelId = interaction.channelId || "";
  const channelGroup = channelId ? findGroupByChannel(registry, channelId) : null;
  if (channelGroup) return channelGroup;
  if (!interaction.inGuild() || !interaction.guild) return null;
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return null;
  const groups = findGroupsForMember(registry, member);
  if (groups.length === 1) return groups[0];
  return null;
}

async function createGroupResources(guild, request) {
  const adminRoles = getAdminRoleIdsFromPolicy();
  const groupName = request.name;
  const colorHex = sanitizeHexColor(request.color) || "#7f1d1d";
  const type = request.type === "shop" ? "shop" : "faction";
  const baseName = type === "shop" ? `shop-${slugifyChannelName(groupName)}` : `faction-${slugifyChannelName(groupName)}`;

  const categoryName = type === "shop" ? "SERVICES" : "FACTIONS";
  let category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && String(c.name).toUpperCase() === categoryName) || null;
  if (!category) {
    category = await createGuildChannelWithApproval(guild, {
      name: categoryName,
      type: ChannelType.GuildCategory,
      reason: `${categoryName} category for groups`
    }).catch(() => null);
  }

  const role = await guild.roles.create({
    name: groupName,
    color: colorHex,
    reason: `${groupTypeLabel(type)} group approved`
  }).catch(() => null);
  if (!role) throw new Error("Failed to create role.");

  const overwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: role.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] }
  ];
  for (const roleId of adminRoles) {
    overwrites.push({ id: roleId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] });
  }

  const textChannel = await createGuildChannelWithApproval(guild, {
    name: baseName,
    type: ChannelType.GuildText,
    parent: category?.id,
    topic: `${groupTypeLabel(type)} private channel for ${groupName}.`,
    permissionOverwrites: overwrites,
    reason: `${groupTypeLabel(type)} group approved`
  }).catch(() => null);

  const voiceChannel = await createGuildChannelWithApproval(guild, {
    name: `${groupName} Voice`,
    type: ChannelType.GuildVoice,
    parent: category?.id,
    permissionOverwrites: overwrites,
    reason: `${groupTypeLabel(type)} group approved`
  }).catch(() => null);

  return { role, textChannel, voiceChannel };
}

async function pruneMissingGroups(guild) {
  const registry = loadGroupRegistry();
  let changed = false;
  const remaining = [];
  for (const group of registry.groups) {
    const roleOk = group.roleId ? guild.roles.cache.has(group.roleId) : false;
    const textOk = group.textChannelId ? guild.channels.cache.has(group.textChannelId) : false;
    const voiceOk = group.voiceChannelId ? guild.channels.cache.has(group.voiceChannelId) : false;
    if (!roleOk || !textOk || !voiceOk) {
      changed = true;
      continue;
    }
    remaining.push(group);
  }
  if (changed) {
    registry.groups = remaining;
    registry.updatedUtc = new Date().toISOString();
    saveGroupRegistry(registry);
    await syncGroupRegistryToWebsite(registry);
  }
}

function previewFromBody(lines) {
  if (!Array.isArray(lines)) return "";
  const combined = lines.slice(0, 3).join("\n");
  return truncate(combined, 700);
}

function bodyToText(body) {
  if (!body) return "";
  if (typeof body === "string") return body.trim();
  if (Array.isArray(body)) return body.map((x) => String(x || "").trim()).filter(Boolean).join("\n\n");
  if (typeof body === "object") {
    if (Array.isArray(body.lines)) return body.lines.map((x) => String(x || "").trim()).filter(Boolean).join("\n\n");
    if (Array.isArray(body.blocks)) {
      return body.blocks
        .map((b) => {
          if (typeof b === "string") return b.trim();
          if (b && typeof b === "object") return String(b.text || b.content || "").trim();
          return "";
        })
        .filter(Boolean)
        .join("\n\n");
    }
    return String(body.text || body.content || "").trim();
  }
  return "";
}

function splitDiscordChunks(text, maxLen = 1800, maxChunks = 16) {
  const src = String(text || "").trim();
  if (!src) return [];
  const blocks = src.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const out = [];
  let current = "";
  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current) out.push(current);
    if (block.length <= maxLen) {
      current = block;
    } else {
      let i = 0;
      while (i < block.length) {
        out.push(block.slice(i, i + maxLen));
        i += maxLen;
        if (out.length >= maxChunks) return out.slice(0, maxChunks);
      }
      current = "";
    }
    if (out.length >= maxChunks) return out.slice(0, maxChunks);
  }
  if (current && out.length < maxChunks) out.push(current);
  return out.slice(0, maxChunks);
}

async function postFullStoryToChannels(kind, item, channelIds, reqId = "") {
  const targets = Array.from(new Set(channelIds.filter(Boolean)));
  if (!targets.length || !item) return { sent: 0 };
  const text = bodyToText(item.body);
  if (!text) return { sent: 0 };
  const chunks = splitDiscordChunks(text, 1800, 16);
  if (!chunks.length) return { sent: 0 };

  let sent = 0;
  const kindTitle = kind === "transmission" ? "Transmission" : "Story Update";
  const readMore = kind === "transmission" ? links.transmissions : links.updates;

  for (const channelId of targets) {
    enqueueJob({
      type: `${kind}-full-header`,
      channelId,
      idempotencyKey: `${kind}:full:${item.id}:header:${channelId}`,
      embeds: [
        new EmbedBuilder()
          .setTitle(`${kindTitle}: ${truncate(item.title || "Untitled", 240)}`)
          .setDescription(`Full story sync from website content feed.\nRead more: ${readMore}`)
          .addFields(
            { name: "Date", value: item.date || "Unknown", inline: true },
            { name: "Source", value: readMore, inline: true }
          )
          .setColor(0xb10f16)
      ],
      maxRetries: 6
    });

    for (let i = 0; i < chunks.length; i += 1) {
      const part = i + 1;
      enqueueJob({
        type: `${kind}-full-part`,
        channelId,
        idempotencyKey: `${kind}:full:${item.id}:part:${part}:${channelId}`,
        content: `**${kindTitle} • Part ${part}/${chunks.length}**\n${chunks[i]}`,
        maxRetries: 6
      });
    }
    sent += 1;
  }

  logEvent("info", "story.full.dispatched", {
    reqId,
    kind,
    itemId: item.id,
    channels: targets.length,
    parts: chunks.length
  });
  return { sent };
}

function ticketRouteForCategory(category) {
  const key = String(category || "").toLowerCase();
  if (key === "cheating") return { channelId: ticketRouteCheatingChannelId, roleId: ticketRouteCheatingRoleId, label: "Cheating" };
  if (key === "harassment") return { channelId: ticketRouteHarassmentChannelId, roleId: ticketRouteHarassmentRoleId, label: "Harassment" };
  if (key === "spam") return { channelId: ticketRouteSpamChannelId, roleId: ticketRouteSpamRoleId, label: "Spam" };
  if (key === "billing") return { channelId: ticketRouteBillingChannelId, roleId: ticketRouteBillingRoleId, label: "Billing" };
  return { channelId: "", roleId: "", label: "General" };
}

function isMajorWebsitePost(item) {
  const title = String(item?.title || "").toLowerCase();
  const body = bodyToText(item?.body).toLowerCase();
  return /(wipe|incident|downtime|maintenance|critical|launch|season|chapter|event)/i.test(`${title}\n${body}`);
}

async function upsertDiscussionThreadForPost(kind, item, channel, reqId = "") {
  if (!item || !channel || !channel.isTextBased()) return false;
  if (!isMajorWebsitePost(item)) return false;

  const marker = `discussion:${kind}:${item.id}`;
  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const existing = recent?.find((m) => m.author?.id === client.user?.id && String(m.content || "").includes(marker)) || null;
  if (existing) return true;

  const root = await sendMessageWithGuards(channel, {
    content: [
      `🧵 Discussion Thread • ${kind === "transmission" ? "Transmission" : "Update"}: **${truncate(item.title || "Untitled", 120)}**`,
      "Use this thread for reactions, theories, and staff Q&A.",
      marker
    ].join("\n")
  }, "website.discussion.root", reqId);
  if (!root) return false;

  const threadName = `${kind}-${normalizeChannelName(item.title || item.id || "discussion")}`.slice(0, 95);
  await root.startThread({
    name: threadName,
    autoArchiveDuration: 1440,
    reason: `Auto discussion thread for ${kind} ${item.id}`
  }).catch(() => null);
  return true;
}

const client = new Client({
  // Default: prevent pings (user/role/everyone/here) even if message content includes mention syntax.
  allowedMentions: { parse: [] },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

async function refreshGuildMembers() {
  try {
    const guild = (client.guilds.cache.get(process.env.DISCORD_GUILD_ID || "") || client.guilds.cache.first() || null);
    if (!guild) return;
    await guild.members.fetch({ withPresences: false }).catch(() => null);
  } catch {}
}

client.once("clientReady", async () => {
  logEvent("info", "discord.ready", { userTag: client.user?.tag || "unknown" });
  if (client.user) {
    client.user.setPresence({
      activities: [{ name: `${botActivity} [${deployTag}]`.slice(0, 120) }],
      status: "online"
    });
  }
  try {
    const guild = (client.guilds.cache.get(process.env.DISCORD_GUILD_ID || "") || client.guilds.cache.first() || null);
    if (guild) {
      guild.roles.fetch().catch(() => null);
      resolveAutoRoleIds(guild);
      ensureDefaultRoles(guild).catch(() => null);
      ensureGroupRequestChannel(guild).catch(() => null);
      pruneMissingGroups(guild).catch(() => null);
      if (!restrictAutomation) {
        autoPostPanels(guild).catch(() => null);
        runTextChannelAutomation({
          guild,
          manual: true,
          force: true,
          maxChannels: 9999
        }).catch(() => null);
      }
      await autoVerifyExistingMembers(guild);
    }
  } catch {}
  refreshGuildMembers();
  restoreMusicSessionsOnStartup().catch((err) => {
    logEvent("warn", "music.restore.failed", { error: truncate(String(err?.message || err), 220) });
  });
  resolveHealthyMusicToolSpecs(true).catch((err) => {
    logEvent("warn", "music.tool.probe.failed", { error: truncate(String(err?.message || err), 220) });
  });
  if (musicToolAutohealEnabled) {
    setInterval(() => {
      resolveHealthyMusicToolSpecs(true).catch((err) => {
        logEvent("warn", "music.tool.autoheal.failed", { error: truncate(String(err?.message || err), 220) });
      });
    }, musicToolHealthIntervalMinutes * 60 * 1000);
  }
  setInterval(refreshGuildMembers, 30 * 60 * 1000);
  startMetricsServer();
  runStartupDiagnostics().catch((err) => {
    logEvent("error", "diag.startup.failed", { error: err instanceof Error ? err.message : String(err) });
  });
  bootstrapChannelProfiles().catch((err) => {
    logEvent("warn", "channel.profiles.bootstrap.failed", { error: err instanceof Error ? err.message : String(err) });
  });
  (async () => {
    try {
      const guild = (client.guilds.cache.get(process.env.DISCORD_GUILD_ID || "") || client.guilds.cache.first() || null);
      if (!guild) return;
      await guild.channels.fetch().catch(() => null);
      const { modes } = loadChannelModes();
      for (const [channelId, mode] of Object.entries(modes || {})) {
        if (mode !== "lock") continue;
        const channel = guild.channels.cache.get(channelId);
        if (channel && channel.isTextBased()) {
          await setChannelLockStatus(channel, "lock");
        }
      }
    } catch (err) {
      logEvent("warn", "channel.modes.apply.failed", { error: err instanceof Error ? err.message : String(err) });
    }
  })();
  safeScheduler(processPendingJobs);
  setInterval(() => safeScheduler(processPendingJobs), Math.max(1, jobWorkerIntervalSeconds) * 1000);
  setInterval(cleanupAbuseWindows, Math.max(10, abuseWindowSeconds) * 1000);
  setInterval(async () => {
    try {
      const guild = (client.guilds.cache.get(process.env.DISCORD_GUILD_ID || "") || client.guilds.cache.first() || null);
      if (guild) await pruneMissingGroups(guild);
      await syncGroupRegistryToWebsite(loadGroupRegistry());
      await syncGroupRequestsToWebsite(loadGroupRequests());
      await syncGroupRequestLogsToWebsite(loadGroupRequestLogs());
      await syncLevelBoardToWebsite(loadLevels());
    } catch {}
  }, 10 * 60 * 1000);
  startSchedulers();
});

client.on("error", (err) => {
  logEvent("error", "discord.client.error", { error: err instanceof Error ? err.message : String(err) });
});

client.on("warn", (message) => {
  logEvent("warn", "discord.client.warn", { message: truncate(String(message), 300) });
});

async function resolveWelcomeChannel(member) {
  if (welcomeChannelId) {
    const direct = await client.channels.fetch(welcomeChannelId).catch(() => null);
    if (direct && direct.isTextBased()) return direct;
  }
  const guild = member?.guild || (client.guilds.cache.get(process.env.DISCORD_GUILD_ID || "") || null);
  if (!guild) return null;
  await guild.channels.fetch().catch(() => null);
  const names = ["welcome", "welcome-hub", "introductions", "start-here", "new-here", "arrivals", "check-in", "onboarding"];
  let found = findTextChannelByNames(guild, names);
  if (found) return found;
  const regex = /(welcome|introductions?|start-here|new-here|arrivals?|onboarding|check-in)/i;
  found = guild.channels.cache.find((c) =>
    c &&
    (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
    regex.test(String(c.name || ""))
  ) || null;
  return found;
}

async function resolveDepartureChannel(member) {
  if (departureChannelId) {
    const direct = await client.channels.fetch(departureChannelId).catch(() => null);
    if (direct && direct.isTextBased()) return direct;
  }
  if (goodbyeChannelId) {
    const direct = await client.channels.fetch(goodbyeChannelId).catch(() => null);
    if (direct && direct.isTextBased()) return direct;
  }
  const guild = member?.guild || (client.guilds.cache.get(process.env.DISCORD_GUILD_ID || "") || null);
  if (!guild) return null;
  await guild.channels.fetch().catch(() => null);
  const names = ["departures", "farewells", "goodbye", "goodbyes", "leave", "leavers", "exits"];
  let found = findTextChannelByNames(guild, names);
  if (found) return found;
  const regex = /(departures?|farewells?|goodbyes?|leavers?|exits?)/i;
  found = guild.channels.cache.find((c) =>
    c &&
    (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
    regex.test(String(c.name || ""))
  ) || null;
  return found;
}

client.on("guildMemberAdd", async (member) => {
  try {
    const guild = member.guild;
    const { defaultRoleId, rpRoleId } = await ensureDefaultRoles(guild);
    if (defaultRoleId && !member.roles.cache.has(defaultRoleId)) {
      await member.roles.add(defaultRoleId, "Auto-assign default member role").catch(() => null);
    }
    if (autoAssignRpRole && rpRoleId && !member.roles.cache.has(rpRoleId)) {
      await member.roles.add(rpRoleId, "Auto-assign RP role").catch(() => null);
    }
  } catch {}
  if (restrictAutomation) return;
  const channel = await resolveWelcomeChannel(member);
  if (!channel || !channel.isTextBased()) return;
  const welcomeList = loadWelcomeMessages();
  const selected = pickRandomMessage(welcomeList, welcomeMessage);
  const msg = renderMemberTemplate(selected, member, "join");
  await sendMessageWithGuards(channel, { content: msg }, "guildMemberAdd");
  try {
    const guild = member.guild;
    await guild.channels.fetch().catch(() => null);
    const startChannel = resolvePanelChannel(guild, ["start-here", "welcome", "rules"], "(start-here|welcome|rules|read-first)");
    const helpChannel = resolvePanelChannel(guild, ["help", "support", "questions"], "(help|support|questions|faq)");
    const lines = [
      "🧭 **Welcome to Grey Hour RP**",
      `Start here: ${startChannel ? `<#${startChannel.id}>` : "use /start"}`,
      "Choose your alerts + roles: `/roleselect`",
      "Need help fast? `/helpwizard` or `/ticket create`",
      helpChannel ? `Help channel: <#${helpChannel.id}>` : ""
    ].filter(Boolean);
    await member.send(lines.join("\n")).catch(() => null);
  } catch {}
});

client.on("guildMemberRemove", async (member) => {
  if (restrictAutomation) return;
  const channel = await resolveDepartureChannel(member);
  if (!channel || !channel.isTextBased()) return;
  const departureList = loadDepartureMessages();
  const selected = pickRandomMessage(departureList, goodbyeMessage);
  const msg = renderMemberTemplate(selected, member, "leave");
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
  if (!message.guild) return;
  if (message.author.bot) {
    if (musicEnforcementEnabled && isMusicBotUserId(message.author.id) && !isMusicTextAllowed(message.channel)) {
      await message.delete().catch(() => {});
    }
    return;
  }

  if (isSpamPattern(message)) {
    await message.delete().catch(() => {});
    const cleared = await cleanupUserSpam(message.channel, message.author.id, spamCleanupLimit);
    if (!restrictAutomation) {
      await postSpamAlert(message, `Auto-removed spam (cleared ${cleared} recent msg)`);
    }
    return;
  }
  if (String(message.content || "").trim().startsWith("!")) {
    const handledChannelApproval = await handleChannelApprovalMessageCommand(message);
    if (handledChannelApproval) return;
    const handledMusic = await handleMusicMessageCommand(message);
    if (handledMusic) return;
  } else if (false && musicPassiveQueryEnabled && isMusicTextAllowed(message.channel)) {
    const raw = String(message.content || "").trim();
    const match = raw.match(/^play\s+(.+)$/i);
    const query = match ? String(match[1] || "").trim() : "";
    if (query && query.length <= 200) {
      const queued = await enqueueMusicFromQuery(message, query, "passive");
      if (queued.ok) {
        const text = queued.started
          ? `Queued and starting: **${queued.title}**`
          : `Queued: **${queued.title}**`;
        await sendMessageWithGuards(message.channel, { content: text }, "music.passive.play");
        return;
      }
      if (queued.error === "voice_required") {
        await sendMessageWithGuards(message.channel, { content: "Join an approved voice channel first." }, "music.passive.voice.required");
        return;
      }
      if (queued.error === "voice_not_allowed") {
        await sendMessageWithGuards(message.channel, { content: "That voice channel is not approved for music." }, "music.passive.voice.denied");
        return;
      }
      if (queued.error === "voice_permission_missing") {
        await sendMessageWithGuards(message.channel, { content: "Bot is missing View Channel, Connect, or Speak permission in your voice channel." }, "music.passive.voice.perms.denied");
        return;
      }
      if (queued.error === "voice_connect_failed") {
        await sendMessageWithGuards(message.channel, { content: "Could not connect to voice. Check channel permissions/region and try again." }, "music.passive.voice.connect.failed");
        return;
      }
      if (queued.error === "resolve_failed") {
        await sendMessageWithGuards(
          message.channel,
          { content: `Could not load track. Ensure \`${getActiveMusicYtDlpLabel()}\` is available and query is valid.` },
          "music.passive.resolve.failed"
        );
        return;
      }
      await sendMessageWithGuards(message.channel, { content: "Music playback is unavailable right now." }, "music.passive.unavailable");
      return;
    }
  }

  await handleAutoSlowmode(message.channel);
  if (restrictAutomation) return;
  await handleVerificationMessage(message);

  if (message.content && message.content.trim().length >= 3) {
    const levels = loadLevels();
    const entry = levels.users[message.author.id] || { xp: 0, level: 0, lastMsgAt: 0, lastVoiceAt: 0 };
    const now = Date.now();
    if (!entry.lastMsgAt || now - entry.lastMsgAt >= levelMessageCooldownMs) {
      entry.lastMsgAt = now;
      levels.users[message.author.id] = entry;
      const xp = levelMessageMinXp + Math.floor(Math.random() * Math.max(1, levelMessageMaxXp - levelMessageMinXp + 1));
      const result = awardXp(levels, message.author.id, xp);
      saveLevels(levels);
      if (result.after > result.before) {
        const channel = message.guild ? await resolveLevelUpChannel(message.guild) : null;
        if (channel && channel.isTextBased()) {
          await sendMessageWithGuards(channel, { content: `🎖️ <@${message.author.id}> reached **Level ${result.after}**.` }, "level.up");
        }
      }
    }
  }

  if (isHelpChannel(message.channel)) {
    const botId = client.user?.id || "";
    const isMentioned = botId ? message.mentions.users.has(botId) : false;
    const content = String(message.content || "").trim();
    if (content && !content.startsWith("/") && !isMentioned) {
      const reply = findHelpFaqResponse(content);
      if (reply && shouldSendHelpFaq(message.guild.id, message.channelId, message.author.id)) {
        await sendMessageWithGuards(message.channel, {
          content: `${reply}\nNeed more help? Try \`/helpwizard\` or \`/ticket create\`.`
        }, "help.faq");
      }
    }
  }

  if (isRoleplayChannel(message.channel)) {
    const oocPattern = /(\(\(|\[\[|ooc:|out of character|\/ooc)/i;
    if (oocPattern.test(message.content || "")) {
      const oocChannel = findOocChannel(message.guild);
      if (shouldSendRpReminder(message.guild.id, message.channelId, message.author.id)) {
        const link = oocChannel ? `<#${oocChannel.id}>` : "the OOC channel";
        await sendMessageWithGuards(message.channel, {
          content: `Gentle reminder: OOC chat belongs in ${link}. Thanks for keeping RP clean.`
        }, "rp.ooc.reminder");
      }
    }
  }

  if (gptEnabled) {
    const gate = isGptAllowedChannel(message.channel);
    if (gate.allowed) {
      const botId = client.user?.id || "";
      const isMentioned = botId ? message.mentions.users.has(botId) || message.content.includes(`<@${botId}>`) || message.content.includes(`<@!${botId}>`) : false;
      const requireMention = gate.help
        ? true
        : gate.override === "nomention"
          ? false
          : (gptRequireMention && gate.override !== "enable");
      if (!requireMention || isMentioned) {
        let content = String(message.content || "");
        if (isMentioned && botId) {
          content = content.replaceAll(`<@${botId}>`, "").replaceAll(`<@!${botId}>`, "").trim();
        }
        if (content && content.length <= gptMaxInputChars) {
          const waitUser = checkGptCooldown(gptUserCooldowns, `${message.guild.id}:${message.author.id}`, gptUserCooldownMs);
          const waitChannel = checkGptCooldown(gptChannelCooldowns, `${message.guild.id}:${message.channelId}`, gptChannelCooldownMs);
          if (waitUser > 0 || waitChannel > 0) return;
          const context = `Channel: #${message.channel?.name || "unknown"}; Tone: ${gate.help ? "help" : gate.staff ? "staff" : "general"}.`;
          const reply = await requestGptReply(context, content);
          await sendMessageWithGuards(message.channel, { content: truncate(reply, 1900) }, "gpt.reply");
        } else if (content && content.length > gptMaxInputChars) {
          await sendMessageWithGuards(message.channel, { content: "That’s a lot at once. Can you shorten your question a bit?" }, "gpt.too.long");
        }
      }
    }
  }

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
    if (restrictAutomation) return;
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
    if (interaction.customId === "bugreport:modal") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "Bug reports must be submitted in a server.", ephemeral: true });
        return;
      }
      const summary = interaction.fields.getTextInputValue("summary");
      const details = interaction.fields.getTextInputValue("details") || "";
      const guild = interaction.guild;
      await guild.channels.fetch().catch(() => null);
      const channel = await resolveTextChannelByIdOrName(guild, process.env.BUG_REPORT_CHANNEL_ID || "", ["bug-reports", "bug-report", "issues"]);
      if (!channel || !channel.isTextBased()) {
        await interaction.reply({ content: "Bug report channel not configured. Please open a ticket instead.", ephemeral: true });
        return;
      }
      const content = [
        "🐛 **Bug Report**",
        `Reporter: <@${interaction.user.id}>`,
        `Summary: ${truncate(summary, 160)}`,
        details ? `Details: ${truncate(details, 1200)}` : "",
        `Channel: <#${interaction.channelId}>`
      ].filter(Boolean).join("\n");
      await sendMessageWithGuards(channel, { content }, "bugreport.submit");
      await interaction.reply({ content: "Bug report submitted. Thank you!", ephemeral: true });
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

    if (interaction.customId.startsWith("spamaction:")) {
      const isStaff = isStaffMember(interaction, member) && hasPolicyAccess(member, "mod");
      if (!isStaff) {
        await interaction.reply({ content: "Only staff can use spam actions.", ephemeral: true });
        return;
      }
      const [, action, userId, channelId] = interaction.customId.split(":");
      const guild = interaction.guild;
      const targetMember = await guild.members.fetch(userId).catch(() => null);
      const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
      if (!targetMember) {
        await interaction.reply({ content: "User not found.", ephemeral: true });
        return;
      }
      if (action === "warn") {
        await targetMember.send("Please slow down. Spam is not allowed here.").catch(() => null);
        await interaction.reply({ content: `Warned <@${userId}>.`, ephemeral: true });
        return;
      }
      if (action === "timeout10" || action === "timeout60") {
        const minutes = action === "timeout10" ? 10 : 60;
        await targetMember.timeout(minutes * 60 * 1000, "Spam detected").catch(() => null);
        await interaction.reply({ content: `Timed out <@${userId}> for ${minutes} minutes.`, ephemeral: true });
        return;
      }
      if (action === "delete") {
        const cleared = channel && channel.isTextBased()
          ? await cleanupUserSpam(channel, userId, spamCleanupLimit)
          : 0;
        await interaction.reply({ content: `Cleared ${cleared} recent messages from <@${userId}>.`, ephemeral: true });
        return;
      }
      if (action === "kick") {
        await targetMember.kick("Spam detected").catch(() => null);
        await interaction.reply({ content: `Kicked <@${userId}>.`, ephemeral: true });
        return;
      }
      if (action === "ban") {
        await targetMember.ban({ reason: "Spam detected" }).catch(() => null);
        await interaction.reply({ content: `Banned <@${userId}>.`, ephemeral: true });
        return;
      }
    }

    if (interaction.customId.startsWith("onboard:")) {
      const type = interaction.customId.split(":")[1];
      const result = await toggleOptInRole(member, type);
      await interaction.reply({ content: result.message, ephemeral: true });
      return;
    }

    if (interaction.customId.startsWith("roleselect:")) {
      const type = interaction.customId.split(":")[1];
      const result = await toggleOptInRole(member, type);
      await interaction.reply({ content: result.message, ephemeral: true });
      return;
    }

    if (interaction.customId.startsWith("helpwizard:")) {
      const topic = interaction.customId.split(":")[1];
      const response = buildHelpWizardResponse(topic);
      await interaction.reply({ content: response, ephemeral: true });
      return;
    }

    if (interaction.customId.startsWith("start:")) {
      const action = interaction.customId.split(":")[1];
      if (action === "rules") {
        await interaction.reply({ content: `Rules: ${links.rules}`, ephemeral: true });
        return;
      }
      if (action === "status") {
        await interaction.reply({ content: `Server status: ${links.site}/status`, ephemeral: true });
        return;
      }
      if (action === "help") {
        await interaction.reply({ content: "Use `/helpwizard` for guided tips or `/ticket create` for private support.", ephemeral: true });
        return;
      }
      if (action === "roles") {
        const rows = buildOptInButtons();
        await interaction.reply({ content: "Choose your alert roles below.", components: rows, ephemeral: true });
        return;
      }
      if (action === "ticket") {
        await interaction.reply({ content: "Use `/ticket create` to open a private support channel.", ephemeral: true });
        return;
      }
      if (action === "website") {
        await interaction.reply({ content: `Website: ${links.site}`, ephemeral: true });
        return;
      }
    }

    if (interaction.customId.startsWith("groupreq:")) {
      const isStaff = isStaffMember(interaction, member) && hasPolicyAccess(member, "ops");
      if (!isStaff) {
        await interaction.reply({ content: "Only staff can approve group requests.", ephemeral: true });
        return;
      }
      const [, action, reqId] = interaction.customId.split(":");
      const requests = loadGroupRequests();
      const registry = loadGroupRegistry();
      const request = requests.requests.find((r) => r.id === reqId);
      if (!request || request.status !== "pending") {
        await interaction.reply({ content: "Request not found or already handled.", ephemeral: true });
        return;
      }
      if (action === "deny") {
        request.status = "denied";
        request.deniedBy = interaction.user.id;
        request.deniedUtc = new Date().toISOString();
        requests.updatedUtc = new Date().toISOString();
        saveGroupRequests(requests);
        syncGroupRequestsToWebsite(requests);
        appendGroupRequestLog({
          id: makeId("grouplog"),
          requestId: request.id,
          action: "denied",
          type: request.type,
          name: request.name,
          ownerId: request.ownerId,
          actorId: interaction.user.id,
          createdUtc: new Date().toISOString()
        });
        await interaction.reply({ content: `Denied request for **${request.name}**.`, ephemeral: true });
        await interaction.message.edit({ components: [] }).catch(() => null);
        const owner = await interaction.guild.members.fetch(request.ownerId).catch(() => null);
        if (owner) {
          await owner.send(`Your ${groupTypeLabel(request.type)} request **${request.name}** was denied by staff.`).catch(() => null);
        }
        return;
      }
      if (action === "approve") {
        const currentTypeCount = registry.groups.filter((g) => g.type === request.type).length;
        if (request.type === "shop" && currentTypeCount >= maxShops) {
          await interaction.reply({ content: `Shop limit reached (${maxShops}).`, ephemeral: true });
          return;
        }
        if (request.type === "faction" && currentTypeCount >= maxFactions) {
          await interaction.reply({ content: `Faction limit reached (${maxFactions}).`, ephemeral: true });
          return;
        }
        const resources = await createGroupResources(interaction.guild, request);
        const group = {
          id: request.id,
          type: request.type,
          name: request.name,
          color: request.color,
          tagline: request.tagline || "",
          details: request.details || "",
          ownerId: request.ownerId,
          memberIds: [request.ownerId],
          roleId: resources.role?.id || "",
          textChannelId: resources.textChannel?.id || "",
          voiceChannelId: resources.voiceChannel?.id || "",
          createdUtc: new Date().toISOString(),
          maxMembers: request.type === "faction" ? maxFactionMembers : maxFactionMembers
        };
        registry.groups.unshift(group);
        registry.updatedUtc = new Date().toISOString();
        saveGroupRegistry(registry);
        await syncGroupRegistryToWebsite(registry);

        request.status = "approved";
        request.approvedBy = interaction.user.id;
        request.approvedUtc = new Date().toISOString();
        requests.updatedUtc = new Date().toISOString();
        saveGroupRequests(requests);
        syncGroupRequestsToWebsite(requests);
        appendGroupRequestLog({
          id: makeId("grouplog"),
          requestId: request.id,
          action: "approved",
          type: request.type,
          name: request.name,
          ownerId: request.ownerId,
          actorId: interaction.user.id,
          createdUtc: new Date().toISOString()
        });
        await interaction.reply({ content: `Approved **${request.name}**. Role and channels created.`, ephemeral: true });
        await interaction.message.edit({ components: [] }).catch(() => null);
        if (resources.role && interaction.guild) {
          const owner = await interaction.guild.members.fetch(request.ownerId).catch(() => null);
          if (owner) await owner.roles.add(resources.role.id).catch(() => null);
          if (owner) {
            await owner.send(`Your ${groupTypeLabel(request.type)} **${request.name}** is approved. Channels: ${resources.textChannel ? `<#${resources.textChannel.id}>` : "created"}`).catch(() => null);
          }
        }
        return;
      }
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

    if (interaction.customId.startsWith("verification:confirm:")) {
      const parts = interaction.customId.split(":");
      const targetId = parts[2] || "";
      if (interaction.user.id !== targetId) {
        await interaction.reply({ content: "You can only verify your own account.", ephemeral: true });
        return;
      }
      if (!interaction.guild) {
        await interaction.reply({ content: "Verification must happen inside the server.", ephemeral: true });
        return;
      }
      const member = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "Member not found.", ephemeral: true });
        return;
      }
      if (isMemberVerified(member)) {
        await interaction.reply({ content: "Already verified.", ephemeral: true });
        return;
      }
      if (verificationRoleId) {
        await member.roles.add(verificationRoleId, "Verification button").catch(() => null);
      }
      markMemberVerified(member, interaction.channelId || "");
      await interaction.reply({ content: verificationAutoReply, ephemeral: true });
      return;
    }
    if (interaction.customId.startsWith("shopreq:")) {
      const [, action, requestId] = interaction.customId.split(":");
      if (!canManageAutoShop(member)) {
        await interaction.reply({ content: "Only auto shop staff can manage requests.", ephemeral: true });
        return;
      }
      const state = loadShopRequests();
      const row = state.requests.find((r) => r.id === requestId);
      if (!row) {
        await interaction.reply({ content: "Shop request not found.", ephemeral: true });
        return;
      }
      if (action === "claim") {
        if (row.status === "completed") {
          await interaction.reply({ content: "Request already completed.", ephemeral: true });
          return;
        }
        if (row.claimedBy) {
          await interaction.reply({ content: `Already claimed by <@${row.claimedBy}>.`, ephemeral: true });
          return;
        }
        row.status = "claimed";
        row.claimedBy = interaction.user.id;
        row.claimedAt = new Date().toISOString();
        saveShopRequests(state);
        const updatedContent = upsertLine(upsertLine(interaction.message.content, "Status", "Claimed"), "Claimed By", `<@${interaction.user.id}>`);
        await interaction.message.edit({ content: updatedContent }).catch(() => null);
        if (row.threadId) {
          const thread = await interaction.guild.channels.fetch(row.threadId).catch(() => null);
          if (thread && thread.isTextBased()) {
            await sendMessageWithGuards(thread, { content: `✅ Request claimed by <@${interaction.user.id}>.` }, "shopreq.claim");
          }
        }
        await interaction.reply({ content: "Request claimed.", ephemeral: true });
        return;
      }
      if (action === "complete") {
        if (row.status === "completed") {
          await interaction.reply({ content: "Request already completed.", ephemeral: true });
          return;
        }
        row.status = "completed";
        row.completedBy = interaction.user.id;
        row.completedAt = new Date().toISOString();
        saveShopRequests(state);
        const updatedContent = upsertLine(upsertLine(interaction.message.content, "Status", "Completed"), "Completed By", `<@${interaction.user.id}>`);
        await interaction.message.edit({ content: updatedContent, components: [] }).catch(() => null);
        if (row.threadId) {
          const thread = await interaction.guild.channels.fetch(row.threadId).catch(() => null);
          if (thread && thread.isTextBased()) {
            await sendMessageWithGuards(thread, { content: `✅ Request completed by <@${interaction.user.id}>.` }, "shopreq.complete");
          }
        }
        await interaction.reply({ content: "Request marked completed.", ephemeral: true });
        return;
      }
    }

    if (interaction.customId.startsWith("shopstore:")) {
      const [, action, shopId] = interaction.customId.split(":");
      if (!canManageStores(member)) {
        await interaction.reply({ content: "Only staff can approve store requests.", ephemeral: true });
        return;
      }
      try {
        const rows = await loadShopsContent();
        const target = rows.find((r) => String(r.id) === String(shopId));
        if (!target) {
          await interaction.reply({ content: "Shop listing not found in content.", ephemeral: true });
          return;
        }
        const now = new Date().toISOString();
        if (action === "approve") {
          target.status = "approved";
          target.approvedUtc = now;
          target.deniedUtc = "";
        }
        if (action === "deny") {
          target.status = "denied";
          target.deniedUtc = now;
          target.approvedUtc = "";
        }
        await saveShopsContent(rows);
        const statusLabel = action === "approve" ? "Approved" : "Denied";
        let updated = upsertLine(interaction.message.content, "Status", statusLabel);
        updated = upsertLine(updated, "Reviewed By", `<@${interaction.user.id}>`);
        await interaction.message.edit({ content: updated }).catch(() => null);
        await interaction.reply({ content: `Shop ${statusLabel.toLowerCase()}.`, ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: `Unable to update shop content: ${err instanceof Error ? err.message : String(err)}`, ephemeral: true });
      }
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

  if (interaction.commandName === "botcontrol") {
    const guild = interaction.inGuild() && interaction.guild ? interaction.guild : null;
    if (!guild) {
      await interaction.reply({ content: "Bot control commands must be used inside the server.", ephemeral: true });
      return;
    }
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!canUseCodex(interaction, member)) {
      await interaction.reply({
        content: "Bot control is restricted to trusted devs/owners. Contact ops if you need access.",
        ephemeral: true
      });
      return;
    }
    const sub = interaction.options.getSubcommand();
    if (sub === "toggle") {
      const feature = interaction.options.getString("feature", true);
      const stateValue = interaction.options.getString("state", true);
      const enabled = stateValue === "on";
      const featureMap = {
        codex: "codexEnabled",
        autoheal: "autohealEnabled",
        textauto: "textAutomationEnabled"
      };
      const labelMap = {
        codex: "Codex replies",
        autoheal: "GPT autoheal",
        textauto: "Text automation"
      };
      const flag = featureMap[feature];
      if (!flag) {
        await interaction.reply({ content: "Unknown feature.", ephemeral: true });
        return;
      }
      const runtime = setRuntimeFlag(flag, enabled);
      await interaction.reply({
        content: `${labelMap[feature]} ${enabled ? "enabled" : "disabled"}. Runtime overrides: ${Object.entries(runtime).map(([k, v]) => `${k}=${v}`).join(", ")}`,
        ephemeral: true
      });
      return;
    }
    if (sub === "run") {
      const job = interaction.options.getString("job", true);
      const force = Boolean(interaction.options.getBoolean("force"));
      await interaction.deferReply({ ephemeral: true });
      if (job === "textauto") {
        const result = await runTextChannelAutomation({ guild, manual: true, force });
        await interaction.editReply({
          content: `Text automation run: processed ${result.processed} channels • topics ${result.topicsSet} • guides posted ${result.guidesPosted} • guides updated ${result.guidesUpdated} • failed ${result.failed} • reason=${result.reason || "ok"}`
        });
        return;
      }
      if (job === "websync") {
        const result = await runWebsiteChannelSync({ guild, manual: true });
        await interaction.editReply({
          content: [
            "Website sync completed:",
            `Updated: ${result.updated || 0}`,
            `Skipped: ${result.skipped || 0}`,
            `Failed: ${result.failed || 0}`,
            result.createdChannels?.length ? `Created: ${result.createdChannels.join(", ")}` : "",
            result.notes?.length ? `Notes: ${result.notes.join(" | ")}` : ""
          ].filter(Boolean).join("\n")
        });
        return;
      }
      if (job === "nav") {
        const infoCategory = findCategoryByNames(guild, ["information", "info", "information-hub"]);
        const staffCategory = findCategoryByNames(guild, ["staff", "staff-lounge", "staff-ops"]);
        const channelRefs = {
          rules: findTextChannelByNames(guild, ["rules"]),
          directory: findTextChannelByNames(guild, ["server-directory", "directory"]),
          communityGuide: findTextChannelByNames(guild, ["community-guide", "community"]),
          serverStatus: findTextChannelByNames(guild, ["server-status", "status"]),
          story: findTextChannelByNames(guild, ["story", "stories"]),
          transmissions: findTextChannelByNames(guild, ["transmissions", "transmission"])
        };
        const state = loadState();
        await updateStaffBotChannels(guild, infoCategory, staffCategory, channelRefs, state);
        saveState(state);
        await interaction.editReply({ content: "Bot ops hub and animated navigation refreshed." });
        return;
      }
    }
    if (sub === "diag") {
      const runtime = getRuntimeFlags();
      const state = loadState();
      const embeds = new EmbedBuilder()
        .setTitle("Bot control status")
        .addFields(
          { name: "Deploy", value: deployTag, inline: true },
          { name: "Mode", value: dryRunMode ? "dry-run" : (stagingMode ? "staging" : "live"), inline: true },
          { name: "Codex replies", value: isCodexEnabled() ? "enabled" : "disabled", inline: true },
          { name: "Autoheal", value: isAutohealEnabled() ? "enabled" : "disabled", inline: true },
          { name: "Text automation", value: isTextAutomationEnabled() ? "enabled" : "disabled", inline: true },
          { name: "GPT failures in window", value: `${gptFailureWindow.length}/${gptAutohealFailureThreshold}`, inline: true },
          { name: "Last text automation", value: state.lastTextChannelAutomationAt ? new Date(state.lastTextChannelAutomationAt).toISOString() : "never", inline: true },
          { name: "Last website sync", value: state.lastWebsiteChannelSyncAt ? new Date(state.lastWebsiteChannelSyncAt).toISOString() : "never", inline: true },
          { name: "Animated nav frame", value: `${(state.animatedNavFrameIndex || 0) + 1}/${animatedNavFrames.length}`, inline: true },
          { name: "Runtime overrides", value: Object.keys(runtime).length ? Object.entries(runtime).map(([k, v]) => `${k}=${v}`).join(", ") : "none", inline: false }
        )
        .setColor(0x22c55e)
        .setTimestamp();
      await interaction.reply({ embeds: [embeds], ephemeral: true });
      return;
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const channelGate = isCommandAllowedInChannel(interaction);
  if (!channelGate.ok) {
    await interaction.reply({ content: channelGate.reason, ephemeral: true });
    return;
  }

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

    if (interaction.commandName === "start") {
      const wantsPost = Boolean(interaction.options.getBoolean("post"));
      await respondWithStartPanel(interaction, reqId, wantsPost);
      return;
    }


    if (interaction.commandName === "roleselect") {
      const wantsPost = Boolean(interaction.options.getBoolean("post"));
      const rows = buildOptInButtons();
      if (!rows.length) {
        await interaction.reply({ content: "No alert roles are configured yet.", ephemeral: true });
        return;
      }
      if (wantsPost) {
        const staff = await requireStaff(interaction, "onboard");
        if (!staff) return;
        const content = [
          "🔔 **Alert Roles**",
          "Pick the alerts you want to receive.",
          "Buttons not working? Use `/optin type:<restart|wipe|raids|trade|events|updates|story|mods>`."
        ].join("\n");
        await sendMessageWithGuards(interaction.channel, { content, components: rows }, "roleselect.panel", reqId);
        await interaction.reply({ content: "Role selector posted.", ephemeral: true });
        return;
      }
      await interaction.reply({
        content: "Choose your alert roles below. Buttons not working? Use `/optin`.",
        components: rows,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "helpwizard") {
      const wantsPost = Boolean(interaction.options.getBoolean("post"));
      const topic = interaction.options.getString("topic") || "";
      if (wantsPost) {
        const staff = await requireStaff(interaction, "onboard");
        if (!staff) return;
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("helpwizard:connect").setLabel("Connection Help").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("helpwizard:mods").setLabel("Mods/Workshop").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("helpwizard:support").setLabel("Open Ticket").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("helpwizard:lore").setLabel("Lore + Story").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("helpwizard:events").setLabel("Events").setStyle(ButtonStyle.Secondary)
        );
        const content = [
          "🧠 **Help Wizard**",
          "Pick a topic below for instant tips. If buttons fail, use `/helpwizard topic:<connect|mods|rules|support|lore|events>`."
        ].join("\n");
        await sendMessageWithGuards(interaction.channel, { content, components: [row] }, "helpwizard.panel", reqId);
        await interaction.reply({ content: "Help wizard posted.", ephemeral: true });
        return;
      }
      const response = buildHelpWizardResponse(topic);
      await interaction.reply({ content: response, ephemeral: true });
      return;
    }

    if (interaction.commandName === "faq") {
      const topic = interaction.options.getString("topic") || "";
      const response = buildFaqResponse(topic);
      await interaction.reply({ content: response, ephemeral: true });
      return;
    }

    if (interaction.commandName === "bugreport") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId("bugreport:modal")
        .setTitle("Report a Bug");
      const summaryInput = new TextInputBuilder()
        .setCustomId("summary")
        .setLabel("Short summary")
        .setStyle(TextInputStyle.Short)
        .setMaxLength(120)
        .setRequired(true);
      const detailsInput = new TextInputBuilder()
        .setCustomId("details")
        .setLabel("Details (what happened, when, where)")
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000)
        .setRequired(false);
      modal.addComponents(
        new ActionRowBuilder().addComponents(summaryInput),
        new ActionRowBuilder().addComponents(detailsInput)
      );
      await interaction.showModal(modal);
      return;
    }

    if (interaction.commandName === "directory") {
      const content = [
        "🌐 **Grey Hour RP Directory**",
        `Website: ${links.site}`,
        `Rules: ${links.rules}`,
        `Server Status: ${links.site}/status`,
        `Updates: ${links.updates}`,
        `Transmissions: ${links.transmissions}`,
        `Join Guide: ${links.join}`
      ].join("\n");
      await interaction.reply({ content, ephemeral: true });
      return;
    }

    if (interaction.commandName === "prompt") {
      const prompts = [
        "You find a hand-written map with a torn edge. Who made it and why?",
        "Your faction discovers a quiet farmhouse with a radio still on. What broadcast plays?",
        "A supply cache is marked as “Do Not Open.” What’s inside?",
        "Someone at the campfire tells a story that no one else remembers happening.",
        "A fresh set of footprints circles your safehouse at dawn.",
        "A trader offers a deal that seems too good. What’s the catch?",
        "A storm knocks out power. What old fear resurfaces?",
        "You find a note addressed to someone in your group. Do you read it?"
      ];
      const prompt = prompts[Math.floor(Math.random() * prompts.length)];
      await interaction.reply({ content: `🕯️ **RP Prompt**\n${prompt}`, ephemeral: true });
      return;
    }

    if (interaction.commandName === "ask") {
      const question = interaction.options.getString("question", true);
      const context = `Channel: #${interaction.channel?.name || "unknown"}; Mode: slash.`;
      const member = interaction.inGuild() && interaction.guild
        ? await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
        : null;
      if (!canUseCodex(interaction, member)) {
        await interaction.reply({
          content: "Codex access is limited to devs and owners working on the website or bot. Reach out to ops if you need access.",
          ephemeral: true
        });
        return;
      }
      await interaction.deferReply();
      const reply = await requestGptReply(context, question);
      await interaction.editReply(truncate(reply, 1900));
      return;
    }

    if (interaction.commandName === "assistant") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "Assistant controls must be used inside the server.", ephemeral: true });
        return;
      }
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      const isStaff = Boolean(member && isStaffMember(interaction, member) && hasPolicyAccess(member, "ops"));
      if (!isStaff) {
        await interaction.reply({ content: "Only staff with ops access can change assistant settings.", ephemeral: true });
        return;
      }
      const sub = interaction.options.getSubcommand();
      const target = interaction.options.getChannel("channel") || interaction.channel;
      if (!target || !target.isTextBased()) {
        await interaction.reply({ content: "Pick a text channel to update.", ephemeral: true });
        return;
      }
      const config = loadGptChannelOverrides();
      const overrides = config.overrides || {};
      if (sub === "enable") {
        overrides[target.id] = "enable";
        saveGptChannelOverrides({ overrides });
        gptOverridesLoadedAt = 0;
        await interaction.reply({ content: `GreyHour Assistant enabled in <#${target.id}>.`, ephemeral: true });
        return;
      }
      if (sub === "disable") {
        overrides[target.id] = "disable";
        saveGptChannelOverrides({ overrides });
        gptOverridesLoadedAt = 0;
        await interaction.reply({ content: `GreyHour Assistant disabled in <#${target.id}>.`, ephemeral: true });
        return;
      }
      if (sub === "nomention") {
        overrides[target.id] = "nomention";
        saveGptChannelOverrides({ overrides });
        gptOverridesLoadedAt = 0;
        await interaction.reply({ content: `GreyHour Assistant enabled without mention in <#${target.id}>.`, ephemeral: true });
        return;
      }
      if (sub === "reset") {
        saveGptChannelOverrides({ overrides: {} });
        gptOverridesLoadedAt = 0;
        await interaction.reply({ content: "Assistant overrides cleared. Auto behavior restored.", ephemeral: true });
        return;
      }
      const auto = isGptAllowedChannel(target);
      const override = getGptChannelOverride(target.id) || "none";
      const reason = override === "enable"
        ? "override enable"
        : override === "disable"
          ? "override disable"
          : override === "nomention"
            ? "override no-mention"
          : auto.help
            ? "auto: help channel"
            : auto.staff
              ? "auto: staff channel"
              : "auto: not allowed";
      await interaction.reply({
        content: `Assistant status for <#${target.id}>: ${auto.allowed ? "enabled" : "disabled"} (${reason}).`,
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "channelmode") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "Channel controls must be used inside the server.", ephemeral: true });
        return;
      }
      const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      const isStaff = Boolean(member && isStaffMember(interaction, member) && hasPolicyAccess(member, "ops"));
      if (!isStaff) {
        await interaction.reply({ content: "Only staff with ops access can change channel modes.", ephemeral: true });
        return;
      }
      const sub = interaction.options.getSubcommand();
      const target = interaction.options.getChannel("channel") || interaction.channel;
      if (!target || !target.isTextBased()) {
        await interaction.reply({ content: "Pick a text channel to update.", ephemeral: true });
        return;
      }
      const config = loadChannelModes();
      const modes = config.modes || {};
      if (sub === "lock") {
        await setChannelLockStatus(target, "lock");
        modes[target.id] = "lock";
        saveChannelModes({ modes });
        await interaction.reply({ content: `Channel locked: <#${target.id}> is now read-only for members.`, ephemeral: true });
        return;
      }
      if (sub === "unlock") {
        await setChannelLockStatus(target, "unlock");
        delete modes[target.id];
        saveChannelModes({ modes });
        await interaction.reply({ content: `Channel unlocked: <#${target.id}> is open for chat.`, ephemeral: true });
        return;
      }
      const status = modes[target.id] === "lock" ? "locked" : "open";
      await interaction.reply({ content: `Channel mode for <#${target.id}>: ${status}.`, ephemeral: true });
      return;
    }

    if (interaction.commandName === "suggest") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "Suggestions must be submitted inside the server.", ephemeral: true });
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const topic = interaction.options.getString("topic", true);
      const suggestion = interaction.options.getString("suggestion", true);
      const details = interaction.options.getString("details");
      const guild = interaction.guild;
      await guild.channels.fetch().catch(() => null);
      const staffCategory = await ensureCategoryChannel(guild, "STAFF", `suggestions by ${interaction.user.tag}`);
      let target = findTextChannelByNames(guild, ["suggestions", "suggestion-box", "community-suggestions", "feedback"]);
      if (!target && staffCategory) {
        target = await ensureTextChannelByName(guild, "suggestions", {
          parentId: staffCategory.id,
          topic: "Community suggestions reviewed by mods/admins/owners.",
          reason: "Suggestion intake"
        });
      }
      if (!target || !target.isTextBased()) {
        await interaction.editReply({ content: "Suggestion channel not available. Create #suggestions or ask staff to enable it." });
        return;
      }
      const mentionRoles = [];
      const policy = loadPermissionPolicy();
      const roleIds = policy?.commandRoleIds || {};
      const roleGroups = ["mod", "admin", "ops"];
      for (const group of roleGroups) {
        const ids = Array.isArray(roleIds[group]) ? roleIds[group] : [];
        for (const id of ids) mentionRoles.push(id);
      }
      const mentionText = mentionRoles.length
        ? `${Array.from(new Set(mentionRoles)).map((id) => `<@&${id}>`).join(" ")} `
        : "";
      const payload = [
        `${mentionText}💡 **Suggestion**`,
        `From: <@${interaction.user.id}>`,
        `Topic: ${topic}`,
        `Suggestion: ${suggestion}`,
        details ? `Details: ${details}` : null,
        interaction.channelId ? `Submitted From: <#${interaction.channelId}>` : null
      ].filter(Boolean).join("\n");
      const posted = await sendMessageWithGuards(target, { content: payload }, "suggestion.create");
      if (posted && typeof posted.startThread === "function") {
        const thread = await posted.startThread({
          name: `suggest-${interaction.user.username}-${Date.now().toString(36)}`.slice(0, 90),
          autoArchiveDuration: 1440,
          reason: "Suggestion intake"
        }).catch(() => null);
        if (thread) {
          await interaction.editReply({ content: `Suggestion sent to ${target.toString()} and thread ${thread.toString()}.` });
          return;
        }
      }
      await interaction.editReply({ content: `Suggestion sent to ${target.toString()}.` });
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

    if (interaction.commandName === "music") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "Music commands only work in a server.", ephemeral: true });
        return;
      }
      const guild = interaction.guild;
      const sub = interaction.options.getSubcommand();
      const musicRateWait = enforceMusicCommandRateLimits(interaction, sub);
      if (musicRateWait > 0) {
        await interaction.reply({ content: `Music rate limit active. Try again in ${musicRateWait}s.`, ephemeral: true });
        return;
      }

      if (["approve", "revoke", "setup", "list"].includes(sub)) {
        const staff = await requireStaff(interaction, "ops");
        if (!staff) return;
      }

      if (sub === "approve" || sub === "revoke") {
        const textChannel = interaction.options.getChannel("text_channel");
        const voiceChannel = interaction.options.getChannel("voice_channel");
        const botUser = interaction.options.getUser("bot_user");
        if (!textChannel && !voiceChannel && !botUser) {
          await interaction.reply({ content: "Provide at least one target: text_channel, voice_channel, or bot_user.", ephemeral: true });
          return;
        }
        const policy = loadMusicPolicy();
        const textSet = new Set(policy.allowedTextChannelIds || []);
        const voiceSet = new Set(policy.allowedVoiceChannelIds || []);
        const botSet = new Set(policy.musicBotUserIds || []);
        if (sub === "approve") {
          if (textChannel && textChannel.isTextBased()) textSet.add(textChannel.id);
          if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice) voiceSet.add(voiceChannel.id);
          if (botUser) botSet.add(botUser.id);
        } else {
          if (textChannel) textSet.delete(textChannel.id);
          if (voiceChannel) voiceSet.delete(voiceChannel.id);
          if (botUser) botSet.delete(botUser.id);
        }
        saveMusicPolicy({
          ...policy,
          allowedTextChannelIds: Array.from(textSet),
          allowedVoiceChannelIds: Array.from(voiceSet),
          musicBotUserIds: Array.from(botSet),
          updatedAt: new Date().toISOString()
        });
        await interaction.reply({
          content: sub === "approve"
            ? "Music policy updated: target(s) approved."
            : "Music policy updated: target(s) removed.",
          ephemeral: true
        });
        return;
      }

      if (sub === "setup") {
        await interaction.deferReply({ ephemeral: true });
        await guild.channels.fetch().catch(() => null);
        const overwrite = Boolean(interaction.options.getBoolean("overwrite"));
        const baseName = normalizeChannelName(interaction.options.getString("base_name") || "music").slice(0, 24) || "music";
        const policy = loadMusicPolicy();
        if (!overwrite && ((policy.managedTextChannelIds || []).length || (policy.managedVoiceChannelIds || []).length)) {
          await interaction.editReply({
            content: "Music setup already has managed channels. Re-run with `overwrite:true` to replace managed channel bindings."
          });
          return;
        }
        const category = await ensureCategoryChannel(guild, musicChannelCategoryName, `Music setup by ${interaction.user.tag}`);
        const textName = `${baseName}-text`.slice(0, 90);
        const voiceName = `${baseName}-voice`.slice(0, 90);
        let text = guild.channels.cache.find((c) =>
          (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
          String(c.name || "").toLowerCase() === textName.toLowerCase()
        ) || null;
        let voice = guild.channels.cache.find((c) =>
          c.type === ChannelType.GuildVoice &&
          String(c.name || "").toLowerCase() === voiceName.toLowerCase()
        ) || null;
        if (!text) {
          text = await createGuildChannelWithApproval(guild, {
            name: textName,
            type: ChannelType.GuildText,
            parent: category?.id || null,
            topic: "Music commands and playback updates."
          }).catch(() => null);
        }
        if (!voice) {
          voice = await createGuildChannelWithApproval(guild, {
            name: voiceName,
            type: ChannelType.GuildVoice,
            parent: category?.id || null,
            reason: `Music setup by ${interaction.user.tag}`
          }).catch(() => null);
        }
        if (!text || !voice) {
          await interaction.editReply({ content: "Failed to create/resolve music channels. Check Manage Channels permission." });
          return;
        }
        saveMusicPolicy({
          ...policy,
          allowedTextChannelIds: Array.from(new Set([...(policy.allowedTextChannelIds || []), text.id])),
          allowedVoiceChannelIds: Array.from(new Set([...(policy.allowedVoiceChannelIds || []), voice.id])),
          managedTextChannelIds: [text.id],
          managedVoiceChannelIds: [voice.id],
          updatedAt: new Date().toISOString()
        });
        await interaction.editReply({ content: `Music setup complete: ${text.toString()} + ${voice.toString()}` });
        return;
      }

      if (sub === "list") {
        await guild.channels.fetch().catch(() => null);
        const policy = loadMusicPolicy();
        const textList = (policy.allowedTextChannelIds || []).map((id) => `<#${id}>`).join(", ") || "none";
        const voiceList = (policy.allowedVoiceChannelIds || []).map((id) => `<#${id}>`).join(", ") || "none";
        const botList = (policy.musicBotUserIds || []).map((id) => `<@${id}>`).join(", ") || "none";
        await interaction.reply({
          content: [
            "**Music Policy**",
            `Text channels: ${textList}`,
            `Voice channels: ${voiceList}`,
            `Music bot users: ${botList}`
          ].join("\n"),
          ephemeral: true
        });
        return;
      }

      const memberVoice = interaction.member?.voice?.channel || null;
      if (!memberVoice || memberVoice.type !== ChannelType.GuildVoice) {
        await interaction.reply({ content: "Join an approved voice channel first.", ephemeral: true });
        return;
      }
      if (!isMusicVoiceAllowed(memberVoice)) {
        await interaction.reply({ content: "This voice channel is not approved for music.", ephemeral: true });
        return;
      }
      if (!hasMusicVoicePermissions(guild, memberVoice)) {
        await interaction.reply({ content: "I need View Channel + Connect + Speak permissions in that voice channel.", ephemeral: true });
        return;
      }
      if (!interaction.channel || !interaction.channel.isTextBased() || !isMusicTextAllowed(interaction.channel)) {
        await interaction.reply({ content: "Use music commands in an approved music text channel.", ephemeral: true });
        return;
      }

      if (sub === "queue") {
        const session = musicSessions.get(guild.id);
        if (!session || (!session.current && !session.queue.length)) {
          await interaction.reply({ content: "Queue is empty.", ephemeral: true });
          return;
        }
        const lines = [];
        if (session.current) lines.push(`Now: **${session.current.title}**`);
        for (let i = 0; i < Math.min(10, session.queue.length); i += 1) {
          lines.push(`${i + 1}. ${session.queue[i].title}`);
        }
        await interaction.reply({ content: truncate(lines.join("\n"), 1800), ephemeral: true });
        return;
      }

      if (sub === "leave") {
        destroyMusicSession(guild.id);
        await interaction.reply({ content: "Left voice channel and cleared queue.", ephemeral: true });
        return;
      }

      if (sub === "stop") {
        const session = musicSessions.get(guild.id);
        if (!session) {
          await interaction.reply({ content: "Nothing is playing.", ephemeral: true });
          return;
        }
        session.queue = [];
        cleanupMusicProcess(session);
        session.player.stop(true);
        session.current = null;
        persistMusicSessions();
        await interaction.reply({ content: "Playback stopped and queue cleared.", ephemeral: true });
        return;
      }

      if (sub === "skip") {
        const session = musicSessions.get(guild.id);
        if (!session || !session.current) {
          await interaction.reply({ content: "Nothing is playing.", ephemeral: true });
          return;
        }
        cleanupMusicProcess(session);
        session.player.stop(true);
        persistMusicSessions();
        await interaction.reply({ content: "Skipped current track.", ephemeral: true });
        return;
      }

      if (sub === "play") {
        const query = interaction.options.getString("query", true);
        const autoPlaylist = Boolean(interaction.options.getBoolean("autoplaylist")) || wantsAutoPlaylist(query);
        await interaction.deferReply({ ephemeral: true });
        const voiceLib = await getVoiceLib();
        if (!voiceLib) {
          await interaction.editReply({ content: "Music playback dependency is missing. Install `@discordjs/voice` and restart the bot." });
          return;
        }
        const trackResult = await resolveMusicTracks(query, { autoPlaylist, maxTracks: autoPlaylist ? getConfiguredAutoPlaylistSize() : 1 });
        if (!trackResult.ok || !Array.isArray(trackResult.tracks) || !trackResult.tracks.length) {
          await interaction.editReply({
            content: `Could not load music. Ensure \`${getActiveMusicYtDlpLabel()}\` is available and the query is valid. (${truncate(trackResult.error || "unknown_error", 160)})`
          });
          return;
        }
        const session = await getOrCreateMusicSession(guild.id);
        if (!session) {
          await interaction.editReply({ content: "Music playback is unavailable right now." });
          return;
        }
        const existing = voiceLib.getVoiceConnection(guild.id);
        const connection = existing || voiceLib.joinVoiceChannel({
          channelId: memberVoice.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: false
        });
        session.connection = connection;
        session.voiceChannelId = memberVoice.id;
        session.textChannelId = interaction.channelId || "";
        attachMusicConnectionHandlers(session, voiceLib);
        if (!(await ensureMusicConnectionReady(session, voiceLib))) {
          await interaction.editReply({ content: "I could not connect to that voice channel. Check bot Connect/Speak permissions and try again." });
          return;
        }
        connection.subscribe(session.player);
        for (const track of trackResult.tracks) {
          session.queue.push({
            ...track,
            requestedBy: interaction.user.id
          });
        }
        persistMusicSessions();
        const firstTitle = trackResult.tracks[0]?.title || "Unknown";
        const queuedCount = trackResult.tracks.length;
        if (!session.current) {
          await playNextInMusicQueue(guild.id);
          if (queuedCount > 1) {
            await interaction.editReply({ content: `Queued and starting: **${firstTitle}** (+${queuedCount - 1} more).` });
          } else {
            await interaction.editReply({ content: `Queued and starting: **${firstTitle}**` });
          }
        } else {
          if (queuedCount > 1) {
            await interaction.editReply({ content: `Queued playlist: **${firstTitle}** (+${queuedCount - 1} more).` });
          } else {
            await interaction.editReply({ content: `Queued: **${firstTitle}**` });
          }
        }
        return;
      }
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
      await interaction.reply({
        content: "Faction management has moved to the new **/group** system. Use `/group request` to start a faction or shop (admin approval required).",
        ephemeral: true
      });
      return;
    }

    if (interaction.commandName === "group") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "Group tools only work inside the server.", ephemeral: true });
        return;
      }
      const sub = interaction.options.getSubcommand();
      const registry = loadGroupRegistry();
      const requests = loadGroupRequests();

      if (sub === "request") {
        const type = interaction.options.getString("type", true);
        const nameRaw = interaction.options.getString("name", true);
        const colorRaw = interaction.options.getString("color", true);
        const tagline = interaction.options.getString("tagline") || "";
        const details = interaction.options.getString("details") || "";
        const name = normalizeGroupName(nameRaw);
        const color = sanitizeHexColor(colorRaw);
        if (!name || name.length < 3) {
          await interaction.reply({ content: "Group name must be at least 3 characters.", ephemeral: true });
          return;
        }
        if (!color) {
          await interaction.reply({ content: "Color must be a valid hex value like #9b1c1c.", ephemeral: true });
          return;
        }
        const key = groupKey(name);
        const exists = registry.groups.some((g) => groupKey(g.name) === key);
        const pending = requests.requests.some((r) => groupKey(r.name) === key && r.status === "pending");
        if (exists || pending) {
          await interaction.reply({ content: "A group with that name already exists or is pending.", ephemeral: true });
          return;
        }
        const currentTypeCount = registry.groups.filter((g) => g.type === type).length;
        if (type === "shop" && currentTypeCount >= maxShops) {
          await interaction.reply({ content: `Shop limit reached (${maxShops}). Try again later.`, ephemeral: true });
          return;
        }
        if (type === "faction" && currentTypeCount >= maxFactions) {
          await interaction.reply({ content: `Faction limit reached (${maxFactions}). Try again later.`, ephemeral: true });
          return;
        }
        const userPending = requests.requests.filter((r) => r.ownerId === interaction.user.id && r.status === "pending");
        if (userPending.length >= 2) {
          await interaction.reply({ content: "You already have 2 pending requests. Please wait for staff review.", ephemeral: true });
          return;
        }

        const reqId = makeId("group");
        const record = {
          id: reqId,
          type,
          name,
          color,
          tagline: truncate(tagline, 60),
          details: truncate(details, 280),
          ownerId: interaction.user.id,
          createdUtc: new Date().toISOString(),
          status: "pending"
        };
        requests.requests.unshift(record);
        requests.updatedUtc = new Date().toISOString();
        saveGroupRequests(requests);
        syncGroupRequestsToWebsite(requests);
        appendGroupRequestLog({
          id: makeId("grouplog"),
          requestId: reqId,
          action: "submitted",
          type,
          name,
          ownerId: interaction.user.id,
          actorId: interaction.user.id,
          createdUtc: new Date().toISOString()
        });

        const channel = await ensureGroupRequestChannel(interaction.guild);
        if (channel && channel.isTextBased()) {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`groupreq:approve:${reqId}`).setLabel("Approve").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`groupreq:deny:${reqId}`).setLabel("Deny").setStyle(ButtonStyle.Danger)
          );
          await sendMessageWithGuards(channel, {
            content: [
              `📌 **Group Request** (${groupTypeLabel(type)})`,
              `Name: **${name}**`,
              `Color: ${color}`,
              tagline ? `Tagline: ${tagline}` : null,
              details ? `Details: ${details}` : null,
              `Requested by: <@${interaction.user.id}>`,
              `Request ID: \`${reqId}\``
            ].filter(Boolean).join("\n"),
            components: [row]
          }, "group.request.post");
        }
        await interaction.reply({ content: `Request submitted for **${name}**. Staff will review it shortly.`, ephemeral: true });
        return;
      }

      if (sub === "add" || sub === "remove" || sub === "roster" || sub === "disband") {
        const group = await resolveGroupContext(interaction, registry);
        if (!group) {
          await interaction.reply({ content: "No group context found. Run this inside your group channel.", ephemeral: true });
          return;
        }
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member || !canManageGroup(member, group)) {
          await interaction.reply({ content: "Only the group owner or staff can manage this group.", ephemeral: true });
          return;
        }

        if (sub === "roster") {
          const members = (group.memberIds || []).map((id) => `<@${id}>`).join(", ");
          await interaction.reply({
            content: members ? `**${group.name}** roster: ${members}` : `**${group.name}** has no members yet.`
          });
          return;
        }

        if (sub === "disband") {
          if (group.roleId) {
            const role = interaction.guild.roles.cache.get(group.roleId);
            if (role) await role.delete("Group disbanded").catch(() => null);
          }
          if (group.textChannelId) {
            const ch = await interaction.guild.channels.fetch(group.textChannelId).catch(() => null);
            if (ch) await ch.delete("Group disbanded").catch(() => null);
          }
          if (group.voiceChannelId) {
            const ch = await interaction.guild.channels.fetch(group.voiceChannelId).catch(() => null);
            if (ch) await ch.delete("Group disbanded").catch(() => null);
          }
          registry.groups = registry.groups.filter((g) => g.id !== group.id);
          registry.updatedUtc = new Date().toISOString();
          saveGroupRegistry(registry);
          await syncGroupRegistryToWebsite(registry);
          await interaction.reply({ content: `Group **${group.name}** disbanded.`, ephemeral: true });
          return;
        }

        const targetUser = interaction.options.getUser("user", true);
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
          await interaction.reply({ content: "Member not found.", ephemeral: true });
          return;
        }
        group.memberIds = ensureArray(group.memberIds);
        if (sub === "add") {
          if (group.memberIds.includes(targetUser.id)) {
            await interaction.reply({ content: "Member already in group.", ephemeral: true });
            return;
          }
          if (group.type === "faction" && group.memberIds.length >= maxFactionMembers) {
            await interaction.reply({ content: `Faction member limit reached (${maxFactionMembers}).`, ephemeral: true });
            return;
          }
          group.memberIds.push(targetUser.id);
          if (group.roleId) await targetMember.roles.add(group.roleId).catch(() => null);
          registry.updatedUtc = new Date().toISOString();
          saveGroupRegistry(registry);
          await syncGroupRegistryToWebsite(registry);
          await interaction.reply({ content: `Added <@${targetUser.id}> to **${group.name}**.`, ephemeral: true });
          return;
        }
        if (sub === "remove") {
          group.memberIds = group.memberIds.filter((id) => id !== targetUser.id);
          if (group.roleId) await targetMember.roles.remove(group.roleId).catch(() => null);
          registry.updatedUtc = new Date().toISOString();
          saveGroupRegistry(registry);
          await syncGroupRegistryToWebsite(registry);
          await interaction.reply({ content: `Removed <@${targetUser.id}> from **${group.name}**.`, ephemeral: true });
          return;
        }
      }
    }

    if (interaction.commandName === "level") {
      const levels = loadLevels();
      const entry = levels.users[interaction.user.id] || { xp: 0, level: 0 };
      const calc = calcLevelFromXp(entry.xp || 0);
      const needed = Math.max(0, calc.nextLevelAt - (entry.xp || 0));
      await interaction.reply({ content: `🎖️ **Level ${entry.level || 0}** — XP: ${entry.xp || 0}. ${needed} XP to next level.` });
      return;
    }

    if (interaction.commandName === "levels") {
      const levels = loadLevels();
      const entries = Object.entries(levels.users || {})
        .map(([id, row]) => ({ id, xp: row.xp || 0, level: row.level || 0 }))
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 10);
      if (!entries.length) {
        await interaction.reply("No level data yet.");
        return;
      }
      const lines = entries.map((row, idx) => `${idx + 1}. <@${row.id}> — Level ${row.level} (${row.xp} XP)`);
      const embed = new EmbedBuilder().setTitle("Level Leaderboard").setDescription(lines.join("\n")).setColor(0x38bdf8);
      await interaction.reply({ embeds: [embed] });
      return;
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
        const channel = await createGuildChannelWithApproval(interaction.guild, {
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
        const navLinks = { rules: links.rules };
        const content = buildStartPanelContent(navLinks);
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("start:rules").setLabel("Rules").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("start:status").setLabel("Server Status").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("start:help").setLabel("Help Wizard").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("start:ticket").setLabel("Open Ticket").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("start:website").setLabel("Website").setStyle(ButtonStyle.Secondary)
        );
        const roleRows = buildOptInButtons();
        await sendMessageWithGuards(interaction.channel, { content, components: [row1, ...roleRows] }, "onboard.post", reqId);
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
        const id = interaction.options.getString("id") || "";
        const reason = interaction.options.getString("reason") || "Resolved by moderator.";
        const row = id
          ? data.cases.find((x) => x.id === id)
          : data.cases.find((x) => x.threadId === interaction.channelId && x.status !== "closed" && x.status !== "cancelled");
        if (!row) {
          const closedTicket = await closeTicketConversation(interaction, interaction.channel);
          if (closedTicket) return;
          const closedOrphanModcall = await closeOrphanModcallConversation(interaction, interaction.channel);
          if (closedOrphanModcall) return;
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
            ? `Case \`${row.id}\` closed. Deleted linked ticket/chat channel(s): ${cleanup.details.join(", ")}`
            : `Case \`${row.id}\` closed.`,
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
          { name: "Mods", value: links.mods, inline: false },
          { name: "Factions", value: `${siteUrl}/factions`, inline: false },
          { name: "Dossiers", value: links.dossiers, inline: false },
          { name: "Story Arcs", value: links.arcs, inline: false },
          { name: "Events", value: links.events, inline: false },
          { name: "Economy", value: links.economy, inline: false }
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
        const preserveExisting = interaction.options.getBoolean("preserve_existing");
        const applyTopics = interaction.options.getBoolean("apply_topics") || false;
        const createIndexes = interaction.options.getBoolean("create_indexes");
        const createCore = interaction.options.getBoolean("create_core");
        const archiveStaleDays = Math.max(0, Math.min(interaction.options.getInteger("archive_stale_days") || 0, 3650));
        const limit = Math.max(1, Math.min(interaction.options.getInteger("limit") || 30, 100));

        await interaction.deferReply({ ephemeral: true });
        await interaction.guild.channels.fetch();
        const plan = planGuildOrganization(interaction.guild, {
          includeVoice: includeVoice !== false,
          normalizeNames,
          preserveExisting: preserveExisting !== false,
          applyTopics,
          createIndexes: createIndexes !== false,
          createCore: createCore !== false,
          limit
        });
        if ((preserveExisting === false) && archiveStaleDays > 0) {
          plan.archivePlan = await detectStaleChannelsForArchive(interaction.guild, archiveStaleDays, Math.min(25, limit));
        }

        if (!plan.actions.length && !(plan.indexPlan || []).length && !(plan.corePlan || []).length && !(plan.archivePlan || []).length) {
          await interaction.editReply({
            content: "No organization changes needed. Your channels already match the current rules."
          });
          return;
        }

        const previewLines = plan.actions.slice(0, 20).map((x) =>
          `#${x.channelName}: ${x.fromCategory} -> ${x.toCategory}${x.renameTo ? ` | rename -> ${x.renameTo}` : ""}${x.topicTo ? " | set topic" : ""}`
        );
        const indexPreview = (plan.indexPlan || []).slice(0, 8).map((x) => `create #${x.name} in ${x.category}`);
        const archivePreview = (plan.archivePlan || []).slice(0, 8).map((x) => `archive #${x.channelName} (last active ${x.lastActiveAt})`);
        if (!apply || isSimulationModeEnabled()) {
          await interaction.editReply({
            content: [
              apply && isSimulationModeEnabled() ? "Simulation mode is enabled. Showing preview only." : "Organization preview:",
              `Planned channel edits: ${plan.actions.length}${plan.actions.length >= limit ? ` (limited to ${limit})` : ""}`,
              `Planned index channels: ${(plan.indexPlan || []).length}`,
              `Planned core channels: ${(plan.corePlan || []).length}`,
              `Planned archive moves: ${(plan.archivePlan || []).length}${archiveStaleDays > 0 ? ` (>${archiveStaleDays} days inactive)` : ""}`,
              ...previewLines,
              plan.actions.length > 20 ? `...and ${plan.actions.length - 20} more` : "",
              ...indexPreview,
              (plan.indexPlan || []).length > 8 ? `...and ${(plan.indexPlan || []).length - 8} more index channel(s)` : "",
              ...((plan.corePlan || []).slice(0, 8).map((x) => `create #${x.name} in ${x.category}`)),
              (plan.corePlan || []).length > 8 ? `...and ${(plan.corePlan || []).length - 8} more core channel(s)` : "",
              ...archivePreview,
              (plan.archivePlan || []).length > 8 ? `...and ${(plan.archivePlan || []).length - 8} more archive move(s)` : "",
              "Run `/ops organize mode:apply` to execute."
            ].filter(Boolean).join("\n")
          });
          return;
        }

        const result = await applyGuildOrganizationPlan(interaction.guild, plan, interaction.user.tag);
        addIncident({
          severity: "low",
          userId: interaction.user.id,
          reason: `ops organize apply moved=${result.moved} renamed=${result.renamed} topics=${result.topicsSet} indexes=${result.indexCreated} archived=${result.archived} failed=${result.failed}`,
          createdBy: interaction.user.id,
          auto: true
        });
        await interaction.editReply({
          content: [
            "Organization applied.",
            `Planned edits: ${plan.actions.length}`,
            `Planned index channels: ${(plan.indexPlan || []).length}`,
            `Planned core channels: ${(plan.corePlan || []).length}`,
            `Planned archive moves: ${(plan.archivePlan || []).length}`,
            `Moved: ${result.moved}`,
            `Renamed: ${result.renamed}`,
            `Topics set: ${result.topicsSet}`,
            `Index channels created: ${result.indexCreated}`,
            `Core channels created: ${result.coreCreated}`,
            `Directory updated: ${result.directoryUpdated ? "yes" : "no"}`,
            `Archived: ${result.archived}`,
            `Failed: ${result.failed}`,
            result.failures.length ? `Failures: ${result.failures.join(" | ")}` : ""
          ].filter(Boolean).join("\n")
        });
        return;
      }

      if (sub === "welcome") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const mode = interaction.options.getString("mode", true);
        const apply = mode === "apply";
        const overwrite = Boolean(interaction.options.getBoolean("overwrite"));
        const chosen = interaction.options.getChannel("channel");
        await interaction.deferReply({ ephemeral: true });
        await interaction.guild.channels.fetch();

        let target = null;
        if (chosen && chosen.isTextBased() && (chosen.type === ChannelType.GuildText || chosen.type === ChannelType.GuildAnnouncement)) {
          target = chosen;
        }
        if (!target && welcomeChannelId) {
          const byEnv = await interaction.guild.channels.fetch(welcomeChannelId).catch(() => null);
          if (byEnv && byEnv.isTextBased()) target = byEnv;
        }
        if (!target) {
          target = interaction.guild.channels.cache.find((c) =>
            c.type === ChannelType.GuildText && /^welcome(-|$)/i.test(String(c.name || ""))
          ) || null;
        }

        const infoCategory = await ensureCategoryChannel(interaction.guild, "INFORMATION", `welcome setup by ${interaction.user.tag}`);
        const previewChannelName = target ? `#${target.name}` : "#welcome-hub (new)";
        if (!apply || isSimulationModeEnabled()) {
          await interaction.editReply({
            content: [
              apply && isSimulationModeEnabled() ? "Simulation mode is enabled. Showing preview only." : "Welcome channel preview:",
              `Target channel: ${previewChannelName}`,
              `Category: ${infoCategory ? "INFORMATION" : "unchanged"}`,
              "Will post/update a polished welcome card with links and onboarding steps.",
              "Run `/ops welcome mode:apply` to publish."
            ].join("\n")
          });
          return;
        }

        if (!target) {
          target = await createGuildChannelWithApproval(interaction.guild, {
            name: "welcome-hub",
            type: ChannelType.GuildText,
            parent: infoCategory?.id || null,
            topic: "Start here: rules, links, support, and onboarding."
          }).catch(() => null);
        }
        if (!target || !target.isTextBased()) {
          await interaction.editReply({ content: "Failed to create or resolve welcome channel." });
          return;
        }
        if (infoCategory && typeof target.setParent === "function" && target.parentId !== infoCategory.id) {
          await target.setParent(infoCategory.id, { lockPermissions: false }).catch(() => null);
        }
        if (typeof target.setTopic === "function") {
          await target.setTopic("Start here for everything Grey Hour RP: rules, status, updates, support, and getting started.", "Welcome polish").catch(() => null);
        }

        const welcomeEmbed = new EmbedBuilder()
          .setTitle("Welcome to Grey Hour RP")
          .setDescription("Survive smart. Build your story. This is your starting point.")
          .addFields(
            { name: "Start Here", value: `Read rules: ${links.rules}\nJoin guide: ${links.join}`, inline: false },
            { name: "Live Info", value: `Status: <#${statusChannelId || "unknown"}>\nUpdates: ${links.updates}`, inline: false },
            { name: "Need Help?", value: "Use `/ticket create` for private support or `/help` for all commands.", inline: false }
          )
          .setColor(0xb10f16)
          .setFooter({ text: "Grey Hour RP • Welcome Hub" })
          .setTimestamp();
        const welcomeButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Rules").setURL(links.rules),
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("How To Join").setURL(links.join),
          new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel("Website").setURL(links.site)
        );

        const recent = await target.messages.fetch({ limit: 30 }).catch(() => null);
        const existing = recent?.find((m) =>
          m.author?.id === client.user?.id &&
          Array.isArray(m.embeds) &&
          m.embeds.some((e) => String(e.title || "").toLowerCase().includes("welcome to grey hour rp"))
        ) || null;
        if (existing && !overwrite) {
          await interaction.editReply({
            content: [
              `Found an existing welcome card in <#${target.id}>.`,
              "No changes were made.",
              "Re-run with `overwrite:true` to replace it."
            ].join("\n")
          });
          return;
        }
        const published = existing
          ? await existing.edit({ embeds: [welcomeEmbed], components: [welcomeButtons] }).catch(() => null)
          : await sendMessageWithGuards(target, { embeds: [welcomeEmbed], components: [welcomeButtons] }, "ops.welcome.publish", reqId);
        if (published && !disablePins) await published.pin().catch(() => {});

        await interaction.editReply({
          content: `Welcome experience published in <#${target.id}>.`
        });
        return;
      }

      if (sub === "channelmap") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const mode = interaction.options.getString("mode") || "summary";
        const includeVoice = interaction.options.getBoolean("include_voice");
        const overwrite = Boolean(interaction.options.getBoolean("overwrite"));
        await interaction.deferReply({ ephemeral: true });
        await interaction.guild.channels.fetch();

        const map = buildGuildChannelMap(interaction.guild, includeVoice !== false);
        const fullText = map.lines.join("\n").trim();
        if (mode === "summary") {
          if (fullText.length <= 1800) {
            await interaction.editReply({ content: fullText || "No channels found." });
            return;
          }
          await interaction.editReply({
            content: `Channel map generated (${map.channelCount} channels across ${map.categoryCount} categories).`,
            files: [{ attachment: Buffer.from(fullText, "utf-8"), name: `channel-map-${interaction.guild.id}.txt` }]
          });
          return;
        }

        const infoCategory = await ensureCategoryChannel(interaction.guild, "INFORMATION", `channel map publish by ${interaction.user.tag}`);
        const dirChannel = interaction.guild.channels.cache.find((c) =>
          c.type === ChannelType.GuildText &&
          String(c.name || "").toLowerCase() === "server-directory" &&
          (!infoCategory || c.parentId === infoCategory.id)
        ) || await createGuildChannelWithApproval(interaction.guild, {
          name: "server-directory",
          type: ChannelType.GuildText,
          parent: infoCategory?.id || null,
          topic: "Full channel directory and navigation map."
        }).catch(() => null);

        if (!dirChannel || !dirChannel.isTextBased()) {
          await interaction.editReply({ content: "Failed to create/find #server-directory channel." });
          return;
        }

        const dirHeader = [
          "**Grey Hour RP Channel Directory**",
          `Generated: ${new Date().toISOString()}`,
          `Total channels: ${map.channelCount}`,
          `Categories: ${map.categoryCount}`,
          "",
          "Full map is attached below."
        ].join("\n");
        const recent = await dirChannel.messages.fetch({ limit: 20 }).catch(() => null);
        const existing = recent?.find((m) =>
          m.author?.id === client.user?.id &&
          String(m.content || "").includes("Grey Hour RP Channel Directory")
        ) || null;
        const payload = {
          content: dirHeader,
          files: [{ attachment: Buffer.from(fullText, "utf-8"), name: `channel-map-${interaction.guild.id}.txt` }]
        };
        if (existing && !overwrite) {
          await interaction.editReply({
            content: [
              `Found an existing published directory card in <#${dirChannel.id}>.`,
              "No changes were made.",
              "Re-run with `overwrite:true` to replace it."
            ].join("\n")
          });
          return;
        }
        const posted = existing
          ? await existing.edit(payload).catch(() => null)
          : await sendMessageWithGuards(dirChannel, payload, "ops.channelmap.publish", reqId);
        if (posted && !disablePins) await posted.pin().catch(() => {});

        await interaction.editReply({
          content: `Channel directory published in <#${dirChannel.id}> with full map attached.`
        });
        return;
      }

      if (sub === "textauto") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const mode = interaction.options.getString("mode", true);
        const apply = mode === "apply";
        const fullScan = interaction.options.getBoolean("full_scan") || false;
        await interaction.deferReply({ ephemeral: true });

        let result;
        let websiteSync = null;
        if (fullScan) {
          await interaction.guild.channels.fetch();
          const allTextCount = Array.from(interaction.guild.channels.cache.values())
            .filter((c) => c && !c.isThread?.() && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement))
            .length;
          result = await runTextChannelAutomation({
            guild: interaction.guild,
            manual: true,
            previewOnly: !apply || isSimulationModeEnabled(),
            force: true,
            maxChannels: Math.max(1, allTextCount)
          });
        } else {
          result = await runTextChannelAutomation({
            guild: interaction.guild,
            manual: true,
            previewOnly: !apply || isSimulationModeEnabled(),
            force: true
          });
        }
        if (apply && !isSimulationModeEnabled()) {
          websiteSync = await runWebsiteChannelSync({ guild: interaction.guild, manual: true });
        }

        await interaction.editReply({
          content: [
            (!apply || isSimulationModeEnabled()) ? "Text channel automation preview:" : "Text channel automation applied:",
            `Processed: ${result.processed}/${result.totalTextChannels || result.processed}`,
            `Topics set: ${result.topicsSet || 0}`,
            `Guides posted: ${result.guidesPosted || 0}`,
            `Guides updated: ${result.guidesUpdated || 0}`,
            websiteSync ? `Website channel sync: updated ${websiteSync.updated}, skipped ${websiteSync.skipped}, failed ${websiteSync.failed}` : "",
            websiteSync?.createdChannels?.length ? `Website channels created: ${websiteSync.createdChannels.join(", ")}` : "",
            `Failed: ${result.failed || 0}`,
            result.notes?.length ? `Preview notes: ${result.notes.join(" | ")}` : ""
          ].filter(Boolean).join("\n")
        });
        return;
      }

      if (sub === "websitesync") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const mode = interaction.options.getString("mode", true);
        const apply = mode === "apply";
        await interaction.deferReply({ ephemeral: true });
        const result = await runWebsiteChannelSync({
          guild: interaction.guild,
          manual: true,
          previewOnly: !apply || isSimulationModeEnabled()
        });
        await interaction.editReply({
          content: [
            (!apply || isSimulationModeEnabled()) ? "Website channel sync preview:" : "Website channel sync applied:",
            `Updated: ${result.updated || 0}`,
            `Skipped: ${result.skipped || 0}`,
            `Failed: ${result.failed || 0}`,
            result.createdChannels?.length ? `Created channels: ${result.createdChannels.join(", ")}` : "",
            result.notes?.length ? `Targets: ${result.notes.join(" | ")}` : ""
          ].filter(Boolean).join("\n")
        });
        return;
      }

      if (sub === "digest") {
        const period = interaction.options.getString("period") || "daily";
        const digest = buildStaffDigest(period === "weekly" ? "weekly" : "daily");
        if (logChannelId && !isSimulationModeEnabled()) {
          const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            await sendMessageWithGuards(logChannel, { content: `${digest}\nauto-marker:staff-digest:${period}:${new Date().toISOString().slice(0, 10)}` }, "ops.digest.post", reqId);
          }
        }
        await interaction.reply({ content: truncate(digest, 1900), ephemeral: true });
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

      if (sub === "channels") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const action = interaction.options.getString("action", true);
        const requestId = String(interaction.options.getString("request_id") || "").trim();
        const existingChannel = interaction.options.getChannel("existing_channel");
        const queue = loadChannelCreateApprovals();
        queue.requests = Array.isArray(queue.requests) ? queue.requests : [];

        if (action === "pending") {
          const pending = queue.requests
            .filter((row) => row && row.status === "pending" && String(row.guildId || "") === String(interaction.guild.id))
            .slice(0, 20);
          if (!pending.length) {
            await interaction.reply({ content: "No pending channel creation requests.", ephemeral: true });
            return;
          }
          const lines = pending.map((row) =>
            `- \`${row.id}\` • ${channelTypeLabel(row.type)} • \`${row.name}\`${row.parentId ? ` • parent <#${row.parentId}>` : ""} • source:${row.source || "auto"}`
          );
          await interaction.reply({
            content: truncate(["**Pending Channel Requests**", ...lines].join("\n"), 1800),
            ephemeral: true
          });
          return;
        }

        if (!requestId) {
          await interaction.reply({ content: "Provide `request_id` for approve/deny.", ephemeral: true });
          return;
        }

        const row = queue.requests.find((x) =>
          x && x.status === "pending" && String(x.guildId || "") === String(interaction.guild.id) && String(x.id || "") === requestId
        );
        if (!row) {
          await interaction.reply({ content: `Pending request not found: \`${requestId}\`.`, ephemeral: true });
          return;
        }

        if (action === "deny") {
          row.status = "denied";
          row.deniedAt = new Date().toISOString();
          row.deniedBy = interaction.user.id;
          queue.updatedUtc = new Date().toISOString();
          saveChannelCreateApprovals(queue);
          await interaction.reply({ content: `Denied \`${requestId}\`.`, ephemeral: true });
          return;
        }

        if (action !== "approve") {
          await interaction.reply({ content: "Unsupported action.", ephemeral: true });
          return;
        }

        let resolvedChannel = null;
        if (existingChannel) {
          resolvedChannel = existingChannel;
        } else {
          const createOptions = normalizeCreateChannelOptions(row.options || {}) || normalizeCreateChannelOptions({
            name: row.name,
            type: row.type,
            parent: row.parentId || null,
            reason: row.reason || "Approved channel creation"
          });
          if (!createOptions) {
            await interaction.reply({ content: "Request has invalid channel options and cannot be approved.", ephemeral: true });
            return;
          }
          resolvedChannel = await createGuildChannelWithApproval(interaction.guild, createOptions, {
            bypassApproval: true,
            source: "ops.channels.approve",
            requesterId: interaction.user.id,
            reason: `Approved by ${interaction.user.tag}`
          });
          if (!resolvedChannel) {
            await interaction.reply({ content: "Channel creation failed. Check bot Manage Channels permission.", ephemeral: true });
            return;
          }
        }

        row.status = "approved";
        row.approvedAt = new Date().toISOString();
        row.approvedBy = interaction.user.id;
        row.resolvedChannelId = resolvedChannel.id;
        queue.updatedUtc = new Date().toISOString();
        saveChannelCreateApprovals(queue);
        await interaction.reply({ content: `Approved \`${requestId}\` -> <#${resolvedChannel.id}>`, ephemeral: true });
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
      const players = status.playersOnline ?? status.players ?? status.playerCount ?? status.onlinePlayers ?? null;
      const embed = new EmbedBuilder()
        .setTitle("Grey Hour RP Status")
        .setDescription(status.message || "No status published")
        .addFields(
          { name: "State", value: status.status || "unknown", inline: true },
          { name: "Updated", value: updatedStamp ? new Date(updatedStamp).toUTCString() : "Unknown", inline: true }
        )
        .setColor(statusColor(status.status));
      if (typeof players === "number") {
        embed.addFields({ name: "Players Online", value: String(players), inline: true });
      }
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

    if (interaction.commandName === "live") {
      await interaction.deferReply({ ephemeral: false });
      let telemetry = null;
      let discordMetrics = null;
      try {
        telemetry = await getGameTelemetry();
      } catch {}
      try {
        discordMetrics = await getDiscordMetrics();
      } catch {}

      const server = telemetry?.server || {};
      const mods = telemetry?.mods || {};
      const counters = discordMetrics?.counters || {};
      const playersOnline = toNumber(server.playersOnline);
      const maxPlayers = toNumber(server.maxPlayers);
      const queue = toNumber(server.queue);
      const discordMembers = toNumber(counters.gh_bot_discord_members_gauge);
      const openTickets = toNumber(counters.gh_bot_ticket_open_total);
      const openModcalls = toNumber(counters.gh_bot_modcall_open_total);

      const embed = new EmbedBuilder()
        .setTitle("Grey Hour Live Snapshot")
        .setColor(0x0ea5e9)
        .addFields(
          { name: "Server State", value: String(server.status || "unknown"), inline: true },
          { name: "Players", value: playersOnline !== null ? String(playersOnline) : "—", inline: true },
          { name: "Queue", value: queue !== null ? String(queue) : "—", inline: true },
          { name: "Map", value: server.map ? String(server.map) : "Unknown", inline: true },
          { name: "Mods", value: mods.count != null ? String(mods.count) : "—", inline: true },
          { name: "Discord Members", value: discordMembers !== null ? String(discordMembers) : "—", inline: true },
          { name: "Open Tickets", value: openTickets !== null ? String(openTickets) : "—", inline: true },
          { name: "Open Modcalls", value: openModcalls !== null ? String(openModcalls) : "—", inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "shop") {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: "Shop requests must be used inside the server.", ephemeral: true });
        return;
      }
      const sub = interaction.options.getSubcommand();
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      const autoShopChannelNames = [
        "demons-autoshop",
        "demons-auto-shop",
        "demons auto shop",
        "demons-autoshop-requests",
        "demons-auto-shop-requests",
        "autoshop",
        "auto-shop",
        "autoshop-requests",
        "auto-shop-requests",
        "repair-shop",
        "repair-shop-requests"
      ];
      const storeRequestsChannelNames = [
        "shop-requests",
        "shop request",
        "shop-request",
        "store-requests",
        "store request",
        "store-request",
        "business-requests",
        "business request",
        "business-request"
      ];

      const interactionChannel = interaction.channel && interaction.channel.isTextBased()
        ? interaction.channel
        : null;

      const autoShopChannel = await resolveTextChannelByIdOrName(guild, autoShopChannelId, autoShopChannelNames);
      const storeRequestsChannel = await resolveTextChannelByIdOrName(guild, storeRequestChannelId, storeRequestsChannelNames);

      const autoShopTarget = pickPostableChannel([
        autoShopChannel,
        interactionChannel && channelNameMatches(interactionChannel, autoShopChannelNames) ? interactionChannel : null,
        interactionChannel && channelNameMatches(interactionChannel, storeRequestsChannelNames) ? interactionChannel : null,
        storeRequestsChannel
      ]);

      const storeRequestsTarget = pickPostableChannel([
        storeRequestsChannel,
        interactionChannel && channelNameMatches(interactionChannel, storeRequestsChannelNames) ? interactionChannel : null,
        interactionChannel && channelNameMatches(interactionChannel, autoShopChannelNames) ? interactionChannel : null,
        autoShopChannel
      ]);

      if (sub === "request") {
        if (!autoShopTarget) {
          await interaction.editReply({ content: "Auto shop channel not found or not writable. Create `#demons-autoshop`, set `AUTOSHOP_CHANNEL_ID`, or grant the bot Send Messages." });
          return;
        }
        const type = interaction.options.getString("type", true);
        const details = interaction.options.getString("details", true);
        const vehicle = interaction.options.getString("vehicle");
        const location = interaction.options.getString("location");
        const contact = interaction.options.getString("contact");
        const urgency = interaction.options.getString("urgency") || "normal";
        const requestId = makeId("autoshop");
        const mention = (autoShopRoleId || resolvedAutoShopRoleId) ? `<@&${autoShopRoleId || resolvedAutoShopRoleId}> ` : "";
        const lines = [
          `${mention}🛠️ **Auto Shop Request**`,
          `Request ID: ${requestId}`,
          `Requester: <@${interaction.user.id}>`,
          `Type: ${type}`,
          `Urgency: ${urgency}`,
          `Details: ${details}`,
          vehicle ? `Vehicle: ${vehicle}` : null,
          location ? `Location: ${location}` : null,
          contact ? `Contact: ${contact}` : null,
          interaction.channelId ? `Submitted From: <#${interaction.channelId}>` : null
        ].filter(Boolean);
        const controls = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`shopreq:claim:${requestId}`).setLabel("Claim").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`shopreq:complete:${requestId}`).setLabel("Complete").setStyle(ButtonStyle.Success)
        );
        const posted = await sendMessageWithGuards(autoShopTarget, { content: lines.join("\n"), components: [controls] }, "shop.request");
        if (!posted) {
          sendOpsAlert("shop.request.failed", `Unable to post auto shop request ${requestId} in <#${autoShopTarget.id}>.`);
          await interaction.editReply({ content: "I couldn't post your request (permissions or rate limit). Please try again or ask staff to check bot permissions." });
          return;
        }
        const state = loadShopRequests();
        state.requests.unshift({
          id: requestId,
          status: "open",
          type,
          details,
          requesterId: interaction.user.id,
          channelId: autoShopTarget.id,
          messageId: posted?.id || "",
          createdAt: new Date().toISOString()
        });
        saveShopRequests(state);
        logEvent("info", "shop.request", { userId: interaction.user.id, type });
        if (posted && typeof posted.startThread === "function") {
          const thread = await posted.startThread({
            name: `autoshop-${interaction.user.username}-${Date.now().toString(36)}`.slice(0, 90),
            autoArchiveDuration: 1440,
            reason: "Auto shop request"
          }).catch(() => null);
          if (thread) {
            const updated = loadShopRequests();
            const row = updated.requests.find((r) => r.id === requestId);
            if (row) {
              row.threadId = thread.id;
              saveShopRequests(updated);
            }
            await interaction.editReply({ content: `Request sent to ${autoShopTarget.toString()} and thread ${thread.toString()}.` });
            return;
          }
        }
        await interaction.editReply({ content: `Request sent to ${autoShopTarget.toString()}.` });
        return;
      }

      if (sub === "store") {
        if (!storeRequestsTarget) {
          await interaction.editReply({ content: "Store requests channel not found or not writable. Create `#shop-requests`, set `STORE_REQUESTS_CHANNEL_ID`, or grant the bot Send Messages." });
          return;
        }
        const name = interaction.options.getString("name", true);
        const category = interaction.options.getString("category", true);
        const description = interaction.options.getString("description", true);
        const owner = interaction.options.getString("owner");
        const location = interaction.options.getString("location");
        const contact = interaction.options.getString("contact");
        const shopId = makeId("shop");
        const storeMention = (shopManagerRoleId || resolvedShopManagerRoleId) ? `<@&${shopManagerRoleId || resolvedShopManagerRoleId}> ` : "";
        const lines = [
          `${storeMention}🏪 **New In-Game Store Request**`,
          `Shop ID: ${shopId}`,
          `Requester: <@${interaction.user.id}>`,
          `Name: ${name}`,
          `Category: ${category}`,
          `Description: ${description}`,
          owner ? `Owner: ${owner}` : null,
          location ? `Location: ${location}` : null,
          contact ? `Contact: ${contact}` : null,
          interaction.channelId ? `Submitted From: <#${interaction.channelId}>` : null
        ].filter(Boolean);
        const controls = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`shopstore:approve:${shopId}`).setLabel("Approve").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`shopstore:deny:${shopId}`).setLabel("Deny").setStyle(ButtonStyle.Danger)
        );
        const posted = await sendMessageWithGuards(storeRequestsTarget, { content: lines.join("\n"), components: [controls] }, "shop.store");
        if (!posted) {
          sendOpsAlert("shop.store.failed", `Unable to post store request ${shopId} in <#${storeRequestsTarget.id}>.`);
          await interaction.editReply({ content: "I couldn't post your store request (permissions or rate limit). Please try again or ask staff to check bot permissions." });
          return;
        }
        logEvent("info", "shop.store", { userId: interaction.user.id, name, category });
        let contentOk = true;
        try {
          const rows = await loadShopsContent();
          rows.unshift({
            id: shopId,
            name,
            category,
            description,
            owner: owner || "",
            location: location || "",
            contact: contact || "",
            status: "pending",
            featured: false,
            tags: [],
            createdUtc: new Date().toISOString(),
            requestedBy: interaction.user.id,
            requestedFrom: interaction.channelId || "",
            source: "bot"
          });
          await saveShopsContent(rows);
        } catch (err) {
          contentOk = false;
          logEvent("warn", "shop.store.save.failed", { error: err instanceof Error ? err.message : String(err) });
        }
        if (posted && typeof posted.startThread === "function") {
          const thread = await posted.startThread({
            name: `shop-${interaction.user.username}-${Date.now().toString(36)}`.slice(0, 90),
            autoArchiveDuration: 1440,
            reason: "New store request"
          }).catch(() => null);
          if (thread) {
            await interaction.editReply({ content: `Request sent to ${storeRequestsTarget.toString()} and thread ${thread.toString()}.${contentOk ? '' : ' (Warning: website update failed — staff can re-save in Admin > In-Game Shops.)'}` });
            return;
          }
        }
        await interaction.editReply({ content: `Request sent to ${storeRequestsTarget.toString()}.${contentOk ? '' : ' (Warning: website update failed — staff can re-save in Admin > In-Game Shops.)'}` });
        return;
      }
    }

    if (interaction.commandName === "dossier") {
      const sub = interaction.options.getSubcommand();
      if (sub === "submit") {
        await interaction.deferReply({ ephemeral: true });
        const name = interaction.options.getString("name", true);
        const handle = interaction.options.getString("handle");
        const factionId = interaction.options.getString("faction");
        const backstory = interaction.options.getString("backstory");
        const goals = interaction.options.getString("goals");
        try {
          const payload = await loadDossiersContent();
          const rows = Array.isArray(payload.dossiers) ? payload.dossiers : [];
          const now = new Date().toISOString();
          const dossierId = makeId("dossier");
          rows.unshift({
            id: dossierId,
            characterName: name,
            handle: handle || "",
            factionId: factionId || "",
            backstory: backstory || "",
            goals: goals ? goals.split(",").map((g) => g.trim()).filter(Boolean) : [],
            status: "pending",
            reputation: 0,
            commendations: 0,
            warnings: 0,
            createdUtc: now,
            requestedBy: interaction.user.id,
            requestedFrom: interaction.channelId || "",
            notes: ""
          });
          await saveDossiersContent({
            ...payload,
            updatedUtc: now,
            dossiers: rows
          });
          if (dossierReviewChannelId) {
            const reviewChannel = await client.channels.fetch(dossierReviewChannelId).catch(() => null);
            if (reviewChannel && reviewChannel.isTextBased()) {
              const mention = dossierReviewRoleId ? `<@&${dossierReviewRoleId}> ` : "";
              const lines = [
                `${mention}📁 **New Dossier Submission**`,
                `ID: ${dossierId}`,
                `Character: ${name}${handle ? ` (${handle})` : ""}`,
                factionId ? `Faction: ${factionId}` : "",
                backstory ? `Backstory: ${truncate(backstory, 280)}` : "",
                goals ? `Goals: ${goals}` : "",
                `Submitted by: <@${interaction.user.id}>`,
                `Review: ${siteUrl}/admin/dossiers`
              ].filter(Boolean);
              enqueueJob({
                type: "dossier-submit",
                channelId: reviewChannel.id,
                idempotencyKey: `dossier:${dossierId}`,
                allowedMentions: dossierReviewRoleId ? { roles: [dossierReviewRoleId] } : { parse: [] },
                content: lines.join("\n"),
                maxRetries: 6
              });
            }
          }
          await interaction.editReply({ content: "✅ Dossier submitted for review. Staff will approve and publish soon." });
        } catch (err) {
          await interaction.editReply({ content: `Failed to submit dossier: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }

      if (sub === "list") {
        await interaction.deferReply({ ephemeral: false });
        const payload = await loadDossiersContent();
        const approved = (payload.dossiers || []).filter((d) => d.status === "approved").slice(0, 6);
        if (!approved.length) {
          await interaction.editReply({ content: "No approved dossiers yet." });
          return;
        }
        const lines = approved.map((d) => `• **${d.characterName}**${d.handle ? ` (${d.handle})` : ""} — Rep ${d.reputation ?? 0}`);
        const embed = new EmbedBuilder()
          .setTitle("Approved Dossiers")
          .setDescription(truncate(lines.join("\n"), 900))
          .setColor(0x94a3b8)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    if (interaction.commandName === "arc") {
      const sub = interaction.options.getSubcommand();
      if (sub === "list") {
        await interaction.deferReply({ ephemeral: false });
        const payload = await loadStoryArcsContent();
        const arcs = payload.arcs || [];
        if (!arcs.length) {
          await interaction.editReply({ content: "No story arcs posted yet." });
          return;
        }
        const featured = arcs.filter((a) => a.featured) || [];
        const list = (featured.length ? featured : arcs).slice(0, 4);
        const lines = list.map((arc) => {
          const active = (arc.phases || []).find((p) => p.status === "active");
          const phaseText = active ? ` • Active: ${active.name}` : "";
          return `• **${arc.title}** (${arc.status})${phaseText}`;
        });
        const embed = new EmbedBuilder()
          .setTitle("Seasonal Story Arcs")
          .setDescription(truncate(lines.join("\n"), 900))
          .setColor(0x38bdf8)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    if (interaction.commandName === "events") {
      const sub = interaction.options.getSubcommand();
      if (sub === "list") {
        await interaction.deferReply({ ephemeral: false });
        const payload = await loadEventsContent();
        const now = Date.now();
        const events = (payload.events || [])
          .filter((e) => e.status !== "canceled" && e.status !== "complete")
          .filter((e) => !e.startUtc || new Date(e.startUtc).getTime() + 60 * 60 * 1000 > now)
          .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime())
          .slice(0, 6);
        if (!events.length) {
          await interaction.editReply({ content: "No upcoming events posted yet." });
          return;
        }
        const lines = events.map((e) => {
          const when = e.startUtc ? new Date(e.startUtc).toUTCString() : "TBD";
          return `• **${e.title}** (${e.status}) — ${when}${e.location ? ` • ${e.location}` : ""}`;
        });
        const embed = new EmbedBuilder()
          .setTitle("Upcoming Events")
          .setDescription(truncate(lines.join("\n"), 900))
          .setColor(0x22c55e)
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    if (interaction.commandName === "economy") {
      const sub = interaction.options.getSubcommand();
      if (sub === "status") {
        await interaction.deferReply({ ephemeral: false });
        const snapshot = await loadEconomyContent();
        if (!snapshot) {
          await interaction.editReply({ content: "Economy snapshot not available yet." });
          return;
        }
        const highlights = Array.isArray(snapshot.highlights) ? snapshot.highlights : [];
        const embed = new EmbedBuilder()
          .setTitle("Economy Snapshot")
          .setColor(0xf59e0b)
          .addFields(
            { name: "Status", value: String(snapshot.status || "unknown"), inline: true },
            { name: "Price Index", value: String(snapshot.priceIndex ?? "—"), inline: true },
            { name: "Scarcity Index", value: String(snapshot.scarcityIndex ?? "—"), inline: true }
          )
          .setDescription(snapshot.summary ? truncate(snapshot.summary, 600) : "No summary posted.")
          .setTimestamp();
        if (highlights.length) {
          embed.addFields({ name: "Highlights", value: truncate(highlights.join(", "), 900), inline: false });
        }
        await interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    if (interaction.commandName === "digest") {
      const sub = interaction.options.getSubcommand();
      if (sub === "content") {
        const member = await requireStaff(interaction, "digest");
        if (!member) return;
        await interaction.deferReply({ ephemeral: true });
        const state = loadState();
        const queue = Array.isArray(state.contentDigestQueue) ? state.contentDigestQueue : [];
        if (!queue.length) {
          await interaction.editReply({ content: "No pending content changes to post." });
          return;
        }
        await postStaffContentDigest({ force: true, channelId: interaction.channelId });
        await interaction.editReply({ content: "✅ Posted staff content digest." });
        return;
      }
    }

    if (interaction.commandName === "helpline") {
      const sub = interaction.options.getSubcommand();
      if (sub === "staff") {
        const member = await requireStaff(interaction, "helpline");
        if (!member) return;
        const topic = interaction.options.getString("topic", true);
        const config = await loadHelplineConfig();
        const lines = resolveHelplineLinesFromConfig(config, member, "staff", topic);
        await interaction.reply({ content: (lines.length ? lines : ["No script found for this topic."]).join("\n"), ephemeral: true });
        return;
      }
      if (sub === "owner") {
        if (!interaction.inGuild() || !interaction.guild) {
          await interaction.reply({ content: "This command only works in a server.", ephemeral: true });
          return;
        }
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member || !isOwnerOrAdminMember(interaction.guild, member) || !hasPolicyAccess(member, "helpline_owner")) {
          await interaction.reply({ content: "Owner-only command.", ephemeral: true });
          return;
        }
        const topic = interaction.options.getString("topic", true);
        const config = await loadHelplineConfig();
        const lines = resolveHelplineLinesFromConfig(config, member, "owner", topic);
        await interaction.reply({ content: (lines.length ? lines : ["No script found for this topic."]).join("\n"), ephemeral: true });
        return;
      }
    }

    if (interaction.commandName === "ptero") {
      const sub = interaction.options.getSubcommand();
      if (sub === "status") {
        const member = await requireStaff(interaction, "ptero");
        if (!member) return;
        await interaction.deferReply({ ephemeral: true });
        try {
          const server = await getPteroServer();
          const attrs = server?.attributes || {};
          const limits = attrs.limits || {};
          const features = attrs.feature_limits || {};
          let dbCount = null;
          try {
            dbCount = await getPteroServerDatabases(String(attrs.id || pteroServerId || ""));
          } catch {}
          const allocations = Array.isArray(attrs.relationships?.allocations?.data) ? attrs.relationships.allocations.data : [];
          const primaryAlloc = allocations.find((a) => a.attributes?.is_default) || allocations[0];
          const embed = new EmbedBuilder()
            .setTitle("Pterodactyl Server")
            .addFields(
              { name: "Name", value: String(attrs.name || "Unknown"), inline: true },
              { name: "Server ID", value: String(attrs.id ?? "—"), inline: true },
              { name: "External ID", value: String(attrs.external_id || "—"), inline: true },
              { name: "Suspended", value: String(attrs.suspended ?? "—"), inline: true },
              { name: "Node", value: String(attrs.node ?? "—"), inline: true },
              { name: "Egg", value: String(attrs.egg ?? "—"), inline: true },
              { name: "Primary Allocation", value: primaryAlloc?.attributes ? `${primaryAlloc.attributes.ip}:${primaryAlloc.attributes.port}` : "—", inline: true },
              { name: "Memory", value: limits.memory != null ? `${limits.memory} MB` : "—", inline: true },
              { name: "Disk", value: limits.disk != null ? `${limits.disk} MB` : "—", inline: true },
              { name: "CPU", value: limits.cpu != null ? `${limits.cpu}%` : "—", inline: true },
              { name: "Feature Limits", value: `DB: ${features.databases ?? "—"} • Backups: ${features.backups ?? "—"} • Alloc: ${features.allocations ?? "—"}`, inline: false },
              { name: "Databases", value: dbCount != null ? String(dbCount) : "—", inline: true }
            )
            .setColor(0x6366f1)
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          await interaction.editReply({ content: `Pterodactyl error: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }
      if (sub === "resources") {
        const member = await requireStaff(interaction, "ptero");
        if (!member) return;
        await interaction.deferReply({ ephemeral: true });
        try {
          const payload = await getPteroClientResources();
          const attrs = payload?.attributes || {};
          const state = attrs.current_state || "unknown";
          const cpu = attrs.resources?.cpu_absolute;
          const memoryBytes = attrs.resources?.memory_bytes;
          const memoryLimitBytes = attrs.resources?.memory_limit_bytes;
          const diskBytes = attrs.resources?.disk_bytes;
          const diskLimitBytes = attrs.resources?.disk_limit_bytes;
          const networkRx = attrs.resources?.network_rx_bytes;
          const networkTx = attrs.resources?.network_tx_bytes;
          const uptime = attrs.resources?.uptime;
          const memoryPercent = percentOf(memoryBytes, memoryLimitBytes);
          const diskPercent = percentOf(diskBytes, diskLimitBytes);
          const embed = new EmbedBuilder()
            .setTitle("Pterodactyl Resources")
            .setColor(0x0ea5e9)
            .addFields(
              { name: "State", value: String(state), inline: true },
              { name: "CPU", value: cpu != null ? `${cpu}%` : "—", inline: true },
              { name: "Uptime", value: formatDurationMs(uptime), inline: true },
              { name: "Memory", value: memoryBytes != null ? `${formatBytes(memoryBytes)} / ${formatBytes(memoryLimitBytes)}${memoryPercent != null ? ` (${memoryPercent}%)` : ""}` : "—", inline: true },
              { name: "Disk", value: diskBytes != null ? `${formatBytes(diskBytes)} / ${formatBytes(diskLimitBytes)}${diskPercent != null ? ` (${diskPercent}%)` : ""}` : "—", inline: true },
              { name: "Network", value: networkRx != null ? `${formatBytes(networkRx)} down / ${formatBytes(networkTx)} up` : "—", inline: false }
            )
            .setTimestamp();
          await interaction.editReply({ embeds: [embed] });
        } catch (err) {
          await interaction.editReply({ content: `Pterodactyl error: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }
      if (sub === "power") {
        const member = await requireStaff(interaction, "ptero");
        if (!member) return;
        const signal = interaction.options.getString("signal", true);
        const confirm = interaction.options.getBoolean("confirm") || false;
        const destructive = signal === "stop" || signal === "restart" || signal === "kill";
        if (!confirm) {
          await interaction.reply({ content: "Confirmation required. Re-run with `confirm:true`.", ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          if (destructive && adminRequireSecondConfirmation) {
            const state = loadState();
            const approvals = Array.isArray(state.pteroPowerApprovals) ? state.pteroPowerApprovals : [];
            const now = Date.now();
            const windowMs = Math.max(1, pteroPowerConfirmWindowMinutes) * 60 * 1000;
            const active = approvals.filter((x) => new Date(x.expiresAt || 0).getTime() > now);
            const existing = active.find((x) => x.signal === signal);
            if (existing && existing.requestedBy !== interaction.user.id) {
              await sendPteroPowerSignal(signal);
              state.pteroPowerApprovals = active.filter((x) => x !== existing);
              state.pteroLastPower = {
                signal,
                confirmedBy: interaction.user.id,
                requestedBy: existing.requestedBy,
                at: new Date().toISOString()
              };
              saveState(state);
              await interaction.editReply({ content: `✅ Power signal \`${signal}\` confirmed and sent.` });
              return;
            }
            if (existing && existing.requestedBy === interaction.user.id) {
              await interaction.editReply({ content: `Awaiting second staff confirmation for \`${signal}\`. Expires in ${pteroPowerConfirmWindowMinutes}m.` });
              return;
            }
            active.push({
              signal,
              requestedBy: interaction.user.id,
              requestedAt: new Date().toISOString(),
              expiresAt: new Date(now + windowMs).toISOString()
            });
            state.pteroPowerApprovals = active.slice(-25);
            saveState(state);
            await interaction.editReply({ content: `Approval request created for \`${signal}\`. A second staff member must confirm within ${pteroPowerConfirmWindowMinutes}m.` });
            return;
          }
          await sendPteroPowerSignal(signal);
          await interaction.editReply({ content: `✅ Sent power signal: ${signal}.` });
        } catch (err) {
          await interaction.editReply({ content: `Pterodactyl error: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }
      if (sub === "console") {
        const member = await requireStaff(interaction, "ptero");
        if (!member) return;
        const minutesRaw = interaction.options.getInteger("minutes");
        const minutes = Math.max(1, Math.min(minutesRaw || pteroConsoleDefaultMinutes, pteroConsoleMaxMinutes));
        const channel = interaction.options.getChannel("channel") || interaction.channel;
        if (!channel || !channel.isTextBased()) {
          await interaction.reply({ content: "Invalid destination channel.", ephemeral: true });
          return;
        }
        if (isChannelBusy(channel)) {
          await interaction.reply({ content: "Channel is busy. Try again in a moment or pick another channel.", ephemeral: true });
          return;
        }
        const state = loadState();
        const cooldownMap = state.pteroConsoleCooldown && typeof state.pteroConsoleCooldown === "object" ? state.pteroConsoleCooldown : {};
        const lastAt = cooldownMap[interaction.user.id] ? new Date(cooldownMap[interaction.user.id]).getTime() : 0;
        const cooldownMs = Math.max(1, pteroConsoleCooldownMinutes) * 60 * 1000;
        if (lastAt && Date.now() - lastAt < cooldownMs) {
          const remainingMs = Math.max(0, cooldownMs - (Date.now() - lastAt));
          await interaction.reply({ content: `Please wait ${formatDurationMs(remainingMs)} before starting another console stream.`, ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          const result = await openPteroConsoleStream({
            channel,
            durationMs: minutes * 60 * 1000,
            requesterId: interaction.user.id,
            reqId
          });
          if (result === "already-running") {
            await interaction.editReply({ content: "Console stream already active in that channel." });
            return;
          }
          if (result === "invalid-channel") {
            await interaction.editReply({ content: "Invalid destination channel." });
            return;
          }
          cooldownMap[interaction.user.id] = new Date().toISOString();
          state.pteroConsoleCooldown = cooldownMap;
          saveState(state);
          await interaction.editReply({ content: `✅ Console stream started in <#${channel.id}> for ${minutes} minute(s).` });
        } catch (err) {
          await interaction.editReply({ content: `Pterodactyl error: ${err instanceof Error ? err.message : String(err)}` });
        }
        return;
      }
    }

    if (interaction.commandName === "game") {
      const sub = interaction.options.getSubcommand();

      if (sub === "status") {
        const staff = await requireStaff(interaction, "ops");
        if (!staff) return;
        await interaction.deferReply({ ephemeral: true });
        const [control, health, telemetry] = await Promise.allSettled([
          adminFetch("/api/admin/game/control/status", { reqId }),
          adminFetch("/api/admin/game/control/health", { reqId }).catch(() => null),
          getGameTelemetry().catch(() => null)
        ]);
        const controlValue = control.status === "fulfilled" ? control.value : null;
        const healthValue = health.status === "fulfilled" ? health.value : null;
        const telemetryValue = telemetry.status === "fulfilled" ? telemetry.value : null;
        const server = telemetryValue?.server || {};
        const embed = new EmbedBuilder()
          .setTitle("Game Server Status")
          .setColor(0x22c55e)
          .addFields(
            { name: "Configured", value: String(controlValue?.configured ?? "unknown"), inline: true },
            { name: "Mode", value: String(controlValue?.mode ?? "unknown"), inline: true },
            { name: "RCON Healthy", value: String(healthValue?.ok ?? "unknown"), inline: true },
            { name: "State", value: String(server.status ?? "unknown"), inline: true },
            { name: "Players", value: server.playersOnline != null ? String(server.playersOnline) : "—", inline: true },
            { name: "Host", value: String(server.host ?? "unknown"), inline: true }
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === "players") {
        const staff = await requireStaff(interaction, "ops");
        if (!staff) return;
        await interaction.deferReply({ ephemeral: true });
        try {
          const telemetry = await getGameTelemetry();
          const server = telemetry?.server || {};
          if (server.playersOnline != null) {
            await interaction.editReply({ content: `Players online: **${server.playersOnline}**` });
            return;
          }
        } catch {}
        const payload = await adminFetch("/api/admin/game/control/command", {
          reqId,
          method: "POST",
          body: { command: "players" }
        });
        await interaction.editReply({ content: payload?.payload?.response || "Player list unavailable." });
        return;
      }

      if (sub === "announce") {
        const staff = await requireStaff(interaction, "ops");
        if (!staff) return;
        const message = interaction.options.getString("message", true);
        await interaction.deferReply({ ephemeral: true });
        await adminFetch("/api/admin/game/control/announce", {
          reqId,
          method: "POST",
          body: { message }
        });
        logEvent("info", "game.announce", { userId: interaction.user.id, message: truncate(message, 240) });
        await interaction.editReply({ content: "Announcement sent to the game server." });
        return;
      }

      if (sub === "save") {
        const staff = await requireStaff(interaction, "ops");
        if (!staff) return;
        await interaction.deferReply({ ephemeral: true });
        await adminFetch("/api/admin/game/control/command", {
          reqId,
          method: "POST",
          body: { command: "save" }
        });
        logEvent("info", "game.save", { userId: interaction.user.id });
        await interaction.editReply({ content: "Save command sent." });
        return;
      }

      if (sub === "restart") {
        const staff = await requireStaff(interaction, "admin");
        if (!staff) return;
        await interaction.deferReply({ ephemeral: true });
        await adminFetch("/api/admin/game/control/restart", { reqId, method: "POST" });
        logEvent("warn", "game.restart", { userId: interaction.user.id });
        await interaction.editReply({ content: "Restart command sent." });
        return;
      }

      if (sub === "command") {
        const staff = await requireStaff(interaction, "admin");
        if (!staff) return;
        const command = interaction.options.getString("command", true);
        const args = interaction.options.getString("args") || null;
        await interaction.deferReply({ ephemeral: true });
        const payload = await adminFetch("/api/admin/game/control/command", {
          reqId,
          method: "POST",
          body: { command, args }
        });
        logEvent("warn", "game.command", { userId: interaction.user.id, command });
        const response = payload?.payload?.response;
        await interaction.editReply({ content: response ? truncate(String(response), 1800) : "Command executed." });
        return;
      }
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
        const route = ticketRouteForCategory(triage.category);
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
        const ticketIntakeChannelNames = [
          "support-desk",
          "ticket-desk",
          "tickets",
          "ticket-support",
          "support",
          "help-desk",
          "report-issue"
        ];
        const routeChannel = route.channelId
          ? await resolveTextChannelByIdOrName(interaction.guild, route.channelId, [])
          : null;
        const fallbackTicketChannel = await resolveTextChannelByIdOrName(interaction.guild, ticketChannelId, ticketIntakeChannelNames);
        const intakeChannel = routeChannel || fallbackTicketChannel || interaction.channel;

        if (!intakeChannel || !intakeChannel.isTextBased()) {
          await interaction.reply({ content: "Ticket channel is not configured or invalid.", ephemeral: true });
          return;
        }

        const sanitizedUser = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 14) || "user";
        const suffix = Date.now().toString(36).slice(-5);
        const channelName = `ticket-${sanitizedUser}-${suffix}`.slice(0, 90);
        await interaction.guild.roles.fetch().catch(() => null);
        const staffRoleIds = getStaffRoleIdsForTicketing().filter((roleId) => interaction.guild.roles.cache.has(roleId));
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

        const ticketChannel = await createGuildChannelWithApproval(interaction.guild, {
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

        const routeRoleMention = route.roleId ? `<@&${route.roleId}>` : "";
        const staffMentions = [routeRoleMention, ...staffRoleIds.map((id) => `<@&${id}>`)]
          .filter(Boolean)
          .join(" ") || (ticketSupportRoleId ? `<@&${ticketSupportRoleId}>` : "Staff");
        await sendMessageWithGuards(ticketChannel, {
          content: [
            `🎫 **Private Support Ticket**`,
            `Reporter: <@${interaction.user.id}>`,
            `Urgency: **${urgency.toUpperCase()}**`,
            `Triage Category: **${triage.category}**`,
            `Route: **${route.label}**${route.channelId ? ` • intake <#${route.channelId}>` : ""}${route.roleId ? ` • role <@&${route.roleId}>` : ""}`,
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
          routeLabel: route.label,
          routeChannelId: route.channelId || "",
          routeRoleId: route.roleId || "",
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

      if (sub === "all") {
        const reason = truncate(interaction.options.getString("reason") || "No reason provided.", 220);
        const dryRun = interaction.options.getBoolean("dry_run") || false;
        const maxMessagesRaw = interaction.options.getInteger("max_messages");
        const maxMessages = maxMessagesRaw == null ? 5000 : maxMessagesRaw;
        if (maxMessages < 100 || maxMessages > 20000) {
          await interaction.reply({ content: "max_messages must be between 100 and 20000.", ephemeral: true });
          return;
        }
        if (typeof target.bulkDelete !== "function") {
          await interaction.reply({ content: "Bulk delete is not supported for that channel type.", ephemeral: true });
          return;
        }
        if (dryRun || isSimulationModeEnabled()) {
          await interaction.reply({
            content: `Dry run: would clear up to ${maxMessages} deletable recent message(s) in <#${target.id}>. Reason: ${reason}`,
            ephemeral: true
          });
          return;
        }

        let remaining = maxMessages;
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
          await interaction.reply({ content: "No deletable recent messages found (Discord only bulk-deletes messages newer than 14 days).", ephemeral: true });
          return;
        }

        addIncident({
          severity: "high",
          userId: interaction.user.id,
          reason: `clear all ${deletedTotal} in #${target.id} (${reason})`,
          createdBy: interaction.user.id,
          auto: true
        });
        if (logChannelId) {
          const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle("Staff Clear Action")
              .setColor(0xdc2626)
              .addFields(
                { name: "Mode", value: "all", inline: true },
                { name: "Deleted", value: String(deletedTotal), inline: true },
                { name: "Channel", value: `<#${target.id}>`, inline: true },
                { name: "By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Reason", value: reason, inline: false }
              )
              .setTimestamp();
            await sendMessageWithGuards(logChannel, { embeds: [embed] }, "clear.all.log", reqId);
          }
        }
        await interaction.reply({
          content: `Clear-all complete in <#${target.id}>. Deleted ${deletedTotal} message(s)${remaining === 0 ? " (reached max_messages cap)." : "."}`,
          ephemeral: true
        });
        return;
      }

      if (sub === "old") {
        const reason = truncate(interaction.options.getString("reason") || "No reason provided.", 220);
        const dryRun = interaction.options.getBoolean("dry_run") || false;
        const includePinned = interaction.options.getBoolean("include_pinned") || false;
        const maxMessagesRaw = interaction.options.getInteger("max_messages");
        const maxMessages = maxMessagesRaw == null ? 250 : maxMessagesRaw;
        if (maxMessages < 10 || maxMessages > 2000) {
          await interaction.reply({ content: "max_messages must be between 10 and 2000.", ephemeral: true });
          return;
        }
        if (!target.messages || typeof target.messages.fetch !== "function") {
          await interaction.reply({ content: "Message history access is not supported for that channel type.", ephemeral: true });
          return;
        }

        const cutoffMs = 14 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        let scanned = 0;
        let eligible = 0;
        let deletedTotal = 0;
        let beforeId;
        const maxScan = Math.min(50000, maxMessages * 20);

        while (scanned < maxScan && deletedTotal < maxMessages) {
          const batch = await target.messages.fetch({ limit: 100, before: beforeId }).catch(() => null);
          if (!batch || batch.size === 0) break;
          scanned += batch.size;
          beforeId = batch.lastKey();
          if (!beforeId) break;

          for (const msg of batch.values()) {
            if (deletedTotal >= maxMessages) break;
            const ageMs = now - msg.createdTimestamp;
            if (ageMs < cutoffMs) continue;
            if (!includePinned && msg.pinned) continue;
            eligible += 1;
            if (dryRun || isSimulationModeEnabled()) continue;
            const ok = await msg.delete().then(() => true).catch(() => false);
            if (ok) deletedTotal += 1;
          }
        }

        if (dryRun || isSimulationModeEnabled()) {
          await interaction.reply({
            content: `Dry run: scanned ${scanned} message(s) in <#${target.id}>; found ${eligible} old message(s) deletable${includePinned ? " (including pinned)" : " (excluding pinned)"}${eligible > maxMessages ? `; capped to ${maxMessages}` : ""}. Reason: ${reason}`,
            ephemeral: true
          });
          return;
        }

        if (!deletedTotal) {
          await interaction.reply({
            content: `No old messages deleted in <#${target.id}>. I scanned ${scanned} message(s).`,
            ephemeral: true
          });
          return;
        }

        addIncident({
          severity: "high",
          userId: interaction.user.id,
          reason: `clear old ${deletedTotal} in #${target.id} (${reason})`,
          createdBy: interaction.user.id,
          auto: true
        });
        if (logChannelId) {
          const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
          if (logChannel && logChannel.isTextBased()) {
            const embed = new EmbedBuilder()
              .setTitle("Staff Clear Action")
              .setColor(0x991b1b)
              .addFields(
                { name: "Mode", value: "old", inline: true },
                { name: "Deleted", value: String(deletedTotal), inline: true },
                { name: "Scanned", value: String(scanned), inline: true },
                { name: "Channel", value: `<#${target.id}>`, inline: true },
                { name: "By", value: `<@${interaction.user.id}>`, inline: true },
                { name: "Pinned", value: includePinned ? "included" : "excluded", inline: true },
                { name: "Reason", value: reason, inline: false }
              )
              .setTimestamp();
            await sendMessageWithGuards(logChannel, { embeds: [embed] }, "clear.old.log", reqId);
          }
        }
        await interaction.reply({
          content: `Clear-old complete in <#${target.id}>. Deleted ${deletedTotal} old message(s) after scanning ${scanned}.`,
          ephemeral: true
        });
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

client.on("voiceStateUpdate", async (oldState, newState) => {
  try {
    const member = newState.member || oldState.member;
    if (!member) return;
    if (member.user.bot) {
      if (member.id === client.user?.id) {
        const guildId = String(newState.guild?.id || oldState.guild?.id || "");
        const session = guildId ? musicSessions.get(guildId) : null;
        if (session) {
          session.voiceChannelId = String(newState.channelId || "");
          if (!newState.channelId) {
            session.connection = null;
          }
          persistMusicSessions();
        }
      }
      if (musicEnforcementEnabled && isMusicBotUserId(member.id) && newState.channel && !isMusicVoiceAllowed(newState.channel)) {
        await member.voice.setChannel(null, "Music policy: bot voice channel not approved").catch(() => null);
      }
      return;
    }
    const userId = member.id;
    const guild = newState.guild || oldState.guild;
    const now = Date.now();
    const leftChannel = oldState.channelId && oldState.channelId !== newState.channelId ? oldState.channel : null;
    const joinedChannel = newState.channelId && oldState.channelId !== newState.channelId ? newState.channel : null;

    if (joinedChannel) {
      voiceSessions.set(userId, { channelId: joinedChannel.id, joinedAt: now });
    }
    if (leftChannel) {
      const session = voiceSessions.get(userId);
      voiceSessions.delete(userId);
      if (!session) return;
      const minutes = Math.floor((now - session.joinedAt) / 60000);
      if (minutes < levelVoiceMinMinutes) return;
      const activeMembers = leftChannel.members.filter((m) => !m.user.bot);
      if (activeMembers.size < 2) return;
      const levels = loadLevels();
      const entry = levels.users[userId] || { xp: 0, level: 0, lastMsgAt: 0, lastVoiceAt: 0 };
      if (entry.lastVoiceAt && now - entry.lastVoiceAt < 10 * 60 * 1000) return;
      entry.lastVoiceAt = now;
      levels.users[userId] = entry;
      const earnedMinutes = Math.min(minutes, levelVoiceMaxMinutes);
      const xp = Math.max(0, earnedMinutes * levelVoiceXpPerMin);
      const result = awardXp(levels, userId, xp);
      saveLevels(levels);
      if (result.after > result.before) {
        const channel = guild ? await resolveLevelUpChannel(guild) : null;
        if (channel && channel.isTextBased()) {
          await sendMessageWithGuards(channel, { content: `🎖️ <@${userId}> reached **Level ${result.after}**.` }, "level.up.voice");
        }
      }
    }
  } catch {}
});

async function postStatusUpdate() {
  if (!statusChannelId) return;
  bumpMetric("schedulerRun");
  const status = await adminFetch("/api/admin/content/server-status", { reqId: "scheduler-status" });
  const state = loadState();
  const updatedStamp = status.updatedUtc || status.updated || status.dateUtc || "";
  const statusKey = status.status || "unknown";
  const hash = statusKey; // suppress chatter: only notify when status meaningfully changes

  const now = Date.now();
  const lastStatusAt = state.lastStatusAt ? new Date(state.lastStatusAt).getTime() : 0;
  const sameStatus = state.lastStatusState === statusKey;
  const cooldownMs = statusCooldownMinutes * 60 * 1000;
  const offlineReminderMs = statusOfflineReminderMinutes * 60 * 1000;
  const withinCooldown = sameStatus && lastStatusAt && now - lastStatusAt < cooldownMs;
  const offlineException = statusKey === "offline" && sameStatus && lastStatusAt && now - lastStatusAt >= offlineReminderMs;
  if (withinCooldown && !offlineException) return;

  const previousState = state.lastStatusState || "unknown";
  const mention = statusMention(status.status);
  const players = status.playersOnline ?? status.players ?? status.playerCount ?? status.onlinePlayers ?? null;
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
  if (typeof players === "number") {
    embed.addFields({ name: "Players Online", value: String(players), inline: true });
  }

  enqueueJob({
    type: "status-update",
    channelId: statusChannelId,
    idempotencyKey: `status:${hash}`,
    content: mention || "",
    embeds: [embed],
    maxRetries: 6
  });
  try {
    const channel = await client.channels.fetch(statusChannelId).catch(() => null);
    if (channel && channel.isTextBased()) {
      await upsertPinnedChannelCard(channel, "status-mini", buildStatusMiniPanel(status), "status.mini.panel");
    }
  } catch {}
  state.lastStatus = hash;
  state.lastStatusState = statusKey;
  state.lastStatusAt = new Date().toISOString();
  saveState(state);
}

async function postLatestUpdate() {
  const fullTargets = Array.from(new Set([...(fullUpdateChannelIds || []), ...(storyChannelIds || []), ...(announceChannelId ? [announceChannelId] : [])]));
  if (!announceChannelId && !fullTargets.length) return;
  bumpMetric("schedulerRun");
  const updates = await adminFetch("/api/admin/content/updates", { reqId: "scheduler-updates" });
  if (!updates.length) return;
  const latest = updates[0];
  const state = loadState();
  const alreadySummary = state.lastUpdateId === latest.id;
  const alreadyFull = state.lastUpdateFullId === latest.id;
  if (alreadySummary && (alreadyFull || !fullTargets.length)) return;

  if (!alreadySummary && announceChannelId) {
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
    const announceChannel = await client.channels.fetch(announceChannelId).catch(() => null);
    await upsertDiscussionThreadForPost("update", latest, announceChannel, "scheduler-updates");
    state.lastUpdateId = latest.id;
  }
  if (!alreadyFull && fullTargets.length) {
    await postFullStoryToChannels("update", latest, fullTargets, "scheduler-updates");
    state.lastUpdateFullId = latest.id;
  }
  saveState(state);
}

async function postLatestTransmission() {
  const fullTargets = Array.from(new Set([...(fullTransmissionChannelIds || []), ...(storyChannelIds || []), ...(announceChannelId ? [announceChannelId] : [])]));
  if (!announceChannelId && !fullTargets.length) return;
  bumpMetric("schedulerRun");
  const items = await adminFetch("/api/admin/content/transmissions", { reqId: "scheduler-transmissions" });
  if (!items.length) return;
  const latest = items[0];
  const state = loadState();
  const alreadySummary = state.lastTransmissionId === latest.id;
  const alreadyFull = state.lastTransmissionFullId === latest.id;
  if (alreadySummary && (alreadyFull || !fullTargets.length)) return;

  if (!alreadySummary && announceChannelId) {
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
    const announceChannel = await client.channels.fetch(announceChannelId).catch(() => null);
    await upsertDiscussionThreadForPost("transmission", latest, announceChannel, "scheduler-transmissions");
    state.lastTransmissionId = latest.id;
  }
  if (!alreadyFull && fullTargets.length) {
    await postFullStoryToChannels("transmission", latest, fullTargets, "scheduler-transmissions");
    state.lastTransmissionFullId = latest.id;
  }
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

async function postStoryArcsUpdate() {
  const channel = arcChannelId
    ? await client.channels.fetch(arcChannelId).catch(() => null)
    : await resolveAutoChannel(
        ["story", "stories"],
        "",
        "story",
        "Story feed synced from website updates and transmissions.",
        null
      );
  if (!channel || !channel.isTextBased()) return;
  bumpMetric("schedulerRun");
  const payload = await adminFetch("/api/admin/content/story-arcs", { reqId: "scheduler-arcs" }).catch(() => null);
  if (!payload || !Array.isArray(payload.arcs)) return;
  const arcs = payload.arcs;
  const hash = hashString(JSON.stringify(payload));
  const state = loadState();
  if (state.lastStoryArcsHash === hash) return;

  const featured = arcs.find((a) => a.featured) || null;
  const live = arcs.find((a) => String(a.status || "").toLowerCase() === "live") || null;
  const pick = featured || live || arcs[0];
  if (!pick) return;

  const activePhase = Array.isArray(pick.phases) ? pick.phases.find((p) => String(p.status || "").toLowerCase() === "active") : null;
  const embed = new EmbedBuilder()
    .setTitle("Story Arc Update")
    .setDescription(truncate(String(pick.summary || "A new arc has been published."), 900))
    .addFields(
      { name: "Arc", value: String(pick.title || "Unknown"), inline: true },
      { name: "Status", value: String(pick.status || "unknown"), inline: true },
      { name: "Season", value: String(pick.season || "Season"), inline: true },
      { name: "Active Phase", value: activePhase ? String(activePhase.name || "Active") : "TBD", inline: true },
      { name: "Full Arc", value: links.arcs, inline: true }
    )
    .setColor(0x38bdf8)
    .setTimestamp();

  enqueueJob({
    type: "arc-post",
    channelId: channel.id,
    idempotencyKey: `story-arcs:${hash}`,
    embeds: [embed],
    maxRetries: 6
  });
  state.lastStoryArcsHash = hash;
  enqueueContentDigest(state, `Story arc updated: ${pick.title}`);
  saveState(state);
}

async function postEventCalendarUpdate() {
  const channel = eventChannelId
    ? await client.channels.fetch(eventChannelId).catch(() => null)
    : await resolveAutoChannel(
        ["story", "stories"],
        "",
        "story",
        "Story feed synced from website updates and transmissions.",
        null
      );
  if (!channel || !channel.isTextBased()) return;
  bumpMetric("schedulerRun");
  const payload = await adminFetch("/api/admin/content/event-calendar", { reqId: "scheduler-events" }).catch(() => null);
  if (!payload || !Array.isArray(payload.events)) return;
  const hash = hashString(JSON.stringify(payload));
  const state = loadState();
  if (state.lastEventCalendarHash === hash) return;

  const events = payload.events
    .filter((e) => e.status !== "canceled" && e.status !== "complete")
    .sort((a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime());
  const next = events[0];
  if (!next) return;

  const when = next.startUtc ? new Date(next.startUtc).toUTCString() : "TBD";
  const embed = new EmbedBuilder()
    .setTitle("Upcoming Event")
    .setDescription(truncate(String(next.summary || "An in-world event has been scheduled."), 900))
    .addFields(
      { name: "Event", value: String(next.title || "Unknown"), inline: true },
      { name: "Status", value: String(next.status || "scheduled"), inline: true },
      { name: "When", value: when, inline: true },
      { name: "Location", value: String(next.location || "TBD"), inline: true },
      { name: "Full Calendar", value: links.events, inline: true }
    )
    .setColor(0x22c55e)
    .setTimestamp();

  enqueueJob({
    type: "event-post",
    channelId: channel.id,
    idempotencyKey: `events:${hash}`,
    embeds: [embed],
    maxRetries: 6
  });
  state.lastEventCalendarHash = hash;
  enqueueContentDigest(state, `Event calendar updated: ${next.title}`);
  saveState(state);
}

async function postEconomySnapshotUpdate() {
  const channel = economyChannelId
    ? await client.channels.fetch(economyChannelId).catch(() => null)
    : await resolveAutoChannel(
        ["lore", "story"],
        "",
        "lore",
        "Lore feed synced from website transmissions.",
        null
      );
  if (!channel || !channel.isTextBased()) return;
  bumpMetric("schedulerRun");
  const payload = await adminFetch("/api/admin/content/economy-snapshot", { reqId: "scheduler-economy" }).catch(() => null);
  if (!payload || typeof payload !== "object") return;
  const hash = hashString(JSON.stringify(payload));
  const state = loadState();
  if (state.lastEconomyHash === hash) return;

  const embed = new EmbedBuilder()
    .setTitle("Economy Snapshot")
    .setDescription(truncate(String(payload.summary || "A new economy snapshot is available."), 900))
    .addFields(
      { name: "Status", value: String(payload.status || "unknown"), inline: true },
      { name: "Price Index", value: String(payload.priceIndex ?? "—"), inline: true },
      { name: "Scarcity Index", value: String(payload.scarcityIndex ?? "—"), inline: true },
      { name: "Full Report", value: links.economy, inline: true }
    )
    .setColor(0xf59e0b)
    .setTimestamp();

  enqueueJob({
    type: "economy-post",
    channelId: channel.id,
    idempotencyKey: `economy:${hash}`,
    embeds: [embed],
    maxRetries: 6
  });
  state.lastEconomyHash = hash;
  enqueueContentDigest(state, `Economy snapshot updated: ${String(payload.status || "unknown")}`);
  saveState(state);
}

async function runPteroWatch() {
  if (!pteroWatchEnabled) return;
  if (!pteroClientBaseUrl || !pteroClientKey || !pteroClientServerId) return;
  const channelId = pteroWatchChannelId || logChannelId;
  if (!channelId) return;

  let payload;
  try {
    payload = await getPteroClientResources();
  } catch {
    return;
  }
  const attrs = payload?.attributes || {};
  const res = attrs.resources || {};
  const state = loadState();
  const now = Date.now();

  const cpu = res.cpu_absolute;
  const memPercent = percentOf(res.memory_bytes, res.memory_limit_bytes);
  const diskPercent = percentOf(res.disk_bytes, res.disk_limit_bytes);
  const triggers = [];
  if (cpu != null && cpu >= pteroWatchCpuAlert) triggers.push(`CPU ${Math.round(cpu)}%`);
  if (memPercent != null && memPercent >= pteroWatchMemoryAlert) triggers.push(`Memory ${memPercent}%`);
  if (diskPercent != null && diskPercent >= pteroWatchDiskAlert) triggers.push(`Disk ${diskPercent}%`);

  if (!triggers.length) {
    state.pteroWatchLastOkAt = new Date().toISOString();
    saveState(state);
    return;
  }

  const summary = triggers.join(" • ");
  const last = state.pteroWatchLastAlert || {};
  const cooldownMs = Math.max(1, pteroWatchCooldownMinutes) * 60 * 1000;
  const lastAt = last.at ? new Date(last.at).getTime() : 0;
  if (summary === last.summary && now - lastAt < cooldownMs) return;

  const embed = new EmbedBuilder()
    .setTitle("Pterodactyl Resource Alert")
    .setColor(0xef4444)
    .setDescription(truncate(`${summary}\nThresholds: CPU ${pteroWatchCpuAlert}% • Mem ${pteroWatchMemoryAlert}% • Disk ${pteroWatchDiskAlert}%`, 700))
    .addFields(
      { name: "State", value: String(attrs.current_state || "unknown"), inline: true },
      { name: "CPU", value: cpu != null ? `${Math.round(cpu)}%` : "—", inline: true },
      { name: "Memory", value: res.memory_bytes != null ? `${formatBytes(res.memory_bytes)} / ${formatBytes(res.memory_limit_bytes)}` : "—", inline: true },
      { name: "Disk", value: res.disk_bytes != null ? `${formatBytes(res.disk_bytes)} / ${formatBytes(res.disk_limit_bytes)}` : "—", inline: true }
    )
    .setTimestamp();

  enqueueJob({
    type: "ptero-alert",
    channelId,
    idempotencyKey: `ptero-alert:${summary}:${Math.floor(now / cooldownMs)}`,
    embeds: [embed],
    allowedMentions: { parse: [] },
    maxRetries: 4
  });

  enqueueContentDigest(state, `Pterodactyl alert: ${summary}`);
  state.pteroWatchLastAlert = { summary, at: new Date().toISOString() };
  saveState(state);
}

async function postStaffContentDigest(opts = {}) {
  bumpMetric("schedulerRun");
  const force = Boolean(opts.force);
  const time = parseTimeUtc(discordOpsCache.staffDigestTimeUtc || staffDigestTimeUtc);
  const now = new Date();
  if (!force) {
    if (!time) return;
    if (!isTimeMatchUtc(now, time)) return;
  }

  const state = loadState();
  const stamp = isoDay(now);
  if (!force && state.lastStaffContentDigest === stamp) return;

  const channelId = opts.channelId || discordOpsCache.staffDigestChannelId || staffDigestChannelId || logChannelId;
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const queue = Array.isArray(state.contentDigestQueue) ? state.contentDigestQueue : [];
  if (!queue.length) return;

  const lines = queue.slice(-12).map((item) => `• ${item.entry}`);
  const content = [
    "📌 **Staff Content Digest**",
    `Date: ${stamp}`,
    "",
    ...lines,
    "",
    "Review in admin:",
    `${siteUrl}/admin/dossiers • ${siteUrl}/admin/story-arcs • ${siteUrl}/admin/events • ${siteUrl}/admin/economy`
  ].join("\n");

  enqueueJob({
    type: "staff-content-digest",
    channelId: channel.id,
    idempotencyKey: `staff-digest:${stamp}:${force ? "manual" : "auto"}`,
    content,
    bypassQuietHours: true,
    maxRetries: 6
  });

  state.lastStaffContentDigest = stamp;
  state.contentDigestQueue = [];
  saveState(state);
}

async function postDossierApprovals() {
  const channel = dossierPublicChannelId
    ? await client.channels.fetch(dossierPublicChannelId).catch(() => null)
    : await resolveAutoChannel(
        ["dossiers", "dossier-board", "dossier-board-public"],
        "",
        "dossiers",
        "Approved character dossiers from the Grey Hour admin panel.",
        null
      );
  if (!channel || !channel.isTextBased()) return;

  bumpMetric("schedulerRun");
  const payload = await adminFetch("/api/admin/content/player-dossiers", { reqId: "scheduler-dossiers" }).catch(() => null);
  if (!payload || !Array.isArray(payload.dossiers)) return;

  const approved = payload.dossiers.filter((d) => String(d.status || "") === "approved");
  if (!approved.length) return;

  const state = loadState();
  const seen = Array.isArray(state.lastApprovedDossierIds) ? state.lastApprovedDossierIds : [];
  const repMap = state.lastDossierReputation && typeof state.lastDossierReputation === "object" ? state.lastDossierReputation : {};
  const fresh = approved.filter((d) => d.id && !seen.includes(d.id)).slice(0, 3);
  const repChanges = approved.filter((d) => {
    const id = String(d.id || "");
    if (!id) return false;
    const prev = Number(repMap[id] ?? 0);
    const curr = Number(d.reputation ?? 0);
    return prev !== curr && !fresh.find((f) => String(f.id) === id);
  }).slice(0, 3);
  if (!fresh.length && !repChanges.length) return;

  for (const dossier of [...fresh, ...repChanges]) {
    const embed = new EmbedBuilder()
      .setTitle("Dossier Approved")
      .setDescription(truncate(String(dossier.backstory || "A new dossier has been approved."), 900))
      .addFields(
        { name: "Character", value: String(dossier.characterName || "Unknown"), inline: true },
        { name: "Handle", value: String(dossier.handle || "—"), inline: true },
        { name: "Faction", value: String(dossier.factionId || "Independent"), inline: true },
        { name: "Reputation", value: String(dossier.reputation ?? 0), inline: true },
        { name: "Full Dossiers", value: links.dossiers, inline: true }
      )
      .setColor(0x94a3b8)
      .setTimestamp();

    if (fresh.find((f) => String(f.id) === String(dossier.id))) {
      enqueueJob({
        type: "dossier-approved",
        channelId: channel.id,
        idempotencyKey: `dossier-approved:${dossier.id}`,
        embeds: [embed],
        maxRetries: 6
      });
    }

    if (dossier.factionId) {
      const map = await loadFactionChannelMap();
      const targetId = map[String(dossier.factionId || "")] || "";
      if (targetId) {
        const factionCh = await client.channels.fetch(targetId).catch(() => null);
        if (factionCh && factionCh.isTextBased()) {
          const repLabel = Number(repMap[String(dossier.id || "")] ?? 0) !== Number(dossier.reputation ?? 0)
            ? `Reputation update: ${repMap[String(dossier.id || "")] ?? 0} → ${dossier.reputation ?? 0}`
            : "";
          enqueueJob({
            type: "dossier-faction",
            channelId: factionCh.id,
            idempotencyKey: `dossier-faction:${dossier.id}`,
            content: repLabel ? `📌 ${repLabel}` : "",
            embeds: [embed],
            maxRetries: 6
          });
        }
      }
    }

    if (fresh.find((f) => String(f.id) === String(dossier.id))) {
      enqueueContentDigest(state, `Dossier approved: ${dossier.characterName || dossier.id}`);
    } else {
      enqueueContentDigest(state, `Dossier reputation change: ${dossier.characterName || dossier.id}`);
    }
    seen.push(dossier.id);
    repMap[dossier.id] = Number(dossier.reputation ?? 0);
  }

  state.lastApprovedDossierIds = seen.slice(-200);
  state.lastDossierReputation = repMap;
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

async function runWeeklyPrompt() {
  if (!weeklyPromptTimeUtc) return;
  bumpMetric("schedulerRun");
  const now = new Date();
  const [hh, mm] = weeklyPromptTimeUtc.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return;
  if (now.getUTCDay() !== weeklyPromptWeekdayUtc) return;
  if (now.getUTCHours() !== hh || now.getUTCMinutes() !== mm) return;

  const state = loadState();
  const stamp = now.toISOString().slice(0, 10);
  if (state.lastWeeklyPrompt === stamp) return;

  const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID || "") || client.guilds.cache.first() || null;
  if (!guild) return;
  await guild.channels.fetch().catch(() => null);
  const targets = guild.channels.cache
    .filter((c) => c && c.isTextBased?.() && isRoleplayChannel(c) && canSendToChannel(c))
    .map((c) => c);
  if (!targets.length) return;

  const prompts = [
    "Your faction discovers a quiet farmhouse with a radio still on. What broadcast plays?",
    "A supply cache is marked as “Do Not Open.” What’s inside?",
    "A storm knocks out power. What old fear resurfaces?",
    "A trader offers a deal that seems too good. What’s the catch?",
    "You find a hand-written map with a torn edge. Who made it and why?",
    "Someone at the campfire tells a story that no one else remembers happening.",
    "A fresh set of footprints circles your safehouse at dawn."
  ];
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  for (const channel of targets) {
    await sendMessageWithGuards(channel, { content: `🕯️ **Weekly RP Prompt**\n${prompt}` }, "weekly.prompt");
  }
  state.lastWeeklyPrompt = stamp;
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

async function postWorldBrief() {
  bumpMetric("schedulerRun");
  const time = parseTimeUtc(worldBriefTimeUtc);
  if (!time) return;
  const now = new Date();
  if (!isTimeMatchUtc(now, time)) return;

  const state = loadState();
  const stamp = isoDay(now);
  if (state.lastWorldBrief === stamp) return;

  const guild = client.guilds.cache.first();
  const infoCategory = guild ? await ensureCategoryChannel(guild, "INFORMATION", "Auto world brief") : null;
  const channel = await resolveAutoChannel(
    ["announcements", "announcement", "updates", "news"],
    announceChannelId,
    "announcements",
    "Official announcements synced from website updates.",
    infoCategory?.id || null
  );
  if (!channel || !channel.isTextBased()) return;

  const [telemetry, discordMetrics, mods, incidents] = await Promise.all([
    getGameTelemetry().catch(() => null),
    getDiscordMetrics().catch(() => null),
    adminFetch("/api/admin/content/mods", { reqId: "world-brief-mods" }).catch(() => []),
    Promise.resolve(loadIncidents())
  ]);

  const server = telemetry?.server || {};
  const counters = discordMetrics?.counters || {};
  const players = toNumber(server.playersOnline);
  const queue = toNumber(server.queue);
  const discordMembers = toNumber(counters.gh_bot_discord_members_gauge);
  const openTickets = toNumber(counters.gh_bot_ticket_open_total);
  const openModcalls = toNumber(counters.gh_bot_modcall_open_total);
  const incidentCount = Array.isArray(incidents) ? incidents.filter((x) => {
    const ts = new Date(x.createdAt || 0).getTime();
    return Number.isFinite(ts) && ts >= Date.now() - 24 * 60 * 60 * 1000;
  }).length : 0;

  const lines = [
    "🌒 **Daily World Brief**",
    `Server: ${server.status || "unknown"} • Players: ${players ?? "—"} • Queue: ${queue ?? "—"}`,
    `Discord: ${discordMembers ?? "—"} members • Tickets: ${openTickets ?? "—"} • Modcalls: ${openModcalls ?? "—"}`,
    `Modpack: ${Array.isArray(mods) ? mods.length : 0} required mods`,
    `Incidents (24h): ${incidentCount}`
  ];

  enqueueJob({
    type: "world-brief",
    channelId: channel.id,
    idempotencyKey: `world-brief:${stamp}`,
    content: lines.join("\n"),
    maxRetries: 6
  });
  state.lastWorldBrief = stamp;
  saveState(state);
}

async function postStorySpark() {
  bumpMetric("schedulerRun");
  const time = parseTimeUtc(storySparkTimeUtc);
  if (!time) return;
  const now = new Date();
  if (!isTimeMatchUtc(now, time)) return;
  const state = loadState();
  const stamp = isoDay(now);
  if (state.lastStorySpark === stamp) return;

  const guild = client.guilds.cache.first();
  const infoCategory = guild ? await ensureCategoryChannel(guild, "INFORMATION", "Auto story spark") : null;
  const channel = await resolveAutoChannel(
    ["lore", "story", "transmissions"],
    "",
    "lore",
    "Lore feed synced from website transmissions.",
    infoCategory?.id || null
  );
  if (!channel || !channel.isTextBased()) return;

  const prompts = loadStorySparks();
  if (!prompts.length) return;
  const lastIndex = Number(state.lastStorySparkIndex || -1);
  let nextIndex = Math.floor(Math.random() * prompts.length);
  if (prompts.length > 1 && nextIndex === lastIndex) {
    nextIndex = (nextIndex + 1) % prompts.length;
  }
  const prompt = prompts[nextIndex];

  enqueueJob({
    type: "story-spark",
    channelId: channel.id,
    idempotencyKey: `story-spark:${stamp}`,
    content: `🕯️ **Story Spark**\n${prompt}`,
    maxRetries: 6
  });
  state.lastStorySpark = stamp;
  state.lastStorySparkIndex = nextIndex;
  saveState(state);
}

async function postMapIntelDigest() {
  bumpMetric("schedulerRun");
  const time = parseTimeUtc(mapIntelTimeUtc);
  if (!time) return;
  const now = new Date();
  if (!isTimeMatchUtc(now, time)) return;
  const state = loadState();
  const stamp = isoDay(now);
  if (state.lastMapIntelDigest === stamp) return;

  const guild = client.guilds.cache.first();
  const infoCategory = guild ? await ensureCategoryChannel(guild, "INFORMATION", "Auto map intel") : null;
  const channel = await resolveAutoChannel(
    ["story", "transmissions", "lore"],
    "",
    "story",
    "Story feed synced from website updates and transmissions.",
    infoCategory?.id || null
  );
  if (!channel || !channel.isTextBased()) return;

  const community = loadCommunity();
  const markers = ensureArray(community.markers);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = markers.filter((m) => new Date(m.createdAt || 0).getTime() >= cutoff).slice(0, 8);
  if (!recent.length) return;

  const lines = recent.map((m) => `• ${m.label} @ ${m.location}${m.notes ? ` • ${m.notes}` : ""}`);
  enqueueJob({
    type: "map-intel",
    channelId: channel.id,
    idempotencyKey: `map-intel:${stamp}`,
    content: `🗺️ **Map Intel Digest**\n${lines.join("\n")}`,
    maxRetries: 6
  });
  state.lastMapIntelDigest = stamp;
  saveState(state);
}

async function postLorePulse() {
  bumpMetric("schedulerRun");
  const time = parseTimeUtc(lorePulseTimeUtc);
  if (!time) return;
  const now = new Date();
  if (!isTimeMatchUtc(now, time)) return;
  const state = loadState();
  const stamp = isoDay(now);
  if (state.lastLorePulse === stamp) return;

  const guild = client.guilds.cache.first();
  const infoCategory = guild ? await ensureCategoryChannel(guild, "INFORMATION", "Auto lore pulse") : null;
  const channel = await resolveAutoChannel(
    ["transmissions", "lore", "story"],
    "",
    "transmissions",
    "Transmission feed synced from website.",
    infoCategory?.id || null
  );
  if (!channel || !channel.isTextBased()) return;

  const [telemetry, latestTransmission] = await Promise.all([
    getGameTelemetry().catch(() => null),
    adminFetch("/api/admin/content/transmissions", { reqId: "lore-pulse-transmissions" }).catch(() => [])
  ]);

  const server = telemetry?.server || {};
  const statusLine = `Server state: ${server.status || "unknown"}`;
  const trans = Array.isArray(latestTransmission) && latestTransmission.length ? latestTransmission[0] : null;
  const headline = trans ? `Transmission: ${trans.title}` : "Transmission: none";

  const fragments = [
    "The air tastes like metal and damp ash.",
    "Rumors move faster than fuel.",
    "The roads don’t forgive, but they remember.",
    "The Grey Hour stretches longer tonight."
  ];
  const fragment = fragments[Math.floor(Math.random() * fragments.length)];

  enqueueJob({
    type: "lore-pulse",
    channelId: channel.id,
    idempotencyKey: `lore-pulse:${stamp}`,
    content: `📡 **Lore Pulse**\n${headline}\n${statusLine}\n${fragment}`,
    maxRetries: 6
  });
  state.lastLorePulse = stamp;
  saveState(state);
}

async function postIncidentDigest() {
  bumpMetric("schedulerRun");
  const time = parseTimeUtc(incidentDigestTimeUtc);
  if (!time) return;
  const now = new Date();
  if (!isTimeMatchUtc(now, time)) return;
  const state = loadState();
  const stamp = isoDay(now);
  if (state.lastIncidentDigest === stamp) return;

  const guild = client.guilds.cache.first();
  const infoCategory = guild ? await ensureCategoryChannel(guild, "INFORMATION", "Auto incident digest") : null;
  const channel = await resolveAutoChannel(
    ["announcements", "announcement", "updates", "news"],
    announceChannelId,
    "announcements",
    "Official announcements synced from website updates.",
    infoCategory?.id || null
  );
  if (!channel || !channel.isTextBased()) return;

  const incidents = loadIncidents();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = incidents.filter((x) => new Date(x.createdAt || 0).getTime() >= cutoff);
  if (!recent.length) return;

  const lines = recent.slice(0, 6).map((x) => `• ${x.severity || "info"} • ${truncate(String(x.reason || "incident"), 140)}`);
  enqueueJob({
    type: "incident-digest",
    channelId: channel.id,
    idempotencyKey: `incident-digest:${stamp}`,
    content: `🧯 **Incident Digest (24h)**\n${lines.join("\n")}`,
    maxRetries: 6
  });
  state.lastIncidentDigest = stamp;
  saveState(state);
}

async function postSurvivorSpotlight() {
  bumpMetric("schedulerRun");
  const time = parseTimeUtc(survivorSpotlightTimeUtc);
  if (!time) return;
  const now = new Date();
  if (!isTimeMatchUtc(now, time)) return;
  if (now.getUTCDay() !== survivorSpotlightWeekdayUtc) return;

  const state = loadState();
  const weekKey = `${now.getUTCFullYear()}-${Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))}`;
  if (state.lastSurvivorSpotlight === weekKey) return;

  const guild = client.guilds.cache.first();
  const infoCategory = guild ? await ensureCategoryChannel(guild, "INFORMATION", "Auto survivor spotlight") : null;
  const channel = await resolveAutoChannel(
    ["announcements", "announcement", "updates", "news"],
    announceChannelId,
    "announcements",
    "Official announcements synced from website updates.",
    infoCategory?.id || null
  );
  if (!channel || !channel.isTextBased()) return;

  const community = loadCommunity();
  const commends = ensureArray(community.commends);
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = commends.filter((x) => Number(x.at || 0) >= cutoff);
  if (!recent.length) return;

  const tally = {};
  for (const row of recent) {
    if (!row.to) continue;
    tally[row.to] = (tally[row.to] || 0) + 1;
  }
  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  if (!top) return;

  enqueueJob({
    type: "survivor-spotlight",
    channelId: channel.id,
    idempotencyKey: `survivor-spotlight:${weekKey}`,
    content: `🏅 **Survivor Spotlight**\nThis week’s most commended survivor: <@${top[0]}> • ${top[1]} commendations.`,
    maxRetries: 6
  });
  state.lastSurvivorSpotlight = weekKey;
  saveState(state);
}

async function postSeasonalArc() {
  bumpMetric("schedulerRun");
  const time = parseTimeUtc(seasonalArcTimeUtc);
  if (!time) return;
  const now = new Date();
  if (!isTimeMatchUtc(now, time)) return;
  if (now.getUTCDate() !== 1) return;

  const state = loadState();
  const monthKey = isoMonth(now);
  if (state.lastSeasonalArc === monthKey) return;

  const guild = client.guilds.cache.first();
  const infoCategory = guild ? await ensureCategoryChannel(guild, "INFORMATION", "Auto seasonal arc") : null;
  const channel = await resolveAutoChannel(
    ["announcements", "announcement", "updates", "news"],
    announceChannelId,
    "announcements",
    "Official announcements synced from website updates.",
    infoCategory?.id || null
  );
  if (!channel || !channel.isTextBased()) return;

  const arcs = loadSeasonalArcs();
  if (!arcs.length) return;
  const index = Math.floor(Math.random() * arcs.length);
  const arc = arcs[index];

  enqueueJob({
    type: "seasonal-arc",
    channelId: channel.id,
    idempotencyKey: `seasonal-arc:${monthKey}:${arc.id}`,
    content: [
      "🗓️ **Seasonal Arc**",
      `**${arc.title}**`,
      arc.summary,
      arc.cta ? `\n${arc.cta}` : ""
    ].filter(Boolean).join("\n"),
    maxRetries: 6
  });
  state.lastSeasonalArc = monthKey;
  saveState(state);
}

async function postLiveMilestones() {
  bumpMetric("schedulerRun");
  if (!statusChannelId) return;
  const telemetry = await getGameTelemetry().catch(() => null);
  const server = telemetry?.server || {};
  const players = toNumber(server.playersOnline);
  if (players === null) return;

  const state = loadState();
  const dayKey = isoDay(new Date());
  const lastDay = state.lastMilestoneDay || "";
  if (lastDay !== dayKey) {
    state.lastMilestoneDay = dayKey;
    state.lastMilestoneValue = 0;
    state.lastPeakValue = 0;
  }

  const nextMilestone = liveMilestones.find((m) => m > Number(state.lastMilestoneValue || 0));
  if (nextMilestone && players >= nextMilestone) {
    enqueueJob({
      type: "live-milestone",
      channelId: statusChannelId,
      idempotencyKey: `milestone:${dayKey}:${nextMilestone}`,
      content: `📈 **Milestone reached:** ${players} players online.`,
      maxRetries: 6
    });
    state.lastMilestoneValue = nextMilestone;
  }

  const peak = Number(state.lastPeakValue || 0);
  if (players > peak && players - peak >= livePeakStep) {
    enqueueJob({
      type: "live-peak",
      channelId: statusChannelId,
      idempotencyKey: `peak:${dayKey}:${players}`,
      content: `🔥 **New daily peak:** ${players} players online.`,
      maxRetries: 6
    });
    state.lastPeakValue = players;
  }

  saveState(state);
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

function parseTimeUtc(input) {
  const value = String(input || "").trim();
  const m = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!m) return null;
  return { hh: Number(m[1]), mm: Number(m[2]) };
}

function isWithinQuietHours(now, startUtc, endUtc) {
  const start = parseTimeUtc(startUtc);
  const end = parseTimeUtc(endUtc);
  if (!start || !end) return false;
  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  const startMin = start.hh * 60 + start.mm;
  const endMin = end.hh * 60 + end.mm;
  if (startMin === endMin) return false;
  if (startMin < endMin) return current >= startMin && current < endMin;
  return current >= startMin || current < endMin;
}

function nextQuietHoursEnd(now, startUtc, endUtc) {
  const end = parseTimeUtc(endUtc);
  if (!end) return now;
  const next = new Date(now);
  next.setUTCSeconds(0, 0);
  next.setUTCHours(end.hh, end.mm, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function isTimeMatchUtc(now, time) {
  if (!time) return false;
  return now.getUTCHours() === time.hh && now.getUTCMinutes() === time.mm;
}

function isoDay(now) {
  return now.toISOString().slice(0, 10);
}

function isoMonth(now) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function resolveAutoChannel(names, fallbackId, createName, topic, parentId) {
  const direct = fallbackId ? await client.channels.fetch(fallbackId).catch(() => null) : null;
  if (direct && direct.isTextBased()) return direct;
  const guild = client.guilds.cache.first();
  if (!guild) return null;
  const found = findTextChannelByNames(guild, names);
  if (found) return found;
  if (!autoChannelProfileCreate) return null;
  return ensureTextChannelByName(guild, createName, { parentId, topic, reason: "Auto channel ensure" }).catch(() => null);
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

function buildStaffDigest(period = "daily") {
  const windowMs = period === "weekly" ? (7 * 24 * 60 * 60 * 1000) : (24 * 60 * 60 * 1000);
  const since = Date.now() - windowMs;
  const modState = loadModCallsState();
  const tickets = loadTickets();
  const incidents = loadIncidents();
  const audits = loadAuditEntries(2000).filter((x) => new Date(x.timeUtc || 0).getTime() >= since);
  const commandTotals = {};
  for (const row of audits) {
    const key = row.command || "unknown";
    commandTotals[key] = (commandTotals[key] || 0) + 1;
  }
  const topCommands = Object.entries(commandTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `/${k}:${v}`).join(", ") || "none";
  const openCases = modState.cases.filter((x) => x.status !== "closed" && x.status !== "cancelled");
  const createdCases = modState.cases.filter((x) => new Date(x.createdAt || 0).getTime() >= since);
  const closedCases = modState.cases.filter((x) => x.closedAt && new Date(x.closedAt || 0).getTime() >= since);
  const createdTickets = tickets.filter((x) => new Date(x.createdAt || 0).getTime() >= since);
  const openTickets = tickets.filter((x) => x.status === "open");
  const recentIncidents = incidents.filter((x) => new Date(x.createdAt || 0).getTime() >= since);
  return [
    `Staff Digest (${period})`,
    `Window: since ${new Date(since).toISOString()}`,
    `Cases: ${createdCases.length} created, ${closedCases.length} closed, ${openCases.length} open`,
    `Tickets: ${createdTickets.length} created, ${openTickets.length} open`,
    `Incidents: ${recentIncidents.length} new`,
    `Commands: ${audits.length} total • Top ${topCommands}`,
    `Runtime: ${summarizeMetrics().split("\n")[0]}`
  ].join("\n");
}

async function runModeratorActionDashboard() {
  bumpMetric("schedulerRun");
  if (!logChannelId) return;
  const now = new Date();
  if (now.getUTCHours() !== modAuditDigestHourUtc || now.getUTCMinutes() !== 0) return;
  const state = loadState();
  const dayKey = now.toISOString().slice(0, 10);
  if (state.lastModAuditDashboardAt === dayKey) return;

  const channel = await client.channels.fetch(logChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const content = `${buildStaffDigest("daily")}\nauto-marker:mod-audit-dashboard`;
  const recent = await channel.messages.fetch({ limit: 40 }).catch(() => null);
  const existing = recent?.find((m) => m.author?.id === client.user?.id && String(m.content || "").includes("auto-marker:mod-audit-dashboard")) || null;
  if (existing) {
    await existing.edit(content).catch(() => null);
    if (!disablePins) await existing.pin().catch(() => {});
  } else {
    const posted = await sendMessageWithGuards(channel, { content }, "mod.audit.dashboard");
    if (posted && !disablePins) await posted.pin().catch(() => {});
  }
  state.lastModAuditDashboardAt = dayKey;
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
  refreshDiscordOpsConfig().catch(() => {});
  setInterval(() => refreshDiscordOpsConfig().catch(() => {}), Math.max(30000, discordOpsRefreshMs));
  if (restrictAutomation) {
    console.log("[diag] DISCORD_RESTRICT_AUTOMATION is enabled; background schedulers are disabled.");
    return;
  }
  setTimeout(() => safeScheduler(postStatusUpdate), initialDelayMs);
  setTimeout(() => safeScheduler(postLatestUpdate), initialDelayMs);
  setTimeout(() => safeScheduler(postLatestTransmission), initialDelayMs);
  setTimeout(() => safeScheduler(postModsChange), initialDelayMs);
  setTimeout(() => safeScheduler(postStoryArcsUpdate), initialDelayMs);
  setTimeout(() => safeScheduler(postEventCalendarUpdate), initialDelayMs);
  setTimeout(() => safeScheduler(postEconomySnapshotUpdate), initialDelayMs);
  setTimeout(() => safeScheduler(postStaffContentDigest), initialDelayMs);
  setTimeout(() => safeScheduler(postDossierApprovals), initialDelayMs);
  setTimeout(() => safeScheduler(postActivityLog), initialDelayMs);
  setTimeout(() => safeScheduler(runDiscordAutomation), initialDelayMs);
  setTimeout(() => safeScheduler(runWebsiteChannelSync), initialDelayMs);
  setTimeout(() => safeScheduler(runTextChannelAutomation), initialDelayMs);
  setTimeout(() => safeScheduler(runModCallEscalations), initialDelayMs);
  setTimeout(() => safeScheduler(runOpsWatchdog), initialDelayMs);
  setTimeout(() => safeScheduler(runModeratorActionDashboard), initialDelayMs);
  setTimeout(() => safeScheduler(runShiftPlanReminders), initialDelayMs);
  setTimeout(() => safeScheduler(runVoiceRaidProtections), initialDelayMs);
  setTimeout(() => safeScheduler(postWorldBrief), initialDelayMs);
  setTimeout(() => safeScheduler(postStorySpark), initialDelayMs);
  setTimeout(() => safeScheduler(postMapIntelDigest), initialDelayMs);
  setTimeout(() => safeScheduler(postLorePulse), initialDelayMs);
  setTimeout(() => safeScheduler(postIncidentDigest), initialDelayMs);
  setTimeout(() => safeScheduler(postSurvivorSpotlight), initialDelayMs);
  setTimeout(() => safeScheduler(postSeasonalArc), initialDelayMs);
  setTimeout(() => safeScheduler(postLiveMilestones), initialDelayMs);

  setInterval(() => safeScheduler(postStatusUpdate), intervalMs(autoStatusMinutes));
  setInterval(() => safeScheduler(postLatestUpdate), intervalMs(autoUpdatesMinutes));
  setInterval(() => safeScheduler(postLatestTransmission), intervalMs(autoTransmissionsMinutes));
  setInterval(() => safeScheduler(postModsChange), intervalMs(autoModsMinutes));
  setInterval(() => safeScheduler(postStoryArcsUpdate), intervalMs(autoArcsMinutes));
  setInterval(() => safeScheduler(postEventCalendarUpdate), intervalMs(autoEventsMinutes));
  setInterval(() => safeScheduler(postEconomySnapshotUpdate), intervalMs(autoEconomyMinutes));
  setInterval(() => safeScheduler(postDossierApprovals), intervalMs(autoDossiersMinutes));
  setInterval(() => safeScheduler(postStaffContentDigest), 60 * 1000);
  setInterval(() => safeScheduler(runPteroWatch), intervalMs(pteroWatchIntervalMinutes));
  setInterval(() => safeScheduler(postActivityLog), intervalMs(autoActivityMinutes));
  setInterval(() => safeScheduler(runDiscordAutomation), intervalMs(autoDiscordAutomationMinutes));
  setInterval(() => safeScheduler(runWebsiteChannelSync), intervalMs(autoWebsiteChannelSyncMinutes));
  setInterval(() => safeScheduler(runTextChannelAutomation), intervalMs(autoTextChannelsMinutes));
  setInterval(() => safeScheduler(runReminders), 60 * 1000);
  setInterval(() => safeScheduler(runDailyReminder), 60 * 1000);
  setInterval(() => safeScheduler(runDailySummary), 60 * 1000);
  setInterval(() => safeScheduler(runWeeklyPrompt), 60 * 1000);
  setInterval(() => safeScheduler(runCommunityMaintenance), 5 * 60 * 1000);
  setInterval(() => safeScheduler(runBackupMaintenance), 60 * 60 * 1000);
  setInterval(() => safeScheduler(runRetentionMaintenance), 60 * 60 * 1000);
  setInterval(() => safeScheduler(runModCallEscalations), 60 * 1000);
  setInterval(() => safeScheduler(runModWeeklyDigest), 60 * 1000);
  setInterval(() => safeScheduler(runOpsWatchdog), 60 * 1000);
  setInterval(() => safeScheduler(runModeratorActionDashboard), 60 * 1000);
  setInterval(() => safeScheduler(runShiftPlanReminders), 60 * 1000);
  setInterval(() => safeScheduler(runVoiceRaidProtections), 60 * 1000);
  setInterval(() => safeScheduler(postWorldBrief), 60 * 1000);
  setInterval(() => safeScheduler(postStorySpark), 60 * 1000);
  setInterval(() => safeScheduler(postMapIntelDigest), 60 * 1000);
  setInterval(() => safeScheduler(postLorePulse), 60 * 1000);
  setInterval(() => safeScheduler(postIncidentDigest), 60 * 1000);
  setInterval(() => safeScheduler(postSurvivorSpotlight), 60 * 1000);
  setInterval(() => safeScheduler(postSeasonalArc), 60 * 1000);
  setInterval(() => safeScheduler(postLiveMilestones), 60 * 1000);
}

client.login(token);
