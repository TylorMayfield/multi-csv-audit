import dbManager from './src/lib/database/database.js';

console.log('=== Primary Key Fields by Platform ===');
const platforms = dbManager.db.prepare('SELECT * FROM platform_types WHERE is_active = 1').all();

platforms.forEach(platform => {
  console.log(`\nPlatform: ${platform.name} (ID: ${platform.id})`);
  
  // Check for primary key fields in schema
  const primaryKeyFields = dbManager.db.prepare(`
    SELECT * FROM platform_schemas 
    WHERE platform_type_id = ? AND is_primary_key = 1
  `).all(platform.id);
  
  console.log('Primary Key Fields:', primaryKeyFields.length > 0 ? primaryKeyFields : 'None defined');
  
  // Check identifier fields
  const identifierFields = dbManager.db.prepare(`
    SELECT * FROM platform_schemas 
    WHERE platform_type_id = ? AND is_identifier = 1
  `).all(platform.id);
  
  console.log('Identifier Fields:', identifierFields.length > 0 ? identifierFields : 'None defined');
  
  // Sample data to see how users are being matched
  const sampleData = dbManager.db.prepare(`
    SELECT processed_data FROM raw_user_data 
    WHERE platform_type_id = ? LIMIT 3
  `).all(platform.id);
  
  console.log('Sample Processed Data:');
  sampleData.forEach((data, idx) => {
    const parsed = JSON.parse(data.processed_data);
    console.log(`  Sample ${idx + 1}: primaryKey=${parsed.primaryKey}, email=${parsed.email}, username=${parsed.username}`);
  });
});

// Check how users are currently being matched
console.log('\n=== Cross-Platform User Analysis ===');
const crossPlatformUsers = dbManager.db.prepare(`
  SELECT 
    mu.primary_key,
    mu.email,
    mu.username,
    COUNT(DISTINCT upp.platform_type_id) as platform_count,
    GROUP_CONCAT(pt.name) as platforms
  FROM master_users mu
  JOIN user_platform_presence upp ON mu.id = upp.master_user_id
  JOIN platform_types pt ON upp.platform_type_id = pt.id
  WHERE mu.is_active = 1 AND pt.is_active = 1
  GROUP BY mu.id
  HAVING platform_count > 1
  LIMIT 5
`).all();

console.log('Users present in multiple platforms:');
crossPlatformUsers.forEach(user => {
  console.log(`  ${user.primary_key} (email: ${user.email}, username: ${user.username}) - ${user.platform_count} platforms: ${user.platforms}`);
});
