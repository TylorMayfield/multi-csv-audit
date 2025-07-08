/**
 * Utility functions for extracting and formatting user names from various data sources
 */

export interface UserNameData {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  username?: string | null;
  primary_key?: string;
}

/**
 * Extract a readable display name from user data
 * Prioritizes display_name, then constructs from first/last name,
 * then attempts to parse from username/email, finally falls back to email/primary_key
 */
export function getDisplayName(userData: UserNameData): string {
  // If we have a proper display name that's not just the primary key, use it
  if (userData.display_name && 
      userData.display_name.trim() && 
      userData.display_name !== userData.primary_key &&
      userData.display_name !== userData.email &&
      userData.display_name.toLowerCase() !== 'undefined undefined') {
    return userData.display_name.trim();
  }
  
  // If we have first and last name, use them
  if (userData.first_name && userData.last_name) {
    return `${userData.first_name} ${userData.last_name}`.trim();
  }
  
  // Try to extract from username or email local part
  const localPart = userData.username || 
                   (userData.email ? userData.email.split('@')[0] : null) || 
                   (userData.primary_key ? userData.primary_key.split('@')[0] : null);
  
  if (localPart && localPart.length > 1) {
    // Check if it looks like firstInitial + lastName pattern (e.g., "jsmith", "aalexander")
    if (/^[a-z][a-z]+$/i.test(localPart)) {
      const firstInitial = localPart.charAt(0).toUpperCase();
      const restOfName = localPart.slice(1);
      
      // Capitalize first letter of what might be last name
      const lastName = restOfName.charAt(0).toUpperCase() + restOfName.slice(1);
      
      return `${firstInitial}. ${lastName}`;
    }
    
    // If it has numbers or special chars, might be a more complex username
    // Just capitalize it nicely
    if (localPart.length > 2) {
      return localPart.charAt(0).toUpperCase() + localPart.slice(1);
    }
  }
  
  // Fallback to email or primary key
  return userData.email || userData.primary_key || 'Unknown User';
}

/**
 * Extract initials from a name or email
 */
export function getInitials(userData: UserNameData): string {
  // Try display name first
  if (userData.display_name && userData.display_name.trim() && userData.display_name.includes(' ')) {
    const parts = userData.display_name.trim().split(' ');
    return parts.map(part => part.charAt(0).toUpperCase()).join('');
  }
  
  // Try first/last name
  if (userData.first_name && userData.last_name) {
    return `${userData.first_name.charAt(0)}${userData.last_name.charAt(0)}`.toUpperCase();
  }
  
  // Extract from username or email
  const localPart = userData.username || 
                   (userData.email ? userData.email.split('@')[0] : null) || 
                   (userData.primary_key ? userData.primary_key.split('@')[0] : null);
  
  if (localPart && localPart.length > 1) {
    // If it looks like firstInitial + lastName, use first char + second char
    if (/^[a-z][a-z]+$/i.test(localPart)) {
      return `${localPart.charAt(0)}${localPart.charAt(1)}`.toUpperCase();
    }
  }
  
  // Final fallback
  const displayName = getDisplayName(userData);
  return displayName.charAt(0).toUpperCase();
}

/**
 * Check if a name looks like it might be "undefined undefined" or similar placeholder
 */
export function isPlaceholderName(name: string): boolean {
  if (!name) return true;
  
  const normalized = name.toLowerCase().trim();
  return normalized === 'undefined undefined' || 
         normalized === 'null null' || 
         normalized === '' ||
         normalized === 'undefined' ||
         normalized === 'null';
}
