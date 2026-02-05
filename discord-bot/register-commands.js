import "dotenv/config";
import { PermissionFlagsBits, REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const scopeArg = process.argv.find((x) => x.startsWith("--scope="));
const registerScope = (scopeArg ? scopeArg.split("=")[1] : process.env.REGISTER_SCOPE || "guild").toLowerCase();

if (!["guild", "global", "both"].includes(registerScope)) {
  console.error(`Invalid --scope value: ${registerScope}. Use guild, global, or both.`);
  process.exit(1);
}

if (!token || !clientId) {
  console.error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID");
  process.exit(1);
}
if ((registerScope === "guild" || registerScope === "both") && !guildId) {
  console.error("DISCORD_GUILD_ID is required for guild or both scope registration.");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  new SlashCommandBuilder().setName("help").setDescription("Show bot commands"),
  new SlashCommandBuilder()
    .setName("health")
    .setDescription("Run bot health checks (staff only)")
    .addBooleanOption((opt) =>
      opt.setName("details").setDescription("Include extended diagnostics").setRequired(false)
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
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
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
        .setName("reopen")
        .setDescription("Reopen a previously closed case")
        .addStringOption((opt) => opt.setName("id").setDescription("Case id").setRequired(true))
        .addStringOption((opt) => opt.setName("reason").setDescription("Reason for reopening").setRequired(false))
    ),
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
  new SlashCommandBuilder().setName("serverip").setDescription("Show server connection details"),
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
      opt.setName("message").setDescription("Announcement text").setRequired(true)
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
        .setDescription("Create a support ticket thread")
        .addStringOption((opt) => opt.setName("subject").setDescription("Short subject").setRequired(true))
        .addStringOption((opt) => opt.setName("details").setDescription("Ticket details").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Close the current ticket thread")
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
    .setName("faction")
    .setDescription("Faction and clan tools")
    .addSubcommand((sub) =>
      sub.setName("create")
        .setDescription("Create a faction")
        .addStringOption((opt) => opt.setName("name").setDescription("Faction name").setRequired(true))
        .addStringOption((opt) => opt.setName("tag").setDescription("Short faction tag").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub.setName("recruit")
        .setDescription("Invite a member to your faction")
        .addStringOption((opt) => opt.setName("faction").setDescription("Faction name").setRequired(true))
        .addUserOption((opt) => opt.setName("user").setDescription("Member to recruit").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("roster")
        .setDescription("Show faction roster")
        .addStringOption((opt) => opt.setName("faction").setDescription("Faction name").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("disband")
        .setDescription("Disband your faction")
        .addStringOption((opt) => opt.setName("faction").setDescription("Faction name").setRequired(true))
    ),
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
    .setName("leaderboard")
    .setDescription("Top commended survivors"),
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
          { name: "trade", value: "trade" }
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
    .setName("survivor")
    .setDescription("Fun survivor interaction tools")
    .addSubcommand((sub) => sub.setName("tip").setDescription("Get a random survival tip"))
    .addSubcommand((sub) => sub.setName("challenge").setDescription("Get a random survivor challenge")),
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
