import express from 'express';
import { mergeRecords, getMergeResults } from '../controllers/mergeController.js';

const router = express.Router();

// Get merge results route
router.get('/:id', getMergeResults);

// Merge records route
router.post('/', (req, res, next) => {
    // Validate required fields
    const { files, keyFields } = req.body;
    if (!files || !keyFields) {
        return res.status(400).json({ 
            error: 'Missing required fields',
            details: {
                files: !files ? 'Files array is required' : null,
                keyFields: !keyFields ? 'Key fields object is required' : null
            }
        });
    }

    // Validate key fields for each file
    const missingKeys = files.filter(fileId => !keyFields[fileId]);
    if (missingKeys.length > 0) {
        return res.status(400).json({
            error: 'Missing key fields',
            details: `No key field specified for files: ${missingKeys.join(', ')}`
        });
    }

    next();
}, mergeRecords);

export default router;
