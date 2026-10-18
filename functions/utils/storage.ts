// functions/utils/storage.ts
//
// 画像の保存・取得はすべてこのファイルを経由します。
// 今は Cloudflare R2 を使っていますが、R2 はAWS S3と互換性のあるAPIを持つため、
// 将来 AWS S3（や MinIO 等のS3互換ストレージ）へ移行する場合も、
// このファイルの中身だけをAWS SDK（S3Client の putObject/getObject）を使う実装に
// 書き換えれば、呼び出し側（upload.ts・images/[[path]].ts）は変更不要な想定です。

export interface StorageEnv {
  IMAGES: R2Bucket;
}

export interface StoredObject {
  body: ReadableStream | null;
  contentType: string;
  etag: string;
}

export async function putObject(
  env: StorageEnv,
  key: string,
  data: ArrayBuffer,
  contentType: string
): Promise<void> {
  await env.IMAGES.put(key, data, { httpMetadata: { contentType } });
}

export async function getObject(env: StorageEnv, key: string): Promise<StoredObject | null> {
  const object = await env.IMAGES.get(key);
  if (!object) return null;
  return {
    body: object.body,
    contentType: object.httpMetadata?.contentType || "application/octet-stream",
    etag: object.httpEtag,
  };
}
