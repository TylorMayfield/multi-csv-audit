import fs from 'fs';

const data = JSON.parse(fs.readFileSync('test-users.json', 'utf8'));
console.log('=== ALL USERS API TEST RESULTS ===');
console.log(`Total users: ${data.length}`);

const platforms = {};
data.forEach(user => {
  user.platforms.forEach(platform => {
    if (!platforms[platform]) platforms[platform] = new Set();
    platforms[platform].add(user.primaryKey);
  });
});

console.log('\nUsers by platform:');
Object.entries(platforms).forEach(([platform, users]) => {
  console.log(`  ${platform}: ${users.size} users`);
});

// Check for multi-platform users
const multiPlatformUsers = data.filter(user => user.platforms.length > 1);
console.log(`\nMulti-platform users: ${multiPlatformUsers.length}`);
console.log('Examples:');
multiPlatformUsers.slice(0, 5).forEach(user => {
  console.log(`  ${user.primaryKey}: ${user.platforms.join(', ')}`);
});
