import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  endpoint: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}`,
  region: "us-east-1", 
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true, 
});