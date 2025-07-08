import dbManager from '../database/database.js';
import userIdentificationService from './UserIdentificationService.js';
import { PLATFORM_COMPARISON_CONFIG } from '../config.js';

export class UserConsolidationService {
    constructor() {
        this.db = dbManager;
        this.userIdService = userIdentificationService;
        this.config = PLATFORM_COMPARISON_CONFIG;
    }

    /**
     * Process imported CSV data and consolidate users
     */
    async processImportedData(importId, platformTypeId, csvData) {
        const results = {
            totalRecords: csvData.length,
            processedRecords: 0,
            newUsers: 0,
            existingUsers: 0,
            errors: []
        };

        // Get platform schema for this platform type
        const platformSchema = this.db.getPlatformSchema(platformTypeId);

        for (const [index, rawRecord] of csvData.entries()) {
            try {
                // Extract standardized user data using platform schema
                const userData = this.userIdService.extractUserData(rawRecord, { columns: platformSchema });
                
                // Validate user data
                const validation = this.userIdService.validateUserData(userData);
                if (!validation.isValid) {
                    results.errors.push({
                        record: index + 1,
                        errors: validation.errors
                    });
                    continue;
                }

                // Save raw data
                const rawDataResult = this.db.insertRawUserData(importId, platformTypeId, rawRecord, userData);
                const rawDataId = rawDataResult.lastInsertRowid;

                // Find or create master user
                const masterUser = await this.findOrCreateMasterUser(userData);
                
                // Create platform presence record
                await this.createPlatformPresence(
                    masterUser.id,
                    platformTypeId,
                    importId,
                    rawDataId,
                    userData,
                    rawRecord
                );

                // Log audit event
                this.db.createAuditLog(
                    masterUser.id,
                    platformTypeId,
                    masterUser.isNew ? 'created' : 'updated',
                    `User processed from ${await this.getPlatformName(platformTypeId)} import`,
                    null,
                    userData
                );

                if (masterUser.isNew) {
                    results.newUsers++;
                } else {
                    results.existingUsers++;
                }

                results.processedRecords++;
            } catch (error) {
                results.errors.push({
                    record: index + 1,
                    errors: [`Processing error: ${error.message}`]
                });
            }
        }

        return results;
    }

    /**
     * Find existing master user or create new one
     */
    async findOrCreateMasterUser(userData) {
        // Try to find existing user by primary key
        let existingUser = this.db.getMasterUserByPrimaryKey(userData.primaryKey);
        
        if (existingUser) {
            // Update existing user with any new information
            const updatedData = this.userIdService.mergeUserData(existingUser, userData);
            this.db.updateMasterUser(existingUser.id, updatedData);
            return { ...existingUser, isNew: false };
        }

        // Check for potential duplicates using similarity matching
        const potentialDuplicates = await this.findPotentialDuplicates(userData);
        
        if (potentialDuplicates.length > 0) {
            // For now, we'll create a new user but log the potential duplicate
            // In a production system, you might want to require manual review
            for (const duplicate of potentialDuplicates) {
                this.db.createAuditLog(
                    duplicate.id,
                    null,
                    'duplicate_detected',
                    `Potential duplicate detected: ${userData.primaryKey}`,
                    duplicate,
                    userData
                );
            }
        }

        // Create new master user
        const result = this.db.createMasterUser(
            userData.primaryKey,
            userData.firstName,
            userData.lastName,
            userData.email,
            userData.displayName || `${userData.firstName} ${userData.lastName}`.trim(),
            userData.username
        );

        return {
            id: result.lastInsertRowid,
            primary_key: userData.primaryKey,
            first_name: userData.firstName,
            last_name: userData.lastName,
            email: userData.email,
            display_name: userData.displayName,
            username: userData.username,
            isNew: true
        };
    }

    /**
     * Find potential duplicate users
     */
    async findPotentialDuplicates(userData) {
        const allUsers = this.db.getMasterUsers();
        const potentialDuplicates = [];

        for (const user of allUsers) {
            const similarity = this.userIdService.calculateSimilarity(userData, user);
            
            if (similarity >= this.config.similarityThreshold) {
                potentialDuplicates.push({
                    ...user,
                    similarity
                });
            }
        }

        return potentialDuplicates.sort((a, b) => b.similarity - a.similarity);
    }

    /**
     * Create platform presence record
     */
    async createPlatformPresence(masterUserId, platformTypeId, importId, rawDataId, userData, rawRecord) {
        // Extract platform-specific user ID
        const platformUserId = userData.username || userData.email || userData.primaryKey;
        
        // Determine if user is active (you might want to customize this logic)
        const isActive = this.determineUserActiveStatus(rawRecord);
        
        // Extract last seen date if available
        const lastSeenDate = this.extractLastSeenDate(rawRecord);
        
        // Create platform-specific data object
        const platformSpecificData = {
            originalData: rawRecord,
            importDate: new Date().toISOString(),
            extractedFields: userData
        };

        // Check if presence record already exists for this import
        const existingPresence = this.db.getUserPlatformPresence(masterUserId, platformTypeId)
            .find(p => p.import_id === importId);

        if (existingPresence) {
            // Update existing record
            // Note: In a real system, you might want to implement an update method
            this.db.createAuditLog(
                masterUserId,
                platformTypeId,
                'updated',
                'Platform presence updated with new import data',
                null,
                platformSpecificData
            );
        } else {
            // Create new presence record
            this.db.createUserPlatformPresence(
                masterUserId,
                platformTypeId,
                importId,
                rawDataId,
                platformUserId,
                isActive,
                lastSeenDate,
                platformSpecificData
            );
        }
    }

