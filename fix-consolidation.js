import dbManager from './src/lib/database/database.js';

console.log('=== FIXING DEVICE PLATFORM CONSOLIDATION ===\n');

// 1. Check why only 2 master_users for 173 device records
console.log('1. INVESTIGATING CONSOLIDATION ISSUE');
console.log('=' .repeat(50));

const devicePlatform = dbManager.db.prepare('SELECT * FROM platform_types WHERE name = ?').get('MaaS360 Devices');

// Get all unique emails from device records
const uniqueEmails = dbManager.db.prepare(`
  SELECT DISTINCT 
    json_extract(processed_data, '$.primaryKey') as primary_key,
    json_extract(processed_data, '$.email') as email,
    json_extract(processed_data, '$.username') as username,
    COUNT(*) as record_count
  FROM raw_user_data 
  WHERE platform_type_id = ?
  GROUP BY json_extract(processed_data, '$.primaryKey')
  ORDER BY record_count DESC
`).all(devicePlatform.id);

console.log(`Unique users found in device records: ${uniqueEmails.length}`);
console.log('Top 10 users by device count:');
uniqueEmails.slice(0, 10).forEach(user => {
  console.log(`  ${user.primary_key}: ${user.record_count} devices`);
});

// 2. Check which device users exist in master_users table
console.log('\n2. CHECKING MASTER_USERS CONSOLIDATION');
console.log('=' .repeat(50));

const deviceUsersInMaster = [];
const deviceUsersNotInMaster = [];

uniqueEmails.forEach(deviceUser => {
  const masterUser = dbManager.db.prepare('SELECT * FROM master_users WHERE primary_key = ?').get(deviceUser.primary_key);
  if (masterUser) {
    deviceUsersInMaster.push(deviceUser);
  } else {
    deviceUsersNotInMaster.push(deviceUser);
  }
});

console.log(`Device users in master_users: ${deviceUsersInMaster.length}`);
console.log(`Device users NOT in master_users: ${deviceUsersNotInMaster.length}`);

if (deviceUsersNotInMaster.length > 0) {
  console.log('\nDevice users missing from master_users:');
  deviceUsersNotInMaster.slice(0, 10).forEach(user => {
    console.log(`  ${user.primary_key} (${user.record_count} devices)`);
  });
}

// 3. Check user_platform_presence for device platform
console.log('\n3. CHECKING USER_PLATFORM_PRESENCE');
console.log('=' .repeat(50));

const devicePresenceRecords = dbManager.db.prepare(`
  SELECT COUNT(*) as count FROM user_platform_presence 
  WHERE platform_type_id = ?
`).get(devicePlatform.id);

console.log(`user_platform_presence records for devices: ${devicePresenceRecords.count}`);

// Check if there are presence records for users not in master_users
const orphanedPresence = dbManager.db.prepare(`
  SELECT upp.*, rud.processed_data
  FROM user_platform_presence upp
  LEFT JOIN master_users mu ON upp.master_user_id = mu.id
  LEFT JOIN raw_user_data rud ON upp.raw_data_id = rud.id
  WHERE upp.platform_type_id = ? AND mu.id IS NULL
`).all(devicePlatform.id);

if (orphanedPresence.length > 0) {
  console.log(`\n⚠️ Found ${orphanedPresence.length} orphaned presence records (no corresponding master_user)`);
}

// 4. Let's manually verify the consolidation for a specific user
console.log('\n4. MANUAL VERIFICATION - CHECKING SPECIFIC USERS');
console.log('=' .repeat(50));

// Pick a user that should exist in multiple platforms
const testUser = 'vsayers@lakesunapeevna.org';
console.log(`\nTesting user: ${testUser}`);

// Check in all platforms
const platforms = dbManager.db.prepare('SELECT * FROM platform_types WHERE is_active = 1').all();
platforms.forEach(platform => {
  const userRecords = dbManager.db.prepare(`
    SELECT COUNT(*) as count FROM raw_user_data
    WHERE platform_type_id = ? AND json_extract(processed_data, '$.primaryKey') = ?
  `).get(platform.id, testUser);
  
  if (userRecords.count > 0) {
    console.log(`  ${platform.name}: ${userRecords.count} records`);
  }
});

// Check master_users entry
const masterUser = dbManager.db.prepare('SELECT * FROM master_users WHERE primary_key = ?').get(testUser);
if (masterUser) {
  console.log(`  Master user exists: ID ${masterUser.id}`);
  
  // Check presence records
  const presenceRecords = dbManager.db.prepare(`
    SELECT pt.name, COUNT(*) as count
    FROM user_platform_presence upp
    JOIN platform_types pt ON upp.platform_type_id = pt.id
    WHERE upp.master_user_id = ?
    GROUP BY pt.id
  `).all(masterUser.id);
  
  console.log(`  Platform presence:`);
  presenceRecords.forEach(pr => {
    console.log(`    ${pr.name}: ${pr.count} presence records`);
  });
} else {
  console.log(`  ⚠️ Master user NOT found`);
}

// 5. Create recommendations for fixing the issue
console.log('\n5. RECOMMENDATIONS FOR FIXING CONSOLIDATION');
console.log('=' .repeat(50));

console.log(`\n📊 Current State:`);
console.log(`  • Device platform has ${uniqueEmails.length} unique users in raw data`);
console.log(`  • Only ${deviceUsersInMaster.length} are properly consolidated in master_users`);
console.log(`  • Missing ${deviceUsersNotInMaster.length} users from master_users table`);

console.log(`\n🔧 Recommended Actions:`);
console.log(`  1. Re-run consolidation process for device platform`);
console.log(`  2. Ensure all device users are added to master_users table`);
console.log(`  3. Create user_platform_presence records for all device users`);
console.log(`  4. Verify cross-platform matching after consolidation`);

if (deviceUsersNotInMaster.length > 0) {
  console.log(`\n💡 Quick Fix SQL (run in database):`);
  console.log(`-- Add missing users to master_users`);
  deviceUsersNotInMaster.slice(0, 5).forEach(user => {
    console.log(`INSERT INTO master_users (primary_key, email, username, is_active) VALUES ('${user.primary_key}', '${user.email}', '${user.username}', 1);`);
  });
}
