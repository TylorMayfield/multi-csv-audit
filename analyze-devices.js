import dbManager from './src/lib/database/database.js';

console.log('=== MaaS360 Devices Platform Analysis ===\n');

// Check raw data for MaaS360 Devices platform
const devicePlatform = dbManager.db.prepare('SELECT * FROM platform_types WHERE name = ?').get('MaaS360 Devices');
console.log('Platform Details:', devicePlatform);

console.log('\n--- Raw Device Records ---');
const deviceRecords = dbManager.db.prepare(`
  SELECT raw_data, processed_data 
  FROM raw_user_data 
  WHERE platform_type_id = ? 
  LIMIT 10
`).all(devicePlatform.id);

deviceRecords.forEach((record, idx) => {
  console.log(`\nRecord ${idx + 1}:`);
  const raw = JSON.parse(record.raw_data);
  const processed = JSON.parse(record.processed_data);
  
  console.log('  Raw data keys:', Object.keys(raw));
  console.log('  Processed:', {
    primaryKey: processed.primaryKey,
    email: processed.email,
    username: processed.username
  });
  
  // Show a few key fields
  if (raw.Email) console.log('  Raw Email:', raw.Email);
  if (raw.Username) console.log('  Raw Username:', raw.Username);
  if (raw['User Name']) console.log('  Raw User Name:', raw['User Name']);
  if (raw.Owner) console.log('  Raw Owner:', raw.Owner);
});

console.log('\n--- Master Users in Device Platform ---');
const deviceUsers = dbManager.db.prepare(`
  SELECT DISTINCT mu.primary_key, mu.email, mu.username
  FROM master_users mu
  JOIN user_platform_presence upp ON mu.id = upp.master_user_id
  WHERE upp.platform_type_id = ?
`).all(devicePlatform.id);

console.log(`Total unique users in MaaS360 Devices: ${deviceUsers.length}`);
deviceUsers.forEach(user => {
  console.log(`  ${user.primary_key} (email: ${user.email}, username: ${user.username})`);
});

console.log('\n--- Check for Processing Issues ---');
const totalDeviceRecords = dbManager.db.prepare('SELECT COUNT(*) as count FROM raw_user_data WHERE platform_type_id = ?').get(devicePlatform.id);
console.log(`Total device records in database: ${totalDeviceRecords.count}`);

// Check if there are records that weren't properly processed
const unprocessedRecords = dbManager.db.prepare(`
  SELECT COUNT(*) as count 
  FROM raw_user_data 
  WHERE platform_type_id = ? AND processed_data IS NULL
`).get(devicePlatform.id);

console.log(`Unprocessed records: ${unprocessedRecords.count}`);

// Check if processed_data is empty or invalid
const invalidProcessedRecords = dbManager.db.prepare(`
  SELECT raw_data, processed_data
  FROM raw_user_data 
  WHERE platform_type_id = ? AND (
    processed_data IS NULL OR 
    processed_data = '' OR 
    json_extract(processed_data, '$.primaryKey') IS NULL OR
    json_extract(processed_data, '$.primaryKey') = ''
  )
  LIMIT 5
`).all(devicePlatform.id);

if (invalidProcessedRecords.length > 0) {
  console.log('\n--- Records with Processing Issues ---');
  invalidProcessedRecords.forEach((record, idx) => {
    console.log(`\nProblem Record ${idx + 1}:`);
    console.log('  Raw data:', record.raw_data.substring(0, 200) + '...');
    console.log('  Processed data:', record.processed_data);
  });
}

console.log('\n--- Sample Schema Configuration ---');
const deviceSchema = dbManager.db.prepare(`
  SELECT column_name, column_type, is_primary_key, is_identifier, user_field
  FROM platform_schemas 
  WHERE platform_type_id = ?
  ORDER BY column_name
`).all(devicePlatform.id);

console.log('Device platform schema:');
deviceSchema.forEach(field => {
  console.log(`  ${field.column_name} (${field.column_type}) -> ${field.user_field} [PK: ${field.is_primary_key}, ID: ${field.is_identifier}]`);
});
