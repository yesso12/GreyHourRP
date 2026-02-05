import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
  new SlashCommandBuilder().setName("help").setDescription("Show bot commands"),
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
    .setDescription("Show recent admin activity (staff only)")
].map((cmd) => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

try {
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log("Slash commands registered.");
} catch (err) {
  console.error(err);
  process.exit(1);
}
