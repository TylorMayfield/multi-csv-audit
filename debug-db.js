import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'data/audit_system.db');
const db = new Database(DB_PATH);

console.log('=== Database Tables ===');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables);

console.log('\n=== Platform Types ===');
try {
  const platforms = db.prepare("SELECT * FROM platform_types LIMIT 5").all();
  console.log(platforms);
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n=== Data Imports ===');
try {
  const imports = db.prepare("SELECT * FROM data_imports LIMIT 5").all();
  console.log(imports);
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n=== Master Users ===');
try {
  const users = db.prepare("SELECT * FROM master_users LIMIT 5").all();
  console.log(users);
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n=== CSV Files ===');
try {
  const csvFiles = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%csv%' OR name LIKE '%file%'").all();
  console.log('CSV-related tables:', csvFiles);
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n=== All Tables Detail ===');
try {
  const allTables = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table'").all();
  allTables.forEach(table => {
    console.log(`\n--- ${table.name} ---`);
    console.log(table.sql);
  });
} catch (e) {
  console.log('Error:', e.message);
}

db.close();
