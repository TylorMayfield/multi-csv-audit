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

    console.log('Performing smart matching analysis for user:', userId);

    // First, find all records for this user
    const userRecords = dbManager.db.prepare(`
      SELECT 
        rud.*,
        pt.name as platformType,
        pt.primary_key_field,
        di.original_filename as importFilename
      FROM raw_user_data rud
      LEFT JOIN platform_types pt ON rud.platform_type_id = pt.id
      LEFT JOIN data_imports di ON rud.import_id = di.id
      WHERE json_extract(rud.processed_data, '$.primaryKey') = ?
    `).all(userId);

    // Find all datasets and analyze their field structures to identify bridge datasets
    const allDatasets = dbManager.db.prepare(`
      SELECT DISTINCT
        pt.name as platformType,
        pt.primary_key_field,
        di.original_filename as filename,
        di.id as importId,
        pt.id as platformTypeId
      FROM raw_user_data rud
      LEFT JOIN platform_types pt ON rud.platform_type_id = pt.id  
      LEFT JOIN data_imports di ON rud.import_id = di.id
      WHERE pt.is_active = 1
    `).all();

    // Analyze each dataset to find available identifier fields
    const bridgeDatasets = [];
    const commonIdentifierFields = ['email', 'username', 'userPrincipalName', 'EmailAddress', 'Username', 'mail', 'sAMAccountName'];

    for (const dataset of allDatasets as any[]) {
      // Sample a few records from this dataset to see what fields are available
      const sampleRecords = dbManager.db.prepare(`
        SELECT raw_data 
        FROM raw_user_data 
        WHERE platform_type_id = ? 
        LIMIT 10
      `).all(dataset.platformTypeId);

      const availableFields = new Set();
      sampleRecords.forEach((record: any) => {
        try {
          const data = JSON.parse(record.raw_data);
          Object.keys(data).forEach(field => {
            const fieldLower = field.toLowerCase();
            if (commonIdentifierFields.some(commonField => 
              fieldLower === commonField.toLowerCase() || 
              fieldLower.includes('email') || 
              fieldLower.includes('user') || 
              fieldLower.includes('name')
            )) {
              availableFields.add(field);
            }
          });
        } catch (e) {
          // Skip invalid JSON
        }
      });

      const fieldsArray = Array.from(availableFields) as string[];
      
      // A dataset is a "bridge" if it has multiple identifier types
      const hasEmail = fieldsArray.some(f => f.toLowerCase().includes('email') || f.toLowerCase() === 'mail');
      const hasUsername = fieldsArray.some(f => f.toLowerCase().includes('user') || f.toLowerCase().includes('name'));
      
      if (hasEmail && hasUsername && fieldsArray.length >= 2) {
        const canBridge = [];
        if (hasEmail) canBridge.push('email-based platforms');
        if (hasUsername) canBridge.push('username-based platforms');
        
        bridgeDatasets.push({
          platformType: dataset.platformType,
          filename: dataset.filename,
          primaryKeyField: dataset.primary_key_field,
          availableFields: fieldsArray,
          canBridge,
          importId: dataset.importId,
          platformTypeId: dataset.platformTypeId
        });
      }
    }

    // Now use bridge datasets to find cross-platform matches for this user
    const crossPlatformMatches: any[] = [];
    
    for (const bridge of bridgeDatasets) {
      // Get records from this bridge dataset that might match our user
      const bridgeRecords = dbManager.db.prepare(`
        SELECT raw_data, processed_data
        FROM raw_user_data 
        WHERE platform_type_id = ?
      `).all(bridge.platformTypeId);

      // Look for records that contain any of the user's known identifiers
      for (const bridgeRecord of bridgeRecords as any[]) {
        try {
          const rawData = JSON.parse(bridgeRecord.raw_data);
          const processedData = JSON.parse(bridgeRecord.processed_data);
          
          // Check if this bridge record matches our user by any identifier
          const userIdentifiers = userRecords.map((ur: any) => {
            try {
              const urRaw = JSON.parse(ur.raw_data);
              return Object.values(urRaw).filter(v => v && typeof v === 'string');
            } catch (e) {
              return [];
            }
          }).flat();

          const bridgeIdentifiers = Object.entries(rawData)
            .filter(([key, value]) => value && typeof value === 'string')
            .map(([key, value]) => ({ field: key, value: value as string }));

          // Find matches between user identifiers and bridge identifiers
          for (const bridgeId of bridgeIdentifiers) {
            if (userIdentifiers.some(ui => 
              typeof ui === 'string' && ui.toLowerCase().trim() === bridgeId.value.toLowerCase().trim()
            )) {
              // This bridge record matches our user! Now find what other identifiers it has
              const otherIdentifiers = bridgeIdentifiers.filter(bi => 
                bi.value.toLowerCase().trim() !== bridgeId.value.toLowerCase().trim()
              );

              // Search for these other identifiers in different platforms
              for (const otherId of otherIdentifiers) {
                const otherPlatformRecords = dbManager.db.prepare(`
                  SELECT DISTINCT
                    pt.name as platformType,
                    pt.primary_key_field,
                    json_extract(rud.processed_data, '$.primaryKey') as primaryKey
                  FROM raw_user_data rud
                  LEFT JOIN platform_types pt ON rud.platform_type_id = pt.id
                  WHERE (
                    json_extract(rud.raw_data, '$.email') = ? OR
                    json_extract(rud.raw_data, '$.username') = ? OR
                    json_extract(rud.raw_data, '$.userPrincipalName') = ? OR
                    json_extract(rud.raw_data, '$.EmailAddress') = ? OR
                    json_extract(rud.raw_data, '$.Username') = ? OR
                    json_extract(rud.raw_data, '$.mail') = ? OR
                    json_extract(rud.raw_data, '$.sAMAccountName') = ?
                  ) AND pt.id != ? AND json_extract(rud.processed_data, '$.primaryKey') != ?
                `).all(
                  otherId.value, otherId.value, otherId.value, otherId.value, 
                  otherId.value, otherId.value, otherId.value,
                  bridge.platformTypeId, userId
                );

                otherPlatformRecords.forEach((otherRecord: any) => {
                  crossPlatformMatches.push({
                    platform1: (userRecords[0] as any)?.platformType || 'Current Platform',
                    platform2: otherRecord.platformType,
                    identifier1: userId,
                    identifier2: otherRecord.primaryKey,
                    bridgeDataset: bridge.platformType,
                    bridgeField1: bridgeId.field,
                    bridgeField2: otherId.field,
                    confidence: 95 // High confidence since we found exact match through bridge
                  });
                });
              }
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }

    // Remove duplicates
    const uniqueMatches = crossPlatformMatches.filter((match: any, index: number, self: any[]) =>
      index === self.findIndex((m: any) => 
        m.platform1 === match.platform1 && 
        m.platform2 === match.platform2 && 
        m.identifier2 === match.identifier2
      )
    );

    // Determine recommended primary key based on analysis
    const fieldUsage = new Map();
    bridgeDatasets.forEach(bridge => {
      bridge.availableFields.forEach(field => {
        const normalizedField = field.toLowerCase();
        if (normalizedField.includes('email') || normalizedField === 'mail') {
          fieldUsage.set('email', (fieldUsage.get('email') || 0) + 1);
        } else if (normalizedField.includes('user') || normalizedField.includes('name')) {
          fieldUsage.set('username', (fieldUsage.get('username') || 0) + 1);
        }
      });
    });

    const recommendedPrimaryKey = fieldUsage.get('email') >= fieldUsage.get('username') ? 'email' : 'username';

    const result = {
      bridgeDatasets,
      crossPlatformMatches: uniqueMatches,
      recommendedPrimaryKey,
      analysis: {
        totalBridgeDatasets: bridgeDatasets.length,
        totalCrossPlatformMatches: uniqueMatches.length,
        fieldUsageStats: Object.fromEntries(fieldUsage)
      }
    };

    console.log(`Smart matching completed. Found ${bridgeDatasets.length} bridge datasets and ${uniqueMatches.length} cross-platform matches`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error performing smart matching:', error);
    return NextResponse.json(
      { error: 'Failed to perform smart matching' },
      { status: 500 }
    );
  }
}
