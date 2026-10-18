// functions/api/upload.ts
// POST multipart/form-data (フィールド名 "file") -> 保存して /images/... のURLを返す
// ログイン必須
import type { Env } from "../utils/auth";
import { isAuthed, jsonUnauthorized } from "../utils/auth";
import { putObject } from "../utils/storage";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return jsonUnauthorized();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file is required" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: "画像サイズが大きすぎます（5MB以下にしてください）" }, { status: 400 });
  }

  const contentType = ALLOWED_TYPES[file.type] ? file.type : "image/png";
  const ext = ALLOWED_TYPES[file.type] || "png";
  const key = `cats/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await putObject(env, key, await file.arrayBuffer(), contentType);

  return Response.json({ url: `/images/${key}`, key }, { status: 201 });
};
