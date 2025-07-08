import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { parse } from 'csv-parse';
import { Readable } from 'stream';
import dbManager from '@/lib/database/database';
import userConsolidationService from '@/lib/services/UserConsolidationService';
import { ensureDirectories, UPLOADS_DIR, PROCESSED_DIR } from '@/lib/config';
import type { PlatformType } from '@/lib/types';

// Initialize directories on first API call
let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await ensureDirectories();
    initialized = true;
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureInit();
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const platformTypeId = formData.get('type') as string;
    
    if (!file) {
      return NextResponse.json(
        { 
          error: 'No file uploaded',
          details: 'Please select a file to upload'
        },
        { status: 400 }
      );
    }

    if (!platformTypeId) {
      return NextResponse.json(
        { 
          error: 'No platform type specified',
          details: 'Please select a platform type for the file'
        },
        { status: 400 }
      );
    }

    const platformTypeIdNum = parseInt(platformTypeId);
    
    // Validate platform type exists
    const platformType = dbManager.getPlatformTypeById(platformTypeIdNum) as PlatformType | null;
    if (!platformType) {
      return NextResponse.json(
        { 
          error: 'Invalid platform type',
          details: 'The specified platform type does not exist'
        },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { 
          error: 'Invalid file type',
          details: 'Only CSV files are allowed'
        },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.round(Math.random() * 1e9);
    const filename = `${timestamp}-${randomId}-${file.name}`;
    const filePath = join(UPLOADS_DIR, filename);

    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create data import record
    const importResult = dbManager.createDataImport(
      platformTypeIdNum,
      filename,
      file.name,
      filePath,
      0, // Will be updated after parsing
      null // createdBy - could be added from auth
    );
    
    const importId = importResult.lastInsertRowid;

    // Parse CSV
    const csvContent = buffer.toString('utf-8');
    const records: any[] = [];
    
    try {
      await new Promise((resolve, reject) => {
        const parser = parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          bom: true
        });

        parser.on('readable', function() {
          let record;
          while ((record = parser.read()) !== null) {
            records.push(record);
          }
        });

        parser.on('error', reject);
        parser.on('end', resolve);

        // Create a readable stream from the CSV content
        const stream = Readable.from([csvContent]);
        stream.pipe(parser);
      });
    } catch (parseError) {
      console.error('CSV parsing error:', parseError);
      
      // Update import status
      (dbManager as any).updateDataImportStatus(importId, 'failed', 
        parseError instanceof Error ? parseError.message : 'Parse error');
      
      return NextResponse.json(
        { 
          error: 'Failed to parse CSV file',
          details: parseError instanceof Error ? parseError.message : 'Parse error',
          type: 'PARSE_ERROR'
        },
        { status: 400 }
      );
    }

    if (records.length === 0) {
      // Update import status
      (dbManager as any).updateDataImportStatus(importId, 'failed', 'Empty CSV file');
      
      return NextResponse.json(
        { 
          error: 'Empty CSV file',
          details: 'The uploaded CSV file contains no records',
          type: 'EMPTY_FILE'
        },
        { status: 400 }
      );
    }

    // Update record count
    dbManager.updateDataImportStatus(importId, 'completed', null);
    
    // Process and consolidate user data
    const consolidationResults = await userConsolidationService.processImportedData(
      importId,
      platformTypeIdNum,
      records
    );

    // Save processed records as JSON for backup
    const processedPath = join(PROCESSED_DIR, `${filename}.json`);
    await writeFile(processedPath, JSON.stringify({
      importId,
      platformTypeId: platformTypeIdNum,
      records,
      consolidationResults,
      processedAt: new Date().toISOString()
    }, null, 2));

    // Create response
    const response = {
      message: 'File uploaded and processed successfully',
      importId,
      platformType: platformType.name,
      data: {
        originalName: file.name,
        filename,
        platformTypeId: platformTypeIdNum,
        uploadDate: new Date().toISOString(),
        recordCount: records.length,
        columns: Object.keys(records[0])
      },
      consolidationResults
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload and process file',
        details: error instanceof Error ? error.message : 'Unknown error',
        type: 'UNKNOWN_ERROR'
      },
      { status: 500 }
    );
  }
}
