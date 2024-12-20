const { parse } = require('csv-parse');
const fs = require('fs').promises;
const { createReadStream } = require('fs');
const { runQuery, getResults } = require('../models/database');
const CSVTypeManager = require('./csvTypeManager');

class CSVProcessor {
    static async processFile(fileId, filePath, source) {
        try {
            // Update file status to processing
            await runQuery(
                'UPDATE files SET status = ? WHERE id = ?',
                ['processing', fileId]
            );

            const records = await this.parseCSV(filePath);
            if (records.length === 0) {
                throw new Error('CSV file is empty');
            }

            // Detect CSV type based on headers
            const headers = Object.keys(records[0]);
            const detectedType = await CSVTypeManager.detectCSVType(headers, source);
            
            if (detectedType) {
                await runQuery(
                    'UPDATE files SET csv_type_id = ? WHERE id = ?',
                    [detectedType.id, fileId]
                );

                // Get column mappings for this type and source
                const mappings = await CSVTypeManager.getMappingsForSource(detectedType.id, source);
                
                // Process columns with mappings
                await this.processColumns(fileId, headers, records, mappings);

                // Process records with type validation
                await this.processRecords(fileId, records, mappings);

                // Find discrepancies
                await CSVTypeManager.findDiscrepancies(fileId);
            } else {
                // Process without type validation
                await this.processColumns(fileId, headers, records);
                await this.processRecords(fileId, records);
            }

            // Update file status and record count
            await runQuery(
                'UPDATE files SET status = ?, record_count = ? WHERE id = ?',
                ['completed', records.length, fileId]
            );

            return {
                success: true,
                recordCount: records.length,
                columns: headers,
                csvType: detectedType
            };
        } catch (error) {
            await runQuery(
                'UPDATE files SET status = ?, error_message = ? WHERE id = ?',
                ['error', error.message, fileId]
            );
            throw error;
        }
    }

    static parseCSV(filePath) {
        return new Promise((resolve, reject) => {
            const records = [];
            createReadStream(filePath)
                .pipe(parse({
                    columns: true,
                    skip_empty_lines: true,
                    trim: true
                }))
                .on('data', (record) => records.push(record))
                .on('error', reject)
                .on('end', () => resolve(records));
        });
    }

    static async processColumns(fileId, headers, records, mappings = []) {
        const sampleSize = Math.min(10, records.length);
        const samples = records.slice(0, sampleSize);

        for (const header of headers) {
            const mapping = mappings.find(m => m.source_column === header);
            const normalizedName = mapping ? mapping.target_column : this.normalizeColumnName(header);
            const sampleData = samples.map(r => r[header]).join(', ');
            const dataType = this.detectDataType(samples.map(r => r[header]));

            await runQuery(
                `INSERT INTO columns 
                (file_id, original_name, normalized_name, mapped_name, data_type, sample_data)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [fileId, header, normalizedName, mapping?.target_column, dataType, sampleData]
            );
        }
    }

    static async processRecords(fileId, records, mappings = []) {
        for (const record of records) {
            const normalizedRecord = {};
            const validationErrors = [];

            // Process each field
            for (const [key, value] of Object.entries(record)) {
                const mapping = mappings.find(m => m.source_column === key);
                const normalizedKey = mapping ? mapping.target_column : this.normalizeColumnName(key);
                let normalizedValue = value;

                // Apply transformation rule if exists
                if (mapping?.transformation_rule) {
                    try {
                        normalizedValue = this.applyTransformation(value, mapping.transformation_rule);
                    } catch (error) {
                        validationErrors.push({
                            field: key,
                            error: `Transformation failed: ${error.message}`
                        });
                    }
                }

                normalizedRecord[normalizedKey] = normalizedValue;
            }

            await runQuery(
                `INSERT INTO records 
                (file_id, record_data, normalized_data, validation_errors)
                VALUES (?, ?, ?, ?)`,
                [
                    fileId,
                    JSON.stringify(record),
                    JSON.stringify(normalizedRecord),
                    validationErrors.length > 0 ? JSON.stringify(validationErrors) : null
                ]
            );
        }
    }

    static normalizeColumnName(columnName) {
        return columnName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_{2,}/g, '_')
            .replace(/^_|_$/g, '');
    }

    static detectDataType(values) {
        const sample = values.find(v => v !== '' && v !== null) || '';
        
        // Check for date patterns
        const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4}$/;
        if (datePattern.test(sample)) return 'date';

        // Check for email
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailPattern.test(sample)) return 'email';

        // Check for numeric
        if (!isNaN(sample) && sample !== '') return 'number';

        // Check for boolean
        const booleanValues = ['true', 'false', 'yes', 'no', '1', '0'];
        if (booleanValues.includes(sample.toLowerCase())) return 'boolean';

        return 'string';
    }

    static applyTransformation(value, rule) {
        // Simple transformation rules
        switch (rule) {
            case 'UPPERCASE':
                return value.toUpperCase();
            case 'LOWERCASE':
                return value.toLowerCase();
            case 'TRIM':
                return value.trim();
            case 'NUMBER':
                return Number(value);
            case 'BOOLEAN':
                return ['true', '1', 'yes'].includes(value.toLowerCase());
            default:
                // For more complex transformations, you could implement a rule parser
                return value;
        }
    }
}

module.exports = CSVProcessor;
