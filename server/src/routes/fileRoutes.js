import express from "express";
import multer from "multer";

import { UPLOADS_DIR } from "../config.js";
import { uploadFile, getUploadedFiles } from "../controllers/fileController.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Check if it's a CSV file
    if (!file.originalname.toLowerCase().endsWith(".csv")) {
      return cb(new Error("Only CSV files are allowed"));
    }
    cb(null, true);
  },
});

// File upload route with multer middleware
router.post("/upload", upload.single("file"), uploadFile);

// Get uploaded files route
router.get("/uploaded-files", getUploadedFiles);

export default router;
