// functions/api/password.ts
// POST { currentPassword, newPassword } -> パスワードを変更する
// ログイン中でも、ログアウト中（ログイン画面から）でも使えます。
// どちらの場合も「現在のパスワード」が合っていることが条件です。
import type { Env } from "../utils/auth";
import {
  isAuthed,
  verifyPassword,
  hashNewPassword,
  validateNewPassword,
  makeSessionCookie,
} from "../utils/auth";
import { saveAdminPassword, invalidateAllResetTokens } from "../utils/db";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const wasLoggedIn = await isAuthed(request, env);

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = body.newPassword;

  const problem = validateNewPassword(newPassword);
  if (problem) return Response.json({ error: problem }, { status: 400 });

  if (!(await verifyPassword(env, currentPassword))) {
    return Response.json({ error: "現在のパスワードが違います" }, { status: 401 });
  }
  if (newPassword === currentPassword) {
    return Response.json({ error: "現在と同じパスワードは設定できません" }, { status: 400 });
  }

  await saveAdminPassword(env, await hashNewPassword(newPassword));
  await invalidateAllResetTokens(env);

  // ログイン中だった場合は、version が変わったので新しいCookieを渡す（ログインしたままにする）。
  // ログアウト中だった場合は、ログイン状態にはせず、新しいパスワードでログインし直してもらう。
  if (wasLoggedIn) {
    const cookie = await makeSessionCookie(env);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
    });
  }
  return Response.json({ ok: true });
};
