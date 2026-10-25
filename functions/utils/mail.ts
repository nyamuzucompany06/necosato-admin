// functions/utils/mail.ts
//
// メール送信はすべてこのファイルを経由します。
// 今は Resend（https://resend.com）を使っています。
// 将来 AWS SES などに変える場合は、この sendMail の中身だけを書き換えればOKです。
//
// 送信元（MAIL_FROM）は環境変数です。
//   今    : necosato <onboarding@resend.dev>   （Resendのテスト用。送信先は登録アドレスのみ）
//   独自ドメイン取得後 : necosato <noreply@あなたのドメイン>  （Resendでドメイン認証が必要）

export interface MailEnv {
  RESEND_API_KEY: string;
  MAIL_FROM: string;
}

export async function sendMail(
  env: MailEnv,
  data: { to: string; subject: string; text: string }
): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    console.error("[mail] RESEND_API_KEY または MAIL_FROM が設定されていません");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [data.to],
        subject: data.subject,
        text: data.text,
      }),
    });
    if (!res.ok) {
      console.error("[mail] 送信に失敗しました", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("[mail] 送信中にエラー", e);
    return false;
  }
}
