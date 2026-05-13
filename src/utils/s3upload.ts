// const multer = require('multer');
// const sharp = require('sharp');

import multer from "multer"
import sharp from "sharp"
import { s3, S3_BUCKET } from "../config/awssdk.js";

// const { s3, S3_BUCKET } = require('../Config/awssdk.js'); 

// import AWS from 'aws-sdk';

// Multer memory storage for handling file uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

const uploadImageToS3 = async (file: any) => {
  const fileName = `${Date.now()}-${file.originalname}`;

  const optimizedImage = await sharp(file.buffer)
    .resize(800, 800, { fit: 'inside' })
    .jpeg({ quality: 80 })
    .toBuffer();

  const params = {
    Bucket: S3_BUCKET,
    Key: `images/${fileName}`,
    Body: optimizedImage,
    ContentType: 'image/jpeg',
    // ACL: 'public-read',
  };

  const { Location } = await s3.upload(params).promise();
  return Location;
};


// module.exports={
// upload, uploadImageToS3
// }


export {
  upload, uploadImageToS3
}