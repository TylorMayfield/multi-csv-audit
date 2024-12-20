const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(path.join(dataDir, 'csvaudit.sqlite'));

// Initialize database tables
const initDatabase = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // CSV Type definitions
            db.run(`CREATE TABLE IF NOT EXISTS csv_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Expected columns for each CSV type
            db.run(`CREATE TABLE IF NOT EXISTS csv_type_columns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                csv_type_id INTEGER,
                column_name TEXT NOT NULL,
                display_name TEXT NOT NULL,
                data_type TEXT NOT NULL,
                is_required BOOLEAN DEFAULT 0,
                validation_regex TEXT,
                description TEXT,
                FOREIGN KEY (csv_type_id) REFERENCES csv_types (id)
            )`);

            // Column mapping patterns for different sources
            db.run(`CREATE TABLE IF NOT EXISTS column_mappings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                csv_type_id INTEGER,
                source TEXT NOT NULL,
                source_column TEXT NOT NULL,
                target_column TEXT NOT NULL,
                transformation_rule TEXT,
                FOREIGN KEY (csv_type_id) REFERENCES csv_types (id)
            )`);

            // Files table to track uploaded files
            db.run(`CREATE TABLE IF NOT EXISTS files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                source TEXT NOT NULL,
                csv_type_id INTEGER,
                upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                record_count INTEGER,
                status TEXT DEFAULT 'pending',
                error_message TEXT,
                FOREIGN KEY (csv_type_id) REFERENCES csv_types (id)
            )`);

            // Columns table to track CSV columns from each file
            db.run(`CREATE TABLE IF NOT EXISTS columns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER,
                original_name TEXT NOT NULL,
                normalized_name TEXT,
                mapped_name TEXT,
                data_type TEXT,
                sample_data TEXT,
                validation_errors INTEGER DEFAULT 0,
                FOREIGN KEY (file_id) REFERENCES files (id)
            )`);

            // Records table to store the actual CSV data
            db.run(`CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id INTEGER,
                record_data TEXT NOT NULL,
                normalized_data TEXT,
                validation_errors TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (file_id) REFERENCES files (id)
            )`);

            // Discrepancy tracking
            db.run(`CREATE TABLE IF NOT EXISTS discrepancies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                csv_type_id INTEGER,
                file_id INTEGER,
                record_id INTEGER,
                column_name TEXT NOT NULL,
                discrepancy_type TEXT NOT NULL,
                description TEXT,
                severity TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (csv_type_id) REFERENCES csv_types (id),
                FOREIGN KEY (file_id) REFERENCES files (id),
                FOREIGN KEY (record_id) REFERENCES records (id)
            )`);

            // Reports table
            db.run(`CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                query_params TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });
};

// Helper function to run queries with promises
const runQuery = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
};

// Helper function to get results with promises
const getResults = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

module.exports = {
    db,
    initDatabase,
    runQuery,
    getResults
};
