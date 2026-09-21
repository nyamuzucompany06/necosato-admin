// functions/api/cats.ts
// GET  -> 猫一覧を返す（ログイン不要。公開サイト側にも同じ形のGETがあります）
// POST -> 新しい猫を登録（ログイン必須）
import type { Env } from "../utils/auth";
import { isAuthed, jsonUnauthorized } from "../utils/auth";
import { listCats, createCat } from "../utils/db";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const cats = await listCats(env);
  return Response.json(cats);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return jsonUnauthorized();

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const name = String(body.name || "");
  const image = String(body.image || "");
  const gender = String(body.gender || "");
  const status = String(body.status || "募集中");
  if (!image) return Response.json({ error: "image is required" }, { status: 400 });

  const cat = await createCat(env, { name, image, gender, status });
  return Response.json(cat, { status: 201 });
};
