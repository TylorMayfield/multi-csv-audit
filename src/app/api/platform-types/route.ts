import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database/database';
import { ensureDirectories } from '@/lib/config';

// Initialize directories on first API call
let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await ensureDirectories();
    initialized = true;
  }
}

export async function GET() {
  try {
    await ensureInit();
    const platformTypes = dbManager.getPlatformTypes();
    return NextResponse.json(platformTypes);
  } catch (error) {
    console.error('Failed to fetch platform types:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch platform types',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInit();
    const { name, description, columns } = await request.json();
    
    console.log('Received data:', { name, description, columns });
    
    if (!name || !columns || !Array.isArray(columns)) {
      return NextResponse.json(
        { 
          error: 'Name and columns are required',
          details: 'Please provide a name and an array of column definitions'
        },
        { status: 400 }
      );
    }

    // Create platform type
    const result = dbManager.createPlatformType(name, description);
    const platformTypeId = result.lastInsertRowid;
    
    console.log('Platform type created with ID:', platformTypeId);
    console.log('Columns to create schema for:', columns);
    
    // Create schema
    if (columns.length > 0) {
      dbManager.createPlatformSchema(platformTypeId, columns);
    }
    
    return NextResponse.json({
      id: platformTypeId,
      name,
      description,
      message: 'Platform type created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create platform type:', error);
    
    // Handle unique constraint violations
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json(
        { 
          error: 'Platform type name already exists',
          details: 'Please choose a different name'
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create platform type',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
