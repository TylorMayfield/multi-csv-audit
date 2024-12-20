const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const { getResults } = require('../models/database');

class ReportGenerator {
    static async generateReport(params) {
        const { source, dateRange, columns, format = 'json' } = params;

        // Build the query based on parameters
        let query = `
            SELECT r.*, f.source, f.upload_date
            FROM records r
            JOIN files f ON r.file_id = f.id
            WHERE 1=1
        `;
        const queryParams = [];

        if (source) {
            query += ' AND f.source = ?';
            queryParams.push(source);
        }

        if (dateRange) {
            const { start, end } = dateRange;
            if (start) {
                query += ' AND f.upload_date >= ?';
                queryParams.push(start);
            }
            if (end) {
                query += ' AND f.upload_date <= ?';
                queryParams.push(end);
            }
        }

        // Get the data
        const records = await getResults(query, queryParams);
        const data = records.map(record => {
            const recordData = JSON.parse(record.normalized_data);
            return {
                ...recordData,
                source: record.source,
                upload_date: record.upload_date
            };
        });

        // Filter columns if specified
        const filteredData = columns ? 
            data.map(record => {
                const filtered = {};
                columns.forEach(col => {
                    if (record[col] !== undefined) {
                        filtered[col] = record[col];
                    }
                });
                return filtered;
            }) : data;

        // Generate report in requested format
        switch (format.toLowerCase()) {
            case 'csv':
                return this.generateCSV(filteredData);
            case 'pdf':
                return this.generatePDF(filteredData);
            default:
                return filteredData;
        }
    }

    static async generateCSV(data) {
        const fields = Object.keys(data[0] || {});
        const parser = new Parser({ fields });
        return parser.parse(data);
    }

    static async generatePDF(data) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const chunks = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Add title
            doc.fontSize(16).text('CSV Audit Report', { align: 'center' });
            doc.moveDown();

            // Add metadata
            doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
            doc.moveDown();

            // Add data table
            if (data.length > 0) {
                const columns = Object.keys(data[0]);
                
                // Table headers
                let yPos = doc.y;
                columns.forEach((col, i) => {
                    doc.text(col, 50 + (i * 100), yPos, { width: 90 });
                });
                
                doc.moveDown();
                yPos = doc.y;

                // Table rows
                data.forEach((row, rowIndex) => {
                    if (yPos > 700) { // Check if we need a new page
                        doc.addPage();
                        yPos = 50;
                    }

                    columns.forEach((col, i) => {
                        doc.text(String(row[col] || ''), 50 + (i * 100), yPos, { width: 90 });
                    });

                    yPos += 20;
                });
            } else {
                doc.text('No data available');
            }

            doc.end();
        });
    }

    static async getAvailableColumns() {
        const query = `
            SELECT DISTINCT normalized_name, data_type
            FROM columns
            ORDER BY normalized_name
        `;
        return await getResults(query);
    }

    static async getSummaryStats() {
        const stats = {
            totalFiles: 0,
            totalRecords: 0,
            sourceBreakdown: [],
            recentUploads: []
        };

        // Get total files and records
        const totals = await getResults(`
            SELECT COUNT(DISTINCT f.id) as file_count, 
                   SUM(f.record_count) as record_count
            FROM files f
            WHERE f.status = 'completed'
        `);
        stats.totalFiles = totals[0].file_count;
        stats.totalRecords = totals[0].record_count;

        // Get breakdown by source
        stats.sourceBreakdown = await getResults(`
            SELECT source, 
                   COUNT(*) as file_count,
                   SUM(record_count) as record_count
            FROM files
            WHERE status = 'completed'
            GROUP BY source
        `);

        // Get recent uploads
        stats.recentUploads = await getResults(`
            SELECT id, original_name, source, upload_date, record_count, status
            FROM files
            ORDER BY upload_date DESC
            LIMIT 5
        `);

        return stats;
    }
}

module.exports = ReportGenerator;
