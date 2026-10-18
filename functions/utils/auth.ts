// functions/utils/auth.ts
// 管理画面のログイン判定まわりの共通処理。
// セッションは「署名付きcookie（HMAC-SHA256）」で管理しています。
// DBにセッションテーブルを作らない、いちばんシンプルな方式です。

import { getAdminAuth, getPasswordVersion } from "./db";

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  ADMIN_PASSWORD: string;
  SESSION_SECRET: string;
  // --- パスワード再設定メール用 ---
  ADMIN_EMAIL: string;     // 再設定メールの送信先（管理者のメールアドレス）
  ADMIN_BASE_URL: string;  // 再設定リンクの土台（例: https://necosato-admin.pages.dev）
  MAIL_FROM: string;       // メールの送信元
  RESEND_API_KEY: string;  // Resend の APIキー（Secret）
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

// Cookieの形式: admin:<期限>:<パスワードversion>:<署名>
// パスワードを変更すると version が増えるため、変更前に発行されたCookieは無効になります。
export async function isAuthed(request: Request, env: Env): Promise<boolean> {
  const raw = getCookie(request, SESSION_COOKIE);
  if (!raw) return false;
  const parts = raw.split(":");
  if (parts.length !== 4) return false;
  const [tag, expiresStr, versionStr, sig] = parts;
  if (tag !== "admin") return false;
  const payload = `${tag}:${expiresStr}:${versionStr}`;
  const expected = await hmac(payload, secretFor(env));
  if (expected !== sig) return false;
  if (Date.now() > Number(expiresStr)) return false;
  const current = await getPasswordVersion(env);
  if (Number(versionStr) !== current) return false;
  return true;
}

export async function makeSessionCookie(env: Env): Promise<string> {
  const version = await getPasswordVersion(env);
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin:${expires}:${version}`;
  const sig = await hmac(payload, secretFor(env));
  const value = `${payload}:${sig}`;
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`;
}

/* =========================================================
   パスワードの保存・照合
   - D1に保存したパスワード（ハッシュ）があればそれを使う
   - 無ければ、環境変数 ADMIN_PASSWORD を使う（初期状態・緊急用）
========================================================= */
export const PBKDF2_ITERATIONS = 100000; // Cloudflare Workers の上限

function toB64(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
}
function fromB64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    256
  );
  return toB64(bits);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hashNewPassword(
  password: string
): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return { hash, salt: toB64(salt), iterations: PBKDF2_ITERATIONS };
}

export async function verifyPassword(env: Env, password: string): Promise<boolean> {
  const row = await getAdminAuth(env);
  if (row) {
    const hash = await pbkdf2(password, fromB64(row.password_salt), row.iterations);
    return safeEqual(hash, row.password_hash);
  }
  if (!env.ADMIN_PASSWORD) return false;
  // 長さが違っても比較時間が変わらないよう、いったんハッシュにしてから比べる
  const [x, y] = await Promise.all([
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)),
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.ADMIN_PASSWORD)),
  ]);
  return safeEqual(toB64(x), toB64(y));
}

// 新しいパスワードのルール（変更・再設定で共通）
export function validateNewPassword(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < 8) return "パスワードは8文字以上にしてください";
  if (pw.length > 128) return "パスワードが長すぎます（128文字まで）";
  return null;
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function jsonUnauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
