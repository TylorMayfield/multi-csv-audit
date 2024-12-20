import { useState, useEffect } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function RecordMerging() {
    const [files, setFiles] = useState([]);
    const [types, setTypes] = useState([]);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [keyFields, setKeyFields] = useState([]);
    const [mergeStrategy, setMergeStrategy] = useState('latest');
    const [mergeInProgress, setMergeInProgress] = useState(false);
    const [mergeResults, setMergeResults] = useState(null);

    // Fetch files and types on mount
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [filesResponse, typesResponse] = await Promise.all([
                    fetch('/api/files'),
                    fetch('/api/csv-types')
                ]);

                if (filesResponse.ok && typesResponse.ok) {
                    const [filesData, typesData] = await Promise.all([
                        filesResponse.json(),
                        typesResponse.json()
                    ]);

                    setFiles(filesData);
                    setTypes(typesData);
                }
            } catch (error) {
                console.error('Failed to fetch data:', error);
            }
        };

        fetchData();
    }, []);

    const handleFileSelect = (fileId) => {
        setSelectedFiles(prev => {
            if (prev.includes(fileId)) {
                return prev.filter(id => id !== fileId);
            }
            return [...prev, fileId];
        });
    };

    const handleKeyFieldToggle = (field) => {
        setKeyFields(prev => {
            if (prev.includes(field)) {
                return prev.filter(f => f !== field);
            }
            return [...prev, field];
        });
    };

    const handleMerge = async () => {
        if (selectedFiles.length < 2) {
            alert('Please select at least 2 files to merge');
            return;
        }

        if (keyFields.length === 0) {
            alert('Please select at least one key field for merging');
            return;
        }

        setMergeInProgress(true);
        try {
            const response = await fetch('/api/merge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    files: selectedFiles,
                    keyFields,
                    strategy: mergeStrategy
                })
            });

            if (response.ok) {
                const results = await response.json();
                setMergeResults(results);
            } else {
                throw new Error('Merge failed');
            }
        } catch (error) {
            console.error('Merge error:', error);
            alert('Failed to merge records');
        } finally {
            setMergeInProgress(false);
        }
    };

    // Get all unique columns from selected files
    const getAvailableColumns = () => {
        const selectedFileTypes = files
            .filter(f => selectedFiles.includes(f.id))
            .map(f => types.find(t => t.id === f.type))
            .filter(Boolean);

        const columns = new Set();
        selectedFileTypes.forEach(type => {
            type.columns.forEach(col => columns.add(col.name));
        });

        return Array.from(columns);
    };

    return (
        <div className="space-y-6">
            {/* File Selection */}
            <div className="card">
                <h2 className="text-lg font-semibold mb-4">Select Files to Merge</h2>
                <div className="space-y-4">
                    {files.map((file) => {
                        const fileType = types.find(t => t.id === file.type);
                        return (
                            <div
                                key={file.id}
                                className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedFiles.includes(file.id)}
                                    onChange={() => handleFileSelect(file.id)}
                                    className="h-4 w-4 text-primary-600 rounded"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">
                                        {file.originalName}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Type: {fileType?.name || 'Unknown'}
                                    </p>
                                </div>
                                <div className="text-sm text-gray-500">
                                    {new Date(file.uploadDate).toLocaleDateString()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Merge Configuration */}
            {selectedFiles.length >= 2 && (
                <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Merge Configuration</h2>
                    
                    {/* Key Fields */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Key Fields for Matching Records
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {getAvailableColumns().map((column) => (
                                <label
                                    key={column}
                                    className="flex items-center space-x-2 p-2 bg-gray-50 rounded"
                                >
                                    <input
                                        type="checkbox"
                                        checked={keyFields.includes(column)}
                                        onChange={() => handleKeyFieldToggle(column)}
                                        className="h-4 w-4 text-primary-600 rounded"
                                    />
                                    <span className="text-sm text-gray-700">{column}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Merge Strategy */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Merge Strategy
                        </label>
                        <select
                            value={mergeStrategy}
                            onChange={(e) => setMergeStrategy(e.target.value)}
                            className="input"
                        >
                            <option value="latest">Keep Latest Value</option>
                            <option value="first">Keep First Value</option>
                            <option value="concatenate">Concatenate Values</option>
                        </select>
                    </div>

                    {/* Merge Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleMerge}
                            disabled={mergeInProgress}
                            className="btn btn-primary flex items-center space-x-2"
                        >
                            {mergeInProgress && (
                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            )}
                            <span>Merge Records</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Merge Results */}
            {mergeResults && (
                <div className="card">
                    <h2 className="text-lg font-semibold mb-4">Merge Results</h2>
                    <div className="space-y-4">
                        <div className="bg-green-50 p-4 rounded-lg">
                            <p className="text-green-700">
                                Successfully merged {mergeResults.totalRecords} records
                            </p>
                            <p className="text-sm text-green-600 mt-1">
                                {mergeResults.matchedRecords} records were matched and merged
                            </p>
                            {mergeResults.conflicts > 0 && (
                                <p className="text-sm text-yellow-600 mt-1">
                                    {mergeResults.conflicts} conflicts were resolved using the {mergeStrategy} strategy
                                </p>
                            )}
                        </div>

                        <div className="flex justify-end space-x-4">
                            <button
                                onClick={() => window.location.href = mergeResults.downloadUrl}
                                className="btn btn-secondary"
                            >
                                Download Merged Data
                            </button>
                            <button
                                onClick={() => setMergeResults(null)}
                                className="btn btn-primary"
                            >
                                Start New Merge
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
