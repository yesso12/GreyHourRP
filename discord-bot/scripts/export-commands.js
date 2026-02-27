import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PermissionFlagsBits } from "discord.js";

process.env.GH_EXPORT_ONLY = "1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { commands } = await import("../register-commands.js");

const defaultSiteRoot = fs.existsSync("/opt/greyhourrp/public")
  ? "/opt/greyhourrp"
  : path.resolve(__dirname, "..", "..");
const siteRoot = process.env.GH_SITE_ROOT || defaultSiteRoot;

function toBigInt(value) {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function permissionLabel(perms) {
  const bits = toBigInt(perms);
  if (bits === 0n) return "public";
  if ((bits & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild) return "admin";
  if ((bits & PermissionFlagsBits.ManageMessages) === PermissionFlagsBits.ManageMessages) return "staff";
  return "restricted";
}

function buildUsage(name, sub) {
  if (!sub) return `/${name}`;
  return `/${name} ${sub}`;
}

function mapCommand(cmd) {
  const perms = cmd.default_member_permissions ?? null;
  const permission = permissionLabel(perms);
  const base = {
    name: cmd.name,
    description: cmd.description || "",
    permission,
    defaultMemberPermissions: perms,
    dmPermission: cmd.dm_permission ?? null,
    usage: buildUsage(cmd.name)
  };

  const options = Array.isArray(cmd.options) ? cmd.options : [];
  const subcommands = options.filter((opt) => opt?.type === 1);
  if (!subcommands.length) {
    return {
      ...base,
      subcommands: [],
      usageAll: [base.usage]
    };
  }

  const mappedSubs = subcommands.map((sub) => ({
    name: sub.name,
    description: sub.description || "",
    usage: buildUsage(cmd.name, sub.name)
  }));

  return {
    ...base,
    subcommands: mappedSubs,
    usageAll: mappedSubs.map((sub) => sub.usage)
  };
}

const payload = {
  generatedUtc: new Date().toISOString(),
  commands: Array.isArray(commands) ? commands.map(mapCommand) : []
};

const target = path.resolve(siteRoot, "public", "content", "discord-commands.json");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Wrote ${payload.commands.length} commands to ${target}`);
