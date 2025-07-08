import { useState, useEffect } from 'react';
import { 
    UsersIcon, 
    ExclamationTriangleIcon, 
    CheckCircleIcon,
    XMarkIcon,
    MagnifyingGlassIcon,
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

export default function UserAudit() {
    const [users, setUsers] = useState([]);
    const [platforms, setPlatforms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [matrix, setMatrix] = useState([]);
    const [missingUsers, setMissingUsers] = useState({});
    const [showMatrix, setShowMatrix] = useState(false);

    useEffect(() => {
        fetchPlatforms();
        fetchUsers();
    }, [currentPage, searchTerm, selectedPlatform]);

    const fetchPlatforms = async () => {
        try {
            const response = await fetch('/api/platform-types');
            if (response.ok) {
                const data = await response.json();
                setPlatforms(data);
            }
        } catch (error) {
            console.error('Error fetching platforms:', error);
        }
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '20',
                search: searchTerm,
                platformId: selectedPlatform
            });
            
            const response = await fetch(`/api/audit/users?${params}`);
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users);
                setTotalPages(data.totalPages);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMatrix = async () => {
        try {
            const response = await fetch('/api/audit/matrix');
            if (response.ok) {
                const data = await response.json();
                setMatrix(data.matrix);
                setShowMatrix(true);
            }
        } catch (error) {
            console.error('Error fetching matrix:', error);
        }
    };

    const fetchMissingUsers = async (sourcePlatformId, targetPlatformId) => {
        try {
            const response = await fetch(`/api/audit/missing-users?sourcePlatformId=${sourcePlatformId}&targetPlatformId=${targetPlatformId}`);
            if (response.ok) {
                const data = await response.json();
                const key = `${sourcePlatformId}-${targetPlatformId}`;
                setMissingUsers(prev => ({
                    ...prev,
                    [key]: data.missingUsers
                }));
            }
        } catch (error) {
            console.error('Error fetching missing users:', error);
        }
    };

    const exportAuditData = async (format = 'json') => {
        try {
            const response = await fetch(`/api/audit/export?format=${format}`);
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit-report.${format}`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }
        } catch (error) {
            console.error('Error exporting audit data:', error);
        }
    };

    const getPlatformPresenceStatus = (user, platformName) => {
        const presence = user.platformPresence?.find(p => p.platform_name === platformName);
        if (!presence) return 'missing';
        return presence.is_active ? 'active' : 'inactive';
    };

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-bold text-gray-900">User Audit</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Comprehensive view of users across all platforms
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-2">
                    <button
                        onClick={fetchMatrix}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <UsersIcon className="-ml-1 mr-2 h-5 w-5" />
                        View Matrix
                    </button>
                    <button
                        onClick={() => exportAuditData('csv')}
                        className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Search and Filter */}
            <div className="bg-white shadow rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Search Users
                        </label>
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-10 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                placeholder="Search by name, email, or key..."
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Filter by Platform
                        </label>
                        <select
                            value={selectedPlatform}
                            onChange={(e) => {
                                setSelectedPlatform(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        >
                            <option value="">All Platforms</option>
                            {platforms.map(platform => (
                                <option key={platform.id} value={platform.id}>
                                    {platform.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedPlatform('');
                                setCurrentPage(1);
                            }}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <div className="px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Consolidated Users
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        Users consolidated across all platforms
                    </p>
                </div>
                
                {loading ? (
                    <div className="flex justify-center items-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                ) : (
                    <div className="border-t border-gray-200">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            User
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Primary Key
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Platform Presence
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {users.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10">
                                                        <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                                            <UsersIcon className="h-5 w-5 text-gray-500" />
                                                        </div>
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {user.display_name || `${user.first_name} ${user.last_name}`.trim()}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {user.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                    {user.primary_key}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex space-x-2">
                                                    {platforms.map(platform => {
                                                        const status = getPlatformPresenceStatus(user, platform.name);
                                                        return (
                                                            <span
                                                                key={platform.id}
                                                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                                    status === 'active' ? 'bg-green-100 text-green-800' :
                                                                    status === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                                                                    'bg-red-100 text-red-800'
                                                                }`}
                                                            >
                                                                {status === 'active' ? (
                                                                    <CheckCircleIcon className="h-3 w-3 mr-1" />
                                                                ) : status === 'inactive' ? (
                                                                    <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                                                                ) : (
                                                                    <XMarkIcon className="h-3 w-3 mr-1" />
                                                                )}
                                                                {platform.name}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-4 py-3 border-t border-gray-200 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 flex justify-between sm:hidden">
                                        <button
                                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm text-gray-700">
                                                Page <span className="font-medium">{currentPage}</span> of{' '}
                                                <span className="font-medium">{totalPages}</span>
                                            </p>
                                        </div>
                                        <div>
                                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                                <button
                                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                                    disabled={currentPage === 1}
                                                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    Previous
                                                </button>
                                                <button
                                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                                    disabled={currentPage === totalPages}
                                                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                                >
                                                    Next
                                                </button>
                                            </nav>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Platform Matrix Modal */}
            {showMatrix && (
                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                        
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="w-full">
                                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                                            User Platform Matrix
                                        </h3>
                                        
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                            User
                                                        </th>
                                                        {platforms.map(platform => (
                                                            <th key={platform.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                {platform.name}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {matrix.slice(0, 50).map((user) => (
                                                        <tr key={user.primaryKey} className="hover:bg-gray-50">
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="text-sm font-medium text-gray-900">
                                                                    {user.displayName}
                                                                </div>
                                                                <div className="text-sm text-gray-500">
                                                                    {user.primaryKey}
                                                                </div>
                                                            </td>
                                                            {platforms.map(platform => {
                                                                const platformData = user.platforms[platform.name];
                                                                const isPresent = platformData?.present;
                                                                return (
                                                                    <td key={platform.id} className="px-6 py-4 whitespace-nowrap text-center">
                                                                        {isPresent ? (
                                                                            <CheckCircleIcon className="h-5 w-5 text-green-500 mx-auto" />
                                                                        ) : (
                                                                            <XMarkIcon className="h-5 w-5 text-red-500 mx-auto" />
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                <button
                                    type="button"
                                    onClick={() => setShowMatrix(false)}
                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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
