import fs from 'fs/promises';
import { join } from 'path';

// Directory paths - use process.cwd() for Next.js
const rootDir = process.cwd();
export const DATA_DIR = join(rootDir, 'data');
export const UPLOADS_DIR = join(DATA_DIR, 'uploads');
export const PROCESSED_DIR = join(DATA_DIR, 'processed');
export const DATABASE_DIR = join(rootDir, 'src/lib/database');

// Legacy file paths (for migration)
export const TYPES_FILE = join(DATA_DIR, 'csvTypes.json');
export const MAPPINGS_FILE = join(DATA_DIR, 'mappings.json');
export const UPLOADED_FILES_FILE = join(UPLOADS_DIR, 'uploadedFiles.json');

// User identification configuration
export const USER_IDENTIFICATION_CONFIG = {
    // Primary key generation strategy
    primaryKeyStrategy: 'first_initial_last_name', // 'first_initial_last_name', 'email', 'custom'
    
    // Common field mappings for user identification
    commonFields: {
        firstName: ['first_name', 'firstname', 'first name', 'given_name', 'givenname'],
        lastName: ['last_name', 'lastname', 'last name', 'surname', 'family_name', 'familyname'],
        email: ['email', 'email_address', 'emailaddress', 'mail'],
        displayName: ['display_name', 'displayname', 'full_name', 'fullname', 'name'],
        username: ['username', 'user_name', 'login', 'userid', 'user_id']
    },
    
    // Normalization rules
    normalization: {
        trimWhitespace: true,
        toLowerCase: true,
        removeSpecialChars: false
    }
};

// Platform comparison configuration
export const PLATFORM_COMPARISON_CONFIG = {
    defaultMatchingFields: ['email', 'primary_key'],
    similarityThreshold: 0.8,
    autoMergeThreshold: 0.95
};

// Ensure directories exist
export const ensureDirectories = async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.mkdir(PROCESSED_DIR, { recursive: true });
    
    // Initialize legacy JSON files if they don't exist (for migration)
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
    
    try {
        await fs.access(UPLOADED_FILES_FILE);
    } catch {
        await fs.writeFile(UPLOADED_FILES_FILE, JSON.stringify([]));
    }
};
