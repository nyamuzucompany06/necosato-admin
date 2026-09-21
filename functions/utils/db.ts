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
