import { NextRequest, NextResponse } from 'next/server';
import dbManager from '@/lib/database/database';

export async function GET(request: NextRequest) {
  try {
    if (!dbManager.db) {
      throw new Error('Database not initialized');
    }

    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('type') || 'comprehensive';

    let csvContent = '';
    let filename = '';

    switch (exportType) {
      case 'comprehensive':
        csvContent = await generateComprehensiveReport();
        filename = `user-audit-comprehensive-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      
      case 'missing-users':
        csvContent = await generateMissingUsersReport();
        filename = `missing-users-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      
      case 'duplicates':
        csvContent = await generateDuplicatesReport();
        filename = `duplicate-users-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      
      case 'all-users':
        csvContent = await generateAllUsersReport();
        filename = `all-users-${new Date().toISOString().split('T')[0]}.csv`;
        break;
      
      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating export:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}

async function generateComprehensiveReport(): Promise<string> {
  if (!dbManager.db) {
    throw new Error('Database not initialized');
  }

  const query = `
    SELECT 
      mu.primary_key,
      mu.first_name,
      mu.last_name,
      mu.email,
      mu.username,
      pt.name as platform,
      di.original_filename,
      di.import_date,
      CASE 
        WHEN mu.display_name IS NOT NULL AND mu.display_name != '' 
        THEN mu.display_name
        WHEN mu.first_name IS NOT NULL AND mu.last_name IS NOT NULL 
        THEN mu.first_name || ' ' || mu.last_name
        ELSE COALESCE(mu.username, mu.email, mu.primary_key)
      END as display_name
    FROM master_users mu
    JOIN user_platform_presence upp ON mu.id = upp.master_user_id
    JOIN data_imports di ON upp.import_id = di.id
    JOIN platform_types pt ON di.platform_type_id = pt.id
    WHERE mu.is_active = 1 AND pt.is_active = 1 AND upp.is_active = 1
    ORDER BY mu.primary_key, pt.name
  `;

  const records = dbManager.db.prepare(query).all();
  
  let csv = 'Primary Key,Display Name,Email,Username,Platform,Filename,Import Date\n';
  
  records.forEach((record: any) => {
    csv += `"${record.primary_key}","${record.display_name}","${record.email || ''}","${record.username || ''}","${record.platform}","${record.original_filename}","${record.import_date}"\n`;
  });

  return csv;
}

async function generateMissingUsersReport(): Promise<string> {
  if (!dbManager.db) {
    throw new Error('Database not initialized');
  }

  // Get all platforms
  const platforms = dbManager.db.prepare(`
    SELECT DISTINCT pt.name 
    FROM platform_types pt 
    JOIN data_imports di ON pt.id = di.platform_type_id
    WHERE pt.is_active = 1
    ORDER BY pt.name
  `).all() as { name: string }[];

  if (platforms.length <= 1) {
    return 'No missing users report available - need at least 2 platforms\n';
  }

  // Get users and their platforms
  const userPlatforms = dbManager.db.prepare(`
    SELECT DISTINCT
      mu.primary_key,
      pt.name as platform,
      CASE 
        WHEN mu.display_name IS NOT NULL AND mu.display_name != '' 
        THEN mu.display_name
        WHEN mu.first_name IS NOT NULL AND mu.last_name IS NOT NULL 
        THEN mu.first_name || ' ' || mu.last_name
        ELSE COALESCE(mu.username, mu.email, mu.primary_key)
      END as display_name,
      mu.email,
      mu.username
    FROM master_users mu
    JOIN user_platform_presence upp ON mu.id = upp.master_user_id
    JOIN data_imports di ON upp.import_id = di.id
    JOIN platform_types pt ON di.platform_type_id = pt.id
    WHERE mu.is_active = 1 AND pt.is_active = 1 AND upp.is_active = 1
    ORDER BY mu.primary_key
  `).all();

  // Group by user
  const usersMap = new Map<string, { displayName: string, email: string, username: string, platforms: Set<string> }>();
  
  userPlatforms.forEach((record: any) => {
    if (!usersMap.has(record.primary_key)) {
      usersMap.set(record.primary_key, {
        displayName: record.display_name,
        email: record.email,
        username: record.username,
        platforms: new Set()
      });
    }
    usersMap.get(record.primary_key)!.platforms.add(record.platform);
  });

  let csv = 'Primary Key,Display Name,Email,Username,Present In,Missing From\n';

  // Find users missing from any platform
  usersMap.forEach((user, primaryKey) => {
    if (user.platforms.size < platforms.length) {
      const presentIn = Array.from(user.platforms).join('; ');
      const missingFrom = platforms
        .filter(p => !user.platforms.has(p.name))
        .map(p => p.name)
        .join('; ');
      
      csv += `"${primaryKey}","${user.displayName}","${user.email || ''}","${user.username || ''}","${presentIn}","${missingFrom}"\n`;
    }
  });

  return csv;
}

async function generateDuplicatesReport(): Promise<string> {
  if (!dbManager.db) {
    throw new Error('Database not initialized');
  }

  const query = `
    SELECT 
      mu.primary_key,
      COUNT(*) as count,
      GROUP_CONCAT(DISTINCT pt.name) as platforms,
      MAX(CASE 
        WHEN mu.display_name IS NOT NULL AND mu.display_name != '' 
        THEN mu.display_name
        WHEN mu.first_name IS NOT NULL AND mu.last_name IS NOT NULL 
        THEN mu.first_name || ' ' || mu.last_name
        ELSE COALESCE(mu.username, mu.email, mu.primary_key)
      END) as display_name,
      MAX(mu.email) as email,
      MAX(mu.username) as username
    FROM master_users mu
    JOIN user_platform_presence upp ON mu.id = upp.master_user_id
    JOIN data_imports di ON upp.import_id = di.id
    JOIN platform_types pt ON di.platform_type_id = pt.id
    WHERE mu.is_active = 1 AND pt.is_active = 1 AND upp.is_active = 1
    GROUP BY mu.primary_key
    HAVING COUNT(*) > 1
    ORDER BY count DESC, mu.primary_key
  `;

  const duplicates = dbManager.db.prepare(query).all();
  
  let csv = 'Primary Key,Display Name,Email,Username,Count,Platforms\n';
  
  duplicates.forEach((record: any) => {
    csv += `"${record.primary_key}","${record.display_name}","${record.email || ''}","${record.username || ''}","${record.count}","${record.platforms}"\n`;
  });

  return csv;
}

async function generateAllUsersReport(): Promise<string> {
  if (!dbManager.db) {
    throw new Error('Database not initialized');
  }

  const query = `
    SELECT 
      mu.primary_key,
      CASE 
        WHEN mu.display_name IS NOT NULL AND mu.display_name != '' 
        THEN mu.display_name
        WHEN mu.first_name IS NOT NULL AND mu.last_name IS NOT NULL 
        THEN mu.first_name || ' ' || mu.last_name
        ELSE COALESCE(mu.username, mu.email, mu.primary_key)
      END as display_name,
      mu.email,
      mu.username,
      GROUP_CONCAT(DISTINCT pt.name) as platforms,
      COUNT(DISTINCT pt.id) as platform_count
    FROM master_users mu
    JOIN user_platform_presence upp ON mu.id = upp.master_user_id
    JOIN data_imports di ON upp.import_id = di.id
    JOIN platform_types pt ON di.platform_type_id = pt.id
    WHERE mu.is_active = 1 AND pt.is_active = 1 AND upp.is_active = 1
    GROUP BY mu.primary_key
    ORDER BY mu.primary_key
  `;

  const users = dbManager.db.prepare(query).all();
  
  let csv = 'Primary Key,Display Name,Email,Username,Platforms,Platform Count\n';
  
  users.forEach((record: any) => {
    csv += `"${record.primary_key}","${record.display_name}","${record.email || ''}","${record.username || ''}","${record.platforms}","${record.platform_count}"\n`;
  });

  return csv;
}
