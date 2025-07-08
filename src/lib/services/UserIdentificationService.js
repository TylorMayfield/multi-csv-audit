import { USER_IDENTIFICATION_CONFIG } from '../config.js';

export class UserIdentificationService {
    constructor() {
        this.config = USER_IDENTIFICATION_CONFIG;
    }

    /**
     * Generate a primary key for a user based on the configured strategy
     */
    generatePrimaryKey(userData) {
        switch (this.config.primaryKeyStrategy) {
            case 'first_initial_last_name':
                return this.generateFirstInitialLastName(userData);
            case 'email':
                return this.extractEmail(userData);
            case 'custom':
                return this.generateCustomKey(userData);
            default:
                return this.generateFirstInitialLastName(userData);
        }
    }

    /**
     * Generate primary key as first initial + last name
     */
    generateFirstInitialLastName(userData) {
        const firstName = this.extractField(userData, 'firstName');
        const lastName = this.extractField(userData, 'lastName');
        
        if (!firstName || !lastName) {
            // Fallback to email if name fields are missing
            const email = this.extractField(userData, 'email');
            if (email) {
                return this.normalizeString(email);
            }
            
            // Last resort: use username or display name
            const username = this.extractField(userData, 'username');
            const displayName = this.extractField(userData, 'displayName');
            
            return this.normalizeString(username || displayName || 'unknown_user');
        }
        
        const firstInitial = firstName.charAt(0).toUpperCase();
        const normalizedLastName = this.normalizeString(lastName);
        
        return `${firstInitial}${normalizedLastName}`;
    }

    /**
     * Extract a field from user data using multiple possible field names
     */
    extractField(userData, fieldType) {
        const possibleFields = this.config.commonFields[fieldType] || [];
        
        for (const fieldName of possibleFields) {
            const value = this.findFieldValue(userData, fieldName);
            if (value) {
                return this.normalizeString(value);
            }
        }
        
        return null;
    }

    /**
     * Find a field value in userData (case-insensitive)
     */
    findFieldValue(userData, fieldName) {
        // Direct match
        if (userData[fieldName]) {
            return userData[fieldName];
        }
        
        // Case-insensitive match
        const lowerFieldName = fieldName.toLowerCase();
        for (const [key, value] of Object.entries(userData)) {
            if (key.toLowerCase() === lowerFieldName && value) {
                return value;
            }
        }
        
        return null;
    }

    /**
     * Normalize a string according to configuration
     */
    normalizeString(str) {
        if (!str) return '';
        
        let normalized = str.toString();
        
        if (this.config.normalization.trimWhitespace) {
            normalized = normalized.trim();
        }
        
        if (this.config.normalization.toLowerCase) {
            normalized = normalized.toLowerCase();
        }
        
        if (this.config.normalization.removeSpecialChars) {
            normalized = normalized.replace(/[^a-zA-Z0-9]/g, '');
        }
        
        return normalized;
    }

    /**
     * Extract standardized user data from raw CSV data
     */
    extractUserData(rawData, platformSchema = null) {
        // If we have a platform schema, use it to map fields correctly
        let userData = {};
        
        if (platformSchema && platformSchema.columns) {
            // Use platform schema mapping first
            userData = this.extractUserDataFromSchema(rawData, platformSchema);
            
            // Only do limited fallback for missing critical fields when using schema
            if (!userData.email) {
                userData.email = this.extractField(rawData, 'email');
            }
            
            // Handle displayName <-> firstName/lastName conversion
            if (!userData.displayName && userData.firstName && userData.lastName) {
                userData.displayName = `${userData.firstName} ${userData.lastName}`.trim();
            } else if (userData.displayName && !userData.firstName && !userData.lastName) {
                // Split displayName into firstName and lastName if they're missing
                const nameParts = userData.displayName.trim().split(/\s+/);
                if (nameParts.length >= 2) {
                    userData.firstName = nameParts[0];
                    userData.lastName = nameParts.slice(1).join(' ');
                } else if (nameParts.length === 1) {
                    userData.firstName = nameParts[0];
                }
            }
        } else {
            // Use fallback field matching when no schema is available
            userData.firstName = this.extractField(rawData, 'firstName');
            userData.lastName = this.extractField(rawData, 'lastName');
            userData.email = this.extractField(rawData, 'email');
            userData.displayName = this.extractField(rawData, 'displayName');
            userData.username = this.extractField(rawData, 'username');
        }
        
        // Generate primary key
        userData.primaryKey = this.generatePrimaryKey(userData);
        
        return userData;
    }
    
