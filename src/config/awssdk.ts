// const AWS = require('aws-sdk')
// const dotenv = require('dotenv')

import AWS from "aws-sdk";
import dotenv from "dotenv";



dotenv.config({ path: '.env' });
// Load from environment variables with fallback types
const accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;
const region = process.env.AWS_REGION!;
const BUCKET_NAME = process.env.AWS_S3_BUCKET!;
// Configure AWS
AWS.config.update({
  accessKeyId,
  secretAccessKey,
  region,
});

const s3 = new AWS.S3();
const S3_BUCKET = BUCKET_NAME;

// module.exports = {
//   s3, S3_BUCKET
// }


export { s3, S3_BUCKET };