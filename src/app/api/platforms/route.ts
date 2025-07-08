import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database/database';

export async function GET(request: NextRequest) {
  try {
    if (!dbManager.db) {
      throw new Error('Database not initialized');
    }

    const platforms = dbManager.db.prepare(`
      SELECT DISTINCT 
        pt.id,
        pt.name,
        pt.description as display_name
      FROM platform_types pt
      JOIN data_imports di ON pt.id = di.platform_type_id
      WHERE pt.is_active = 1
      ORDER BY pt.name
    `).all();

    return NextResponse.json(platforms);
  } catch (error) {
    console.error('Error fetching platforms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platforms' },
      { status: 500 }
    );
  }
}
