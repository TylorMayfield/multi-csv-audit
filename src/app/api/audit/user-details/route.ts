import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!dbManager.db) {
      throw new Error('Database not initialized');
    }

    console.log('Fetching detailed info for user:', userId);

    // Get all records for this user across all platforms
    // Since primary key could be username OR email, we need to search more flexibly
    const records = dbManager.db.prepare(`
      SELECT 
        rud.*,
        pt.name as platformType,
        di.original_filename as importFilename,
        di.import_date as importDate
      FROM raw_user_data rud
      LEFT JOIN platform_types pt ON rud.platform_type_id = pt.id
      LEFT JOIN data_imports di ON rud.import_id = di.id
      WHERE json_extract(rud.processed_data, '$.primaryKey') = ?
      ORDER BY pt.name, di.import_date DESC
    `).all(userId);

    // Also search for records where the user might be identified by different fields
    // This handles cases where the same person has records under different identifiers
    const potentialRecords = dbManager.db.prepare(`
      SELECT 
        rud.*,
        pt.name as platformType,
        di.original_filename as importFilename,
        di.import_date as importDate
      FROM raw_user_data rud
      LEFT JOIN platform_types pt ON rud.platform_type_id = pt.id
      LEFT JOIN data_imports di ON rud.import_id = di.id
      WHERE (
        json_extract(rud.raw_data, '$.email') = ? OR
        json_extract(rud.raw_data, '$.username') = ? OR
        json_extract(rud.raw_data, '$.userPrincipalName') = ? OR
        json_extract(rud.raw_data, '$.EmailAddress') = ? OR
        json_extract(rud.raw_data, '$.Username') = ? OR
        json_extract(rud.raw_data, '$.mail') = ? OR
        json_extract(rud.raw_data, '$.sAMAccountName') = ?
      ) AND json_extract(rud.processed_data, '$.primaryKey') != ?
      ORDER BY pt.name, di.import_date DESC
    `).all(userId, userId, userId, userId, userId, userId, userId, userId);

    // Get all unique identifiers used by this user
    const allIdentifiers: { [key: string]: Set<string> } = {};
    const presentRecords: any[] = [];

    records.forEach((record: any) => {
      // Parse the processed data to extract all fields
      try {
        const processedData = JSON.parse(record.processed_data);
        const rawData = JSON.parse(record.raw_data);
        
        // Add both processed and raw data fields
        const allData = { ...rawData, ...processedData };
        
        Object.entries(allData).forEach(([field, value]) => {
          if (value && typeof value === 'string' && value.trim()) {
            if (!allIdentifiers[field]) {
              allIdentifiers[field] = new Set();
            }
            allIdentifiers[field].add(value.trim());
          }
        });

        presentRecords.push({
          ...record,
          matchedValue: processedData.primaryKey,
          rawData: record.raw_data,
          processedData: record.processed_data
        });
      } catch (e) {
        console.error('Error parsing data for record:', record.id);
      }
    });

    // Convert sets to arrays for JSON serialization
    const allIdentifiersObj: { [key: string]: string[] } = {};
    Object.entries(allIdentifiers).forEach(([field, valueSet]) => {
      allIdentifiersObj[field] = Array.from(valueSet);
    });

    // Look for potential matches in platforms where the user is missing
    const potentialMatches: any[] = [];
    
    // Get all platform types with their configuration
    const platformTypes = dbManager.db.prepare(`
      SELECT id, name, is_active 
      FROM platform_types 
      WHERE is_active = 1
    `).all();

    // Create a map of missing platforms for this user
    const missingPlatformNames = new Set();
    const presentPlatformNames = new Set();
    
    // Determine which platforms this user is missing from
    records.forEach((record: any) => {
      presentPlatformNames.add(record.platformType);
    });
    
    platformTypes.forEach((pt: any) => {
      if (!presentPlatformNames.has(pt.name)) {
        missingPlatformNames.add(pt.name);
      }
    });

    // For each platform type, search for similar records
    for (const platformType of platformTypes as any[]) {
      try {
        const platformRecords = dbManager.db.prepare(`
          SELECT rud.*, pt.name as platformType
          FROM raw_user_data rud
          LEFT JOIN platform_types pt ON rud.platform_type_id = pt.id
          WHERE pt.id = ? AND json_extract(rud.processed_data, '$.primaryKey') != ?
          LIMIT 1000
        `).all(platformType.id, userId);

        // Check each record for similarity with our user's identifiers
        platformRecords.forEach((record: any) => {
          try {
            const processedData = JSON.parse(record.processed_data);
            const rawData = JSON.parse(record.raw_data);
            const recordData = { ...rawData, ...processedData };
            
            // Check if any of this user's identifiers appear in this record
            Object.entries(allIdentifiersObj).forEach(([field, values]) => {
              values.forEach(value => {
                // Look for exact matches in any field of the record
                Object.entries(recordData).forEach(([recordField, recordValue]) => {
                  if (recordValue && typeof recordValue === 'string') {
                    const similarity = calculateSimilarity(value.toLowerCase(), recordValue.toLowerCase());
                    
                    // If similarity is high, this might be the same user
                    if (similarity > 80 && similarity < 100) { // Not exact match, but very similar
                      potentialMatches.push({
                        platformType: record.platformType,
                        similarKey: recordValue,
                        similarity: Math.round(similarity),
                        matchedField: recordField,
                        originalField: field,
                        originalValue: value,
                        recordId: record.id
                      });
                    }
                  }
                });
              });
            });
          } catch (e) {
            // Skip records with invalid JSON
          }
        });
      } catch (e) {
        console.error('Error searching platform:', platformType.name);
      }
    }

    // Remove duplicates and sort by similarity
    const uniqueMatches = potentialMatches
      .filter((match: any, index: number, self: any[]) => 
        index === self.findIndex((m: any) => 
          m.platformType === match.platformType && 
          m.similarKey === match.similarKey
        )
      )
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, 10); // Limit to top 10 matches

    const result = {
      presentRecords,
      allIdentifiers: allIdentifiersObj,
      potentialMatches: uniqueMatches,
      totalRecords: presentRecords.length,
      platformConfiguration: {
        allPlatforms: platformTypes,
        presentPlatforms: Array.from(presentPlatformNames),
        missingPlatforms: Array.from(missingPlatformNames)
      }
    };

    console.log(`Found ${result.totalRecords} records and ${result.potentialMatches.length} potential matches for user: ${userId}`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching user details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user details' },
      { status: 500 }
    );
  }
}

// Simple string similarity function using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 100;
  }
  
  const editDistance = levenshteinDistance(longer, shorter);
  return ((longer.length - editDistance) / longer.length) * 100;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}
