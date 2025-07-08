import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { readFileSync, mkdirSync, existsSync } from 'fs';

// For Next.js, use process.cwd() to get the root directory
const DB_PATH = join(process.cwd(), 'data/audit_system.db');
const SCHEMA_PATH = join(process.cwd(), 'src/lib/database/schema.sql');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.initialize();
    }

    initialize() {
        try {
            // Ensure data directory exists
            const dbDir = dirname(DB_PATH);
            if (!existsSync(dbDir)) {
                mkdirSync(dbDir, { recursive: true });
            }

            // Create database connection
            this.db = new Database(DB_PATH);
            
            // Enable foreign keys
            this.db.pragma('foreign_keys = ON');
            
            // Read and execute schema
            const schema = readFileSync(SCHEMA_PATH, 'utf-8');
            this.db.exec(schema);
            
            // Run migrations for existing databases
            this.runMigrations();
            
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }

    runMigrations() {
        try {
            // Check if user_field column exists in platform_schemas table
            const columnCheck = this.db.prepare(`
                PRAGMA table_info(platform_schemas)
            `).all();
            
            const hasUserField = columnCheck.some(column => column.name === 'user_field');
            
            if (!hasUserField) {
                console.log('Adding user_field column to platform_schemas table...');
                this.db.exec(`
                    ALTER TABLE platform_schemas 
                    ADD COLUMN user_field VARCHAR(50)
                `);
                console.log('Migration completed: user_field column added');
            }
        } catch (error) {
            console.error('Migration failed:', error);
            // Don't throw here as the app should still work without migrations
        }
    }

    // Platform Types methods
    createPlatformType(name, description, version = 1) {
        const stmt = this.db.prepare(`
            INSERT INTO platform_types (name, description, version)
            VALUES (?, ?, ?)
        `);
        return stmt.run(name, description, version);
    }

    getPlatformTypes() {
        const stmt = this.db.prepare(`
            SELECT * FROM platform_types 
            WHERE is_active = 1 
            ORDER BY name ASC
        `);
        const platformTypes = stmt.all();
        
        // For each platform type, get its schema
        return platformTypes.map(platformType => {
            const schema = this.getPlatformSchema(platformType.id);
            return {
                ...platformType,
                // Convert snake_case to camelCase for frontend
                isActive: Boolean(platformType.is_active),
                createdAt: platformType.created_at,
                updatedAt: platformType.updated_at,
                schema: {
                    columns: schema.map(col => ({
                        name: col.column_name,
                        type: col.column_type,
                        required: Boolean(col.is_required),
                        userField: col.user_field || undefined
                    })),
                    primaryKeyFields: schema.filter(col => col.is_primary_key).map(col => col.column_name),
                    userIdentificationFields: {
                        firstName: schema.find(col => col.user_field === 'firstName')?.column_name,
                        lastName: schema.find(col => col.user_field === 'lastName')?.column_name,
                        email: schema.find(col => col.user_field === 'email')?.column_name,
                        username: schema.find(col => col.user_field === 'username')?.column_name,
                    }
                }
            };
        });
    }

    getPlatformTypeById(id) {
        const stmt = this.db.prepare(`
            SELECT * FROM platform_types WHERE id = ?
        `);
        return stmt.get(id);
    }

    updatePlatformType(id, name, description) {
        const stmt = this.db.prepare(`
            UPDATE platform_types 
            SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(name, description, id);
    }

    deactivatePlatformType(id) {
        const stmt = this.db.prepare(`
            UPDATE platform_types 
            SET is_active = 0, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        return stmt.run(id);
    }

    // Hard delete platform type (only if no data exists)
    deletePlatformType(id) {
        const deleteSchemaStmt = this.db.prepare(`
            DELETE FROM platform_schemas WHERE platform_type_id = ?
        `);
        
        const deletePlatformStmt = this.db.prepare(`
            DELETE FROM platform_types WHERE id = ?
        `);

        return this.db.transaction(() => {
            // Delete schema first
            deleteSchemaStmt.run(id);
            
            // Delete platform type
            return deletePlatformStmt.run(id);
        })();
    }

    // Find platform type by matching column schema
    findMatchingPlatformType(csvColumns) {
        const platformTypes = this.getPlatformTypes();
        
        for (const platformType of platformTypes) {
            const schema = platformType.schema;
            
            // Check if column counts match
            if (schema.columns.length !== csvColumns.length) {
                continue;
            }
            
            // Check if all column names match (case-insensitive)
            const csvColumnNames = csvColumns.map(col => col.toLowerCase().trim());
            const schemaColumnNames = schema.columns.map(col => col.name.toLowerCase().trim());
            
            const csvColumnSet = new Set(csvColumnNames);
            const schemaColumnSet = new Set(schemaColumnNames);
            
            // Check if all columns exist in both sets
            if (csvColumnSet.size === schemaColumnSet.size && 
                [...csvColumnSet].every(col => schemaColumnSet.has(col))) {
                return platformType;
            }
        }
        
        return null;
    }

    // Platform Schema methods
    createPlatformSchema(platformTypeId, columns) {
        const stmt = this.db.prepare(`
            INSERT INTO platform_schemas 
            (platform_type_id, column_name, column_type, is_required, is_identifier, is_primary_key, user_field, validation_rules)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const deleteStmt = this.db.prepare(`
            DELETE FROM platform_schemas WHERE platform_type_id = ?
        `);

        return this.db.transaction(() => {
            // Delete existing schema
            deleteStmt.run(platformTypeId);
            
            // Insert new schema
            for (const column of columns) {
                stmt.run(
                    platformTypeId,
                    column.name,
                    column.type,
                    column.required ? 1 : 0,
                    column.isIdentifier ? 1 : 0,
                    column.isPrimaryKey ? 1 : 0,
                    column.userField || null,
                    column.validationRules ? JSON.stringify(column.validationRules) : null
                );
            }
        })();
    }

    getPlatformSchema(platformTypeId) {
        const stmt = this.db.prepare(`
            SELECT * FROM platform_schemas 
            WHERE platform_type_id = ? 
            ORDER BY column_name ASC
        `);
        return stmt.all(platformTypeId);
    }

    // Data Import methods
    createDataImport(platformTypeId, filename, originalFilename, filePath, recordCount, createdBy = null) {
        const stmt = this.db.prepare(`
            INSERT INTO data_imports 
            (platform_type_id, filename, original_filename, file_path, record_count, created_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(platformTypeId, filename, originalFilename, filePath, recordCount, createdBy);
    }

    getDataImports(platformTypeId = null) {
        let query = `
            SELECT di.*, pt.name as platform_name
            FROM data_imports di
            JOIN platform_types pt ON di.platform_type_id = pt.id
        `;
        
        if (platformTypeId) {
            query += ` WHERE di.platform_type_id = ?`;
        }
        
        query += ` ORDER BY di.import_date DESC`;
        
        const stmt = this.db.prepare(query);
        return platformTypeId ? stmt.all(platformTypeId) : stmt.all();
    }

    updateDataImportStatus(importId, status, errorMessage = null) {
        const stmt = this.db.prepare(`
            UPDATE data_imports 
            SET import_status = ?, error_message = ?
            WHERE id = ?
        `);
        return stmt.run(status, errorMessage, importId);
    }

    // Delete data import and all associated data
    deleteDataImport(importId) {
        const deleteRawDataStmt = this.db.prepare(`
            DELETE FROM raw_user_data WHERE import_id = ?
        `);
        
        const deleteUserPresenceStmt = this.db.prepare(`
            DELETE FROM user_platform_presence WHERE import_id = ?
        `);
        
        const deleteImportStmt = this.db.prepare(`
            DELETE FROM data_imports WHERE id = ?
        `);

        return this.db.transaction(() => {
            // Delete user platform presence records first (references raw_user_data.id)
            deleteUserPresenceStmt.run(importId);
            
            // Delete associated raw data next
            deleteRawDataStmt.run(importId);
            
            // Delete the import record last
            return deleteImportStmt.run(importId);
        })();
    }

    // Delete all data imports for a platform type
    deleteAllDataImportsForPlatform(platformTypeId) {
        const imports = this.getDataImports(platformTypeId);
        const results = [];
        
        for (const imp of imports) {
            results.push(this.deleteDataImport(imp.id));
        }
        
        return results;
    }

    // Raw User Data methods
    insertRawUserData(importId, platformTypeId, rawData, processedData = null) {
        const stmt = this.db.prepare(`
            INSERT INTO raw_user_data 
            (import_id, platform_type_id, raw_data, processed_data)
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(importId, platformTypeId, JSON.stringify(rawData), processedData ? JSON.stringify(processedData) : null);
    }

    getRawUserData(importId) {
        const stmt = this.db.prepare(`
            SELECT * FROM raw_user_data WHERE import_id = ?
        `);
        return stmt.all(importId);
    }

    // Master User methods
    createMasterUser(primaryKey, firstName, lastName, email, displayName, username) {
        const stmt = this.db.prepare(`
            INSERT INTO master_users 
            (primary_key, first_name, last_name, email, display_name, username)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(primaryKey, firstName, lastName, email, displayName, username);
    }

    getMasterUsers() {
        const stmt = this.db.prepare(`
            SELECT * FROM master_users 
            WHERE is_active = 1 
            ORDER BY primary_key ASC
        `);
        return stmt.all();
    }

    getMasterUserByPrimaryKey(primaryKey) {
        const stmt = this.db.prepare(`
            SELECT * FROM master_users WHERE primary_key = ?
        `);
        return stmt.get(primaryKey);
    }

    updateMasterUser(id, data) {
        const fields = [];
        const values = [];
        
        // Map camelCase fields to snake_case database columns
        const fieldMap = {
            'primaryKey': 'primary_key',
            'firstName': 'first_name',
            'lastName': 'last_name',
            'displayName': 'display_name',
            'isActive': 'is_active',
            'createdAt': 'created_at',
            'updatedAt': 'updated_at'
        };
        
        for (const [key, value] of Object.entries(data)) {
            if (key !== 'id') {
                const dbColumnName = fieldMap[key] || key;
                fields.push(`${dbColumnName} = ?`);
                values.push(value);
            }
        }
        
        if (fields.length === 0) return null;
        
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        
        const stmt = this.db.prepare(`
            UPDATE master_users SET ${fields.join(', ')} WHERE id = ?
        `);
        return stmt.run(...values);
    }

    // User Platform Presence methods
    createUserPlatformPresence(masterUserId, platformTypeId, importId, rawDataId, platformUserId, isActive = true, lastSeenDate = null, platformSpecificData = null) {
        const stmt = this.db.prepare(`
            INSERT INTO user_platform_presence 
            (master_user_id, platform_type_id, import_id, raw_data_id, platform_user_id, is_active, last_seen_date, platform_specific_data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            masterUserId, 
            platformTypeId, 
            importId, 
            rawDataId, 
            platformUserId, 
            isActive ? 1 : 0, // Convert boolean to integer
            lastSeenDate,
            platformSpecificData ? JSON.stringify(platformSpecificData) : null
        );
    }

    getUserPlatformPresence(masterUserId = null, platformTypeId = null) {
        let query = `
            SELECT upp.*, pt.name as platform_name, mu.primary_key, mu.display_name
            FROM user_platform_presence upp
            JOIN platform_types pt ON upp.platform_type_id = pt.id
            JOIN master_users mu ON upp.master_user_id = mu.id
        `;
        
        const conditions = [];
        const params = [];
        
        if (masterUserId) {
            conditions.push('upp.master_user_id = ?');
            params.push(masterUserId);
        }
        
        if (platformTypeId) {
            conditions.push('upp.platform_type_id = ?');
            params.push(platformTypeId);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY mu.primary_key ASC, pt.name ASC`;
        
        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    // User Audit Log methods
    createAuditLog(masterUserId, platformTypeId, action, description, oldData = null, newData = null) {
        const stmt = this.db.prepare(`
            INSERT INTO user_audit_log 
            (master_user_id, platform_type_id, action, description, old_data, new_data)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            masterUserId, 
            platformTypeId, 
            action, 
            description,
            oldData ? JSON.stringify(oldData) : null,
            newData ? JSON.stringify(newData) : null
        );
    }

    getAuditLogs(masterUserId = null, platformTypeId = null, limit = 100) {
        let query = `
            SELECT ual.*, mu.primary_key, mu.display_name, pt.name as platform_name
            FROM user_audit_log ual
            JOIN master_users mu ON ual.master_user_id = mu.id
            LEFT JOIN platform_types pt ON ual.platform_type_id = pt.id
        `;
        
        const conditions = [];
        const params = [];
        
        if (masterUserId) {
            conditions.push('ual.master_user_id = ?');
            params.push(masterUserId);
        }
        
        if (platformTypeId) {
            conditions.push('ual.platform_type_id = ?');
            params.push(platformTypeId);
        }
        
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY ual.created_at DESC LIMIT ?`;
        params.push(limit);
        
        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    // Analytics methods
    getUserPlatformMatrix() {
        const stmt = this.db.prepare(`
            SELECT 
                mu.primary_key,
                mu.display_name,
                pt.name as platform_name,
                COUNT(upp.id) as presence_count,
                MAX(upp.last_seen_date) as last_seen
            FROM master_users mu
            CROSS JOIN platform_types pt
            LEFT JOIN user_platform_presence upp ON mu.id = upp.master_user_id AND pt.id = upp.platform_type_id
            WHERE mu.is_active = 1 AND pt.is_active = 1
            GROUP BY mu.id, pt.id
            ORDER BY mu.primary_key ASC, pt.name ASC
        `);
        return stmt.all();
    }

    getMissingUsers(sourcePlatformId, targetPlatformId) {
        const stmt = this.db.prepare(`
            SELECT DISTINCT mu.primary_key, mu.display_name, mu.email
            FROM master_users mu
            JOIN user_platform_presence upp_source ON mu.id = upp_source.master_user_id
            LEFT JOIN user_platform_presence upp_target ON mu.id = upp_target.master_user_id AND upp_target.platform_type_id = ?
            WHERE upp_source.platform_type_id = ? 
                AND upp_source.is_active = 1
                AND upp_target.id IS NULL
                AND mu.is_active = 1
            ORDER BY mu.primary_key ASC
        `);
        return stmt.all(targetPlatformId, sourcePlatformId);
    }

    getPlatformStatistics() {
        const stmt = this.db.prepare(`
            SELECT 
                pt.name as platform_name,
                COUNT(DISTINCT upp.master_user_id) as unique_users,
                COUNT(di.id) as total_imports,
                MAX(di.import_date) as last_import_date
            FROM platform_types pt
            LEFT JOIN user_platform_presence upp ON pt.id = upp.platform_type_id AND upp.is_active = 1
            LEFT JOIN data_imports di ON pt.id = di.platform_type_id
            WHERE pt.is_active = 1
            GROUP BY pt.id
            ORDER BY pt.name ASC
        `);
        return stmt.all();
    }

    // Cleanup methods
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

// Create singleton instance
const dbManager = new DatabaseManager();

export default dbManager;
