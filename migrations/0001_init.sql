-- migrations/0001_init.sql
-- necosato の猫データ・サイト設定用テーブル

CREATE TABLE IF NOT EXISTS cats (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '募集中',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  wishlist_url TEXT NOT NULL DEFAULT '',
  signature_url TEXT NOT NULL DEFAULT '',
  instagram_url TEXT NOT NULL DEFAULT '',
  line_url TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  representative TEXT NOT NULL DEFAULT ''
);

-- 今の管理画面に入っている初期表示用データをそのまま投入します。
-- （すでに本番で運用を始めていて上書きしたくない場合は、この2つのINSERT文は削除してから実行してください）

INSERT OR IGNORE INTO cats (id, name, image, gender, status, created_at) VALUES
  ('cat_1', 'くう',   'catCard1', '女の子', '募集中', 1),
  ('cat_2', 'なつ',   'catCard2', '男の子', '募集中', 2),
  ('cat_3', 'もずく', 'catCard3', '男の子', '募集中', 3);

INSERT OR IGNORE INTO settings (id, wishlist_url, signature_url, instagram_url, line_url, phone, representative) VALUES
  (1,
   'https://www.amazon.jp/hz/wishlist/ls/',
   'https://www.change.org/',
   'https://www.instagram.com/',
   'https://line.me/',
   '090-6610-2948',
   '野田 ひとみ');
