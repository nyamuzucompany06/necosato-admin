-- migrations/0002_password.sql
-- パスワード変更・メール再設定用のテーブル

-- 管理者パスワード（ハッシュ化して保存）。
-- 行が無い間は、環境変数 ADMIN_PASSWORD でログインします（初期状態・緊急用）。
CREATE TABLE IF NOT EXISTS admin_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  password_version INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

-- 再設定リンク用の使い捨てトークン（トークン本体は保存せず、ハッシュだけ保存）
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
