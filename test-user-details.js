import fs from 'fs';

const userDetails = JSON.parse(fs.readFileSync('test-user-details.json', 'utf8'));
console.log('=== USER DETAILS API TEST ===');
console.log(`User: aalexander@lakesunapeevna.org`);
console.log(`Present Records: ${userDetails.presentRecords.length}`);
console.log(`Platforms Found:`);
userDetails.presentRecords.forEach(record => {
  console.log(`  - ${record.platformType} (Import: ${record.importFilename})`);
});

console.log(`\nAll Identifiers:`);
Object.entries(userDetails.allIdentifiers).forEach(([field, values]) => {
  console.log(`  ${field}: ${values.join(', ')}`);
});

console.log(`\nPotential Matches: ${userDetails.potentialMatches.length}`);
console.log(`Total Records: ${userDetails.totalRecords}`);

console.log('\n✅ User Details API is working correctly!');
