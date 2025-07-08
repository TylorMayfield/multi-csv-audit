-- Multi-Platform User Audit System Database Schema

-- Platform Types (Data Sources)
CREATE TABLE IF NOT EXISTS platform_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Platform Type Schemas (Column definitions for each platform type version)
CREATE TABLE IF NOT EXISTS platform_schemas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_type_id INTEGER NOT NULL,
    column_name VARCHAR(100) NOT NULL,
    column_type VARCHAR(50) NOT NULL, -- string, number, date, email, boolean
    is_required BOOLEAN DEFAULT FALSE,
    is_identifier BOOLEAN DEFAULT FALSE, -- Used for user identification
    is_primary_key BOOLEAN DEFAULT FALSE,
    user_field VARCHAR(50), -- firstName, lastName, email, username - for user identification mapping
    validation_rules TEXT, -- JSON string for validation rules
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (platform_type_id) REFERENCES platform_types(id) ON DELETE CASCADE
);

-- Data Imports (Track each CSV import)
CREATE TABLE IF NOT EXISTS data_imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_type_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    record_count INTEGER NOT NULL,
    import_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    import_status VARCHAR(20) DEFAULT 'completed', -- pending, completed, failed
    error_message TEXT,
    created_by VARCHAR(100),
    FOREIGN KEY (platform_type_id) REFERENCES platform_types(id)
);

-- Raw User Data (All imported user records)
CREATE TABLE IF NOT EXISTS raw_user_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER NOT NULL,
    platform_type_id INTEGER NOT NULL,
    raw_data TEXT NOT NULL, -- JSON string of all original data
    processed_data TEXT, -- JSON string of processed/standardized data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (import_id) REFERENCES data_imports(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_type_id) REFERENCES platform_types(id)
);

-- Master User Records (Consolidated user identities)
CREATE TABLE IF NOT EXISTS master_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    primary_key VARCHAR(255) NOT NULL UNIQUE, -- Usually first_initial + last_name
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    display_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User Platform Presence (Track which platforms each user exists in)
CREATE TABLE IF NOT EXISTS user_platform_presence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    master_user_id INTEGER NOT NULL,
    platform_type_id INTEGER NOT NULL,
    import_id INTEGER NOT NULL,
    raw_data_id INTEGER NOT NULL,
    platform_user_id VARCHAR(255), -- The user ID in the source platform
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_date DATETIME,
    platform_specific_data TEXT, -- JSON string for platform-specific attributes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (master_user_id) REFERENCES master_users(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_type_id) REFERENCES platform_types(id),
    FOREIGN KEY (import_id) REFERENCES data_imports(id),
    FOREIGN KEY (raw_data_id) REFERENCES raw_user_data(id),
    UNIQUE(master_user_id, platform_type_id, import_id)
);

-- User Audit Log (Track changes and discrepancies)
CREATE TABLE IF NOT EXISTS user_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    master_user_id INTEGER NOT NULL,
    platform_type_id INTEGER,
    action VARCHAR(50) NOT NULL, -- created, updated, deactivated, missing, duplicate
    description TEXT,
    old_data TEXT, -- JSON string
    new_data TEXT, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (master_user_id) REFERENCES master_users(id),
    FOREIGN KEY (platform_type_id) REFERENCES platform_types(id)
);

-- Platform Comparison Rules (Rules for identifying missing users)
CREATE TABLE IF NOT EXISTS platform_comparison_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    source_platforms TEXT NOT NULL, -- JSON array of platform_type_ids
    target_platforms TEXT NOT NULL, -- JSON array of platform_type_ids
    matching_rules TEXT NOT NULL, -- JSON string defining matching criteria
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_user_data_import ON raw_user_data(import_id);
CREATE INDEX IF NOT EXISTS idx_raw_user_data_platform ON raw_user_data(platform_type_id);
CREATE INDEX IF NOT EXISTS idx_user_platform_presence_master ON user_platform_presence(master_user_id);
CREATE INDEX IF NOT EXISTS idx_user_platform_presence_platform ON user_platform_presence(platform_type_id);
CREATE INDEX IF NOT EXISTS idx_master_users_primary_key ON master_users(primary_key);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_master ON user_audit_log(master_user_id);
CREATE INDEX IF NOT EXISTS idx_user_audit_log_platform ON user_audit_log(platform_type_id);
