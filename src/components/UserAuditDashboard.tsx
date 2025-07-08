'use client'

import { useState, useEffect } from "react";
import { 
  UsersIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  DocumentIcon,
  CheckIcon,
  XMarkIcon,
  CogIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface AuditStats {
  totalUsers: number;
  totalPlatforms: number;
  missingUsers: number;
  duplicateUsers: number;
  recentImports: number;
}

interface MissingUser {
  userId: string;
  primaryKey: string;
  missingPlatforms: string[];
  presentPlatforms: string[];
}

interface DuplicateUser {
  primaryKey: string;
  platformType: string;
  count: number;
  records: any[];
}

interface PlatformMatrix {
  [platform: string]: {
    [userId: string]: boolean;
  };
}

export default function UserAuditDashboard() {
  const [stats, setStats] = useState<AuditStats>({
    totalUsers: 0,
    totalPlatforms: 0,
    missingUsers: 0,
    duplicateUsers: 0,
    recentImports: 0
  });
  const [missingUsers, setMissingUsers] = useState<MissingUser[]>([]);
  const [duplicateUsers, setDuplicateUsers] = useState<DuplicateUser[]>([]);
  const [platformMatrix, setPlatformMatrix] = useState<PlatformMatrix>({});
  const [recentUploads, setRecentUploads] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'missing' | 'duplicates' | 'matrix' | 'all-users'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);
  const [mergingAll, setMergingAll] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [availablePlatforms, setAvailablePlatforms] = useState<any[]>([]);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const [statsRes, missingRes, duplicatesRes, matrixRes, uploadsRes] = await Promise.all([
        fetch('/api/audit/stats'),
        fetch('/api/audit/missing-users'),
        fetch('/api/audit/duplicate-users'),
        fetch('/api/audit/platform-matrix'),
        fetch('/api/files/uploaded-files')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (missingRes.ok) {
        const missingData = await missingRes.json();
        setMissingUsers(missingData);
      }

      if (duplicatesRes.ok) {
        const duplicatesData = await duplicatesRes.json();
        setDuplicateUsers(duplicatesData);
      }

      if (matrixRes.ok) {
        const matrixData = await matrixRes.json();
        setPlatformMatrix(matrixData.matrix);
        setPlatforms(matrixData.platforms);
      }

      if (uploadsRes.ok) {
        const uploadsData = await uploadsRes.json();
        setRecentUploads(uploadsData);
      }
    } catch (error) {
      console.error('Failed to fetch audit data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleViewUserDetails = async (user: MissingUser | DuplicateUser | string) => {
    try {
      let userId: string;
      if (typeof user === 'string') {
        userId = user;
      } else {
        userId = user.primaryKey;
      }
      
      // Fetch detailed user information from the backend
      const response = await fetch(`/api/audit/user-details?userId=${encodeURIComponent(userId)}`);
      if (response.ok) {
        const detailedUser = await response.json();
        if (typeof user === 'string') {
          setSelectedUser({ primaryKey: userId, displayName: userId, ...detailedUser });
        } else {
          setSelectedUser({ ...user, ...detailedUser });
        }
      } else {
        if (typeof user === 'string') {
          setSelectedUser({ primaryKey: userId, displayName: userId });
        } else {
          setSelectedUser(user);
        }
      }
      setShowUserModal(true);
    } catch (error) {
      console.error('Failed to view user details:', error);
      if (typeof user === 'string') {
        setSelectedUser({ primaryKey: user, displayName: user });
      } else {
        setSelectedUser(user);
      }
      setShowUserModal(true);
    }
  };

  const fetchAllUsers = async () => {
    setAllUsersLoading(true);
    try {
      const response = await fetch('/api/audit/all-users');
      if (response.ok) {
        const users = await response.json();
        setAllUsers(users);
      } else {
        console.error('Failed to fetch all users');
      }
    } catch (error) {
      console.error('Error fetching all users:', error);
    } finally {
      setAllUsersLoading(false);
    }
  };

  const getFilteredUsers = () => {
    let filtered = allUsers;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((user: any) => 
        user.primaryKey.toLowerCase().includes(term) ||
        user.displayName.toLowerCase().includes(term) ||
        (user.email && user.email.toLowerCase().includes(term))
      );
    }

    // Filter by platform
    if (selectedPlatform) {
      filtered = filtered.filter((user: any) => 
        user.platforms.includes(selectedPlatform)
      );
    }

    return filtered;
  };

  // Load all users when switching to all-users tab
  useEffect(() => {
    if (activeTab === 'all-users' && allUsers.length === 0) {
      fetchAllUsers();
    }
  }, [activeTab]);

  // Load available platforms
  useEffect(() => {
    const loadPlatforms = async () => {
      try {
        const response = await fetch('/api/platforms');
        if (response.ok) {
          const platforms = await response.json();
          setAvailablePlatforms(platforms);
        }
      } catch (error) {
        console.error('Failed to load platforms:', error);
      }
    };
    loadPlatforms();
  }, []);

  const handleMergeDuplicates = async (user: DuplicateUser) => {
    if (!confirm(`Are you sure you want to merge ${user.count} duplicate records for ${user.primaryKey}? This action cannot be undone.`)) {
      return;
    }

    setMerging(user.primaryKey);
    try {
      const response = await fetch('/api/audit/merge-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primaryKey: user.primaryKey,
          platformType: user.platformType,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully merged ${result.mergedRecord.mergedCount} duplicate records. ${result.mergedRecord.conflicts.length} conflicts were detected and resolved.`);
        
        // Refresh the data
        await fetchAuditData();
        
        // Close modal if open
        setShowUserModal(false);
      } else {
        const error = await response.json();
        alert(`Failed to merge duplicates: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to merge duplicates:', error);
      alert('Failed to merge duplicates. Please try again.');
    } finally {
      setMerging(null);
    }
  };

  const handleMergeAllDuplicates = async () => {
    const totalDuplicates = filteredDuplicateUsers.length;
    if (totalDuplicates === 0) {
      alert('No duplicates found to merge.');
      return;
    }

    if (!confirm(`Are you sure you want to merge ALL ${totalDuplicates} duplicate user groups? This action cannot be undone and may take several minutes to complete.`)) {
      return;
    }

    setMergingAll(true);
    try {
      const response = await fetch('/api/audit/merge-all-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Merge completed!\n\nTotal processed: ${result.results.totalProcessed}\nSuccessful merges: ${result.results.successfulMerges}\nErrors: ${result.results.errors.length}\n\n${result.message}`);
        
        // Refresh the data
        await fetchAuditData();
      } else {
        const error = await response.json();
        alert(`Failed to merge all duplicates: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to merge all duplicates:', error);
      alert('Failed to merge all duplicates. Please try again.');
    } finally {
      setMergingAll(false);
    }
  };

  const filteredMissingUsers = missingUsers.filter(user =>
    user.primaryKey.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDuplicateUsers = duplicateUsers.filter(user =>
    user.primaryKey.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="spinner h-12 w-12 border-blue-400 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading audit data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="stat-card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UsersIcon className="stat-icon" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dt className="stat-label truncate">
                Total Users
              </dt>
              <dd className="stat-value">
                {stats.totalUsers.toLocaleString()}
              </dd>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ArrowTrendingUpIcon className="stat-icon" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dt className="stat-label truncate">
                Platforms
              </dt>
              <dd className="stat-value">
                {stats.totalPlatforms}
              </dd>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-yellow-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dt className="stat-label truncate">
                Missing Users
              </dt>
              <dd className="text-2xl font-bold text-yellow-400">
                {stats.missingUsers.toLocaleString()}
              </dd>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dt className="stat-label truncate">
                Duplicates
              </dt>
              <dd className="text-2xl font-bold text-red-400">
                {stats.duplicateUsers.toLocaleString()}
              </dd>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircleIcon className="h-8 w-8 text-green-400" />
            </div>
            <div className="ml-5 w-0 flex-1">
              <dt className="stat-label truncate">
                Recent Imports
              </dt>
              <dd className="text-2xl font-bold text-green-400">
                {stats.recentImports}
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', count: null },
            { id: 'missing', name: 'Missing Users', count: stats.missingUsers },
            { id: 'duplicates', name: 'Duplicates', count: stats.duplicateUsers },
            { id: 'matrix', name: 'Platform Matrix', count: null },
            { id: 'all-users', name: 'All Users', count: stats.totalUsers }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`nav-tab ${
                activeTab === tab.id ? 'nav-tab-active' : 'nav-tab-inactive'
              }`}
            >
              {tab.name}
              {tab.count !== null && tab.count > 0 && (
                <span className="ml-2 status-badge status-warning">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Search Bar */}
      {(activeTab === 'missing' || activeTab === 'duplicates' || activeTab === 'all-users') && (
        <div className="search-container">
          <div className="search-icon">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Uploads */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Recent Uploads</h3>
            </div>
            <div className="card-content">
              {recentUploads.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No uploads yet</p>
              ) : (
                <div className="space-y-3">
                  {recentUploads.slice(0, 5).map((upload: any) => (
                    <div key={upload.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <DocumentIcon className="h-5 w-5 text-blue-400" />
                        <div>
                          <p className="text-sm font-medium text-white">{upload.original_filename}</p>
                          <p className="text-xs text-gray-400">
                            {upload.import_date ? new Date(upload.import_date).toLocaleDateString() : 'Unknown date'}
                          </p>
                        </div>
                      </div>
                      <span className="status-badge status-success">
                        {upload.record_count} records
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Data Quality Overview */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Data Quality Overview</h3>
            </div>
            <div className="card-content space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <h4 className="font-medium text-white">Data Completeness</h4>
                  <p className="text-sm text-gray-400">
                    {stats.totalUsers - stats.missingUsers} of {stats.totalUsers} users present across all platforms
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-medium text-green-400">
                    {stats.totalUsers > 0 ? Math.round(((stats.totalUsers - stats.missingUsers) / stats.totalUsers) * 100) : 0}%
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <h4 className="font-medium text-white">Data Quality</h4>
                  <p className="text-sm text-gray-400">
                    Duplicate rate across platforms
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-medium text-yellow-400">
                    {stats.totalUsers > 0 ? Math.round((stats.duplicateUsers / stats.totalUsers) * 100) : 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Export Tools */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Export & Reports</h3>
            </div>
            <div className="card-content space-y-3">
              <button
                onClick={async () => {
                  setExporting(true);
                  try {
                    const response = await fetch('/api/audit/export?type=comprehensive');
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `user-audit-comprehensive-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } else {
                      alert('Failed to export report');
                    }
                  } catch (error) {
                    console.error('Export error:', error);
                    alert('Failed to export report');
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting}
                className={`w-full btn-primary ${exporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {exporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <DocumentIcon className="h-4 w-4 mr-2" />
                    Export Comprehensive Report
                  </>
                )}
              </button>

              <button
                onClick={async () => {
                  setExporting(true);
                  try {
                    const response = await fetch('/api/audit/export?type=missing-users');
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `missing-users-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } else {
                      alert('Failed to export missing users');
                    }
                  } catch (error) {
                    console.error('Export error:', error);
                    alert('Failed to export missing users');
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting}
                className={`w-full btn-warning ${exporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                Export Missing Users
              </button>

              <button
                onClick={async () => {
                  setExporting(true);
                  try {
                    const response = await fetch('/api/audit/export?type=duplicates');
                    if (response.ok) {
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `duplicate-users-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    } else {
                      alert('Failed to export duplicates');
                    }
                  } catch (error) {
                    console.error('Export error:', error);
                    alert('Failed to export duplicates');
                  } finally {
                    setExporting(false);
                  }
                }}
                disabled={exporting}
                className={`w-full btn-danger ${exporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <CheckIcon className="h-4 w-4 mr-2" />
                Export Duplicates
              </button>

              <button
                onClick={() => setActiveTab('all-users')}
                className="w-full btn-info"
              >
                <UsersIcon className="h-4 w-4 mr-2" />
                View All Users ({stats.totalUsers})
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'missing' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Missing Users</h3>
            <p className="text-sm text-gray-400">
              Users present in some platforms but missing from others
            </p>
          </div>
          <div className="card-content">
            {filteredMissingUsers.length === 0 ? (
              <div className="text-center py-8">
                <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-gray-600" />
                <h3 className="mt-2 text-sm font-medium text-gray-300">No missing users found</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {searchTerm ? 'No users found matching your search.' : 'All users are present on all platforms.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMissingUsers.map((user) => (
                  <div key={user.userId} className="p-4 bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-white">{user.primaryKey}</h4>
                        <p className="text-sm text-gray-400 mt-1">
                          Present in: <span className="text-green-400">{user.presentPlatforms.join(', ')}</span>
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Missing from: <span className="text-red-400">{user.missingPlatforms.join(', ')}</span>
                        </p>
                      </div>
                      <button 
                        className="btn-outline-primary btn-sm"
                        onClick={() => handleViewUserDetails(user)}
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'duplicates' && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="card-title">Duplicate Users</h3>
                <p className="text-sm text-gray-400">
                  Users with multiple records in the same platform
                </p>
              </div>
              {filteredDuplicateUsers.length > 0 && (
                <button 
                  className={`btn-success ${mergingAll ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={handleMergeAllDuplicates}
                  disabled={mergingAll}
                >
                  {mergingAll ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Merging All...
                    </>
                  ) : (
                    <>
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Merge All ({filteredDuplicateUsers.length})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <div className="card-content">
            {filteredDuplicateUsers.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircleIcon className="mx-auto h-12 w-12 text-green-600" />
                <h3 className="mt-2 text-sm font-medium text-gray-300">No duplicates found</h3>
                <p className="mt-1 text-sm text-gray-400">
                  {searchTerm ? 'No duplicates found matching your search.' : 'All users have unique identifiers.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDuplicateUsers.map((user, index) => (
                  <div key={index} className="p-4 bg-gray-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-white">{user.primaryKey}</h4>
                        <p className="text-sm text-gray-400 mt-1">
                          Platform: <span className="text-blue-400">{user.platformType}</span>
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          <span className="text-red-400">{user.count} duplicate records found</span>
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button 
                          className="btn-outline-secondary btn-sm"
                          onClick={() => handleViewUserDetails(user)}
                        >
                          <EyeIcon className="h-4 w-4 mr-1" />
                          View Records
                        </button>
                        <button 
                          className={`btn-success btn-sm ${merging === user.primaryKey ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={() => handleMergeDuplicates(user)}
                          disabled={merging === user.primaryKey}
                        >
                          {merging === user.primaryKey ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                              Merging...
                            </>
                          ) : (
                            <>
                              <CheckIcon className="h-4 w-4 mr-1" />
                              Merge Records
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Platform Presence Matrix</h3>
            <p className="text-sm text-gray-400">
              Visual representation of user presence across all platforms
            </p>
          </div>
          <div className="card-content">
            {Object.keys(platformMatrix).length === 0 ? (
              <div className="text-center py-8">
                <ArrowTrendingUpIcon className="mx-auto h-12 w-12 text-gray-600" />
                <h3 className="mt-2 text-sm font-medium text-gray-300">No data available</h3>
                <p className="mt-1 text-sm text-gray-400">
                  Upload some CSV files to see the platform matrix.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      {platforms.map((platform: string) => (
                        <th key={platform} className="text-center">{platform}</th>
                      ))}
                      <th className="text-center">Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(platformMatrix).slice(0, 50).map(([userId, userPlatforms]: [string, any]) => {
                      const totalPlatforms = platforms.length;
                      const presentCount = platforms.filter((platform: string) => userPlatforms[platform]).length;
                      const coverage = totalPlatforms > 0 ? (presentCount / totalPlatforms * 100).toFixed(0) : '0';

                      return (
                        <tr key={userId}>
                          <td className="font-medium">{userId}</td>
                          {platforms.map((platform: string) => (
                            <td key={platform} className="text-center">
                              <div
                                className={`inline-block w-4 h-4 rounded-full ${
                                  userPlatforms[platform] ? 'bg-green-400' : 'bg-red-400'
                                }`}
                                title={userPlatforms[platform] ? 'Present' : 'Missing'}
                              />
                            </td>
                          ))}
                          <td className="text-center">
                            <span className={`status-badge ${
                              coverage === '100' ? 'status-success' :
                              parseInt(coverage) >= 75 ? 'status-warning' :
                              'status-error'
                            }`}>
                              {coverage}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {Object.keys(platformMatrix).length > 50 && (
                  <div className="mt-4 text-center">
                    <p className="text-sm text-gray-400">
                      Showing first 50 users. Total: {Object.keys(platformMatrix).length}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'all-users' && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="card-title">All Users ({allUsers.length})</h3>
              <div className="flex items-center space-x-3">
                <button
                  onClick={async () => {
                    setExporting(true);
                    try {
                      const response = await fetch('/api/audit/export?type=all-users');
                      if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `all-users-${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        window.URL.revokeObjectURL(url);
                      } else {
                        alert('Failed to export all users');
                      }
                    } catch (error) {
                      console.error('Export error:', error);
                      alert('Failed to export all users');
                    } finally {
                      setExporting(false);
                    }
                  }}
                  disabled={exporting}
                  className={`btn-info ${exporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <DocumentIcon className="h-4 w-4 mr-2" />
                      Export All Users
                    </>
                  )}
                </button>
                
                <button
                  onClick={fetchAllUsers}
                  disabled={allUsersLoading}
                  className={`btn-outline-primary ${allUsersLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {allUsersLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Loading...
                    </>
                  ) : (
                    <>
                      <ArrowPathIcon className="h-4 w-4 mr-2" />
                      Refresh
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="card-content">
            {allUsersLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-400">Loading all users...</span>
              </div>
            ) : allUsers.length === 0 ? (
              <div className="text-center py-8">
                <UsersIcon className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No users found. Make sure you have uploaded some CSV files.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users by name, email, or username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  <select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Platforms</option>
                    {availablePlatforms.map((platform: any) => (
                      <option key={platform.id} value={platform.name}>
                        {platform.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 font-medium text-gray-300">User</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-300">Platforms</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-300">Status</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredUsers().map((user: any, index: number) => (
                        <tr key={`${user.primaryKey}-${index}`} className="border-b border-gray-700 hover:bg-gray-700/50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium text-white">{user.displayName}</p>
                              <p className="text-sm text-gray-400">{user.primaryKey}</p>
                              {user.email && user.email !== user.primaryKey && (
                                <p className="text-xs text-gray-500">{user.email}</p>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {user.platforms.map((platform: string) => (
                                <span
                                  key={platform}
                                  className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30"
                                >
                                  {platform}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {user.platforms.length === availablePlatforms.length ? (
                              <span className="status-badge status-success">Complete</span>
                            ) : user.platforms.length > 1 ? (
                              <span className="status-badge status-warning">Partial</span>
                            ) : (
                              <span className="status-badge status-error">Limited</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleViewUserDetails(user.primaryKey)}
                              className="btn-outline-primary btn-sm"
                            >
                              <EyeIcon className="h-4 w-4 mr-1" />
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {getFilteredUsers().length === 0 && searchTerm && (
                  <div className="text-center py-8">
                    <MagnifyingGlassIcon className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">No users found matching "{searchTerm}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={() => setShowUserModal(false)}
            />
            
            <div className="inline-block align-bottom bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="w-full">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg leading-6 font-medium text-white">
                        User Details
                      </h3>
                      <button
                        onClick={() => setShowUserModal(false)}
                        className="text-gray-400 hover:text-white"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-gray-700 p-4 rounded-lg">
                        <h4 className="font-medium text-white text-lg mb-2">
                          {selectedUser.primaryKey}
                        </h4>
                        
                        {'missingPlatforms' in selectedUser ? (
                          // Missing User Details
                          <div className="space-y-4">
                            <div>
                              <h5 className="text-sm font-medium text-gray-300 mb-1">Primary Key:</h5>
                              <span className="text-blue-400 font-mono text-sm">{selectedUser.primaryKey}</span>
                            </div>
                            
                            <div>
                              <h5 className="text-sm font-medium text-gray-300 mb-1">Present in:</h5>
                              <div className="flex flex-wrap gap-2">
                                {selectedUser.presentPlatforms.map((platform: string) => (
                                  <span key={platform} className="status-badge status-success">
                                    {platform}
                                  </span>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <h5 className="text-sm font-medium text-gray-300 mb-1">Missing from:</h5>
                              <div className="flex flex-wrap gap-2">
                                {selectedUser.missingPlatforms.map((platform: string) => (
                                  <span key={platform} className="status-badge status-error">
                                    {platform}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Show actual records from present platforms */}
                            {selectedUser.presentRecords && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-300 mb-2">Records Found:</h5>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {selectedUser.presentRecords.map((record: any, index: number) => (
                                    <div key={index} className="bg-gray-600 p-3 rounded text-sm">
                                      <div className="grid grid-cols-2 gap-2 text-gray-300 mb-2">
                                        <div>
                                          <strong>Platform:</strong> {record.platformType}
                                        </div>
                                        <div>
                                          <strong>Primary Key Field:</strong> <span className="text-yellow-400">{record.primary_key_field || 'Unknown'}</span>
                                        </div>
                                        <div>
                                          <strong>Matched Key:</strong> <span className="font-mono text-xs">{record.matchedValue}</span>
                                        </div>
                                        <div>
                                          <strong>Import:</strong> {record.importFilename || `Import #${record.importId}`}
                                        </div>
                                        <div>
                                          <strong>Date:</strong> {record.importDate ? new Date(record.importDate).toLocaleDateString() : 'Unknown'}
                                        </div>
                                      </div>
                                      {record.rawData && (
                                        <div className="mt-2">
                                          <details className="text-xs">
                                            <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
                                              Show all fields from this record
                                            </summary>
                                            <pre className="mt-2 p-2 bg-gray-700 rounded overflow-x-auto text-gray-300">
                                              {JSON.stringify(JSON.parse(record.rawData), null, 2)}
                                            </pre>
                                          </details>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Show potential matching variations */}
                            {selectedUser.potentialMatches && selectedUser.potentialMatches.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-yellow-300 mb-2">
                                  Potential Matches in Missing Platforms:
                                </h5>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {selectedUser.potentialMatches.map((match: any, index: number) => (
                                    <div key={index} className="bg-yellow-900/20 border border-yellow-700 p-2 rounded text-sm">
                                      <div className="text-yellow-300">
                                        <strong>Platform:</strong> {match.platformType} | 
                                        <strong> Similar Key:</strong> <span className="font-mono text-xs ml-1">{match.similarKey}</span>
                                      </div>
                                      <div className="text-gray-400 text-xs mt-1">
                                        Similarity: {match.similarity}% | Field: {match.matchedField}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-yellow-400 mt-2">
                                  These records might be the same user but with different identifiers. 
                                  Check if the mapping configuration needs adjustment.
                                </p>
                              </div>
                            )}

                            {/* Show all possible identifiers */}
                            {selectedUser.allIdentifiers && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-300 mb-2">All Known Identifiers for this User:</h5>
                                <div className="bg-gray-600 p-3 rounded">
                                  {Object.entries(selectedUser.allIdentifiers).map(([field, values]: [string, any]) => (
                                    <div key={field} className="mb-2">
                                      <span className="text-blue-400 text-sm font-medium">{field}:</span>
                                      <div className="ml-2 flex flex-wrap gap-1">
                                        {Array.from(new Set(values)).map((value: any, idx: number) => (
                                          <span key={idx} className="text-xs bg-gray-700 px-2 py-1 rounded font-mono">
                                            {value}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Show debugging information */}
                            {selectedUser.missingPlatforms && selectedUser.missingPlatforms.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium text-orange-300 mb-2">
                                  🔍 Primary Key Field Analysis:
                                </h5>
                                <div className="bg-orange-900/20 border border-orange-700 p-3 rounded text-sm">
                                  <p className="text-orange-200 mb-2">
                                    <strong>⚠️ POTENTIAL ISSUE: Multiple Primary Key Fields Detected</strong>
                                  </p>
                                  
                                  {/* Show primary key fields being used */}
                                  {selectedUser.presentRecords && selectedUser.presentRecords.length > 0 && (
                                    <div className="mb-3">
                                      <p className="text-yellow-300 text-sm mb-1">Primary key fields currently in use:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {[...new Set(selectedUser.presentRecords.map((r: any) => r.primary_key_field).filter(Boolean))].map((field: any) => (
                                          <span key={field} className="bg-yellow-800 text-yellow-200 px-2 py-1 rounded text-xs font-mono">
                                            {field}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <p className="text-gray-300 text-sm mb-2">
                                    <strong>Common Issue:</strong> If platforms use different primary key fields (email vs username), 
                                    the same user may appear as missing because they're being matched on different identifiers.
                                  </p>
                                  
                                  <ul className="text-gray-300 space-y-1 text-xs list-disc list-inside">
                                    <li><strong>Check platform configurations:</strong> Ensure all platforms use the same primary key field</li>
                                    <li><strong>Verify field mappings:</strong> Missing platforms might be configured to use 'username' while present platforms use 'email'</li>
                                    <li><strong>Look for field variations:</strong> Check if missing platforms have 'EmailAddress' vs 'Email' or similar variations</li>
                                    <li><strong>Cross-reference identifiers:</strong> Use the "All Known Identifiers" section above to see available fields</li>
                                    <li><strong>Consider standardization:</strong> You may need to reconfigure platforms to use a consistent primary key field</li>
                                  </ul>
                                  
                                  {selectedUser.potentialMatches && selectedUser.potentialMatches.length > 0 && (
                                    <p className="text-yellow-300 mt-2 text-xs">
                                      ⚠️ Found {selectedUser.potentialMatches.length} potential matches above. 
                                      These likely represent the same user matched on different field types (email vs username).
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Show platform mapping info */}
                            <div>
                              <h5 className="text-sm font-medium text-gray-300 mb-2">Platform Configuration Analysis:</h5>
                              <div className="bg-gray-600 p-3 rounded text-xs">
                                <p className="text-gray-400 mb-2">
                                  Primary key field configuration by platform:
                                </p>
                                <div className="space-y-2">
                                  {/* Show platforms where user is present with their primary key fields */}
                                  {selectedUser.presentRecords && [...new Map(selectedUser.presentRecords.map((r: any) => [r.platformType, r])).values()].map((record: any) => (
                                    <div key={record.platformType} className="flex items-center justify-between bg-green-900/20 border border-green-700 p-2 rounded">
                                      <span className="text-green-400">
                                        ✓ {record.platformType}
                                      </span>
                                      <span className="text-gray-300 font-mono text-xs">
                                        Primary Key: {record.primary_key_field || 'Not specified'}
                                      </span>
                                    </div>
                                  ))}
                                  
                                  {/* Show missing platforms with warning about unknown primary key fields */}
                                  {selectedUser.missingPlatforms.map((platform: string) => (
                                    <div key={platform} className="flex items-center justify-between bg-red-900/20 border border-red-700 p-2 rounded">
                                      <span className="text-red-400">
                                        ✗ {platform}
                                      </span>
                                      <span className="text-yellow-300 text-xs">
                                        ⚠️ Check primary key field mapping
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                
                                <div className="mt-3 p-2 bg-blue-900/20 border border-blue-700 rounded">
                                  <p className="text-blue-300 text-xs font-medium mb-1">💡 Recommendation:</p>
                                  <p className="text-gray-300 text-xs">
                                    If you see different primary key fields above, consider standardizing all platforms 
                                    to use the same field (e.g., all use 'email' or all use 'username') to ensure 
                                    consistent user matching across platforms.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Duplicate User Details
                          <div className="space-y-3">
                            <div>
                              <h5 className="text-sm font-medium text-gray-300 mb-1">Platform:</h5>
                              <span className="status-badge status-info">
                                {selectedUser.platformType}
                              </span>
                            </div>
                            <div>
                              <h5 className="text-sm font-medium text-gray-300 mb-1">Duplicate Records:</h5>
                              <span className="status-badge status-warning">
                                {selectedUser.count} records
                              </span>
                            </div>
                            {'records' in selectedUser && (
                              <div>
                                <h5 className="text-sm font-medium text-gray-300 mb-2">Record Details:</h5>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {selectedUser.records.map((record: any, index: number) => (
                                    <div key={index} className="bg-gray-600 p-3 rounded text-sm">
                                      <div className="grid grid-cols-2 gap-2 text-gray-300 mb-2">
                                        <div>
                                          <strong>Import:</strong> {record.importFilename || `Import #${record.importId}`}
                                        </div>
                                        <div>
                                          <strong>Date:</strong> {record.importDate ? new Date(record.importDate).toLocaleDateString() : 'Unknown'}
                                        </div>
                                        <div>
                                          <strong>Record ID:</strong> {record.id}
                                        </div>
                                        <div>
                                          <strong>Import ID:</strong> {record.importId}
                                        </div>
                                      </div>
                                      {record.rawData && (
                                        <div className="mt-2">
                                          <details className="text-xs">
                                            <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
                                              Show raw data
                                            </summary>
                                            <pre className="mt-2 p-2 bg-gray-700 rounded overflow-x-auto text-gray-300">
                                              {JSON.stringify(JSON.parse(record.rawData), null, 2)}
                                            </pre>
                                          </details>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {/* Show additional actions for missing users */}
                {'missingPlatforms' in selectedUser && selectedUser.missingPlatforms.length > 0 && (
                  <>
                    {/* Smart Matching Analysis Button */}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const smartMatchResponse = await fetch(`/api/audit/smart-matching?userId=${encodeURIComponent(selectedUser.primaryKey)}`);
                          if (smartMatchResponse.ok) {
                            const smartMatches = await smartMatchResponse.json();
                            
                            let message = `🧠 SMART MATCHING ANALYSIS\n\n`;
                            message += `User: ${selectedUser.primaryKey}\n\n`;
                            
                            if (smartMatches.bridgeDatasets && smartMatches.bridgeDatasets.length > 0) {
                              message += `🌉 BRIDGE DATASETS FOUND:\n`;
                              message += `These datasets contain multiple identifier fields and can link users across platforms:\n\n`;
                              
                              smartMatches.bridgeDatasets.forEach((bridge: any) => {
                                message += `📊 ${bridge.platformType} (${bridge.filename})\n`;
                                message += `   Fields available: ${bridge.availableFields.join(', ')}\n`;
                                message += `   Can bridge: ${bridge.canBridge.join(' ↔ ')}\n\n`;
                              });
                            }
                            
                            if (smartMatches.crossPlatformMatches && smartMatches.crossPlatformMatches.length > 0) {
                              message += `🔗 CROSS-PLATFORM MATCHES FOUND:\n`;
                              message += `Based on bridge datasets, these records likely belong to the same user:\n\n`;
                              
                              smartMatches.crossPlatformMatches.forEach((match: any) => {
                                message += `${match.platform1} ↔ ${match.platform2}\n`;
                                message += `   ${match.identifier1} ↔ ${match.identifier2}\n`;
                                message += `   Bridge: ${match.bridgeDataset}\n`;
                                message += `   Confidence: ${match.confidence}%\n\n`;
                              });
                              
                              message += `💡 RECOMMENDATION:\n`;
                              message += `Update platform configurations to use the same primary key field, then re-import data.\n`;
                              message += `Suggested standard field: ${smartMatches.recommendedPrimaryKey}\n`;
                            } else {
                              message += `❌ NO CROSS-PLATFORM MATCHES\n`;
                              message += `Could not find matching records using bridge datasets.\n`;
                              message += `The user may genuinely be missing from some platforms.\n`;
                            }
                            
                            alert(message);
                          } else {
                            alert('Failed to perform smart matching analysis');
                          }
                        } catch (error) {
                          console.error('Error performing smart matching:', error);
                          alert('Error performing smart matching analysis');
                        }
                      }}
                      className="w-full inline-flex justify-center rounded-md border border-green-600 shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm mb-2 sm:mb-0"
                    >
                      🧠 Smart Matching
                    </button>
                    
                    {/* Platform Configuration Analysis Button */}
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const platformsResponse = await fetch('/api/platform-types');
                          if (platformsResponse.ok) {
                            const platforms = await platformsResponse.json();
                            
                            let message = `🔧 PLATFORM CONFIGURATION ANALYSIS\n\n`;
                            message += `User: ${selectedUser.primaryKey}\n\n`;
                            
                            message += `📋 PRIMARY KEY FIELD CONFIGURATION:\n`;
                            platforms.forEach((platform: any) => {
                              const isPresent = selectedUser.presentPlatforms.includes(platform.name);
                              const isMissing = selectedUser.missingPlatforms.includes(platform.name);
                              
                              const status = isPresent ? '✅ PRESENT' : isMissing ? '❌ MISSING' : '⚪ N/A';
                              message += `\n${status} ${platform.name}\n`;
                              message += `   Primary Key Field: ${platform.primary_key_field || 'Not configured'}\n`;
                              message += `   Status: ${platform.is_active ? 'Active' : 'Inactive'}\n`;
                            });
                            
                            // Check for inconsistencies
                            const primaryKeyFields = new Set(platforms.map((p: any) => p.primary_key_field).filter(Boolean));
                            if (primaryKeyFields.size > 1) {
                              message += `\n⚠️ INCONSISTENCY DETECTED!\n`;
                              message += `Multiple primary key fields found: ${Array.from(primaryKeyFields).join(', ')}\n`;
                              message += `\nThis is likely why "${selectedUser.primaryKey}" appears missing from some platforms.\n`;
                              message += `The user exists but platforms are using different fields for matching.\n`;
                            }
                            
                            message += `\n💡 RECOMMENDATIONS:\n`;
                            message += `• Standardize all platforms to use the same primary key field\n`;
                            message += `• Common options: 'email', 'username', 'userPrincipalName'\n`;
                            message += `• Re-import data after updating configurations\n`;
                            message += `• Use the 'All Known Identifiers' section to see available fields\n`;
                            
                            alert(message);
                          } else {
                            alert('Failed to load platform configuration');
                          }
                        } catch (error) {
                          console.error('Error loading platform config:', error);
                          alert('Error loading platform configuration');
                        }
                      }}
                      className="w-full inline-flex justify-center rounded-md border border-purple-600 shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm mb-2 sm:mb-0"
                    >
                      🔧 Analyze Configurations
                    </button>
                    
                    <button
                      type="button"
                      onClick={async () => {
                        // Search for this user in all uploaded files
                        try {
                          const searchResponse = await fetch(`/api/files/search-user?userId=${encodeURIComponent(selectedUser.primaryKey)}`);
                          if (searchResponse.ok) {
                            const searchResults = await searchResponse.json();
                            
                            // Create a detailed modal or alert with results
                            let message = `📊 File Search Results for: ${selectedUser.primaryKey}\n\n`;
                            
                            if (searchResults.foundInFiles.length > 0) {
                              message += `✅ FOUND IN ${searchResults.foundInFiles.length} FILES:\n`;
                              searchResults.foundInFiles.forEach((file: any) => {
                                message += `\n📁 ${file.filename} (${file.platformType})\n`;
                                message += `   • ${file.matches} matches found\n`;
                                message += `   • Import date: ${new Date(file.importDate).toLocaleDateString()}\n`;
                                if (file.matchDetails && file.matchDetails.length > 0) {
                                  message += `   • Sample matches:\n`;
                                  file.matchDetails.slice(0, 2).forEach((match: any) => {
                                    message += `     - Row ${match.rowNumber}: ${match.matchingFields.map((f: any) => `${f.field}="${f.value}"`).join(', ')}\n`;
                                  });
                                }
                              });
                            }
                            
                            if (searchResults.notFoundInFiles.length > 0) {
                              message += `\n❌ NOT FOUND IN ${searchResults.notFoundInFiles.length} FILES:\n`;
                              searchResults.notFoundInFiles.forEach((file: any) => {
                                message += `\n📁 ${file.filename} (${file.platformType || 'Unknown'})\n`;
                                message += `   • Reason: ${file.reason}\n`;
                                if (file.totalRecords) {
                                  message += `   • Total records checked: ${file.totalRecords}\n`;
                                }
                              });
                            }
                            
                            message += `\n💡 NEXT STEPS:\n`;
                            message += `• Check if missing files have the correct primary key field mapping\n`;
                            message += `• Verify the email format matches exactly (case sensitive)\n`;
                            message += `• Look for typos or extra spaces in the user identifier\n`;
                            message += `• Consider if the user might be in a different CSV file or batch\n`;
                            
                            alert(message);
                          } else {
                            alert('Failed to search for user in files');
                          }
                        } catch (error) {
                          console.error('Error searching files:', error);
                          alert('Error searching for user in files');
                        }
                      }}
                      className="w-full inline-flex justify-center rounded-md border border-blue-600 shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm mb-2 sm:mb-0"
                    >
                      🔍 Search in CSV Files
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-600 text-base font-medium text-white hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
