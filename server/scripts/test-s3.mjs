import {
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  S3Client,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(serverRoot, '.env') });

const region = process.env.AWS_REGION ?? 'ap-south-1';
const bucket = process.env.S3_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

console.log('Region:', region);
console.log('Bucket:', bucket);
console.log('Access key set:', Boolean(accessKeyId));
console.log('Secret set:', Boolean(secretAccessKey));

if (!bucket || !accessKeyId || !secretAccessKey) {
  console.error('Missing AWS env vars in server/.env');
  process.exit(1);
}

const s3 = new S3Client({
  region,
  credentials: { accessKeyId, secretAccessKey },
});

function dumpErr(label, err) {
  console.error(`\n${label}:`);
  console.error('  name:', err.name);
  console.error('  message:', err.message);
  console.error('  code:', err.Code ?? err.code);
  console.error('  status:', err.$metadata?.httpStatusCode);
  console.error('  requestId:', err.$metadata?.requestId);
}

try {
  const buckets = await s3.send(new ListBucketsCommand({}));
  const names = buckets.Buckets?.map((b) => b.Name) ?? [];
  console.log('\nAccessible buckets:', names.length ? names.join(', ') : '(none)');

  if (!names.includes(bucket)) {
    console.error(`\nBucket "${bucket}" is NOT in your account's bucket list.`);
    console.error('Create it in AWS Console → S3 → ap-south-1 (Mumbai), or fix S3_BUCKET name.');
    process.exit(1);
  }

  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`\nHeadBucket "${bucket}": OK`);

  const testKey = `attachments/_connectivity-test-${Date.now()}.txt`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: Buffer.from('homesfy-task-manager s3 ok'),
      ContentType: 'text/plain',
    })
  );
  console.log('PutObject: OK');

  const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: testKey }));
  const body = await got.Body?.transformToString();
  console.log('GetObject: OK —', body);

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));
  console.log('DeleteObject: OK');
  console.log('\nS3 is configured correctly for task attachments.');
} catch (err) {
  dumpErr('S3 test failed', err);
  if (err.name === 'AccessDenied' || err.$metadata?.httpStatusCode === 403) {
    console.error('\nFix: IAM user needs s3:PutObject, s3:GetObject, s3:DeleteObject, s3:ListBucket on the bucket.');
  }
  process.exit(1);
}
