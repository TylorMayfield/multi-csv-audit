import { NextRequest, NextResponse } from 'next/server'
import dbManager from '@/lib/database/database'

export async function GET() {
  try {
    if (!dbManager.db) {
      throw new Error('Database not initialized')
    }

    // Check if we have multiple platforms - if not, return empty array
    const platformCountResult = dbManager.db.prepare(`
      SELECT COUNT(*) as count FROM platform_types WHERE is_active = 1
    `).get() as { count: number }

    if (platformCountResult.count <= 1) {
      return NextResponse.json([])
    }

    const missingUsers = dbManager.db.prepare(`
      SELECT 
        mu.id as userId,
        mu.primary_key,
        GROUP_CONCAT(DISTINCT pt_present.name) as presentPlatforms,
        GROUP_CONCAT(DISTINCT pt_missing.name) as missingPlatforms
      FROM master_users mu
      LEFT JOIN user_platform_presence upp_present ON mu.id = upp_present.master_user_id
      LEFT JOIN platform_types pt_present ON upp_present.platform_type_id = pt_present.id AND pt_present.is_active = 1
      CROSS JOIN platform_types pt_missing 
      WHERE mu.is_active = 1 
        AND pt_missing.is_active = 1
        AND NOT EXISTS (
          SELECT 1 FROM user_platform_presence upp_check 
          WHERE upp_check.master_user_id = mu.id 
          AND upp_check.platform_type_id = pt_missing.id
        )
      GROUP BY mu.id, mu.primary_key
      HAVING missingPlatforms IS NOT NULL AND presentPlatforms IS NOT NULL
      ORDER BY mu.primary_key
    `).all()

    // Process results to format properly
    const processedResults = missingUsers.map((user: any) => ({
      userId: user.userId,
      primaryKey: user.primary_key,
      presentPlatforms: user.presentPlatforms ? user.presentPlatforms.split(',') : [],
      missingPlatforms: user.missingPlatforms ? user.missingPlatforms.split(',') : []
    }))

    return NextResponse.json(processedResults)
  } catch (error) {
    console.error('Error getting missing users:', error)
    return NextResponse.json(
      { error: 'Failed to get missing users' },
      { status: 500 }
    )
  }
}
