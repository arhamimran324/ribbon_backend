import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import config from "../config/config.js"; 

// Initialize S3 client using config
const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

export const upload = multer({
  storage: multerS3({
    s3,
    bucket: config.AWS_S3_BUCKET,
    key: (req, file, cb) => {
      const fileExt = path.extname(file.originalname);
      const fileName = `${file.fieldname}/${uuidv4()}${fileExt}`;
      cb(null, fileName);
    },
  }),
});
