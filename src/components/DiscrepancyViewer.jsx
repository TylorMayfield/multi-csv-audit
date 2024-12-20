import { useState, useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import {
    ExclamationTriangleIcon,
    ExclamationCircleIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

const severityIcons = {
    high: <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />,
    medium: <ExclamationCircleIcon className="h-5 w-5 text-yellow-500" />,
    low: <InformationCircleIcon className="h-5 w-5 text-blue-500" />
};

const severityColors = {
    high: 'rgb(239, 68, 68)',
    medium: 'rgb(245, 158, 11)',
    low: 'rgb(59, 130, 246)'
};

export default function DiscrepancyViewer({ fileId }) {
    const [discrepancies, setDiscrepancies] = useState([]);
    const [summary, setSummary] = useState(null);
    const [view, setView] = useState('list'); // 'list', 'chart', or 'details'
    const [selectedDiscrepancy, setSelectedDiscrepancy] = useState(null);

    useEffect(() => {
        if (fileId) {
            fetchDiscrepancies();
            fetchSummary();
        }
    }, [fileId]);

    const fetchDiscrepancies = async () => {
        try {
            const response = await fetch(`http://localhost:3001/api/files/${fileId}/discrepancies`);
            if (response.ok) {
                const data = await response.json();
                setDiscrepancies(data);
            }
        } catch (error) {
            console.error('Error fetching discrepancies:', error);
        }
    };

    const fetchSummary = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/discrepancies/summary');
            if (response.ok) {
                const data = await response.json();
                setSummary(data);
            }
        } catch (error) {
            console.error('Error fetching summary:', error);
        }
    };

    const prepareChartData = () => {
        if (!summary) return null;

        const sourceData = {};
        const severityData = {
            high: 0,
            medium: 0,
            low: 0
        };

        summary.forEach((item) => {
            // Source data
            if (!sourceData[item.source]) {
                sourceData[item.source] = 0;
            }
            sourceData[item.source] += item.count;

            // Severity data
            severityData[item.severity] += item.count;
        });

        return {
            sourceChart: {
                labels: Object.keys(sourceData),
                datasets: [
                    {
                        label: 'Discrepancies by Source',
                        data: Object.values(sourceData),
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1
                    }
                ]
            },
            severityChart: {
                labels: Object.keys(severityData),
                datasets: [
                    {
                        data: Object.values(severityData),
                        backgroundColor: Object.keys(severityData).map(
                            (severity) => severityColors[severity]
                        )
                    }
                ]
            }
        };
    };

    const chartData = prepareChartData();

    return (
        <div className="space-y-6">
            {/* View Toggle */}
            <div className="flex space-x-4">
                <button
                    onClick={() => setView('list')}
                    className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                >
                    List View
                </button>
                <button
                    onClick={() => setView('chart')}
                    className={`btn ${view === 'chart' ? 'btn-primary' : 'btn-secondary'}`}
                >
                    Charts
                </button>
            </div>

            {/* List View */}
            {view === 'list' && (
                <div className="space-y-4">
                    {discrepancies.map((discrepancy) => (
                        <div
                            key={discrepancy.id}
                            className="card hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => {
                                setSelectedDiscrepancy(discrepancy);
                                setView('details');
                            }}
                        >
                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0">
                                    {severityIcons[discrepancy.severity]}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                        <h4 className="text-lg font-medium">
                                            {discrepancy.discrepancy_type}
                                        </h4>
                                        <span
                                            className={`text-xs px-2 py-1 rounded ${
                                                discrepancy.severity === 'high'
                                                    ? 'bg-red-100 text-red-800'
                                                    : discrepancy.severity === 'medium'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-blue-100 text-blue-800'
                                            }`}
                                        >
                                            {discrepancy.severity}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {discrepancy.description}
                                    </p>
                                    <div className="text-xs text-gray-500 mt-2">
                                        File: {discrepancy.filename}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Chart View */}
            {view === 'chart' && chartData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="card">
                        <h3 className="text-lg font-semibold mb-4">Discrepancies by Source</h3>
                        <Bar
                            data={chartData.sourceChart}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: {
                                        display: false
                                    }
                                }
                            }}
                        />
                    </div>
                    <div className="card">
                        <h3 className="text-lg font-semibold mb-4">Discrepancies by Severity</h3>
                        <Pie
                            data={chartData.severityChart}
                            options={{
                                responsive: true,
                                plugins: {
                                    legend: {
                                        position: 'bottom'
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Details View */}
            {view === 'details' && selectedDiscrepancy && (
                <div className="card">
                    <button
                        onClick={() => {
                            setView('list');
                            setSelectedDiscrepancy(null);
                        }}
                        className="btn btn-secondary mb-4"
                    >
                        Back to List
                    </button>

                    <div className="space-y-4">
                        <div>
                            <h3 className="text-xl font-semibold flex items-center space-x-2">
                                <span>{severityIcons[selectedDiscrepancy.severity]}</span>
                                <span>{selectedDiscrepancy.discrepancy_type}</span>
                            </h3>
                            <p className="text-gray-600 mt-2">{selectedDiscrepancy.description}</p>
                        </div>

                        <div>
                            <h4 className="font-medium mb-2">Record Data</h4>
                            <pre className="bg-gray-50 p-4 rounded-md overflow-x-auto">
                                {JSON.stringify(selectedDiscrepancy.record_data, null, 2)}
                            </pre>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="font-medium">File:</span>{' '}
                                {selectedDiscrepancy.filename}
                            </div>
                            <div>
                                <span className="font-medium">Created:</span>{' '}
                                {new Date(selectedDiscrepancy.created_at).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
