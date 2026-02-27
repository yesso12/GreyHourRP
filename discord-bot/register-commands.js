import "dotenv/config";
import { ChannelType, PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const scopeArg = process.argv.find((x) => x.startsWith("--scope="));
const registerScope = (scopeArg ? scopeArg.split("=")[1] : process.env.REGISTER_SCOPE || "guild").toLowerCase();
const exportOnly = process.argv.includes("--export") || process.env.GH_EXPORT_ONLY === "1";

if (!exportOnly && !["guild", "global", "both"].includes(registerScope)) {
  console.error(`Invalid --scope value: ${registerScope}. Use guild, global, or both.`);
  process.exit(1);
}

if (!exportOnly && (!token || !clientId)) {
  console.error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID");
  process.exit(1);
}
if (!exportOnly && (registerScope === "guild" || registerScope === "both") && !guildId) {
  console.error("DISCORD_GUILD_ID is required for guild or both scope registration.");
  process.exit(1);
}

export const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  new SlashCommandBuilder().setName("help").setDescription("Show bot commands"),
  new SlashCommandBuilder()
    .setName("start")
    .setDescription("Quick start guide with buttons")
    .addBooleanOption((opt) =>
      opt.setName("post").setDescription("Post a start panel in this channel (staff only)")
    ),
  new SlashCommandBuilder()
    .setName("roleselect")
    .setDescription("Pick alert roles with buttons")
    .addBooleanOption((opt) =>
      opt.setName("post").setDescription("Post the role selector panel (staff only)")
    ),
  new SlashCommandBuilder()
    .setName("helpwizard")
    .setDescription("Guided help topics and quick tips")
    .addStringOption((opt) =>
      opt.setName("topic")
        .setDescription("Help topic")
        .setRequired(false)
        .addChoices(
          { name: "connect", value: "connect" },
          { name: "mods", value: "mods" },
          { name: "rules", value: "rules" },
          { name: "support", value: "support" },
          { name: "lore", value: "lore" },
          { name: "events", value: "events" }
        )
    )
    .addBooleanOption((opt) =>
      opt.setName("post").setDescription("Post help wizard buttons (staff only)")
    ),
  new SlashCommandBuilder()
    .setName("faq")
    .setDescription("Common answers for new survivors")
    .addStringOption((opt) =>
      opt.setName("topic")
        .setDescription("FAQ topic")
        .setRequired(false)
        .addChoices(
          { name: "mods", value: "mods" },
          { name: "connect", value: "connect" },
          { name: "whitelist", value: "whitelist" },
          { name: "lag", value: "lag" }
        )
    ),
  new SlashCommandBuilder()
    .setName("bugreport")
    .setDescription("Report a bug or issue to staff"),
  new SlashCommandBuilder().setName("directory").setDescription("Website and server directory links"),
  new SlashCommandBuilder().setName("prompt").setDescription("Get a roleplay prompt"),
  new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask GreyHour Assistant a question")
    .addStringOption((opt) =>
      opt.setName("question").setDescription("Your question").setRequired(true)
    ),
  new SlashCommandBuilder().setName("live").setDescription("Show live server + Discord snapshot"),
  new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Send a suggestion to staff")
    .addStringOption((opt) =>
      opt.setName("topic")
        .setDescription("Suggestion topic")
        .setRequired(true)
        .addChoices(
          { name: "server", value: "server" },
          { name: "events", value: "events" },
          { name: "economy", value: "economy" },
          { name: "roleplay", value: "roleplay" },
          { name: "rules", value: "rules" },
          { name: "mods", value: "mods" },
          { name: "other", value: "other" }
        )
    )
    .addStringOption((opt) => opt.setName("suggestion").setDescription("Your suggestion").setRequired(true))
    .addStringOption((opt) => opt.setName("details").setDescription("Optional extra details").setRequired(false)),
  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Shop and service requests")
    .addSubcommand((sub) =>
      sub
        .setName("request")
        .setDescription("Request a repair shop service")
        .addStringOption((opt) =>
          opt.setName("type")
            .setDescription("Service type")
            .setRequired(true)
            .addChoices(
              { name: "repair", value: "repair" },
              { name: "parts", value: "parts" },
              { name: "tow", value: "tow" },
              { name: "tune", value: "tune" },
              { name: "inspection", value: "inspection" },
              { name: "other", value: "other" }
            )
        )
        .addStringOption((opt) => opt.setName("details").setDescription("What do you need?").setRequired(true))
        .addStringOption((opt) => opt.setName("vehicle").setDescription("Vehicle or plate").setRequired(false))
        .addStringOption((opt) => opt.setName("location").setDescription("Pickup/location").setRequired(false))
        .addStringOption((opt) => opt.setName("contact").setDescription("Best contact info").setRequired(false))
        .addStringOption((opt) =>
          opt.setName("urgency")
            .setDescription("Urgency")
            .setRequired(false)
            .addChoices(
              { name: "low", value: "low" },
              { name: "normal", value: "normal" },
              { name: "high", value: "high" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("store")
        .setDescription("Request a new in-game store/shop listing")
        .addStringOption((opt) => opt.setName("name").setDescription("Store name").setRequired(true))
        .addStringOption((opt) =>
          opt.setName("category")
            .setDescription("Store category")
            .setRequired(true)
            .addChoices(
              { name: "mechanic", value: "mechanic" },
              { name: "medical", value: "medical" },
              { name: "weapons", value: "weapons" },
              { name: "food", value: "food" },
              { name: "clothing", value: "clothing" },
              { name: "entertainment", value: "entertainment" },
              { name: "other", value: "other" }
            )
        )
        .addStringOption((opt) => opt.setName("description").setDescription("What does the shop offer?").setRequired(true))
        .addStringOption((opt) => opt.setName("owner").setDescription("Owner/operator name").setRequired(false))
        .addStringOption((opt) => opt.setName("location").setDescription("Location").setRequired(false))
        .addStringOption((opt) => opt.setName("contact").setDescription("Best contact info").setRequired(false))
    ),
  new SlashCommandBuilder()
    .setName("dossier")
    .setDescription("Character dossier submissions")
    .addSubcommand((sub) =>
      sub
        .setName("submit")
        .setDescription("Submit a character dossier for review")
        .addStringOption((opt) => opt.setName("name").setDescription("Character name").setRequired(true))
        .addStringOption((opt) => opt.setName("handle").setDescription("Handle or nickname").setRequired(false))
        .addStringOption((opt) => opt.setName("faction").setDescription("Faction ID (optional)").setRequired(false))
        .addStringOption((opt) => opt.setName("backstory").setDescription("Short backstory").setRequired(false))
        .addStringOption((opt) => opt.setName("goals").setDescription("Goals (comma-separated)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List approved dossiers")
    ),
  new SlashCommandBuilder()
    .setName("arc")
    .setDescription("Seasonal story arcs")
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show current arcs")
    ),
  new SlashCommandBuilder()
    .setName("events")
    .setDescription("Event calendar")
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List upcoming events")
    ),
  new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Economy snapshot")
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Show the latest economy snapshot")
    ),
  new SlashCommandBuilder()
    .setName("digest")
    .setDescription("Post staff digests")
    .addSubcommand((sub) =>
      sub
        .setName("content")
        .setDescription("Post the staff content digest now")
    ),
  new SlashCommandBuilder()
    .setName("ptero")
    .setDescription("Pterodactyl control")
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Show server status from Pterodactyl Application API")
    )
    .addSubcommand((sub) =>
      sub
        .setName("resources")
        .setDescription("Show live resource usage from Pterodactyl Client API")
    )
    .addSubcommand((sub) =>
      sub
        .setName("power")
        .setDescription("Send a power signal via Pterodactyl Client API")
        .addStringOption((opt) =>
          opt
            .setName("signal")
            .setDescription("Power action")
            .setRequired(true)
            .addChoices(
              { name: "start", value: "start" },
              { name: "stop", value: "stop" },
              { name: "restart", value: "restart" },
              { name: "kill", value: "kill" }
            )
        )
        .addBooleanOption((opt) =>
          opt
            .setName("confirm")
            .setDescription("Confirm this power action")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("console")
        .setDescription("Stream live console output (read-only)")
        .addIntegerOption((opt) =>
          opt
            .setName("minutes")
            .setDescription("Stream duration in minutes (default 2)")
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Optional destination channel")
        )
    ),
  new SlashCommandBuilder()
    .setName("helpline")
    .setDescription("Scripted help lines for staff and owners")
    .addSubcommand((sub) =>
      sub
        .setName("staff")
        .setDescription("Staff ticket response scripts")
        .addStringOption((opt) =>
          opt.setName("topic")
            .setDescription("Choose a script")
            .setRequired(true)
            .addChoices(
              { name: "ticket", value: "ticket" },
              { name: "triage", value: "triage" },
              { name: "conflict", value: "conflict" },
              { name: "bug", value: "bug" },
              { name: "appeal", value: "appeal" },
              { name: "harassment", value: "harassment" },
              { name: "cheating", value: "cheating" },
              { name: "outage", value: "outage" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("owner")
        .setDescription("Owner announcement scripts")
        .addStringOption((opt) =>
          opt.setName("topic")
            .setDescription("Choose a script")
            .setRequired(true)
            .addChoices(
              { name: "announcement", value: "announcement" },
              { name: "escalation", value: "escalation" },
              { name: "policy", value: "policy" },
              { name: "appreciation", value: "appreciation" },
              { name: "outage", value: "outage" }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName("oncall")
    .setDescription("On-call rota management")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("add")
        .setDescription("Add an on-call staff member")
        .addUserOption((opt) => opt.setName("user").setDescription("Staff user").setRequired(true))
        .addStringOption((opt) => opt.setName("timezone").setDescription("Timezone label (e.g. UTC, EST)").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List on-call rota"))
    .addSubcommand((sub) =>
      sub.setName("remove")
        .setDescription("Remove from on-call rota")
        .addUserOption((opt) => opt.setName("user").setDescription("Staff user").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("ping")
        .setDescription("Ping current on-call and fallback")
        .addStringOption((opt) => opt.setName("issue").setDescription("Issue summary").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("sla")
    .setDescription("SLA tracking tools")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName("board").setDescription("Show current SLA board")),
  new SlashCommandBuilder()
    .setName("summarize")
    .setDescription("AI-assisted moderation summaries")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("channel")
        .setDescription("Summarize recent channel activity")
        .addChannelOption((opt) => opt.setName("channel").setDescription("Target channel").setRequired(false))
        .addIntegerOption((opt) => opt.setName("minutes").setDescription("Minutes back (5-180)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("user")
        .setDescription("Summarize moderation risk for user")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("safety")
    .setDescription("Community safety scoring")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("score")
        .setDescription("Show safety score for a channel")
        .addChannelOption((opt) => opt.setName("channel").setDescription("Target channel").setRequired(false))
    ),
  new SlashCommandBuilder()
    .setName("drill")
    .setDescription("Red-team simulation drills")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("start")
        .setDescription("Start a drill scenario")
        .addStringOption((opt) =>
          opt.setName("scenario")
            .setDescription("Drill type")
            .setRequired(true)
            .addChoices(
              { name: "raid", value: "raid" },
              { name: "harassment", value: "harassment" },
              { name: "spam", value: "spam" },
              { name: "incident-response", value: "incident-response" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName("score")
        .setDescription("Score a drill result")
        .addStringOption((opt) => opt.setName("id").setDescription("Drill id").setRequired(true))
        .addIntegerOption((opt) => opt.setName("score").setDescription("Score 0-100").setRequired(true))
        .addStringOption((opt) => opt.setName("notes").setDescription("After-action notes").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("report").setDescription("Show recent drill reports")),
  new SlashCommandBuilder()
    .setName("vault")
    .setDescription("Evidence vault tools")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("create")
        .setDescription("Create signed evidence link")
        .addStringOption((opt) => opt.setName("case_id").setDescription("Case id").setRequired(true))
        .addIntegerOption((opt) => opt.setName("expires_hours").setDescription("Link expiry hours (1-168)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("list")
        .setDescription("List recent evidence links")
        .addStringOption((opt) => opt.setName("case_id").setDescription("Optional case id").setRequired(false))
    ),
  new SlashCommandBuilder()
    .setName("kb")
    .setDescription("Knowledge base ingestion/search")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("ingest")
        .setDescription("Ingest a knowledge snippet")
        .addStringOption((opt) => opt.setName("topic").setDescription("Topic").setRequired(true))
        .addStringOption((opt) => opt.setName("text").setDescription("Knowledge text").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("search")
        .setDescription("Search ingested knowledge")
        .addStringOption((opt) => opt.setName("query").setDescription("Query").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("approve")
    .setDescription("Approve or deny pending high-risk requests")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) => opt.setName("request_id").setDescription("Approval request id").setRequired(true))
    .addStringOption((opt) =>
      opt.setName("decision")
        .setDescription("approve or deny")
        .setRequired(true)
        .addChoices(
          { name: "approve", value: "approve" },
          { name: "deny", value: "deny" }
        )
    )
    .addStringOption((opt) => opt.setName("note").setDescription("Optional note").setRequired(false)),
  new SlashCommandBuilder()
    .setName("diagnose")
    .setDescription("Diagnose command readiness and permissions")
    .addStringOption((opt) =>
      opt.setName("command").setDescription("Command name without slash").setRequired(true)
    )
    .addChannelOption((opt) =>
      opt.setName("channel").setDescription("Optional channel context").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("health")
    .setDescription("Run bot health checks (staff only)")
    .addBooleanOption((opt) =>
      opt.setName("details").setDescription("Include extended diagnostics").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("game")
    .setDescription("Game server controls (staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Show live game server status")
    )
    .addSubcommand((sub) =>
      sub.setName("players").setDescription("Show current online player count")
    )
    .addSubcommand((sub) =>
      sub
        .setName("announce")
        .setDescription("Broadcast a message to the game server")
        .addStringOption((opt) => opt.setName("message").setDescription("Message to broadcast").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("save").setDescription("Force save world state")
    )
    .addSubcommand((sub) =>
      sub.setName("restart").setDescription("Restart the game server")
    )
    .addSubcommand((sub) =>
      sub
        .setName("command")
        .setDescription("Run a raw game command")
        .addStringOption((opt) => opt.setName("command").setDescription("Command without leading slash").setRequired(true))
        .addStringOption((opt) => opt.setName("args").setDescription("Optional args string").setRequired(false))
    ),
  new SlashCommandBuilder()
    .setName("ops")
    .setDescription("Operations controls (staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("status").setDescription("Show runtime operations status")
    )
    .addSubcommand((sub) =>
      sub
        .setName("maintenance")
        .setDescription("Set maintenance mode")
        .addStringOption((opt) =>
          opt.setName("state")
            .setDescription("on or off")
            .setRequired(true)
            .addChoices(
              { name: "on", value: "on" },
              { name: "off", value: "off" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("message").setDescription("Optional maintenance message").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("inventory")
        .setDescription("Export or summarize members/channels/roles")
        .addStringOption((opt) =>
          opt.setName("mode")
            .setDescription("summary or export")
            .setRequired(false)
            .addChoices(
              { name: "summary", value: "summary" },
              { name: "export", value: "export" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("safemode")
        .setDescription("Toggle safe mode for high-risk admin actions")
        .addStringOption((opt) =>
          opt.setName("state")
            .setDescription("on or off")
            .setRequired(true)
            .addChoices(
              { name: "on", value: "on" },
              { name: "off", value: "off" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("dashboard")
        .setDescription("Get dashboard and metrics endpoints")
    )
    .addSubcommand((sub) =>
      sub
        .setName("simulation")
        .setDescription("Toggle simulation mode for staff drills")
        .addStringOption((opt) =>
          opt.setName("state")
            .setDescription("on or off")
            .setRequired(true)
            .addChoices(
              { name: "on", value: "on" },
              { name: "off", value: "off" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remediate")
        .setDescription("Run auto-remediation recipe")
        .addStringOption((opt) =>
          opt.setName("recipe")
            .setDescription("Remediation recipe")
            .setRequired(true)
            .addChoices(
              { name: "raid", value: "raid" },
              { name: "spam", value: "spam" },
              { name: "harassment", value: "harassment" }
            )
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Target channel (default current)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("organize")
        .setDescription("Beautify channel layout, naming, topics, and archive stale channels")
        .addStringOption((opt) =>
          opt.setName("mode")
            .setDescription("Preview or apply changes")
            .setRequired(true)
            .addChoices(
              { name: "preview", value: "preview" },
              { name: "apply", value: "apply" }
            )
        )
        .addBooleanOption((opt) =>
          opt.setName("normalize_names").setDescription("Also normalize channel names").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("preserve_existing").setDescription("Keep existing channels untouched; only add missing structure").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("apply_topics").setDescription("Auto-apply topic templates when topic is empty").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("create_indexes").setDescription("Create index/read-first channels for each category").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("create_core").setDescription("Create missing core channels for easy discovery").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("include_voice").setDescription("Include voice/stage channels").setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt.setName("limit").setDescription("Max channels to reorganize (1-100)").setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt.setName("archive_stale_days").setDescription("Move inactive channels to ARCHIVE after N days (0 disables)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("welcome")
        .setDescription("Build/update a polished welcome experience channel")
        .addStringOption((opt) =>
          opt.setName("mode")
            .setDescription("Preview or apply")
            .setRequired(true)
            .addChoices(
              { name: "preview", value: "preview" },
              { name: "apply", value: "apply" }
            )
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Optional target channel (defaults to welcome channel)").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("overwrite").setDescription("Allow replacing existing bot welcome card if found").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("channelmap")
        .setDescription("Identify and map all channels by category/type")
        .addStringOption((opt) =>
          opt.setName("mode")
            .setDescription("summary or publish")
            .setRequired(false)
            .addChoices(
              { name: "summary", value: "summary" },
              { name: "publish", value: "publish" }
            )
        )
        .addBooleanOption((opt) =>
          opt.setName("include_voice").setDescription("Include voice/stage channels").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("overwrite").setDescription("Allow replacing existing published directory card").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("textauto")
        .setDescription("Automate all text channels with guides and topic upkeep")
        .addStringOption((opt) =>
          opt.setName("mode")
            .setDescription("Preview or apply")
            .setRequired(true)
            .addChoices(
              { name: "preview", value: "preview" },
              { name: "apply", value: "apply" }
            )
        )
        .addBooleanOption((opt) =>
          opt.setName("full_scan").setDescription("Process all text channels now").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("websitesync")
        .setDescription("Sync rules/status/announcements/directory/story channels from website content")
        .addStringOption((opt) =>
          opt.setName("mode")
            .setDescription("Preview or apply")
            .setRequired(true)
            .addChoices(
              { name: "preview", value: "preview" },
              { name: "apply", value: "apply" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("digest")
        .setDescription("Post staff operational digest summary")
        .addStringOption((opt) =>
          opt.setName("period")
            .setDescription("Digest period")
            .setRequired(false)
            .addChoices(
              { name: "daily", value: "daily" },
              { name: "weekly", value: "weekly" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("analytics")
        .setDescription("Show command analytics and error trends")
        .addIntegerOption((opt) =>
          opt.setName("limit").setDescription("Top commands to show (3-20)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("channels")
        .setDescription("Approve or deny pending channel creation requests")
        .addStringOption((opt) =>
          opt.setName("action")
            .setDescription("Action to run")
            .setRequired(true)
            .addChoices(
              { name: "pending", value: "pending" },
              { name: "approve", value: "approve" },
              { name: "deny", value: "deny" }
            )
        )
        .addStringOption((opt) =>
          opt.setName("request_id").setDescription("Pending request id for approve/deny").setRequired(false)
        )
        .addChannelOption((opt) =>
          opt.setName("existing_channel").setDescription("Optional existing channel to bind on approve").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("syncpanel")
        .setDescription("Sync bot operations snapshot to admin panel content")
    )
    .addSubcommand((sub) =>
      sub
        .setName("disaster")
        .setDescription("Disaster recovery mode controls")
        .addStringOption((opt) =>
          opt.setName("state")
            .setDescription("on or off")
            .setRequired(true)
            .addChoices(
              { name: "on", value: "on" },
              { name: "off", value: "off" }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName("botcontrol")
    .setDescription("Owner/dev controls for bot automation and codex")
    .addSubcommand((sub) =>
      sub
        .setName("toggle")
        .setDescription("Toggle runtime features without editing config")
        .addStringOption((opt) =>
          opt
            .setName("feature")
            .setDescription("Feature to toggle")
            .setRequired(true)
            .addChoices(
              { name: "Codex replies", value: "codex" },
              { name: "GPT autoheal", value: "autoheal" },
              { name: "Text channel automation", value: "textauto" }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName("state")
            .setDescription("Enable or disable the feature")
            .setRequired(true)
            .addChoices(
              { name: "Enable", value: "on" },
              { name: "Disable", value: "off" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("run")
        .setDescription("Run a manual automation job")
        .addStringOption((opt) =>
          opt
            .setName("job")
            .setDescription("Job to run")
            .setRequired(true)
            .addChoices(
              { name: "Text channel automation", value: "textauto" },
              { name: "Website channel sync", value: "websync" },
              { name: "Refresh bot ops hub", value: "nav" }
            )
        )
        .addBooleanOption((opt) => opt.setName("force").setDescription("Force run even if the job is disabled"))
    )
    .addSubcommand((sub) =>
      sub
        .setName("diag")
        .setDescription("Show runtime bot control status")
    ),
  new SlashCommandBuilder()
    .setName("assistant")
    .setDescription("Control GreyHour Assistant per channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("enable")
        .setDescription("Enable assistant in a channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to enable (defaults to current)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("Disable assistant in a channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to disable (defaults to current)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("nomention")
        .setDescription("Allow assistant without mention in a channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to update (defaults to current)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reset")
        .setDescription("Clear overrides and return to auto behavior")
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Show assistant channel settings")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to check (defaults to current)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName("channelmode")
    .setDescription("Lock or unlock channels for focused use")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("lock")
        .setDescription("Make a channel read-only for members")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to lock (defaults to current)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unlock")
        .setDescription("Allow members to chat normally")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to unlock (defaults to current)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Show channel lock status")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to check (defaults to current)")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName("rolesync")
    .setDescription("Validate and optionally repair role-sync mappings")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("preview")
        .setDescription("Preview role-sync drift without changes")
    )
    .addSubcommand((sub) =>
      sub
        .setName("validate")
        .setDescription("Check role-sync drift and optionally apply fixes")
        .addBooleanOption((opt) =>
          opt.setName("apply").setDescription("Apply missing/removal fixes").setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName("modcall")
    .setDescription("Real-time moderator call workflow")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("setup").setDescription("Post live mod call button panel (staff)")
    )
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Open a live moderator case")
        .addStringOption((opt) =>
          opt.setName("severity")
            .setDescription("Case severity")
            .setRequired(false)
            .addChoices(
              { name: "low", value: "low" },
              { name: "medium", value: "medium" },
              { name: "high", value: "high" },
              { name: "critical", value: "critical" }
            )
        )
        .addStringOption((opt) => opt.setName("category").setDescription("Abuse, harassment, cheating, etc").setRequired(false))
        .addStringOption((opt) => opt.setName("details").setDescription("What is happening right now?").setRequired(false))
        .addUserOption((opt) => opt.setName("target").setDescription("User involved").setRequired(false))
        .addAttachmentOption((opt) => opt.setName("attachment").setDescription("Screenshot/video evidence").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List mod cases (staff)")
        .addBooleanOption((opt) => opt.setName("open_only").setDescription("Show open only (default true)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("claim")
        .setDescription("Claim a mod case (staff)")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("transfer")
        .setDescription("Transfer a case to another moderator (staff)")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
        .addUserOption((opt) => opt.setName("to").setDescription("Moderator user").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Close a mod case (staff)")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id (optional when run in case thread)").setRequired(false))
        .addStringOption((opt) => opt.setName("reason").setDescription("Resolution reason").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Send reporter status update (staff)")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
        .addStringOption((opt) => opt.setName("message").setDescription("Status message").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("evidence")
        .setDescription("Attach evidence to case (staff)")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
        .addStringOption((opt) => opt.setName("note").setDescription("Evidence notes").setRequired(false))
        .addStringOption((opt) => opt.setName("url").setDescription("Evidence URL").setRequired(false))
        .addAttachmentOption((opt) => opt.setName("attachment").setDescription("Evidence attachment").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("flag")
        .setDescription("Flag false-report abuse (staff)")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
        .addStringOption((opt) => opt.setName("reason").setDescription("Why this is a false report").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("template")
        .setDescription("Post a canned staff response template")
        .addStringOption((opt) =>
          opt.setName("type")
            .setDescription("Template type")
            .setRequired(true)
            .addChoices(
              { name: "acknowledge", value: "acknowledge" },
              { name: "investigating", value: "investigating" },
              { name: "resolution", value: "resolution" },
              { name: "insufficient-evidence", value: "insufficient_evidence" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("export")
        .setDescription("Export a full case bundle")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("wizard")
        .setDescription("Guided moderation case workflow")
        .addStringOption((opt) =>
          opt.setName("scenario")
            .setDescription("Scenario type")
            .setRequired(false)
            .addChoices(
              { name: "harassment", value: "harassment" },
              { name: "cheating", value: "cheating" },
              { name: "spam", value: "spam" },
              { name: "raid", value: "raid" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reopen")
        .setDescription("Reopen a previously closed case")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
        .addStringOption((opt) => opt.setName("reason").setDescription("Reason for reopening").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("priority")
        .setDescription("Adjust case priority")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
        .addStringOption((opt) =>
          opt.setName("level")
            .setDescription("Priority level")
            .setRequired(true)
            .addChoices(
              { name: "low", value: "low" },
              { name: "normal", value: "normal" },
              { name: "high", value: "high" },
              { name: "critical", value: "critical" }
            )
        )
        .addStringOption((opt) => opt.setName("reason").setDescription("Reason for change").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("vault")
        .setDescription("Create evidence vault link for a case")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("case")
    .setDescription("Case routing helpers")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("assign-next")
        .setDescription("Assign an open case to the least-busy on-shift moderator")
        .addStringOption((opt) => opt.setName("id").setDescription("Specific case id (optional)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("timeline")
        .setDescription("Render full timeline for a case")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("staffpanel")
    .setDescription("Post a one-click staff control panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("staffquickstart")
    .setDescription("Post and pin a staff quickstart guide")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder()
    .setName("playbook")
    .setDescription("Show moderator response playbooks")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt.setName("topic")
        .setDescription("Playbook topic")
        .setRequired(true)
        .addChoices(
          { name: "harassment", value: "harassment" },
          { name: "cheating", value: "cheating" },
          { name: "spam", value: "spam" },
          { name: "raid", value: "raid" }
        )
    )
    .addStringOption((opt) =>
      opt.setName("case_id").setDescription("Optional case id to apply playbook notes").setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt.setName("execute").setDescription("Post playbook steps into the case thread").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("triage")
    .setDescription("Analyze ticket/case text for severity, category, and actions")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt.setName("text").setDescription("Text to analyze").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Voice moderation tools")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("panic-move")
        .setDescription("Move all users in your current voice channel to target voice channel")
        .addChannelOption((opt) => opt.setName("target").setDescription("Target voice channel").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("mute-cooldown")
        .setDescription("Timeout all users in your current voice channel for a short cooldown")
        .addIntegerOption((opt) => opt.setName("minutes").setDescription("Cooldown minutes (1-30)").setRequired(false))
    ),
  new SlashCommandBuilder()
    .setName("trustgraph")
    .setDescription("Analyze trust/risk context for a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true)),
  new SlashCommandBuilder()
    .setName("policy")
    .setDescription("Policy simulator tools")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("test")
        .setDescription("Test whether a user can run a command")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
        .addStringOption((opt) => opt.setName("command").setDescription("Command name without slash").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("suggest")
        .setDescription("Suggest policy updates from denied/error command patterns")
    ),
  new SlashCommandBuilder()
    .setName("copilot")
    .setDescription("Staff copilot recommendations")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("suggest")
        .setDescription("Suggest next best moderation actions for a case")
        .addStringOption((opt) => opt.setName("case_id").setDescription("Case id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("shiftplan")
    .setDescription("Moderator shift scheduling")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("add")
        .setDescription("Add a shift reminder")
        .addStringOption((opt) => opt.setName("time_utc").setDescription("UTC time HH:MM").setRequired(true))
        .addStringOption((opt) => opt.setName("note").setDescription("Shift note").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("list")
        .setDescription("List your shift reminders")
    )
    .addSubcommand((sub) =>
      sub.setName("remove")
        .setDescription("Remove shift reminder by id")
        .addStringOption((opt) => opt.setName("id").setDescription("Shift id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("handoff")
    .setDescription("Generate shift handoff summary")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption((opt) => opt.setName("include_cases").setDescription("Include case list details").setRequired(false)),
  new SlashCommandBuilder()
    .setName("permissions")
    .setDescription("Audit bot permissions in key channels")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("audit")
        .setDescription("Check for missing permissions")
        .addBooleanOption((opt) =>
          opt.setName("detailed").setDescription("Include fix suggestions").setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName("staffstats")
    .setDescription("Show moderator performance metrics")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((opt) => opt.setName("user").setDescription("Specific staff member").setRequired(false)),
  new SlashCommandBuilder()
    .setName("announcepreset")
    .setDescription("Send a preset staff announcement")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt.setName("preset")
        .setDescription("Preset template")
        .setRequired(true)
        .addChoices(
          { name: "restart", value: "restart" },
          { name: "maintenance", value: "maintenance" },
          { name: "wipe", value: "wipe" },
          { name: "incident", value: "incident" },
          { name: "resolved", value: "resolved" }
        )
    )
    .addStringOption((opt) => opt.setName("note").setDescription("Optional extra details").setRequired(false))
    .addBooleanOption((opt) => opt.setName("everyone").setDescription("Mention @everyone").setRequired(false)),
  new SlashCommandBuilder()
    .setName("knowledge")
    .setDescription("Search staff knowledge base (rules, playbooks, FAQ)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) => opt.setName("query").setDescription("Search query").setRequired(true)),
  new SlashCommandBuilder()
    .setName("mod")
    .setDescription("Moderator shift and analytics")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("shift")
        .setDescription("Set your moderator shift status")
        .addStringOption((opt) =>
          opt.setName("state")
            .setDescription("on or off")
            .setRequired(true)
            .addChoices(
              { name: "on", value: "on" },
              { name: "off", value: "off" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName("coverage").setDescription("Show on-shift coverage and open queue")
    )
    .addSubcommand((sub) =>
      sub.setName("metrics").setDescription("Show weekly moderation metrics")
    ),
  new SlashCommandBuilder()
    .setName("admin")
    .setDescription("Admin control plane with approvals and rollback")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("purge")
        .setDescription("Purge recent messages")
        .addIntegerOption((opt) => opt.setName("amount").setDescription("Messages to delete (1-100)").setRequired(true))
        .addChannelOption((opt) => opt.setName("channel").setDescription("Target channel").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("lockdown")
        .setDescription("Lock a channel for @everyone")
        .addChannelOption((opt) => opt.setName("channel").setDescription("Target channel").setRequired(false))
        .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("unlockdown")
        .setDescription("Unlock a channel for @everyone")
        .addChannelOption((opt) => opt.setName("channel").setDescription("Target channel").setRequired(false))
        .addStringOption((opt) => opt.setName("reason").setDescription("Reason").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("rolegrant")
        .setDescription("Grant role to user")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
        .addRoleOption((opt) => opt.setName("role").setDescription("Role to grant").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("rolerevoke")
        .setDescription("Revoke role from user")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
        .addRoleOption((opt) => opt.setName("role").setDescription("Role to revoke").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("snapshot")
        .setDescription("Capture current channel lock/slowmode snapshot")
        .addStringOption((opt) => opt.setName("label").setDescription("Snapshot label").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("rollback")
        .setDescription("Rollback channel lock/slowmode snapshot")
        .addStringOption((opt) => opt.setName("snapshot_id").setDescription("Snapshot id").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("health")
        .setDescription("Run admin control plane health checks")
    )
    .addSubcommand((sub) =>
      sub
        .setName("doctor")
        .setDescription("Suggest precise remediation for admin control issues")
    ),
  new SlashCommandBuilder().setName("metrics").setDescription("Show bot runtime metrics (staff only)"),
  new SlashCommandBuilder().setName("whois").setDescription("Show member profile")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Target user").setRequired(false)
    ),
  new SlashCommandBuilder().setName("playercount").setDescription("Show live player count"),
  new SlashCommandBuilder()
    .setName("music")
    .setDescription("Music playback controls")
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("Play by artist/song text, URL, or auto-playlist")
        .addStringOption((opt) =>
          opt.setName("query").setDescription("Song name, artist, URL, or playlist request").setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt.setName("autoplaylist").setDescription("Queue an automatic playlist from the query").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("queue").setDescription("Show current queue")
    )
    .addSubcommand((sub) =>
      sub.setName("skip").setDescription("Skip current track")
    )
    .addSubcommand((sub) =>
      sub.setName("stop").setDescription("Stop playback and clear queue")
    )
    .addSubcommand((sub) =>
      sub.setName("leave").setDescription("Disconnect and clear queue")
    )
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Create and approve music text/voice channels")
        .addStringOption((opt) =>
          opt.setName("base_name").setDescription("Base channel name (default music)").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("overwrite").setDescription("Replace managed channel bindings").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("approve")
        .setDescription("Approve channels or bot user for music policy")
        .addChannelOption((opt) =>
          opt
            .setName("text_channel")
            .setDescription("Approved music text channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("voice_channel")
            .setDescription("Approved music voice channel")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addUserOption((opt) =>
          opt.setName("bot_user").setDescription("Music bot account to enforce").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("revoke")
        .setDescription("Remove channels or bot user from music policy")
        .addChannelOption((opt) =>
          opt
            .setName("text_channel")
            .setDescription("Approved music text channel")
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("voice_channel")
            .setDescription("Approved music voice channel")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(false)
        )
        .addUserOption((opt) =>
          opt.setName("bot_user").setDescription("Music bot account to remove").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Show current music policy")
    ),
  new SlashCommandBuilder()
    .setName("staff")
    .setDescription("Show current owners/admins/moderators")
    .addBooleanOption((opt) =>
      opt.setName("online_only").setDescription("Show only online staff").setRequired(false)
    ),
  new SlashCommandBuilder().setName("links").setDescription("Show Grey Hour RP links"),
  new SlashCommandBuilder().setName("lore").setDescription("Show the Grey Hour lore primer"),
  new SlashCommandBuilder().setName("status").setDescription("Get live server status"),
  new SlashCommandBuilder().setName("statushistory").setDescription("Show recent status history"),
  new SlashCommandBuilder().setName("updates").setDescription("Show latest update"),
  new SlashCommandBuilder().setName("transmissions").setDescription("Show latest transmission"),
  new SlashCommandBuilder().setName("mods").setDescription("Get modpack info"),
  new SlashCommandBuilder().setName("rules").setDescription("Show rules link"),
  new SlashCommandBuilder().setName("join").setDescription("How to join Grey Hour RP"),
  new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send announcement to Discord")
    .addStringOption((opt) =>
      opt.setName("message").setDescription("Announcement text").setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName("preset")
        .setDescription("Optional preset template")
        .setRequired(false)
        .addChoices(
          { name: "restart", value: "restart" },
          { name: "maintenance", value: "maintenance" },
          { name: "wipe", value: "wipe" },
          { name: "incident", value: "incident" },
          { name: "resolved", value: "resolved" }
        )
    )
    .addStringOption((opt) =>
      opt.setName("note").setDescription("Extra details appended to preset").setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt.setName("everyone").setDescription("Mention @everyone").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("reminder")
    .setDescription("Manage scheduled reminders")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Create a reminder")
        .addIntegerOption((opt) =>
          opt.setName("minutes").setDescription("Minutes from now").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("message").setDescription("Reminder message").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List upcoming reminders")
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a reminder by id")
        .addStringOption((opt) =>
          opt.setName("id").setDescription("Reminder id").setRequired(true)
        )
    ),
  new SlashCommandBuilder()
    .setName("roll")
    .setDescription("Roll dice")
    .addIntegerOption((opt) =>
      opt.setName("sides").setDescription("Number of sides (default 6)").setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt.setName("count").setDescription("Number of dice (default 1)").setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("activity")
    .setDescription("Show recent admin activity (staff only)"),
  new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a quick reaction poll (staff only)")
    .addStringOption((opt) =>
      opt.setName("question").setDescription("Poll question").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("event")
    .setDescription("Manage community events (staff only)")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create an event")
        .addStringOption((opt) => opt.setName("title").setDescription("Event title").setRequired(true))
        .addStringOption((opt) => opt.setName("time").setDescription("When it starts").setRequired(true))
        .addStringOption((opt) => opt.setName("details").setDescription("Extra details").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List active events")
    )
    .addSubcommand((sub) =>
      sub
        .setName("announce")
        .setDescription("Announce an event by id")
        .addStringOption((opt) => opt.setName("id").setDescription("Event id").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("Mark an event completed")
        .addStringOption((opt) => opt.setName("id").setDescription("Event id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Open or close support tickets")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Create a private support ticket")
        .addStringOption((opt) => opt.setName("subject").setDescription("Short subject").setRequired(true))
        .addStringOption((opt) => opt.setName("details").setDescription("Ticket details").setRequired(false))
        .addStringOption((opt) =>
          opt.setName("urgency")
            .setDescription("How urgent is this issue?")
            .setRequired(false)
            .addChoices(
              { name: "normal", value: "normal" },
              { name: "high", value: "high" },
              { name: "urgent", value: "urgent" }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Close the current ticket thread")
    )
    .addSubcommand((sub) =>
      sub
        .setName("forceclose")
        .setDescription("Owner/admin recovery close for broken ticket metadata")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Ticket channel/thread to force close").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Optional reason for audit/deletion log").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("intake")
        .setDescription("Open structured ticket intake form")
    )
    .addSubcommand((sub) =>
      sub
        .setName("wizard")
        .setDescription("Guided ticket intake workflow")
    )
    .addSubcommand((sub) =>
      sub
        .setName("reopen")
        .setDescription("Reopen a closed ticket by id")
        .addStringOption((opt) => opt.setName("id").setDescription("Ticket id").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("feedback")
        .setDescription("Submit post-ticket feedback")
        .addStringOption((opt) => opt.setName("ticket_id").setDescription("Ticket id").setRequired(true))
        .addIntegerOption((opt) => opt.setName("rating").setDescription("Rating 1-5").setRequired(true))
        .addStringOption((opt) => opt.setName("note").setDescription("Optional note").setRequired(false))
    ),
  new SlashCommandBuilder()
    .setName("moddiff")
    .setDescription("Show modpack changes since last snapshot"),
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete recent messages in this channel (staff only)")
    .addIntegerOption((opt) =>
      opt.setName("amount").setDescription("Messages to delete (1-100)").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Advanced channel clear tools (staff only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sub) =>
      sub.setName("messages")
        .setDescription("Delete recent messages in batches")
        .addIntegerOption((opt) =>
          opt.setName("amount").setDescription("Messages to delete (1-1000)").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for clearing").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("dry_run").setDescription("Preview only; do not delete").setRequired(false)
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Target channel (defaults to current)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("all")
        .setDescription("Clear all deletable recent messages from a channel")
        .addIntegerOption((opt) =>
          opt.setName("max_messages").setDescription("Safety cap (100-20000, default 5000)").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for clearing").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("dry_run").setDescription("Preview only; do not delete").setRequired(false)
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Target channel (defaults to current)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("old")
        .setDescription("Delete old messages (older than 14 days) one-by-one")
        .addIntegerOption((opt) =>
          opt.setName("max_messages").setDescription("Max old messages to delete (10-2000, default 250)").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("include_pinned").setDescription("Also delete pinned messages").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for clearing").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("dry_run").setDescription("Preview only; do not delete").setRequired(false)
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Target channel (defaults to current)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("nuke")
        .setDescription("Recreate a channel to wipe full history")
        .addStringOption((opt) =>
          opt.setName("confirm").setDescription("Type NUKE to confirm").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Reason for nuking").setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt.setName("dry_run").setDescription("Preview only; do not nuke").setRequired(false)
        )
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Target text channel (defaults to current)").setRequired(false)
        )
    ),
  new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set channel slowmode seconds (staff only)")
    .addIntegerOption((opt) =>
      opt.setName("seconds").setDescription("0 to disable, max 21600").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Lock current channel for @everyone (staff only)"),
  new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlock current channel for @everyone (staff only)"),
  new SlashCommandBuilder()
    .setName("lfg")
    .setDescription("Looking-for-group tools")
    .addSubcommand((sub) =>
      sub.setName("create")
        .setDescription("Create an LFG post")
        .addStringOption((opt) => opt.setName("playstyle").setDescription("PvE, PvP, RP, casual...").setRequired(true))
        .addStringOption((opt) => opt.setName("map").setDescription("Map / region").setRequired(true))
        .addStringOption((opt) => opt.setName("details").setDescription("Extra details").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List active LFG posts"))
    .addSubcommand((sub) =>
      sub.setName("close")
        .setDescription("Close one of your LFG posts")
        .addStringOption((opt) => opt.setName("id").setDescription("LFG id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("group")
    .setDescription("Faction and shop group tools")
    .addSubcommand((sub) =>
      sub
        .setName("request")
        .setDescription("Request a new faction/shop group (admin approval required)")
        .addStringOption((opt) =>
          opt
            .setName("type")
            .setDescription("Group type")
            .setRequired(true)
            .addChoices(
              { name: "faction", value: "faction" },
              { name: "shop", value: "shop" }
            )
        )
        .addStringOption((opt) => opt.setName("name").setDescription("Group name").setRequired(true))
        .addStringOption((opt) => opt.setName("color").setDescription("Hex color (#9b1c1c)").setRequired(true))
        .addStringOption((opt) => opt.setName("tagline").setDescription("Short tagline (optional)").setRequired(false))
        .addStringOption((opt) => opt.setName("details").setDescription("Purpose / story summary").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a member to your group")
        .addUserOption((opt) => opt.setName("user").setDescription("Member to add").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a member from your group")
        .addUserOption((opt) => opt.setName("user").setDescription("Member to remove").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("roster")
        .setDescription("Show your group roster")
    )
    .addSubcommand((sub) =>
      sub
        .setName("disband")
        .setDescription("Disband your group (owner or staff)")
    ),
  new SlashCommandBuilder()
    .setName("level")
    .setDescription("Show your level and XP"),
  new SlashCommandBuilder()
    .setName("levels")
    .setDescription("Show the top level leaderboard"),
  new SlashCommandBuilder()
    .setName("trade")
    .setDescription("Loot and trade board")
    .addSubcommand((sub) =>
      sub.setName("post")
        .setDescription("Create a trade listing")
        .addStringOption((opt) => opt.setName("type").setDescription("WTS, WTB, WTT").setRequired(true))
        .addStringOption((opt) => opt.setName("item").setDescription("Item or bundle").setRequired(true))
        .addStringOption((opt) => opt.setName("details").setDescription("Details / price").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List active trade posts"))
    .addSubcommand((sub) =>
      sub.setName("close")
        .setDescription("Close your trade listing")
        .addStringOption((opt) => opt.setName("id").setDescription("Trade id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("contest")
    .setDescription("Community contests")
    .addSubcommand((sub) =>
      sub.setName("start")
        .setDescription("Start a contest")
        .addStringOption((opt) => opt.setName("title").setDescription("Contest title").setRequired(true))
        .addStringOption((opt) => opt.setName("theme").setDescription("Contest theme").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("vote")
        .setDescription("Vote in a contest")
        .addStringOption((opt) => opt.setName("id").setDescription("Contest id").setRequired(true))
        .addUserOption((opt) => opt.setName("user").setDescription("Entry owner").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("end")
        .setDescription("End a contest")
        .addStringOption((opt) => opt.setName("id").setDescription("Contest id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("pz")
    .setDescription("Project Zomboid quick knowledge")
    .addSubcommand((sub) =>
      sub.setName("trait")
        .setDescription("Trait tip")
        .addStringOption((opt) => opt.setName("name").setDescription("Trait name").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("recipe")
        .setDescription("Crafting recipe tip")
        .addStringOption((opt) => opt.setName("name").setDescription("Recipe name").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("infection")
        .setDescription("Infection / wound guidance")
        .addStringOption((opt) => opt.setName("topic").setDescription("Topic").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("skill")
        .setDescription("Skill leveling tip")
        .addStringOption((opt) => opt.setName("name").setDescription("Skill name").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("mapmark")
    .setDescription("Map marker tools")
    .addSubcommand((sub) =>
      sub.setName("add")
        .setDescription("Add a community map marker")
        .addStringOption((opt) => opt.setName("label").setDescription("Marker label").setRequired(true))
        .addStringOption((opt) => opt.setName("location").setDescription("Grid or location").setRequired(true))
        .addStringOption((opt) => opt.setName("notes").setDescription("Extra notes").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List map markers"))
    .addSubcommand((sub) =>
      sub.setName("remove")
        .setDescription("Remove your marker")
        .addStringOption((opt) => opt.setName("id").setDescription("Marker id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("safehouse")
    .setDescription("Safehouse request workflow")
    .addSubcommand((sub) =>
      sub.setName("request")
        .setDescription("Request safehouse approval")
        .addStringOption((opt) => opt.setName("location").setDescription("Safehouse location").setRequired(true))
        .addStringOption((opt) => opt.setName("details").setDescription("Claim details").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("review")
        .setDescription("Approve/deny a request (staff)")
        .addStringOption((opt) => opt.setName("id").setDescription("Request id").setRequired(true))
        .addStringOption((opt) => opt.setName("decision").setDescription("approve or deny").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List safehouse requests")),
  new SlashCommandBuilder()
    .setName("raid")
    .setDescription("Raid/event scheduler")
    .addSubcommand((sub) =>
      sub.setName("create")
        .setDescription("Create a raid event")
        .addStringOption((opt) => opt.setName("title").setDescription("Raid title").setRequired(true))
        .addStringOption((opt) => opt.setName("time").setDescription("Raid time").setRequired(true))
        .addStringOption((opt) => opt.setName("details").setDescription("Raid details").setRequired(false))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List active raids"))
    .addSubcommand((sub) =>
      sub.setName("end")
        .setDescription("End a raid")
        .addStringOption((opt) => opt.setName("id").setDescription("Raid id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("signup")
    .setDescription("Join/leave event or raid signups")
    .addSubcommand((sub) =>
      sub.setName("join")
        .setDescription("Join by event/raid id")
        .addStringOption((opt) => opt.setName("id").setDescription("Event or raid id").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("leave")
        .setDescription("Leave by id")
        .addStringOption((opt) => opt.setName("id").setDescription("Event or raid id").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("list")
        .setDescription("List signups for id")
        .addStringOption((opt) => opt.setName("id").setDescription("Event or raid id").setRequired(true))
    ),
  new SlashCommandBuilder()
    .setName("commend")
    .setDescription("Commend a helpful survivor")
    .addUserOption((opt) => opt.setName("user").setDescription("Who to commend").setRequired(true))
    .addStringOption((opt) => opt.setName("reason").setDescription("Why").setRequired(false)),
  new SlashCommandBuilder()
    .setName("squadvc")
    .setDescription("Temporary squad voice channels")
    .addSubcommand((sub) =>
      sub.setName("create")
        .setDescription("Create a temporary squad VC")
        .addStringOption((opt) => opt.setName("name").setDescription("Channel name").setRequired(true))
        .addIntegerOption((opt) => opt.setName("limit").setDescription("User limit").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("close")
        .setDescription("Close your squad VC")
    ),
  new SlashCommandBuilder()
    .setName("optin")
    .setDescription("Toggle alert roles")
    .addStringOption((opt) =>
      opt.setName("type")
        .setDescription("Alert type")
        .setRequired(true)
        .addChoices(
          { name: "restart", value: "restart" },
          { name: "wipe", value: "wipe" },
          { name: "raids", value: "raids" },
          { name: "trade", value: "trade" },
          { name: "events", value: "events" },
          { name: "updates", value: "updates" },
          { name: "story", value: "story" },
          { name: "mods", value: "mods" },
          { name: "roleplay", value: "roleplay" }
        )
    ),
  new SlashCommandBuilder()
    .setName("onboard")
    .setDescription("Onboarding panel tools")
    .addSubcommand((sub) => sub.setName("post").setDescription("Post onboarding instructions (staff)")),
  new SlashCommandBuilder()
    .setName("raidmode")
    .setDescription("Anti-raid moderation mode (staff)")
    .addStringOption((opt) =>
      opt.setName("state")
        .setDescription("on or off")
        .setRequired(true)
        .addChoices(
          { name: "on", value: "on" },
          { name: "off", value: "off" }
        )
    ),
  new SlashCommandBuilder()
    .setName("audit")
    .setDescription("View command audit logs (staff)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("list")
        .setDescription("Show recent audit entries")
        .addIntegerOption((opt) => opt.setName("limit").setDescription("How many entries (1-50)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("export")
        .setDescription("Export audit entries as a file")
        .addStringOption((opt) =>
          opt.setName("format")
            .setDescription("Export format")
            .setRequired(false)
            .addChoices(
              { name: "json", value: "json" },
              { name: "csv", value: "csv" }
            )
        )
        .addIntegerOption((opt) => opt.setName("limit").setDescription("How many entries (1-1000)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("verify")
        .setDescription("Verify signed audit hash chain integrity")
        .addIntegerOption((opt) => opt.setName("limit").setDescription("How many latest entries to verify (50-5000)").setRequired(false))
    ),
  new SlashCommandBuilder()
    .setName("incident")
    .setDescription("Moderation incident tracking")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("create")
        .setDescription("Create a moderation incident (staff)")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
        .addStringOption((opt) =>
          opt.setName("severity")
            .setDescription("Severity level")
            .setRequired(true)
            .addChoices(
              { name: "low", value: "low" },
              { name: "medium", value: "medium" },
              { name: "high", value: "high" },
              { name: "critical", value: "critical" }
            )
        )
        .addStringOption((opt) => opt.setName("reason").setDescription("Incident reason").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("list")
        .setDescription("List incidents (staff)")
        .addBooleanOption((opt) => opt.setName("open_only").setDescription("Show only open incidents").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("resolve")
        .setDescription("Resolve incident by id (staff)")
        .addStringOption((opt) => opt.setName("id").setDescription("Incident id").setRequired(true))
        .addStringOption((opt) => opt.setName("note").setDescription("Resolution note").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("link")
        .setDescription("Link incident to a mod case")
        .addStringOption((opt) => opt.setName("id").setDescription("Incident id").setRequired(true))
        .addStringOption((opt) => opt.setName("case_id").setDescription("Case id").setRequired(true))
        .addStringOption((opt) => opt.setName("note").setDescription("Optional link note").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("correlate")
        .setDescription("Correlate incidents for a target user")
        .addUserOption((opt) => opt.setName("user").setDescription("Target user").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("report")
        .setDescription("Generate post-incident report")
        .addStringOption((opt) => opt.setName("id").setDescription("Incident id").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("postmortem_create")
        .setDescription("Create postmortem draft for incident")
        .addStringOption((opt) => opt.setName("id").setDescription("Incident id").setRequired(true))
        .addStringOption((opt) => opt.setName("impact").setDescription("Impact summary").setRequired(true))
        .addStringOption((opt) => opt.setName("root_cause").setDescription("Root cause").setRequired(true))
        .addStringOption((opt) => opt.setName("prevention").setDescription("Prevention plan").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("postmortem_approve")
        .setDescription("Approve postmortem draft by id")
        .addStringOption((opt) => opt.setName("postmortem_id").setDescription("Postmortem id").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("wizard")
        .setDescription("Guided incident response workflow")
        .addStringOption((opt) =>
          opt.setName("scenario")
            .setDescription("Scenario type")
            .setRequired(false)
            .addChoices(
              { name: "harassment", value: "harassment" },
              { name: "cheating", value: "cheating" },
              { name: "spam", value: "spam" },
              { name: "raid", value: "raid" }
            )
        )
    ),
  new SlashCommandBuilder()
    .setName("backup")
    .setDescription("Backup/restore bot data stores (staff)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("create")
        .setDescription("Create a data snapshot")
        .addStringOption((opt) => opt.setName("label").setDescription("Backup label").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("list")
        .setDescription("List backups")
        .addIntegerOption((opt) => opt.setName("limit").setDescription("How many backups (1-30)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("restore")
        .setDescription("Restore backup by file name")
        .addStringOption((opt) => opt.setName("file").setDescription("Backup file").setRequired(true))
        .addBooleanOption((opt) => opt.setName("dry_run").setDescription("Validate restore without applying changes").setRequired(false))
    )
].map((cmd) => cmd.toJSON());

if (!exportOnly) {
  const rest = new REST({ version: "10" }).setToken(token);

  try {
    if (registerScope === "guild" || registerScope === "both") {
      console.log(`Registering guild slash commands for guild ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log("Guild slash commands registered.");
    }
    if (registerScope === "global" || registerScope === "both") {
      console.log("Registering global slash commands...");
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log("Global slash commands registered.");
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
