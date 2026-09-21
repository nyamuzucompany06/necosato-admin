// functions/api/session.ts
// GET -> 今のCookieがログイン状態として有効かどうかを返す。
// 画面をリロードしてもログイン状態を保つために使う。
import type { Env } from "../utils/auth";
import { isAuthed } from "../utils/auth";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const loggedIn = await isAuthed(request, env);
  return Response.json({ loggedIn });
};
