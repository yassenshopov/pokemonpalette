import { randomBytes, createHash } from "node:crypto";

const PREFIX = "pkpal_";

export function generateKey(): { plain: string; hash: string; prefix: string } {
  const raw = randomBytes(24);
  const token = raw.toString("base64url");
  const plain = `${PREFIX}${token}`;
  return {
    plain,
    hash: hashKey(plain),
    prefix: token.slice(0, 8),
  };
}

export function hashKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}
