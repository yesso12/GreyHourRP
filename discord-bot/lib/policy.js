export function normalizePolicy(raw) {
  const policy = raw && typeof raw === "object" ? raw : {};
  return {
    allowUserIds: Array.isArray(policy.allowUserIds) ? policy.allowUserIds : [],
    denyUserIds: Array.isArray(policy.denyUserIds) ? policy.denyUserIds : [],
    commandRoleIds: policy.commandRoleIds && typeof policy.commandRoleIds === "object" ? policy.commandRoleIds : {}
  };
}

export function canAccessCommand(policyRaw, userId, roleIds, commandName) {
  const policy = normalizePolicy(policyRaw);
  if (policy.denyUserIds.includes(userId)) return false;
  if (policy.allowUserIds.includes(userId)) return true;
  const requiredRoles = Array.isArray(policy.commandRoleIds[commandName]) ? policy.commandRoleIds[commandName] : [];
  if (!requiredRoles.length) return true;
  return roleIds.some((id) => requiredRoles.includes(id));
}
