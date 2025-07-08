import { NextRequest, NextResponse } from 'next/server'
import dbManager from '@/lib/database/database'

export async function POST(request: NextRequest) {
  try {
    if (!dbManager.db) {
      throw new Error('Database not initialized')
    }

    const { primaryKey, platformType } = await request.json()

    if (!primaryKey || !platformType) {
      return NextResponse.json(
        { error: 'Primary key and platform type are required' },
        { status: 400 }
      )
    }

    // Get all duplicate records for this user and platform
    const duplicateRecords = dbManager.db.prepare(`
      SELECT 
        rud.id,
        rud.import_id,
        rud.raw_data,
        rud.processed_data,
        di.original_filename,
        di.import_date
      FROM raw_user_data rud
      JOIN data_imports di ON rud.import_id = di.id
      JOIN platform_types pt ON di.platform_type_id = pt.id
      WHERE json_extract(rud.processed_data, '$.primaryKey') = ? 
        AND pt.name = ?
      ORDER BY di.import_date DESC
    `).all(primaryKey, platformType)

    if (duplicateRecords.length <= 1) {
      return NextResponse.json(
        { error: 'No duplicates found to merge' },
        { status: 400 }
      )
    }

    // Parse the raw data for each record
    const parsedRecords = duplicateRecords.map((record: any) => ({
      id: record.id,
      import_id: record.import_id,
      original_filename: record.original_filename,
      import_date: record.import_date,
      rawData: JSON.parse(record.raw_data),
      processedData: record.processed_data ? JSON.parse(record.processed_data) : null
    }))

    // Perform smart merge
    const mergedRecord = performSmartMerge(parsedRecords)

    // Update the most recent record with merged data and mark others as merged
    const mostRecentRecord = parsedRecords[0]
    
    // Update the most recent record with merged data
    dbManager.db.prepare(`
      UPDATE raw_user_data 
      SET raw_data = ?, processed_data = ?
      WHERE id = ?
    `).run(
      JSON.stringify(mergedRecord.mergedData),
      JSON.stringify(mergedRecord.processedData),
      mostRecentRecord.id
    )

    // Mark other records as merged (add a merged flag to raw_data)
    for (let i = 1; i < parsedRecords.length; i++) {
      const record = parsedRecords[i]
      const updatedRawData = {
        ...record.rawData,
        _merged: true,
        _mergedInto: mostRecentRecord.id,
        _mergedAt: new Date().toISOString()
      }

      dbManager.db.prepare(`
        UPDATE raw_user_data 
        SET raw_data = ?
        WHERE id = ?
      `).run(
        JSON.stringify(updatedRawData),
        record.id
      )
    }

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${duplicateRecords.length} duplicate records`,
      mergedRecord: {
        id: mostRecentRecord.id,
        data: mergedRecord.mergedData,
        conflicts: mergedRecord.conflicts,
        mergedCount: duplicateRecords.length - 1
      }
    })

  } catch (error) {
    console.error('Error merging duplicates:', error)
    return NextResponse.json(
      { error: 'Failed to merge duplicate records' },
      { status: 500 }
    )
  }
}

interface ParsedRecord {
  id: number
  import_id: number
  rawData: Record<string, any>
  processedData: Record<string, any> | null
  original_filename: string
  import_date: string
}

interface MergeResult {
  mergedData: Record<string, any>
  processedData: Record<string, any>
  conflicts: Array<{
    field: string
    values: Array<{ value: any, source: string }>
  }>
}

function performSmartMerge(records: ParsedRecord[]): MergeResult {
  const mergedData: Record<string, any> = {}
  const conflicts: Array<{
    field: string
    values: Array<{ value: any, source: string }>
  }> = []

  // Get all unique field names across all records
  const allFields = new Set<string>()
  records.forEach(record => {
    Object.keys(record.rawData).forEach(field => {
      if (!field.startsWith('_')) { // Skip internal fields
        allFields.add(field)
      }
    })
  })

  // Process each field
  allFields.forEach(field => {
    const fieldValues: Array<{ value: any, source: string, recordId: number }> = []
    
    // Collect all non-empty values for this field
    records.forEach(record => {
      const value = record.rawData[field]
      if (value !== undefined && value !== null && value !== '') {
        const normalizedValue = typeof value === 'string' ? value.trim() : value
        if (normalizedValue !== '') {
          fieldValues.push({
            value: normalizedValue,
            source: record.original_filename,
            recordId: record.id
          })
        }
      }
    })

    if (fieldValues.length === 0) {
      // No values for this field
      return
    }

    if (fieldValues.length === 1) {
      // Only one value, use it
      mergedData[field] = fieldValues[0].value
      return
    }

    // Check if all values are the same
    const uniqueValues = new Set(fieldValues.map(fv => JSON.stringify(fv.value)))
    
    if (uniqueValues.size === 1) {
      // All values are the same, use the first one
      mergedData[field] = fieldValues[0].value
      return
    }

    // Handle conflicts based on field type
    const mergeStrategy = determineMergeStrategy(field, fieldValues)
    
    switch (mergeStrategy.type) {
      case 'latest':
        // Use the value from the most recent import
        mergedData[field] = fieldValues[0].value
        break
        
      case 'concatenate':
        // Concatenate unique values
        const uniqueStringValues = [...new Set(fieldValues.map(fv => String(fv.value)))]
        mergedData[field] = uniqueStringValues.join(' | ')
        break
        
      case 'array':
        // Store as array to preserve all values
        mergedData[field] = fieldValues.map(fv => ({
          value: fv.value,
          source: fv.source
        }))
        break
        
      case 'conflict':
      default:
        // Mark as conflict and use the most recent value
        mergedData[field] = fieldValues[0].value
        conflicts.push({
          field,
          values: fieldValues.map(fv => ({
            value: fv.value,
            source: fv.source
          }))
        })
        break
    }
  })

  // Create processed data for the merged record
  const processedData = {
    primaryKey: records[0].processedData?.primaryKey || extractPrimaryKey(mergedData),
    firstName: extractFirstName(mergedData),
    lastName: extractLastName(mergedData),
    email: extractEmail(mergedData),
    username: extractUsername(mergedData),
    mergedAt: new Date().toISOString(),
    mergedFrom: records.length,
    conflicts: conflicts.length
  }

  return {
    mergedData,
    processedData,
    conflicts
  }
}

function determineMergeStrategy(field: string, values: Array<{ value: any, source: string, recordId: number }>) {
  const fieldLower = field.toLowerCase()
  
  // Date fields - use latest
  if (fieldLower.includes('date') || fieldLower.includes('time') || fieldLower.includes('last')) {
    return { type: 'latest' }
  }
  
  // Device-specific fields that should be kept separate
  if (fieldLower.includes('device') || fieldLower.includes('model') || 
      fieldLower.includes('imei') || fieldLower.includes('serial')) {
    return { type: 'array' }
  }
  
  // Status fields - use latest
  if (fieldLower.includes('status') || fieldLower.includes('active')) {
    return { type: 'latest' }
  }
  
  // Description fields - concatenate
  if (fieldLower.includes('description') || fieldLower.includes('note')) {
    return { type: 'concatenate' }
  }
  
  // Default to conflict for other fields
  return { type: 'conflict' }
}

function extractPrimaryKey(data: Record<string, any>): string {
  // Common primary key field patterns
  const keyFields = ['username', 'user', 'userid', 'login', 'email']
  
  for (const field of keyFields) {
    const value = findFieldValue(data, field)
    if (value) {
      return String(value).toLowerCase()
    }
  }
  
  // Fallback: try to construct from name fields
  const firstName = extractFirstName(data)
  const lastName = extractLastName(data)
  
  if (firstName && lastName) {
    return `${firstName.charAt(0).toLowerCase()}${lastName.toLowerCase()}`
  }
  
  return 'unknown'
}

function extractFirstName(data: Record<string, any>): string | null {
  return findFieldValue(data, ['firstname', 'first_name', 'given_name'])
}

function extractLastName(data: Record<string, any>): string | null {
  return findFieldValue(data, ['lastname', 'last_name', 'surname', 'family_name'])
}

function extractEmail(data: Record<string, any>): string | null {
  return findFieldValue(data, ['email', 'email_address', 'mail'])
}

function extractUsername(data: Record<string, any>): string | null {
  return findFieldValue(data, ['username', 'user', 'userid', 'login'])
}

function findFieldValue(data: Record<string, any>, fieldNames: string | string[]): string | null {
  const fields = Array.isArray(fieldNames) ? fieldNames : [fieldNames]
  
  for (const field of fields) {
    // Try exact match first
    if (data[field]) {
      return String(data[field]).trim()
    }
    
    // Try case-insensitive match
    const lowerField = field.toLowerCase()
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase() === lowerField && value) {
        return String(value).trim()
      }
    }
    
    // Try partial match
    for (const [key, value] of Object.entries(data)) {
      if (key.toLowerCase().includes(lowerField) && value) {
        return String(value).trim()
      }
    }
  }
  
  return null
}
