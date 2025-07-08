import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database/database';
import { getDisplayName } from '@/lib/utils/nameUtils';

export async function GET(request: NextRequest) {
  try {
    if (!dbManager.db) {
      throw new Error('Database not initialized');
    }
    
    // Get all unique users across all platforms
    const query = `
      SELECT DISTINCT
        mu.primary_key,
        mu.first_name,
        mu.last_name,
        mu.email,
        mu.username,
        mu.display_name,
        pt.name as platform_name,
        pt.description as platform_display_name
      FROM master_users mu
      JOIN user_platform_presence upp ON mu.id = upp.master_user_id
      JOIN platform_types pt ON upp.platform_type_id = pt.id
      WHERE mu.is_active = 1 AND pt.is_active = 1
      ORDER BY mu.primary_key
    `;
    
    const records = dbManager.db.prepare(query).all();
    
    // Group by primary key to create user objects
    const usersMap = new Map();
    
    records.forEach((record: any) => {
      const primaryKey = record.primary_key;
      
      if (!usersMap.has(primaryKey)) {
        usersMap.set(primaryKey, {
          primaryKey,
          displayName: getDisplayName({
            first_name: record.first_name,
            last_name: record.last_name,
            display_name: record.display_name,
            email: record.email,
            username: record.username,
            primary_key: record.primary_key
          }),
          email: record.email,
          username: record.username,
          platforms: []
        });
      }
      
      const user = usersMap.get(primaryKey);
      const platformDisplay = record.platform_display_name || record.platform_name;
      if (!user.platforms.includes(platformDisplay)) {
        user.platforms.push(platformDisplay);
      }
    });
    
    const users = Array.from(usersMap.values());
    
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch all users' },
      { status: 500 }
    );
  }
}
