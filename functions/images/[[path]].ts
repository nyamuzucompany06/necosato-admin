// functions/images/[[path]].ts
// /images/cats/xxxx.jpg のようなURLで画像を配信する（誰でも閲覧可・書き込みは不可）
import type { StorageEnv } from "../utils/storage";
import { getObject } from "../utils/storage";

export const onRequestGet: PagesFunction<StorageEnv> = async ({ env, params }) => {
  const pathParam = params.path;
  const key = Array.isArray(pathParam) ? pathParam.join("/") : String(pathParam || "");
  if (!key) return new Response("Not found", { status: 404 });

  const object = await getObject(env, key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", object.contentType);
  headers.set("etag", object.etag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
};
