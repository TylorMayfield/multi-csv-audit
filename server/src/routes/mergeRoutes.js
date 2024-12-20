import express from 'express';
import { mergeRecords } from '../controllers/mergeController.js';

const router = express.Router();

// Merge records route
router.post('/', mergeRecords);

export default router;
