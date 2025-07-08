import { NextRequest, NextResponse } from 'next/server'
import dbManager from '@/lib/database/database'

export async function GET() {
  try {
    if (!dbManager.db) {
      throw new Error('Database not initialized')
    }

    // Get total users
    const totalUsersResult = dbManager.db.prepare(`
      SELECT COUNT(DISTINCT id) as count FROM master_users WHERE is_active = 1
    `).get() as { count: number }
    
    // Get total platforms
    const totalPlatformsResult = dbManager.db.prepare(`
      SELECT COUNT(DISTINCT id) as count FROM platform_types WHERE is_active = 1
    `).get() as { count: number }
    
    // Get missing users (users not present in all platforms)
    // Only count as missing if there are multiple platforms
    const missingUsersResult = dbManager.db.prepare(`
      SELECT 
        CASE 
          WHEN (SELECT COUNT(*) FROM platform_types WHERE is_active = 1) <= 1 THEN 0
          ELSE (
            SELECT COUNT(DISTINCT mu.id)
            FROM master_users mu
            WHERE mu.is_active = 1
            AND EXISTS (
              SELECT 1 FROM platform_types pt
              WHERE pt.is_active = 1
              AND NOT EXISTS (
                SELECT 1 FROM user_platform_presence upp
                WHERE upp.master_user_id = mu.id AND upp.platform_type_id = pt.id
              )
            )
          )
        END as count
    `).get() as { count: number }
    
    // Get duplicate users (users with multiple records in same platform)
    const duplicateUsersResult = dbManager.db.prepare(`
      SELECT COUNT(*) as count
      FROM (
        SELECT json_extract(processed_data, '$.primaryKey') as primaryKey, platform_type_id
        FROM raw_user_data
        WHERE json_extract(processed_data, '$.primaryKey') IS NOT NULL
        GROUP BY json_extract(processed_data, '$.primaryKey'), platform_type_id
        HAVING COUNT(*) > 1
      ) duplicates
    `).get() as { count: number }
    
    // Get recent imports (last 7 days)
    const recentImportsResult = dbManager.db.prepare(`
      SELECT COUNT(*) as count
      FROM data_imports
      WHERE import_date >= datetime('now', '-7 days')
    `).get() as { count: number }
    
    const stats = {
      totalUsers: totalUsersResult.count,
      totalPlatforms: totalPlatformsResult.count,
      missingUsers: missingUsersResult.count,
      duplicateUsers: duplicateUsersResult.count,
      recentImports: recentImportsResult.count
    }
    
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error getting audit stats:', error)
    return NextResponse.json(
      { error: 'Failed to get audit stats' },
      { status: 500 }
    )
  }
}
