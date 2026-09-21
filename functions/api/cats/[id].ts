// functions/api/cats/[id].ts
// PUT    -> 指定したidの猫を更新（ログイン必須）
// DELETE -> 指定したidの猫を削除（ログイン必須）
import type { Env } from "../../utils/auth";
import { isAuthed, jsonUnauthorized } from "../../utils/auth";
import { updateCat, deleteCat } from "../../utils/db";

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!(await isAuthed(request, env))) return jsonUnauthorized();

  const id = String(params.id);
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

  const cat = await updateCat(env, id, { name, image, gender, status });
  if (!cat) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(cat);
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!(await isAuthed(request, env))) return jsonUnauthorized();

  const id = String(params.id);
  const ok = await deleteCat(env, id);
  if (!ok) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
};
