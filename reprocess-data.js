import dbManager from './src/lib/database/database.js';
import UserIdentificationService from './src/lib/services/UserIdentificationService.js';

console.log('Starting data reprocessing...');

try {
    // Get all raw user data
    const rawUserData = dbManager.db.prepare(`
        SELECT id, platform_type_id, raw_data 
        FROM raw_user_data
    `).all();

    console.log(`Found ${rawUserData.length} raw user records to reprocess`);

    // Clear existing processed data
    console.log('Clearing existing processed data...');
    dbManager.db.prepare('DELETE FROM user_platform_presence').run();
    dbManager.db.prepare('DELETE FROM master_users WHERE is_active = 1').run();

    console.log('Processing raw data with updated schemas...');

    const processedUsers = new Map(); // primaryKey -> user data
    const userPlatformPresence = []; // Array of presence records

    for (const rawRecord of rawUserData) {
        try {
            // Get the platform schema
            const platformSchema = dbManager.getPlatformSchema(rawRecord.platform_type_id);
            const rawData = JSON.parse(rawRecord.raw_data);

            // Extract user data using the updated schema
            const userData = UserIdentificationService.extractUserData(rawData, platformSchema);

            console.log(`Processing user: ${userData.primaryKey} from platform ${rawRecord.platform_type_id}`);
            console.log(`  Email: ${userData.email}`);
            console.log(`  Username: ${userData.username}`);
            console.log(`  FirstName: ${userData.firstName}`);
            console.log(`  LastName: ${userData.lastName}`);
            console.log(`  DisplayName: ${userData.displayName}`);

            if (!userData.primaryKey) {
                console.log(`  WARNING: Could not generate primary key for record ${rawRecord.id}`);
                continue;
            }

            // Update or create master user
            if (processedUsers.has(userData.primaryKey)) {
                // Merge with existing user data
                const existing = processedUsers.get(userData.primaryKey);
                processedUsers.set(userData.primaryKey, UserIdentificationService.mergeUserData(existing, userData));
            } else {
                processedUsers.set(userData.primaryKey, userData);
            }

            // Add platform presence record (we'll need to link it after creating master users)
            userPlatformPresence.push({
                primaryKey: userData.primaryKey,
                platformTypeId: rawRecord.platform_type_id,
                rawDataId: rawRecord.id,
                isPresent: true,
                lastSeen: new Date().toISOString()
            });

        } catch (error) {
            console.error(`Error processing raw record ${rawRecord.id}:`, error);
        }
    }

    console.log(`\nProcessed ${processedUsers.size} unique users across platforms`);

    // Insert master users
    console.log('Inserting master users...');
    const insertMasterUser = dbManager.db.prepare(`
        INSERT INTO master_users (
            primary_key, email, first_name, last_name, display_name, 
            is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `);

    let masterUserCount = 0;
    for (const [primaryKey, userData] of processedUsers) {
        try {
            insertMasterUser.run(
                primaryKey,
                userData.email || null,
                userData.firstName || null,
                userData.lastName || null,
                userData.displayName || null
            );
            masterUserCount++;
        } catch (error) {
            console.error(`Error inserting master user ${primaryKey}:`, error);
        }
    }

    console.log(`Inserted ${masterUserCount} master users`);

    // Insert user platform presence records
    console.log('Inserting user platform presence records...');
    
    // First, get master user IDs by primary key
    const masterUserIdMap = new Map();
    const masterUsers = dbManager.db.prepare('SELECT id, primary_key FROM master_users WHERE is_active = 1').all();
    masterUsers.forEach(user => {
        masterUserIdMap.set(user.primary_key, user.id);
    });

    // Get data import IDs for each platform
    const dataImports = dbManager.db.prepare('SELECT id, platform_type_id FROM data_imports').all();
    const importIdMap = new Map();
    dataImports.forEach(imp => {
        importIdMap.set(imp.platform_type_id, imp.id);
    });

    const insertPresence = dbManager.db.prepare(`
        INSERT INTO user_platform_presence (
            master_user_id, platform_type_id, import_id, raw_data_id, 
            is_active, last_seen_date, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
    `);

    let presenceCount = 0;
    for (const presence of userPlatformPresence) {
        try {
            const masterUserId = masterUserIdMap.get(presence.primaryKey);
            const importId = importIdMap.get(presence.platformTypeId);
            
            if (!masterUserId) {
                console.error(`No master user found for primary key: ${presence.primaryKey}`);
                continue;
            }
            
            if (!importId) {
                console.error(`No import found for platform: ${presence.platformTypeId}`);
                continue;
            }

            insertPresence.run(
                masterUserId,
                presence.platformTypeId,
                importId,
                presence.rawDataId,
                presence.lastSeen
            );
            presenceCount++;
        } catch (error) {
            console.error(`Error inserting presence record:`, error);
        }
    }

    console.log(`Inserted ${presenceCount} user platform presence records`);

    // Show final statistics
    console.log('\n=== FINAL STATISTICS ===');
    const finalStats = {
        masterUsers: dbManager.db.prepare('SELECT COUNT(*) as count FROM master_users WHERE is_active = 1').get().count,
        rawUserData: dbManager.db.prepare('SELECT COUNT(*) as count FROM raw_user_data').get().count,
        userPlatformPresence: dbManager.db.prepare('SELECT COUNT(*) as count FROM user_platform_presence').get().count
    };

    console.log('Master Users:', finalStats.masterUsers);
    console.log('Raw User Data:', finalStats.rawUserData);
    console.log('User Platform Presence:', finalStats.userPlatformPresence);

    // Show sample master users
    console.log('\n=== SAMPLE MASTER USERS ===');
    const sampleUsers = dbManager.db.prepare(`
        SELECT primary_key, email, first_name, last_name, display_name 
        FROM master_users 
        WHERE is_active = 1 
        LIMIT 5
    `).all();
    
    sampleUsers.forEach(user => {
        console.log(`${user.primary_key}: ${user.email} - ${user.first_name} ${user.last_name} (${user.display_name})`);
    });

    // Show platform coverage
    console.log('\n=== PLATFORM COVERAGE ===');
    const coverage = dbManager.db.prepare(`
        SELECT 
            pt.name as platform_name,
            COUNT(DISTINCT upp.master_user_id) as user_count
        FROM platform_types pt
        LEFT JOIN user_platform_presence upp ON pt.id = upp.platform_type_id
        WHERE pt.is_active = 1
        GROUP BY pt.id, pt.name
        ORDER BY pt.name
    `).all();

    coverage.forEach(item => {
        console.log(`${item.platform_name}: ${item.user_count} users`);
    });

    console.log('\nData reprocessing completed successfully!');

} catch (error) {
    console.error('Error during reprocessing:', error);
    process.exit(1);
}
