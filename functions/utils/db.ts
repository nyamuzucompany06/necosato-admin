// functions/utils/db.ts
//
// データベースへのアクセスはすべてこのファイルを経由します。
// 今は Cloudflare D1（SQLite互換）を使っていますが、
// 将来 AWS 等に移行してPostgreSQLなどに切り替える場合は、
// このファイルの中身（各関数の実装）だけを書き換えれば、
// functions/api/*.ts 側（呼び出し側）はほぼ変更なしで動く想定です。
//
// 呼び出し側は Cat / Settings という「データの形」と、
// listCats / createCat / updateCat / deleteCat / getSettings / updateSettings
// という「関数名」にだけ依存し、D1固有の書き方（prepare/bind等）には依存しません。

export interface Cat {
  id: string;
  name: string;
  image: string;
  gender: string;
  status: string;
}

export interface Settings {
  wishlistUrl: string;
  signatureUrl: string;
  instagramUrl: string;
  lineUrl: string;
  phone: string;
  representative: string;
}

export interface DbEnv {
  DB: D1Database;
}

export async function listCats(env: DbEnv): Promise<Cat[]> {
  const { results } = await env.DB.prepare(
    "SELECT id, name, image, gender, status FROM cats ORDER BY created_at ASC"
  ).all<Cat>();
  return results as unknown as Cat[];
}

export async function createCat(
  env: DbEnv,
  data: { name: string; image: string; gender: string; status: string }
): Promise<Cat> {
  const id = "cat_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  await env.DB.prepare(
    "INSERT INTO cats (id, name, image, gender, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, data.name, data.image, data.gender, data.status, Date.now())
    .run();
  return { id, ...data };
}

export async function updateCat(
  env: DbEnv,
  id: string,
  data: { name: string; image: string; gender: string; status: string }
): Promise<Cat | null> {
  const result = await env.DB.prepare(
    "UPDATE cats SET name=?, image=?, gender=?, status=? WHERE id=?"
  )
    .bind(data.name, data.image, data.gender, data.status, id)
    .run();
  if (!result.meta.changes) return null;
  return { id, ...data };
}

export async function deleteCat(env: DbEnv, id: string): Promise<boolean> {
  const result = await env.DB.prepare("DELETE FROM cats WHERE id=?").bind(id).run();
  return !!result.meta.changes;
}

function rowToSettings(row: any): Settings {
  return {
    wishlistUrl: row?.wishlist_url || "",
    signatureUrl: row?.signature_url || "",
    instagramUrl: row?.instagram_url || "",
    lineUrl: row?.line_url || "",
    phone: row?.phone || "",
    representative: row?.representative || "",
  };
}

export async function getSettings(env: DbEnv): Promise<Settings> {
  const row = await env.DB.prepare("SELECT * FROM settings WHERE id = 1").first();
  return rowToSettings(row);
}

export async function updateSettings(env: DbEnv, data: Settings): Promise<Settings> {
  await env.DB.prepare(
    `INSERT INTO settings (id, wishlist_url, signature_url, instagram_url, line_url, phone, representative)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       wishlist_url = excluded.wishlist_url,
       signature_url = excluded.signature_url,
       instagram_url = excluded.instagram_url,
       line_url = excluded.line_url,
       phone = excluded.phone,
       representative = excluded.representative`
  )
    .bind(
      data.wishlistUrl || "",
      data.signatureUrl || "",
      data.instagramUrl || "",
      data.lineUrl || "",
      data.phone || "",
      data.representative || ""
    )
    .run();
  return getSettings(env);
}

/* =========================================================
   管理者パスワード / 再設定トークン
   （auth.ts / password系のAPIから使います。AWS移行時はここを書き換えます）
========================================================= */

export interface AdminAuthRow {
  password_hash: string;
  password_salt: string;
  iterations: number;
  password_version: number;
}

export async function getAdminAuth(env: DbEnv): Promise<AdminAuthRow | null> {
  const row = await env.DB.prepare(
    "SELECT password_hash, password_salt, iterations, password_version FROM admin_auth WHERE id = 1"
  ).first<AdminAuthRow>();
  return row || null;
}

export async function getPasswordVersion(env: DbEnv): Promise<number> {
  const row = await getAdminAuth(env);
  return row ? row.password_version : 0;
}

// パスワードを保存し、新しい version を返す（version が変わると、他の端末のログインは無効になる）
export async function saveAdminPassword(
  env: DbEnv,
  data: { hash: string; salt: string; iterations: number }
): Promise<number> {
  const current = await getPasswordVersion(env);
  const next = current + 1;
  await env.DB.prepare(
    `INSERT INTO admin_auth (id, password_hash, password_salt, iterations, password_version, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       password_hash = excluded.password_hash,
       password_salt = excluded.password_salt,
       iterations = excluded.iterations,
       password_version = excluded.password_version,
       updated_at = excluded.updated_at`
  )
    .bind(data.hash, data.salt, data.iterations, next, Date.now())
    .run();
  return next;
}

// 直近1時間に作られた再設定リンクの数（連続リクエストの制限用）
export async function countRecentResets(env: DbEnv, sinceMs: number): Promise<number> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM password_resets WHERE created_at > ?"
  )
    .bind(sinceMs)
    .first<{ n: number }>();
  return row ? row.n : 0;
}

export async function createResetToken(
  env: DbEnv,
  data: { tokenHash: string; expiresAt: number }
): Promise<void> {
  // 古い（期限切れ・使用済み）トークンはついでに掃除する
  await env.DB.prepare("DELETE FROM password_resets WHERE expires_at < ? OR used = 1")
    .bind(Date.now())
    .run();
  await env.DB.prepare(
    "INSERT INTO password_resets (token_hash, expires_at, used, created_at) VALUES (?, ?, 0, ?)"
  )
    .bind(data.tokenHash, data.expiresAt, Date.now())
    .run();
}

// トークンが有効なら「使用済み」にして true を返す（1回しか使えない）
export async function consumeResetToken(env: DbEnv, tokenHash: string): Promise<boolean> {
  const result = await env.DB.prepare(
    "UPDATE password_resets SET used = 1 WHERE token_hash = ? AND used = 0 AND expires_at > ?"
  )
    .bind(tokenHash, Date.now())
    .run();
  return !!result.meta.changes;
}

// 未使用のトークンをすべて無効にする（パスワード変更後に実行）
export async function invalidateAllResetTokens(env: DbEnv): Promise<void> {
  await env.DB.prepare("UPDATE password_resets SET used = 1 WHERE used = 0").run();
}
