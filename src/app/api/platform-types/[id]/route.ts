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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureInit();
    
    const awaitedParams = await params;
    const platformTypeId = parseInt(awaitedParams.id);
    
    if (isNaN(platformTypeId)) {
      return NextResponse.json(
        { error: 'Invalid platform type ID' },
        { status: 400 }
      );
    }

    // Check if platform type exists
    const platformType = dbManager.getPlatformTypeById(platformTypeId);
    if (!platformType) {
      return NextResponse.json(
        { error: 'Platform type not found' },
        { status: 404 }
      );
    }

    // Check for force delete parameter
    const url = new URL(request.url);
    const forceDelete = url.searchParams.get('force') === 'true';

    // Check if there are any data imports for this platform type
    const dataImports = (dbManager as any).getDataImports ? (dbManager as any).getDataImports(platformTypeId) : [];
    if (dataImports && dataImports.length > 0) {
      if (!forceDelete) {
        return NextResponse.json(
          { 
            error: 'Cannot delete platform type',
            details: `This platform type has ${dataImports.length} data import(s). Add ?force=true to delete all data and the platform type.`,
            canForceDelete: true,
            dataImports: dataImports.map((imp: any) => ({
              id: imp.id,
              filename: imp.original_filename,
              recordCount: imp.record_count,
              importDate: imp.import_date
            }))
          },
          { status: 409 }
        );
      } else {
        // Force delete - remove all data imports first
        console.log(`Force deleting platform type ${platformTypeId} with ${dataImports.length} data imports`);
        (dbManager as any).deleteAllDataImportsForPlatform(platformTypeId);
      }
    }

    // Perform hard delete of platform type
    const result = dbManager.deletePlatformType(platformTypeId);
    
    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Failed to delete platform type' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: forceDelete 
        ? `Platform type and ${dataImports?.length || 0} associated data import(s) deleted successfully`
        : 'Platform type deleted successfully',
      id: platformTypeId,
      deletedDataImports: forceDelete ? dataImports?.length || 0 : 0
    });
    
  } catch (error) {
    console.error('Failed to delete platform type:', error);
    return NextResponse.json(
      { 
        error: 'Failed to delete platform type',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureInit();
    
    const awaitedParams = await params;
    const platformTypeId = parseInt(awaitedParams.id);
    
    if (isNaN(platformTypeId)) {
      return NextResponse.json(
        { error: 'Invalid platform type ID' },
        { status: 400 }
      );
    }

    const { name, description, columns } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check if platform type exists
    const platformType = dbManager.getPlatformTypeById(platformTypeId);
    if (!platformType) {
      return NextResponse.json(
        { error: 'Platform type not found' },
        { status: 404 }
      );
    }

    // Update platform type
    const updateResult = dbManager.updatePlatformType(platformTypeId, name, description);
    
    // Update schema if columns provided
    if (columns && Array.isArray(columns)) {
      dbManager.createPlatformSchema(platformTypeId, columns);
    }
    
    return NextResponse.json({
      id: platformTypeId,
      name,
      description,
      message: 'Platform type updated successfully'
    });
    
  } catch (error) {
    console.error('Failed to update platform type:', error);
    
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
        error: 'Failed to update platform type',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
