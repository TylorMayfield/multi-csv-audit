const { runQuery, getResults } = require('../models/database');

class CSVTypeManager {
    static async createType(typeData) {
        const { name, description, columns } = typeData;

        try {
            const result = await runQuery(
                'INSERT INTO csv_types (name, description) VALUES (?, ?)',
                [name, description]
            );

            const typeId = result.lastID;

            // Add columns for this type
            for (const column of columns) {
                await runQuery(
                    `INSERT INTO csv_type_columns 
                    (csv_type_id, column_name, display_name, data_type, is_required, validation_regex, description)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        typeId,
                        column.name,
                        column.displayName,
                        column.dataType,
                        column.required ? 1 : 0,
                        column.validationRegex,
                        column.description
                    ]
                );
            }

            return typeId;
        } catch (error) {
            throw new Error(`Failed to create CSV type: ${error.message}`);
        }
    }

    static async addColumnMapping(mappingData) {
        const { csvTypeId, source, mappings } = mappingData;

        try {
            for (const mapping of mappings) {
                await runQuery(
                    `INSERT INTO column_mappings 
                    (csv_type_id, source, source_column, target_column, transformation_rule)
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        csvTypeId,
                        source,
                        mapping.sourceColumn,
                        mapping.targetColumn,
                        mapping.transformationRule
                    ]
                );
            }
        } catch (error) {
            throw new Error(`Failed to add column mapping: ${error.message}`);
        }
    }

    static async getTypeDefinition(typeId) {
        try {
            const type = await getResults(
                'SELECT * FROM csv_types WHERE id = ?',
                [typeId]
            );

            if (!type.length) {
                throw new Error('CSV type not found');
            }

            const columns = await getResults(
                'SELECT * FROM csv_type_columns WHERE csv_type_id = ?',
                [typeId]
            );

            return {
                ...type[0],
                columns
            };
        } catch (error) {
            throw new Error(`Failed to get CSV type: ${error.message}`);
        }
    }

    static async getMappingsForSource(typeId, source) {
        try {
            return await getResults(
                'SELECT * FROM column_mappings WHERE csv_type_id = ? AND source = ?',
                [typeId, source]
            );
        } catch (error) {
            throw new Error(`Failed to get column mappings: ${error.message}`);
        }
    }

    static async detectCSVType(headers, source) {
        try {
            // Get all CSV types
            const types = await getResults('SELECT * FROM csv_types');
            let bestMatch = null;
            let highestScore = 0;

            for (const type of types) {
                // Get mappings for this type and source
                const mappings = await this.getMappingsForSource(type.id, source);
                const mappedColumns = mappings.map(m => m.source_column);

                // Calculate match score
                let score = 0;
                for (const header of headers) {
                    if (mappedColumns.includes(header)) {
                        score++;
                    }
                }

                const matchPercentage = score / mappedColumns.length;

                if (matchPercentage > highestScore) {
                    highestScore = matchPercentage;
                    bestMatch = type;
                }
            }

            // Require at least 70% match
            return highestScore >= 0.7 ? bestMatch : null;
        } catch (error) {
            throw new Error(`Failed to detect CSV type: ${error.message}`);
        }
    }

    static async findDiscrepancies(fileId) {
        try {
            const file = await getResults(
                'SELECT * FROM files WHERE id = ?',
                [fileId]
            );

            if (!file.length || !file[0].csv_type_id) {
                throw new Error('File not found or no CSV type assigned');
            }

            const typeDefinition = await this.getTypeDefinition(file[0].csv_type_id);
            const records = await getResults(
                'SELECT * FROM records WHERE file_id = ?',
                [fileId]
            );

            const discrepancies = [];

            for (const record of records) {
                const normalizedData = JSON.parse(record.normalized_data);
                
                // Check each expected column
                for (const column of typeDefinition.columns) {
                    const value = normalizedData[column.column_name];

                    // Check required fields
                    if (column.is_required && (value === undefined || value === null || value === '')) {
                        await this.addDiscrepancy({
                            csvTypeId: file[0].csv_type_id,
                            fileId,
                            recordId: record.id,
                            columnName: column.column_name,
                            discrepancyType: 'missing_required',
                            description: `Missing required value for ${column.display_name}`,
                            severity: 'high'
                        });
                    }

                    // Check data type
                    if (value !== undefined && value !== null) {
                        const validationError = this.validateDataType(value, column.data_type);
                        if (validationError) {
                            await this.addDiscrepancy({
                                csvTypeId: file[0].csv_type_id,
                                fileId,
                                recordId: record.id,
                                columnName: column.column_name,
                                discrepancyType: 'invalid_type',
                                description: validationError,
                                severity: 'medium'
                            });
                        }
                    }

                    // Check regex validation if specified
                    if (value && column.validation_regex) {
                        const regex = new RegExp(column.validation_regex);
                        if (!regex.test(value)) {
                            await this.addDiscrepancy({
                                csvTypeId: file[0].csv_type_id,
                                fileId,
                                recordId: record.id,
                                columnName: column.column_name,
                                discrepancyType: 'validation_failed',
                                description: `Value does not match expected format for ${column.display_name}`,
                                severity: 'medium'
                            });
                        }
                    }
                }
            }

            return discrepancies;
        } catch (error) {
            throw new Error(`Failed to find discrepancies: ${error.message}`);
        }
    }

    static async addDiscrepancy(discrepancyData) {
        try {
            await runQuery(
                `INSERT INTO discrepancies 
                (csv_type_id, file_id, record_id, column_name, discrepancy_type, description, severity)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    discrepancyData.csvTypeId,
                    discrepancyData.fileId,
                    discrepancyData.recordId,
                    discrepancyData.columnName,
                    discrepancyData.discrepancyType,
                    discrepancyData.description,
                    discrepancyData.severity
                ]
            );
        } catch (error) {
            throw new Error(`Failed to add discrepancy: ${error.message}`);
        }
    }

    static validateDataType(value, expectedType) {
        switch (expectedType.toLowerCase()) {
            case 'number':
                if (isNaN(value)) {
                    return 'Value is not a number';
                }
                break;
            case 'date':
                if (isNaN(Date.parse(value))) {
                    return 'Value is not a valid date';
                }
                break;
            case 'boolean':
                if (![true, false, 'true', 'false', 0, 1, '0', '1'].includes(value)) {
                    return 'Value is not a boolean';
                }
                break;
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    return 'Value is not a valid email';
                }
                break;
        }
        return null;
    }
}

module.exports = CSVTypeManager;
