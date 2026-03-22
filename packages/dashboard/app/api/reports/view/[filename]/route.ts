export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

function getS3Client(): S3Client | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim() ?? "auto";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
) {
  const { filename } = await context.params;
  const bucket = process.env.S3_BUCKET?.trim();
  const client = getS3Client();

  if (!client || !bucket) {
    return new Response("S3 not configured", { status: 503 });
  }

  try {
    const result = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: decodeURIComponent(filename),
    }));

    const body = await result.Body?.transformToByteArray();
    if (!body) return new Response("empty response from S3", { status: 502 });

    return new Response(Buffer.from(body), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
}
