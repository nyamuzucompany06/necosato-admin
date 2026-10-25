// functions/api/password.ts
// POST { currentPassword, newPassword } -> ログイン中にパスワードを変更（ログイン必須）
import type { Env } from "../utils/auth";
import {
  isAuthed,
  jsonUnauthorized,
  verifyPassword,
  hashNewPassword,
  validateNewPassword,
  makeSessionCookie,
} from "../utils/auth";
import { saveAdminPassword, invalidateAllResetTokens } from "../utils/db";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return jsonUnauthorized();

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

  // version が変わったので、今使っているブラウザには新しいCookieを渡す（ログインしたままにする）
  const cookie = await makeSessionCookie(env);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
};
