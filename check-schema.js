import dbManager from './src/lib/database/database.js';

console.log('=== Platform Types Table Structure ===');
const pragma = dbManager.db.prepare('PRAGMA table_info(platform_types)').all();
console.log(pragma);

console.log('\n=== Platform Schemas Table Structure ===');
const pragmaSchemas = dbManager.db.prepare('PRAGMA table_info(platform_schemas)').all();
console.log(pragmaSchemas);

console.log('\n=== How to determine primary key field for each platform ===');
const platforms = dbManager.db.prepare('SELECT * FROM platform_types WHERE is_active = 1').all();
platforms.forEach(platform => {
  console.log(`\nPlatform: ${platform.name}`);
  const primaryKeySchemas = dbManager.db.prepare(`
    SELECT * FROM platform_schemas 
    WHERE platform_type_id = ? AND is_primary_key = 1
  `).all(platform.id);
  
  if (primaryKeySchemas.length > 0) {
    console.log('Primary Key Fields:', primaryKeySchemas.map(s => s.column_name));
  } else {
    console.log('No primary key defined in schema - using default logic');
  }
});
