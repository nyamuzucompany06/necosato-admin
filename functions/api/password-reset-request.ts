// functions/api/password-reset-request.ts
// POST { email } -> 登録済みの管理者メールアドレスなら、再設定リンクをメールで送る（ログイン不要）
//
// 安全のため、メールアドレスが合っていても間違っていても、画面には同じ文面を返します。
import type { Env } from "../utils/auth";
import { sha256Hex } from "../utils/auth";
import { countRecentResets, createResetToken } from "../utils/db";
import { sendMail } from "../utils/mail";

const TOKEN_TTL_MS = 1000 * 60 * 30; // 30分
const MAX_REQUESTS_PER_HOUR = 3;

const SAME_RESPONSE = {
  ok: true,
  message: "登録されているメールアドレスの場合は、再設定用のメールを送信しました。メールをご確認ください。",
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // ignore
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!env.ADMIN_EMAIL || !env.ADMIN_BASE_URL) {
    console.error("[reset] ADMIN_EMAIL または ADMIN_BASE_URL が設定されていません");
    return Response.json(SAME_RESPONSE);
  }
  if (email !== env.ADMIN_EMAIL.trim().toLowerCase()) {
    return Response.json(SAME_RESPONSE);
  }

  // 連続リクエストの制限（1時間に3回まで）
  const recent = await countRecentResets(env, Date.now() - 1000 * 60 * 60);
  if (recent >= MAX_REQUESTS_PER_HOUR) {
    return Response.json(SAME_RESPONSE);
  }

  // 推測できない使い捨てトークンを作る（DBにはハッシュだけ保存）
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
  await createResetToken(env, {
    tokenHash: await sha256Hex(token),
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  // リンクの土台は ADMIN_BASE_URL（環境変数）。独自ドメインにしたときは、ここを書き換えるだけ。
  // #以降はサーバーのログに残らないので、トークンの受け渡しに使う。
  const base = env.ADMIN_BASE_URL.replace(/\/+$/, "");
  const link = `${base}/#reset=${token}`;

  await sendMail(env, {
    to: env.ADMIN_EMAIL,
    subject: "【necosato】パスワード再設定のご案内",
    text:
      "necosato 管理画面のパスワード再設定のリクエストを受け付けました。\n" +
      "下のリンクを開いて、新しいパスワードを設定してください（30分間有効・1回のみ使えます）。\n\n" +
      `${link}\n\n` +
      "このメールに心当たりがない場合は、何もせずにこのメールを破棄してください。\n" +
      "（パスワードは変更されません）\n",
  });

  return Response.json(SAME_RESPONSE);
};
