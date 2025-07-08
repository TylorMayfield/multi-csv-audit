import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'data/audit_system.db');
const db = new Database(DB_PATH);

console.log('=== Data Counts ===');

// Platform types count
const platformCount = db.prepare("SELECT COUNT(*) as count FROM platform_types WHERE is_active = 1").get();
console.log(`Active Platform Types: ${platformCount.count}`);

// Master users count
const userCount = db.prepare("SELECT COUNT(*) as count FROM master_users WHERE is_active = 1").get();
console.log(`Active Master Users: ${userCount.count}`);

// Platform presence
const presenceCount = db.prepare("SELECT COUNT(*) as count FROM user_platform_presence").get();
console.log(`User Platform Presence Records: ${presenceCount.count}`);

// Platform breakdown
console.log('\n=== Users by Platform ===');
const platformBreakdown = db.prepare(`
  SELECT 
    pt.name as platform_name,
    COUNT(DISTINCT upp.master_user_id) as unique_users,
    COUNT(upp.id) as total_records
  FROM platform_types pt
  LEFT JOIN user_platform_presence upp ON pt.id = upp.platform_type_id
  WHERE pt.is_active = 1
  GROUP BY pt.id, pt.name
  ORDER BY pt.name
`).all();

platformBreakdown.forEach(row => {
  console.log(`${row.platform_name}: ${row.unique_users} unique users, ${row.total_records} records`);
});

// Sample users with platform presence
console.log('\n=== Sample Users with Platform Presence ===');
const sampleUsers = db.prepare(`
  SELECT 
    mu.primary_key,
    mu.email,
    mu.display_name,
    pt.name as platform_name
  FROM master_users mu
  JOIN user_platform_presence upp ON mu.id = upp.master_user_id
  JOIN platform_types pt ON upp.platform_type_id = pt.id
  WHERE mu.is_active = 1
  ORDER BY mu.primary_key
  LIMIT 10
`).all();

sampleUsers.forEach(user => {
  console.log(`${user.primary_key} (${user.email}) - ${user.platform_name}`);
});

db.close();
