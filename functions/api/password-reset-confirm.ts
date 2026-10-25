// functions/api/password-reset-confirm.ts
// POST { token, newPassword } -> 再設定リンクのトークンが有効なら、新しいパスワードを保存（ログイン不要）
import type { Env } from "../utils/auth";
import { sha256Hex, hashNewPassword, validateNewPassword } from "../utils/auth";
import { consumeResetToken, saveAdminPassword, invalidateAllResetTokens } from "../utils/db";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  const newPassword = body.newPassword;

  const problem = validateNewPassword(newPassword);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return Response.json({ error: "リンクが無効、または期限切れです" }, { status: 400 });
  }

  // 有効なトークンなら「使用済み」にする（同じリンクは2回使えない）
  const ok = await consumeResetToken(env, await sha256Hex(token));
  if (!ok) {
    return Response.json({ error: "リンクが無効、または期限切れです" }, { status: 400 });
  }

  await saveAdminPassword(env, await hashNewPassword(newPassword));
  await invalidateAllResetTokens(env);

  // 自動ログインはしない。新しいパスワードでログインし直してもらう。
  return Response.json({ ok: true });
};
