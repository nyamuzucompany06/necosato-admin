// functions/api/settings.ts
// GET -> サイト設定を返す（ログイン不要）
// PUT -> サイト設定を保存（ログイン必須）
import type { Env } from "../utils/auth";
import { isAuthed, jsonUnauthorized } from "../utils/auth";
import { getSettings, updateSettings } from "../utils/db";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const settings = await getSettings(env);
  return Response.json(settings);
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return jsonUnauthorized();

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const settings = await updateSettings(env, {
    wishlistUrl: String(body.wishlistUrl || ""),
    signatureUrl: String(body.signatureUrl || ""),
    instagramUrl: String(body.instagramUrl || ""),
    lineUrl: String(body.lineUrl || ""),
    phone: String(body.phone || ""),
    representative: String(body.representative || ""),
  });
  return Response.json(settings);
};
