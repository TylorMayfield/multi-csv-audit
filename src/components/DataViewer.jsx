import { useState, useEffect } from 'react';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    MagnifyingGlassIcon,
    ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

export default function DataViewer() {
    const [files, setFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [data, setData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [filters, setFilters] = useState({});

    const itemsPerPage = 10;

    // Fetch files on mount
    useEffect(() => {
        const fetchFiles = async () => {
            try {
                const response = await fetch('/api/files');
                if (response.ok) {
                    const filesData = await response.json();
                    setFiles(filesData);
                }
            } catch (error) {
                console.error('Failed to fetch files:', error);
            }
        };

        fetchFiles();
    }, []);

    // Fetch file data when selected
    useEffect(() => {
        const fetchData = async () => {
            if (!selectedFile) return;

            try {
                const response = await fetch(`/api/files/${selectedFile.id}/data`);
                if (response.ok) {
                    const jsonData = await response.json();
                    setData(jsonData);
                    if (jsonData.length > 0) {
                        setColumns(Object.keys(jsonData[0]));
                    }
                }
            } catch (error) {
                console.error('Failed to fetch file data:', error);
            }
        };

        fetchData();
    }, [selectedFile]);

    // Filter and sort data
    const filteredData = data.filter(item => {
        // Apply search
        const matchesSearch = Object.values(item).some(
            value => String(value).toLowerCase().includes(searchTerm.toLowerCase())
        );

        // Apply column filters
        const matchesFilters = Object.entries(filters).every(([key, value]) => {
            if (!value) return true;
            return String(item[key]).toLowerCase().includes(value.toLowerCase());
        });

        return matchesSearch && matchesFilters;
    });

    // Sort data
    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortConfig.key) return 0;

        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Pagination
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleFilterChange = (column, value) => {
        setFilters(prev => ({
            ...prev,
            [column]: value
        }));
        setCurrentPage(1);
    };

    const handleExport = async () => {
        if (!selectedFile) return;

        try {
            const csvContent = [
                columns.join(','),
                ...sortedData.map(row => 
                    columns.map(col => {
                        const value = row[col];
                        return typeof value === 'string' && value.includes(',')
                            ? `"${value}"`
                            : value;
                    }).join(',')
                )
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedFile.originalName.replace('.csv', '')}_processed.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export data');
        }
    };

    return (
        <div className="space-y-6">
            {/* File Selection */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">View Processed Data</h2>
                    {selectedFile && (
                        <button
                            onClick={handleExport}
                            className="btn btn-secondary flex items-center space-x-2"
                        >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            <span>Export CSV</span>
                        </button>
                    )}
                </div>

                <select
                    value={selectedFile?.id || ''}
                    onChange={(e) => {
                        const file = files.find(f => f.id === e.target.value);
                        setSelectedFile(file);
                        setCurrentPage(1);
                        setSearchTerm('');
                        setFilters({});
                        setSortConfig({ key: null, direction: 'asc' });
                    }}
                    className="input mb-4"
                >
                    <option value="">Select a file to view...</option>
                    {files.map((file) => (
                        <option key={file.id} value={file.id}>
                            {file.originalName}
                        </option>
                    ))}
                </select>

                {selectedFile && (
                    <>
                        {/* Search */}
                        <div className="relative mb-4">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search all columns..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="input pl-10"
                            />
                        </div>

                        {/* Data Table */}
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead>
                                    <tr>
                                        {columns.map((column) => (
                                            <th
                                                key={column}
                                                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                                            >
                                                <div className="space-y-1">
                                                    <button
                                                        onClick={() => handleSort(column)}
                                                        className="flex items-center space-x-1 hover:text-primary-600"
                                                    >
                                                        <span>{column}</span>
                                                        {sortConfig.key === column && (
                                                            <span className="text-primary-600">
                                                                {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                                            </span>
                                                        )}
                                                    </button>
                                                    <input
                                                        type="text"
                                                        placeholder="Filter..."
                                                        value={filters[column] || ''}
                                                        onChange={(e) => handleFilterChange(column, e.target.value)}
                                                        className="block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                                                    />
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {paginatedData.map((row, rowIndex) => (
                                        <tr key={rowIndex}>
                                            {columns.map((column) => (
                                                <td
                                                    key={column}
                                                    className="whitespace-nowrap px-3 py-4 text-sm text-gray-500"
                                                >
                                                    {row[column]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                            <div className="flex flex-1 justify-between sm:hidden">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="btn btn-secondary"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="btn btn-secondary"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        Showing{' '}
                                        <span className="font-medium">{startIndex + 1}</span>
                                        {' '}to{' '}
                                        <span className="font-medium">
                                            {Math.min(startIndex + itemsPerPage, sortedData.length)}
                                        </span>
                                        {' '}of{' '}
                                        <span className="font-medium">{sortedData.length}</span>
                                        {' '}results
                                    </p>
                                </div>
                                <div>
                                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                                        >
                                            <ChevronLeftIcon className="h-5 w-5" />
                                        </button>
                                        {[...Array(totalPages)].map((_, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setCurrentPage(index + 1)}
                                                className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                                                    currentPage === index + 1
                                                        ? 'z-10 bg-primary-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600'
                                                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                                                }`}
                                            >
                                                {index + 1}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0"
                                        >
                                            <ChevronRightIcon className="h-5 w-5" />
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
