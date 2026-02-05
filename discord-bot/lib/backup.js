import { createHash } from "crypto";

export function sha256(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

export function verifyBackupPayload(payload, keys, parseJsonKeys = []) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Backup payload is not an object." };
  }
  if (!payload.files || typeof payload.files !== "object") {
    return { ok: false, message: "Backup payload is missing files map." };
  }

  for (const key of keys) {
    const content = payload.files[key];
    if (content === null || content === undefined) continue;
    const text = String(content);

    if (parseJsonKeys.includes(key)) {
      try {
        JSON.parse(text);
      } catch {
        return { ok: false, message: `Backup file "${key}" is not valid JSON.` };
      }
    }

    if (payload.checksums && payload.checksums[key]) {
      const digest = sha256(text);
      if (digest !== payload.checksums[key]) {
        return { ok: false, message: `Checksum mismatch for ${key}.` };
      }
    }
  }

  return { ok: true, message: "Backup payload verified." };
}
