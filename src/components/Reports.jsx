import { useState, useEffect } from 'react';
import { DocumentChartBarIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';

export default function Reports() {
    const [columns, setColumns] = useState([]);
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [source, setSource] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [format, setFormat] = useState('json');
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetchColumns();
        fetchStats();
    }, []);

    const fetchColumns = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/columns');
            if (response.ok) {
                const data = await response.json();
                setColumns(data);
            }
        } catch (error) {
            console.error('Error fetching columns:', error);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleGenerateReport = async () => {
        try {
            const params = {
                columns: selectedColumns,
                source,
                dateRange: dateRange.start || dateRange.end ? dateRange : undefined,
                format
            };

            const response = await fetch('http://localhost:3001/api/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params)
            });

            if (response.ok) {
                if (format === 'json') {
                    const data = await response.json();
                    console.log('Report data:', data);
                } else {
                    // For CSV and PDF, trigger download
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `report.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }
            }
        } catch (error) {
            console.error('Error generating report:', error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Statistics Summary */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card bg-primary-50">
                        <h3 className="text-lg font-semibold text-primary-900">Total Files</h3>
                        <p className="text-3xl font-bold text-primary-600">{stats.totalFiles}</p>
                    </div>
                    <div className="card bg-primary-50">
                        <h3 className="text-lg font-semibold text-primary-900">Total Records</h3>
                        <p className="text-3xl font-bold text-primary-600">{stats.totalRecords}</p>
                    </div>
                    <div className="card bg-primary-50">
                        <h3 className="text-lg font-semibold text-primary-900">Sources</h3>
                        <p className="text-3xl font-bold text-primary-600">{stats.sourceBreakdown?.length || 0}</p>
                    </div>
                </div>
            )}

            {/* Report Generator */}
            <div className="card">
                <h2 className="text-xl font-semibold mb-4">Generate Report</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Columns
                        </label>
                        <select
                            multiple
                            className="input h-32"
                            value={selectedColumns}
                            onChange={(e) => setSelectedColumns(Array.from(e.target.selectedOptions, option => option.value))}
                        >
                            {columns.map((col) => (
                                <option key={col.normalized_name} value={col.normalized_name}>
                                    {col.normalized_name} ({col.data_type})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Source
                        </label>
                        <select
                            className="input"
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
                        >
                            <option value="">All Sources</option>
                            <option value="active-directory">Active Directory</option>
                            <option value="verizon">Verizon</option>
                            <option value="mdm">MDM</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Start Date
                            </label>
                            <input
                                type="date"
                                className="input"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                End Date
                            </label>
                            <input
                                type="date"
                                className="input"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Format
                        </label>
                        <select
                            className="input"
                            value={format}
                            onChange={(e) => setFormat(e.target.value)}
                        >
                            <option value="json">JSON</option>
                            <option value="csv">CSV</option>
                            <option value="pdf">PDF</option>
                        </select>
                    </div>

                    <button
                        className="btn btn-primary w-full flex items-center justify-center space-x-2"
                        onClick={handleGenerateReport}
                    >
                        <DocumentArrowDownIcon className="h-5 w-5" />
                        <span>Generate Report</span>
                    </button>
                </div>
            </div>

            {/* Source Breakdown */}
            {stats?.sourceBreakdown && (
                <div className="card">
                    <h2 className="text-xl font-semibold mb-4">Source Breakdown</h2>
                    <div className="space-y-4">
                        {stats.sourceBreakdown.map((item) => (
                            <div key={item.source} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium">{item.source}</p>
                                    <p className="text-sm text-gray-500">{item.file_count} files</p>
                                </div>
                                <p className="text-lg font-semibold">{item.record_count} records</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
