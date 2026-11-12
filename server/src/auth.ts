import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

const TOKEN_TTL_MS = 12 * 3600e3;

const b64url = (s: string) => Buffer.from(s).toString("base64url");

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function checkPassword(input: unknown, expected: string) {
  return typeof input === "string" && safeEqual(input, expected);
}

export function issueToken(secret: string, now = Date.now()) {
  const payload = b64url(JSON.stringify({ sub: "admin", exp: now + TOKEN_TTL_MS }));
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt: now + TOKEN_TTL_MS };
}

export function verifyToken(token: string | undefined, secret: string, now = Date.now()) {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, sign(payload, secret))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > now;
  } catch {
    return false;
  }
}

export function requireAdmin(secret: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!verifyToken(token, secret)) {
      return reply.code(401).send({ error: "Требуется вход в админку" });
    }
  };
}
