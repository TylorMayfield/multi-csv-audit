import { NextRequest, NextResponse } from 'next/server'
import dbManager from '@/lib/database/database'

export async function GET() {
  try {
    if (!dbManager.db) {
      throw new Error('Database not initialized')
    }

    const uploadedFiles = dbManager.db.prepare(`
      SELECT 
        di.id,
        di.original_filename,
        di.file_path,
        di.record_count,
        di.import_date,
        di.import_status,
        pt.name as platform_name,
        pt.version as platform_version
      FROM data_imports di
      LEFT JOIN platform_types pt ON di.platform_type_id = pt.id
      ORDER BY di.import_date DESC
      LIMIT 50
    `).all()

    return NextResponse.json(uploadedFiles)
  } catch (error) {
    console.error('Error getting uploaded files:', error)
    return NextResponse.json(
      { error: 'Failed to get uploaded files' },
      { status: 500 }
    )
  }
}
