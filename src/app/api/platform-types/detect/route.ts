import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database/database';

export async function POST(request: NextRequest) {
  try {
    const { columns } = await request.json();
    
    if (!columns || !Array.isArray(columns)) {
      return NextResponse.json(
        { error: 'Invalid columns provided' },
        { status: 400 }
      );
    }

    // Try to find a matching platform type
    const matchingPlatformType = dbManager.findMatchingPlatformType(columns);
    
    if (matchingPlatformType) {
      return NextResponse.json({
        success: true,
        match: true,
        platformType: matchingPlatformType,
        message: `Found matching platform type: ${matchingPlatformType.name}`
      });
    } else {
      return NextResponse.json({
        success: true,
        match: false,
        platformType: null,
        message: 'No matching platform type found'
      });
    }
  } catch (error) {
    console.error('Error detecting platform type:', error);
    return NextResponse.json(
      { 
        error: 'Failed to detect platform type',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
