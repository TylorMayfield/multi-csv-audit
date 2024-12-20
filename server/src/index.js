import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Setup storage directories
const DATA_DIR = join(__dirname, '../data');
const UPLOADS_DIR = join(DATA_DIR, 'uploads');
const TYPES_FILE = join(DATA_DIR, 'csvTypes.json');
const MAPPINGS_FILE = join(DATA_DIR, 'mappings.json');
const PROCESSED_DIR = join(DATA_DIR, 'processed');

// Ensure directories exist
await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(UPLOADS_DIR, { recursive: true });
await fs.mkdir(PROCESSED_DIR, { recursive: true });

// Initialize JSON files if they don't exist
try {
    await fs.access(TYPES_FILE);
} catch {
    await fs.writeFile(TYPES_FILE, JSON.stringify([]));
}

try {
    await fs.access(MAPPINGS_FILE);
} catch {
    await fs.writeFile(MAPPINGS_FILE, JSON.stringify({}));
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'text/csv') {
            cb(new Error('Only CSV files are allowed'));
            return;
        }
        cb(null, true);
    }
});

// Routes for CSV Types
app.get('/api/csv-types', async (req, res) => {
    try {
        const types = JSON.parse(await fs.readFile(TYPES_FILE, 'utf-8'));
        res.json(types);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch CSV types' });
    }
});

app.post('/api/csv-types', async (req, res) => {
    try {
        const types = JSON.parse(await fs.readFile(TYPES_FILE, 'utf-8'));
        const newType = {
            id: Date.now().toString(),
            ...req.body,
            created: new Date().toISOString()
        };
        types.push(newType);
        await fs.writeFile(TYPES_FILE, JSON.stringify(types, null, 2));
        res.json(newType);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create CSV type' });
    }
});

// Routes for Column Mappings
app.get('/api/mappings', async (req, res) => {
    try {
        const mappings = JSON.parse(await fs.readFile(MAPPINGS_FILE, 'utf-8'));
        res.json(mappings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch mappings' });
    }
});

app.post('/api/mappings', async (req, res) => {
    try {
        const mappings = JSON.parse(await fs.readFile(MAPPINGS_FILE, 'utf-8'));
        const { sourceType, targetType, columnMappings } = req.body;
        const mappingKey = `${sourceType}-${targetType}`;
        
        mappings[mappingKey] = {
            sourceType,
            targetType,
            columnMappings,
            created: new Date().toISOString()
        };
        
        await fs.writeFile(MAPPINGS_FILE, JSON.stringify(mappings, null, 2));
        res.json(mappings[mappingKey]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create mapping' });
    }
});

// File Upload and Processing
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileInfo = {
            id: Date.now().toString(),
            originalName: req.file.originalname,
            filename: req.file.filename,
            type: req.body.type,
            uploadDate: new Date().toISOString()
        };

        // Save file info
        const processedPath = join(PROCESSED_DIR, `${fileInfo.id}.json`);
        await fs.writeFile(processedPath, JSON.stringify(fileInfo));

        // Process CSV file
        const records = [];
        const parser = createReadStream(req.file.path)
            .pipe(parse({
                columns: true,
                skip_empty_lines: true
            }));

        for await (const record of parser) {
            records.push(record);
        }

        // Save processed records
        await fs.writeFile(
            join(PROCESSED_DIR, `${fileInfo.id}-data.json`),
            JSON.stringify(records, null, 2)
        );

        res.json(fileInfo);
    } catch (error) {
        res.status(500).json({ error: 'Failed to process file' });
    }
});

// Get processed files
app.get('/api/files', async (req, res) => {
    try {
        const files = await fs.readdir(PROCESSED_DIR);
        const fileInfos = await Promise.all(
            files
                .filter(f => !f.endsWith('-data.json'))
                .map(async (file) => {
                    const content = await fs.readFile(join(PROCESSED_DIR, file), 'utf-8');
                    return JSON.parse(content);
                })
        );
        res.json(fileInfos);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});

// Get file data
app.get('/api/files/:id/data', async (req, res) => {
    try {
        const data = await fs.readFile(
            join(PROCESSED_DIR, `${req.params.id}-data.json`),
            'utf-8'
        );
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch file data' });
    }
});

// Merge records
app.post('/api/merge', async (req, res) => {
    try {
        const { files: fileIds, keyFields, strategy } = req.body;

        // Load data from all files
        const allData = await Promise.all(
            fileIds.map(async (fileId) => {
                const data = await fs.readFile(
                    join(PROCESSED_DIR, `${fileId}-data.json`),
                    'utf-8'
                );
                return JSON.parse(data);
            })
        );

        // Create a map to store merged records
        const mergedRecords = new Map();
        let conflicts = 0;

        // Process each file's data
        allData.forEach((fileData, fileIndex) => {
            fileData.forEach(record => {
                // Create key from specified key fields
                const key = keyFields
                    .map(field => record[field])
                    .join('|');

                if (!mergedRecords.has(key)) {
                    // New record
                    mergedRecords.set(key, { ...record });
                } else {
                    // Existing record - merge based on strategy
                    conflicts++;
                    const existing = mergedRecords.get(key);
                    
                    Object.keys(record).forEach(field => {
                        if (keyFields.includes(field)) return; // Skip key fields

                        switch (strategy) {
                            case 'latest':
                                existing[field] = record[field];
                                break;
                            case 'first':
                                // Keep existing value
                                break;
                            case 'concatenate':
                                if (record[field] && existing[field] !== record[field]) {
                                    existing[field] = `${existing[field]}; ${record[field]}`;
                                }
                                break;
                        }
                    });
                }
            });
        });

        // Convert merged records back to array
        const mergedData = Array.from(mergedRecords.values());

        // Save merged data
        const mergeId = Date.now().toString();
        const mergedFilePath = join(PROCESSED_DIR, `merged-${mergeId}.json`);
        await fs.writeFile(mergedFilePath, JSON.stringify(mergedData, null, 2));

        // Create merge result file
        const mergeInfo = {
            id: mergeId,
            originalName: 'merged-data.csv',
            filename: `merged-${mergeId}.json`,
            type: 'merged',
            uploadDate: new Date().toISOString(),
            sourceFiles: fileIds,
            keyFields,
            strategy,
            totalRecords: mergedData.length,
            conflicts
        };

        await fs.writeFile(
            join(PROCESSED_DIR, `${mergeId}.json`),
            JSON.stringify(mergeInfo)
        );

        res.json(mergeInfo);
    } catch (error) {
        console.error('Merge error:', error);
        res.status(500).json({ error: 'Failed to merge records' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
