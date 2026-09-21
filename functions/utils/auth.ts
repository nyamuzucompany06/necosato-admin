// functions/utils/auth.ts
// 管理画面のログイン判定まわりの共通処理。
// セッションは「署名付きcookie（HMAC-SHA256）」で管理しています。
// DBにセッションテーブルを作らない、いちばんシンプルな方式です。

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
}

const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7日間

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie") || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function secretFor(env: Env): string {
  // SESSION_SECRET が未設定でも動くように ADMIN_PASSWORD をフォールバックにしていますが、
  // 本番では必ず SESSION_SECRET を別途設定してください（README参照）。
  return env.SESSION_SECRET || env.ADMIN_PASSWORD || "necosato-fallback-secret";
}

export async function isAuthed(request: Request, env: Env): Promise<boolean> {
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) return false;
  const parts = raw.split(":");
  if (parts.length !== 3) return false;
  const [tag, expiresStr, sig] = parts;
  if (tag !== "admin") return false;
  const payload = `${tag}:${expiresStr}`;
  const expected = await hmac(payload, secretFor(env));
  if (expected !== sig) return false;
  if (Date.now() > Number(expiresStr)) return false;
  return true;
}

export async function makeSessionCookie(env: Env): Promise<string> {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expires}`;
  const sig = await hmac(payload, secretFor(env));
  const value = `${payload}:${sig}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function jsonUnauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
