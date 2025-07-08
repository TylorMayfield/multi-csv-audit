import dbManager from './src/lib/database/database.js';

console.log('=== FIXING USER_PLATFORM_PRESENCE RECORDS ===\n');

const devicePlatform = dbManager.db.prepare('SELECT * FROM platform_types WHERE name = ?').get('MaaS360 Devices');

// 1. Get all device users that should have presence records
const deviceUsers = dbManager.db.prepare(`
  SELECT DISTINCT 
    mu.id as master_user_id,
    mu.primary_key,
    rud.id as raw_data_id,
    rud.import_id
  FROM master_users mu
  JOIN raw_user_data rud ON json_extract(rud.processed_data, '$.primaryKey') = mu.primary_key
  WHERE rud.platform_type_id = ?
  AND mu.is_active = 1
`).all(devicePlatform.id);

console.log(`Device users that should have presence records: ${deviceUsers.length}`);

// 2. Check which ones are missing presence records
const missingPresenceUsers = [];
const existingPresenceUsers = [];

deviceUsers.forEach(user => {
  const presence = dbManager.db.prepare(`
    SELECT * FROM user_platform_presence 
    WHERE master_user_id = ? AND platform_type_id = ?
  `).get(user.master_user_id, devicePlatform.id);
  
  if (presence) {
    existingPresenceUsers.push(user);
  } else {
    missingPresenceUsers.push(user);
  }
});

console.log(`Users with existing presence records: ${existingPresenceUsers.length}`);
console.log(`Users missing presence records: ${missingPresenceUsers.length}`);

if (missingPresenceUsers.length > 0) {
  console.log('\n⚠️ CREATING MISSING PRESENCE RECORDS');
  console.log('=' .repeat(50));
  
  // Create the missing presence records
  const insertPresence = dbManager.db.prepare(`
    INSERT INTO user_platform_presence (
      master_user_id, 
      platform_type_id, 
      import_id, 
      raw_data_id, 
      platform_user_id, 
      is_active,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  
  let created = 0;
  missingPresenceUsers.forEach(user => {
    try {
      insertPresence.run(
        user.master_user_id, 
        devicePlatform.id, 
        user.import_id, 
        user.raw_data_id, 
        user.primary_key
      );
      created++;
    } catch (error) {
      console.error(`Failed to create presence for ${user.primary_key}:`, error.message);
    }
  });
  
  console.log(`✅ Created ${created} missing presence records`);
}

// 3. Verify the fix
console.log('\n3. VERIFICATION AFTER FIX');
console.log('=' .repeat(50));

const finalPresenceCount = dbManager.db.prepare(`
  SELECT COUNT(*) as count FROM user_platform_presence 
  WHERE platform_type_id = ?
`).get(devicePlatform.id);

console.log(`Total presence records for device platform: ${finalPresenceCount.count}`);

// Check a few sample users
const sampleUsers = ['vsayers@lakesunapeevna.org', 'mrainville@lakesunapeevna.org', 'tmayfield@lakesunapeevna.org'];
sampleUsers.forEach(userId => {
  const masterUser = dbManager.db.prepare('SELECT * FROM master_users WHERE primary_key = ?').get(userId);
  if (masterUser) {
    const platforms = dbManager.db.prepare(`
      SELECT pt.name, COUNT(*) as count
      FROM user_platform_presence upp
      JOIN platform_types pt ON upp.platform_type_id = pt.id
      WHERE upp.master_user_id = ?
      GROUP BY pt.id
    `).all(masterUser.id);
    
    console.log(`${userId}: ${platforms.map(p => p.name).join(', ')}`);
  }
});

// 4. Test the API to see if it now shows correct counts
console.log('\n4. TESTING API RESPONSE');
console.log('=' .repeat(50));

const allUsersQuery = `
  SELECT DISTINCT
    mu.primary_key,
    pt.name as platform_name
  FROM master_users mu
  JOIN user_platform_presence upp ON mu.id = upp.master_user_id
  JOIN platform_types pt ON upp.platform_type_id = pt.id
  WHERE mu.is_active = 1 AND pt.is_active = 1
`;

const apiResults = dbManager.db.prepare(allUsersQuery).all();

// Count by platform
const platformCounts = {};
apiResults.forEach(result => {
  if (!platformCounts[result.platform_name]) {
    platformCounts[result.platform_name] = new Set();
  }
  platformCounts[result.platform_name].add(result.primary_key);
});

console.log('Updated platform user counts (for API):');
Object.entries(platformCounts).forEach(([platform, users]) => {
  console.log(`  ${platform}: ${users.size} users`);
});

console.log('\n✅ Fix complete! The All Users API should now show correct counts for all platforms.');