    /**
     * Determine if user is active based on raw record
     */
    determineUserActiveStatus(rawRecord) {
        // Common status field names
        const statusFields = ['status', 'active', 'enabled', 'disabled', 'account_status'];
        
        for (const field of statusFields) {
            const value = this.userIdService.findFieldValue(rawRecord, field);
            if (value) {
                const normalizedValue = value.toString().toLowerCase();
                
                // Check for active indicators
                if (normalizedValue.includes('active') || 
                    normalizedValue.includes('enabled') || 
                    normalizedValue === 'true' || 
                    normalizedValue === '1') {
                    return true;
                }
                
                // Check for inactive indicators
                if (normalizedValue.includes('inactive') || 
                    normalizedValue.includes('disabled') || 
                    normalizedValue.includes('suspended') ||
                    normalizedValue === 'false' || 
                    normalizedValue === '0') {
                    return false;
                }
            }
        }
        
        // Default to active if no status information found
        return true;
    }

    /**
     * Extract last seen date from raw record
     */
    extractLastSeenDate(rawRecord) {
        const dateFields = [
            'last_seen', 'last_login', 'last_activity', 'last_updated', 
            'last_reported', 'last_sync', 'modified_date'
        ];
        
        for (const field of dateFields) {
            const value = this.userIdService.findFieldValue(rawRecord, field);
            if (value) {
                try {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        return date.toISOString();
                    }
                } catch (error) {
                    // Invalid date, continue to next field
                }
            }
        }
        
        return null;
    }

    /**
     * Get platform name by ID
     */
    async getPlatformName(platformTypeId) {
        const platform = this.db.getPlatformTypeById(platformTypeId);
        return platform ? platform.name : 'Unknown Platform';
    }

    /**
     * Generate user audit report
     */
    async generateUserAuditReport() {
        const platforms = this.db.getPlatformTypes();
        const matrix = this.db.getUserPlatformMatrix();
        
        // Group matrix data by user
        const userMatrix = {};
        matrix.forEach(row => {
            if (!userMatrix[row.primary_key]) {
                userMatrix[row.primary_key] = {
                    primaryKey: row.primary_key,
                    displayName: row.display_name,
                    platforms: {}
                };
            }
            
            userMatrix[row.primary_key].platforms[row.platform_name] = {
                present: row.presence_count > 0,
                lastSeen: row.last_seen
            };
        });

        // Find users missing from platforms
        const missingUsers = {};
        platforms.forEach(sourcePlatform => {
            platforms.forEach(targetPlatform => {
                if (sourcePlatform.id !== targetPlatform.id) {
                    const missing = this.db.getMissingUsers(sourcePlatform.id, targetPlatform.id);
                    const key = `${sourcePlatform.name}_missing_from_${targetPlatform.name}`;
                    missingUsers[key] = missing;
                }
            });
        });

        return {
            userMatrix: Object.values(userMatrix),
            missingUsers,
            platformStatistics: this.db.getPlatformStatistics(),
            auditSummary: this.generateAuditSummary()
        };
    }

    /**
     * Generate audit summary
     */
    generateAuditSummary() {
        const recentAuditLogs = this.db.getAuditLogs(null, null, 100);
        
        const summary = {
            totalUsers: this.db.getMasterUsers().length,
            totalPlatforms: this.db.getPlatformTypes().length,
            recentActivity: recentAuditLogs.slice(0, 10),
            actionCounts: {}
        };

        // Count actions
        recentAuditLogs.forEach(log => {
            summary.actionCounts[log.action] = (summary.actionCounts[log.action] || 0) + 1;
        });

        return summary;
    }

    /**
     * Merge duplicate users manually
     */
    async mergeDuplicateUsers(primaryUserId, duplicateUserId) {
        const primaryUser = this.db.getMasterUserByPrimaryKey(primaryUserId);
        const duplicateUser = this.db.getMasterUserByPrimaryKey(duplicateUserId);

        if (!primaryUser || !duplicateUser) {
            throw new Error('One or both users not found');
        }

        // Transfer all platform presence records from duplicate to primary
        const duplicatePresences = this.db.getUserPlatformPresence(duplicateUser.id);
        
        for (const presence of duplicatePresences) {
            // Check if primary user already has presence on this platform
            const existingPresence = this.db.getUserPlatformPresence(primaryUser.id, presence.platform_type_id);
            
            if (existingPresence.length === 0) {
                // Transfer presence record
                this.db.createUserPlatformPresence(
                    primaryUser.id,
                    presence.platform_type_id,
                    presence.import_id,
                    presence.raw_data_id,
                    presence.platform_user_id,
                    presence.is_active,
                    presence.last_seen_date,
                    presence.platform_specific_data
                );
            }
        }

        // Update master user with merged data
        const mergedData = this.userIdService.mergeUserData(primaryUser, duplicateUser);
        this.db.updateMasterUser(primaryUser.id, mergedData);

        // Deactivate duplicate user
        this.db.updateMasterUser(duplicateUser.id, { is_active: false });

        // Log merge action
        this.db.createAuditLog(
            primaryUser.id,
            null,
            'merged',
            `Merged duplicate user ${duplicateUser.primary_key} into ${primaryUser.primary_key}`,
            duplicateUser,
            mergedData
        );

        return {
            success: true,
            message: `Successfully merged ${duplicateUser.primary_key} into ${primaryUser.primary_key}`
        };
    }
}

export default new UserConsolidationService();
