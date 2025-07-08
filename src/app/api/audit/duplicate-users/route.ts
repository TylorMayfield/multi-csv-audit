import { NextRequest, NextResponse } from 'next/server'
import dbManager from '@/lib/database/database'

export async function GET() {
  try {
    if (!dbManager.db) {
      throw new Error('Database not initialized')
    }

    const duplicateUsers = dbManager.db.prepare(`
      SELECT 
        json_extract(rud.processed_data, '$.primaryKey') as primaryKey,
        pt.name as platformType,
        COUNT(*) as count,
        json_group_array(json_object(
          'id', rud.id,
          'importId', rud.import_id,
          'importFilename', di.original_filename,
          'importDate', di.import_date,
          'rawData', rud.raw_data
        )) as records
      FROM raw_user_data rud
      JOIN data_imports di ON rud.import_id = di.id
      JOIN platform_types pt ON di.platform_type_id = pt.id
      WHERE json_extract(rud.raw_data, '$._merged') IS NULL
      GROUP BY json_extract(rud.processed_data, '$.primaryKey'), di.platform_type_id
      HAVING COUNT(*) > 1 AND json_extract(rud.processed_data, '$.primaryKey') IS NOT NULL
      ORDER BY count DESC, primaryKey
    `).all()

    // Process results to parse JSON records
    const processedResults = duplicateUsers.map((user: any) => ({
      primaryKey: user.primaryKey,
      platformType: user.platformType,
      count: user.count,
      records: JSON.parse(user.records)
    }))

    return NextResponse.json(processedResults)
  } catch (error) {
    console.error('Error getting duplicate users:', error)
    return NextResponse.json(
      { error: 'Failed to get duplicate users' },
      { status: 500 }
    )
  }
}
