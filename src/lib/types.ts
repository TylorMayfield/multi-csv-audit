export interface PlatformType {
  id: number;
  name: string;
  description: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformSchema {
  id: number;
  platform_type_id: number;
  column_name: string;
  column_type: string;
  is_required: boolean;
  is_identifier: boolean;
  is_primary_key: boolean;
  validation_rules: string | null;
  created_at: string;
}

export interface DataImport {
  id: number;
  platform_type_id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  record_count: number;
  import_date: string;
  import_status: string;
  error_message: string | null;
  created_by: string | null;
}

export interface MasterUser {
  id: number;
  primary_key: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPlatformPresence {
  id: number;
  master_user_id: number;
  platform_type_id: number;
  import_id: number;
  raw_data_id: number;
  platform_user_id: string | null;
  is_active: boolean;
  last_seen_date: string | null;
  platform_specific_data: string | null;
  created_at: string;
  updated_at: string;
}
