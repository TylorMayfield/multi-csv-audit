import { NextRequest, NextResponse } from 'next/server'
import dbManager from '@/lib/database/database'

export async function GET() {
  try {
    if (!dbManager.db) {
      throw new Error('Database not initialized')
    }

    // Get all platforms
    const platforms = dbManager.db.prepare(`
      SELECT name FROM platform_types 
      WHERE is_active = 1 
      ORDER BY name
    `).all().map((p: any) => p.name)

    // Get user presence matrix
    const presenceData = dbManager.db.prepare(`
      SELECT 
        mu.primary_key as userId,
        pt.name as platform,
        CASE WHEN upp.id IS NOT NULL THEN 1 ELSE 0 END as present
      FROM master_users mu
      CROSS JOIN platform_types pt
      LEFT JOIN user_platform_presence upp ON mu.id = upp.master_user_id AND pt.id = upp.platform_type_id
      WHERE mu.is_active = 1 AND pt.is_active = 1
      ORDER BY mu.primary_key, pt.name
    `).all()

    // Build matrix object
    const matrix: { [userId: string]: { [platform: string]: boolean } } = {}
    
    presenceData.forEach((row: any) => {
      if (!matrix[row.userId]) {
        matrix[row.userId] = {}
      }
      matrix[row.userId][row.platform] = Boolean(row.present)
    })

    return NextResponse.json({
      platforms,
      matrix
    })
  } catch (error) {
    console.error('Error getting platform matrix:', error)
    return NextResponse.json(
      { error: 'Failed to get platform matrix' },
      { status: 500 }
    )
  }
}
