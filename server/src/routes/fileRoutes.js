import express from 'express';
import { uploadFile, getUploadedFiles } from '../controllers/fileController.js';

const router = express.Router();

// File upload route
router.post('/upload', uploadFile);

// Get uploaded files route
router.get('/uploaded-files', getUploadedFiles);

export default router;
