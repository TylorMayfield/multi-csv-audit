import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database/database';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!dbManager.db) {
      throw new Error('Database not initialized');
    }

    console.log('Searching for user in CSV files:', userId);

    // Get all uploaded files
    const uploadedFiles = dbManager.db.prepare(`
      SELECT * FROM data_imports
      ORDER BY import_date DESC
    `).all();

    const searchResults = {
      foundInFiles: [] as any[],
      notFoundInFiles: [] as any[],
      searchTerm: userId
    };

    // Get uploads directory path - first check server uploads, then main uploads
    const serverUploadsDir = path.join(process.cwd(), 'server', 'data', 'uploads');
    const mainUploadsDir = path.join(process.cwd(), 'data', 'uploads');
    
    for (const file of uploadedFiles as any[]) {
      try {
        // Try to find the file in either uploads directory
        let filePath = path.join(serverUploadsDir, file.filename);
        if (!fs.existsSync(filePath)) {
          filePath = path.join(mainUploadsDir, file.filename);
        }

        if (!fs.existsSync(filePath)) {
          searchResults.notFoundInFiles.push({
            filename: file.original_filename,
            reason: 'File not found on disk',
            importDate: file.import_date
          });
          continue;
        }

        // Read and parse the CSV file
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const records = parse(fileContent, { 
          columns: true, 
          skip_empty_lines: true,
          trim: true 
        });

        // Search for the user in all columns
        const matches = [];
        const searchTermLower = userId.toLowerCase().trim();

        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          let found = false;
          const matchingFields = [];

          // Check each field in the record
          for (const [field, value] of Object.entries(record)) {
            if (value && typeof value === 'string') {
              const valueLower = value.toLowerCase().trim();
              if (valueLower === searchTermLower || valueLower.includes(searchTermLower)) {
                found = true;
                matchingFields.push({
                  field,
                  value: value.toString(),
                  exactMatch: valueLower === searchTermLower
                });
              }
            }
          }

          if (found) {
            matches.push({
              rowNumber: i + 2, // +2 because CSV is 1-indexed and we skip header
              matchingFields,
              fullRecord: record
            });
          }
        }

        if (matches.length > 0) {
          searchResults.foundInFiles.push({
            filename: file.original_filename,
            matches: matches.length,
            importDate: file.import_date,
            platformType: file.platform_type_name || 'Unknown',
            matchDetails: matches.slice(0, 5) // Limit to first 5 matches for performance
          });
        } else {
          searchResults.notFoundInFiles.push({
            filename: file.original_filename,
            reason: 'User not found in file',
            importDate: file.import_date,
            platformType: file.platform_type_name || 'Unknown',
            totalRecords: records.length
          });
        }

      } catch (error) {
        console.error(`Error searching file ${file.original_filename}:`, error);
        searchResults.notFoundInFiles.push({
          filename: file.original_filename,
          reason: `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`,
          importDate: file.import_date
        });
      }
    }

    console.log(`Search completed. Found in ${searchResults.foundInFiles.length} files, not found in ${searchResults.notFoundInFiles.length} files`);

    return NextResponse.json(searchResults);
  } catch (error) {
    console.error('Error searching for user in files:', error);
    return NextResponse.json(
      { error: 'Failed to search for user in files' },
      { status: 500 }
    );
  }
}
