import multer from "multer";
import sharp from "sharp";
import { v4 as uuidv4 } from 'uuid'; // You need to install uuid: npm install uuid
import path from "path";
import { s3, S3_BUCKET } from "../config/awssdk.js";

// 1. Multer Configuration (Memory Storage)
// We allow images, pdfs, and videos
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedTypes = [
    "image/jpeg", "image/png", "image/jpg",
    "application/pdf",
    "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only Images, PDFs and Videos are allowed."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // Optional: Limit to 100MB per file
});

// 2. Helper to Generate Unique Key
const generateS3Key = (originalName: string, folder: any) => {
  const ext = path.extname(originalName);
  const uniqueId = uuidv4(); // Generates a random string like '1b9d6bcd-...'
  return `${folder}/${uniqueId}${ext}`;
};

// 3. The Main Upload Function (To be called from Controller)
const uploadFileToS3New = async (file: any) => {
  let fileBuffer = file.buffer;
  let contentType = file.mimetype;
  let folder = "others";

  // --- LOGIC: PROCESS BASED ON TYPE ---

  // A. Handle Images (Optimize with Sharp)
  if (file.mimetype.startsWith("image/")) {
    folder = "images";
    fileBuffer = await sharp(file.buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    contentType = "image/jpeg"; // We converted it to jpeg
  }

  // B. Handle PDFs
  else if (file.mimetype === "application/pdf") {
    folder = "pdfs";
  }

  // C. Handle Videos
  else if (file.mimetype.startsWith("video/")) {
    folder = "videos";
  }

  // Generate Key
  const key = generateS3Key(file.originalname, folder);

  const params = {
    Bucket: S3_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    // ACL: 'public-read' // Uncomment only if you want files public
  };

  const uploadResult = await s3.upload(params).promise();

  return {
    url: uploadResult.Location, // Public URL (if public)
    key: uploadResult.Key,      // Internal Key (needed for signed URLs/deleting)
    type: file.mimetype,
    originalName: file.originalname
  };
};

// 4. Download Helper (Generate Signed URL)
// This generates a temporary link valid for 15 minutes
const getSignedUrlForKey = (key:any) => {
  const params = {
    Bucket: S3_BUCKET,
    Key: key,
    Expires: 60 * 15, // URL valid for 15 minutes
    // This forces the browser to download the file instead of opening it
    ResponseContentDisposition: 'attachment'
  };
  return s3.getSignedUrl("getObject", params);
};

export { upload, uploadFileToS3New, getSignedUrlForKey };