// functions/api/login.ts
// POST { password } -> パスワードが正しければセッションCookieを発行
// DELETE -> ログアウト（Cookie削除）
import type { Env } from "../utils/auth";
import { makeSessionCookie, clearSessionCookie } from "../utils/auth";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // ignore malformed body
  }
  const password = typeof body.password === "string" ? body.password : "";

  if (!env.ADMIN_PASSWORD) {
    return Response.json(
      { ok: false, error: "サーバー側にADMIN_PASSWORDが設定されていません" },
      { status: 500 }
    );
  }
  if (password !== env.ADMIN_PASSWORD) {
    return Response.json({ ok: false, error: "パスワードが違います" }, { status: 401 });
  }

  const cookie = await makeSessionCookie(env);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
};

export const onRequestDelete: PagesFunction<Env> = async () => {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": clearSessionCookie() },
  });
};
