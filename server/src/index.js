const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const winston = require('winston');
const fs = require('fs');
const { initDatabase, runQuery, getResults } = require('./models/database');
const CSVProcessor = require('./services/csvProcessor');
const CSVTypeManager = require('./services/csvTypeManager');
const ReportGenerator = require('./services/reportGenerator');

// Initialize Express app
const app = express();
const port = process.env.PORT || 3001;

// Configure CORS
app.use(cors());
app.use(express.json());

// Configure logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'text/csv') {
            return cb(new Error('Only CSV files are allowed'));
        }
        cb(null, true);
    }
});

// Initialize database
initDatabase().catch(err => {
    logger.error('Database initialization error:', err);
    process.exit(1);
});

// CSV Type Management Routes
app.post('/api/csv-types', async (req, res) => {
    try {
        const typeId = await CSVTypeManager.createType(req.body);
        res.json({ id: typeId });
    } catch (error) {
        logger.error('Error creating CSV type:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/csv-types', async (req, res) => {
    try {
        const types = await getResults('SELECT * FROM csv_types');
        res.json(types);
    } catch (error) {
        logger.error('Error fetching CSV types:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/csv-types/:id', async (req, res) => {
    try {
        const type = await CSVTypeManager.getTypeDefinition(req.params.id);
        res.json(type);
    } catch (error) {
        logger.error('Error fetching CSV type:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/csv-types/:id/mappings', async (req, res) => {
    try {
        await CSVTypeManager.addColumnMapping({
            csvTypeId: req.params.id,
            ...req.body
        });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error adding column mapping:', error);
        res.status(500).json({ error: error.message });
    }
});

// File Upload and Processing Routes
app.post('/api/upload', upload.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Insert file record
        const result = await runQuery(
            `INSERT INTO files (filename, original_name, source, status) 
             VALUES (?, ?, ?, ?)`,
            [req.file.filename, req.file.originalname, req.body.source, 'pending']
        );

        // Process the CSV file
        CSVProcessor.processFile(result.lastID, req.file.path, req.body.source)
            .catch(err => logger.error('CSV processing error:', err));

        res.json({
            id: result.lastID,
            filename: req.file.originalname,
            source: req.body.source
        });
    } catch (error) {
        logger.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to process upload' });
    }
});

// Discrepancy Routes
app.get('/api/files/:id/discrepancies', async (req, res) => {
    try {
        const discrepancies = await getResults(`
            SELECT d.*, f.original_name as filename, r.record_data
            FROM discrepancies d
            JOIN files f ON d.file_id = f.id
            JOIN records r ON d.record_id = r.id
            WHERE d.file_id = ?
            ORDER BY d.severity DESC, d.created_at DESC
        `, [req.params.id]);
        res.json(discrepancies);
    } catch (error) {
        logger.error('Error fetching discrepancies:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/discrepancies/summary', async (req, res) => {
    try {
        const summary = await getResults(`
            SELECT 
                f.source,
                d.discrepancy_type,
                d.severity,
                COUNT(*) as count
            FROM discrepancies d
            JOIN files f ON d.file_id = f.id
            GROUP BY f.source, d.discrepancy_type, d.severity
            ORDER BY count DESC
        `);
        res.json(summary);
    } catch (error) {
        logger.error('Error fetching discrepancy summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Existing routes
app.get('/api/uploads', async (req, res) => {
    try {
        const uploads = await getResults(`
            SELECT id, original_name as filename, source, upload_date, record_count, status
            FROM files
            ORDER BY upload_date DESC
            LIMIT 10
        `);
        res.json(uploads);
    } catch (error) {
        logger.error('Error fetching uploads:', error);
        res.status(500).json({ error: 'Failed to fetch uploads' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const stats = await ReportGenerator.getSummaryStats();
        res.json(stats);
    } catch (error) {
        logger.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

app.get('/api/columns', async (req, res) => {
    try {
        const columns = await ReportGenerator.getAvailableColumns();
        res.json(columns);
    } catch (error) {
        logger.error('Error fetching columns:', error);
        res.status(500).json({ error: 'Failed to fetch columns' });
    }
});

app.post('/api/reports', async (req, res) => {
    try {
        const report = await ReportGenerator.generateReport(req.body);
        
        if (req.body.format === 'csv') {
            res.header('Content-Type', 'text/csv');
            res.header('Content-Disposition', 'attachment; filename=report.csv');
        } else if (req.body.format === 'pdf') {
            res.header('Content-Type', 'application/pdf');
            res.header('Content-Disposition', 'attachment; filename=report.pdf');
        }
        
        res.send(report);
    } catch (error) {
        logger.error('Error generating report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({ error: err.message });
});

// Start server
app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
    console.log(`Server running on port ${port}`);
});