    /**
     * Extract user data using platform schema mappings
     */
    extractUserDataFromSchema(rawData, platformSchema) {
        const userData = {};
        
        for (const column of platformSchema.columns) {
            const columnName = column.name || column.column_name;
            const columnValue = rawData[columnName];
            
            if (!columnValue) continue;
            
            // Check if this column has a specific user field mapping
            const userField = column.userField || column.user_field;
            if (userField) {
                userData[userField] = this.normalizeString(columnValue);
                continue;
            }
            
            // Skip smart mapping for columns without explicit user field mappings when using schema
            // This prevents incorrect matches like "Last Updated Date" being treated as a lastName field
            continue;
        }
        
        return userData;
    }
    
    /**
     * Check if column name indicates first name
     */
    isFirstNameField(normalizedName) {
        const patterns = ['firstname', 'first', 'givenname', 'fname'];
        return patterns.some(pattern => normalizedName.includes(pattern));
    }
    
    /**
     * Check if column name indicates last name
     */
    isLastNameField(normalizedName) {
        const patterns = ['lastname', 'last', 'surname', 'familyname', 'lname'];
        return patterns.some(pattern => normalizedName.includes(pattern));
    }
    
    /**
     * Check if column name indicates email
     */
    isEmailField(normalizedName) {
        const patterns = ['email', 'mail', 'emailaddress'];
        return patterns.some(pattern => normalizedName.includes(pattern));
    }
    
    /**
     * Check if column name indicates username
     */
    isUsernameField(normalizedName) {
        const patterns = ['username', 'user', 'login', 'userid'];
        return patterns.some(pattern => normalizedName.includes(pattern));
    }
    
    /**
     * Check if column name indicates full name
     */
    isFullNameField(normalizedName) {
        const patterns = ['fullname', 'full', 'displayname', 'name'];
        return patterns.some(pattern => normalizedName.includes(pattern));
    }
    
    /**
     * Split full name into first and last name
     */
    splitFullName(fullName) {
        if (!fullName) return { firstName: null, lastName: null };
        
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) {
            return { firstName: parts[0], lastName: null };
        } else if (parts.length === 2) {
            return { firstName: parts[0], lastName: parts[1] };
        } else {
            // More than 2 parts - first word is first name, rest is last name
            return { 
                firstName: parts[0], 
                lastName: parts.slice(1).join(' ') 
            };
        }
    }

    /**
     * Check if two user records might be the same person
     */
    calculateSimilarity(user1, user2) {
        let score = 0;
        let totalFields = 0;
        
        // Compare primary keys
        if (user1.primaryKey && user2.primaryKey) {
            totalFields++;
            if (user1.primaryKey === user2.primaryKey) {
                score += 1;
            }
        }
        
        // Compare emails
        if (user1.email && user2.email) {
            totalFields++;
            if (user1.email === user2.email) {
                score += 1;
            }
        }
        
        // Compare names
        if (user1.firstName && user2.firstName) {
            totalFields++;
            if (user1.firstName === user2.firstName) {
                score += 0.5;
            }
        }
        
        if (user1.lastName && user2.lastName) {
            totalFields++;
            if (user1.lastName === user2.lastName) {
                score += 0.5;
            }
        }
        
        // Compare usernames
        if (user1.username && user2.username) {
            totalFields++;
            if (user1.username === user2.username) {
                score += 0.8;
            }
        }
        
        return totalFields > 0 ? score / totalFields : 0;
    }

    /**
     * Generate a custom primary key (override this method for custom logic)
     */
    generateCustomKey(userData) {
        // Default implementation - can be overridden
        return this.generateFirstInitialLastName(userData);
    }

    /**
     * Extract email from user data
     */
    extractEmail(userData) {
        const email = this.extractField(userData, 'email');
        return email ? this.normalizeString(email) : null;
    }

    /**
     * Validate user data completeness
     */
    validateUserData(userData) {
        const errors = [];
        
        if (!userData.primaryKey) {
            errors.push('Primary key could not be generated');
        }
        
        if (!userData.firstName && !userData.lastName && !userData.email) {
            errors.push('At least one identifying field (firstName, lastName, or email) is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Merge user data from multiple sources
     */
    mergeUserData(existingData, newData) {
        const merged = { ...existingData };
        
        // Update non-null fields
        for (const [key, value] of Object.entries(newData)) {
            if (value && !merged[key]) {
                merged[key] = value;
            }
        }
        
        return merged;
    }
}

export default new UserIdentificationService();
