import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function ColumnMappings({ csvTypeId }) {
    const [mappings, setMappings] = useState([]);
    const [sources, setSources] = useState(['active-directory', 'verizon', 'mdm', 'other']);
    const [selectedSource, setSelectedSource] = useState('');
    const [newMapping, setNewMapping] = useState({
        sourceColumn: '',
        targetColumn: '',
        transformationRule: ''
    });
    const [availableColumns, setAvailableColumns] = useState([]);
    const [transformationRules] = useState([
        'UPPERCASE',
        'LOWERCASE',
        'TRIM',
        'NUMBER',
        'BOOLEAN',
        'CUSTOM_AD_STATUS',
        'CUSTOM_DATE_FORMAT'
    ]);

    useEffect(() => {
        if (csvTypeId) {
            fetchTypeColumns();
            fetchMappings();
        }
    }, [csvTypeId]);

    const fetchTypeColumns = async () => {
        try {
            const response = await fetch(`http://localhost:3001/api/csv-types/${csvTypeId}`);
            if (response.ok) {
                const data = await response.json();
                setAvailableColumns(data.columns || []);
            }
        } catch (error) {
            console.error('Error fetching type columns:', error);
        }
    };

    const fetchMappings = async () => {
        try {
            const response = await fetch(`http://localhost:3001/api/csv-types/${csvTypeId}/mappings`);
            if (response.ok) {
                const data = await response.json();
                setMappings(data);
            }
        } catch (error) {
            console.error('Error fetching mappings:', error);
        }
    };

    const handleAddMapping = async () => {
        try {
            const response = await fetch(`http://localhost:3001/api/csv-types/${csvTypeId}/mappings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    source: selectedSource,
                    mappings: [newMapping]
                })
            });

            if (response.ok) {
                fetchMappings();
                setNewMapping({
                    sourceColumn: '',
                    targetColumn: '',
                    transformationRule: ''
                });
            }
        } catch (error) {
            console.error('Error adding mapping:', error);
        }
    };

    const handleRemoveMapping = async (mappingId) => {
        try {
            const response = await fetch(
                `http://localhost:3001/api/csv-types/${csvTypeId}/mappings/${mappingId}`,
                {
                    method: 'DELETE'
                }
            );

            if (response.ok) {
                fetchMappings();
            }
        } catch (error) {
            console.error('Error removing mapping:', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="card">
                <h3 className="text-lg font-semibold mb-4">Column Mappings</h3>

                {/* Source Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Source
                    </label>
                    <select
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value)}
                        className="input"
                    >
                        <option value="">Select a source</option>
                        {sources.map((source) => (
                            <option key={source} value={source}>
                                {source}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Existing Mappings */}
                {mappings.length > 0 && (
                    <div className="mb-6">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Current Mappings</h4>
                        <div className="space-y-2">
                            {mappings.map((mapping) => (
                                <div
                                    key={mapping.id}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                                >
                                    <div>
                                        <div className="text-sm font-medium">
                                            {mapping.source_column} → {mapping.target_column}
                                        </div>
                                        {mapping.transformation_rule && (
                                            <div className="text-xs text-gray-500">
                                                Transform: {mapping.transformation_rule}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleRemoveMapping(mapping.id)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Add New Mapping */}
                {selectedSource && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Add New Mapping</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                placeholder="Source Column"
                                value={newMapping.sourceColumn}
                                onChange={(e) =>
                                    setNewMapping({
                                        ...newMapping,
                                        sourceColumn: e.target.value
                                    })
                                }
                                className="input"
                            />
                            <select
                                value={newMapping.targetColumn}
                                onChange={(e) =>
                                    setNewMapping({
                                        ...newMapping,
                                        targetColumn: e.target.value
                                    })
                                }
                                className="input"
                            >
                                <option value="">Select Target Column</option>
                                {availableColumns.map((column) => (
                                    <option key={column.name} value={column.name}>
                                        {column.display_name}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={newMapping.transformationRule}
                                onChange={(e) =>
                                    setNewMapping({
                                        ...newMapping,
                                        transformationRule: e.target.value
                                    })
                                }
                                className="input"
                            >
                                <option value="">Select Transformation (Optional)</option>
                                {transformationRules.map((rule) => (
                                    <option key={rule} value={rule}>
                                        {rule}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={handleAddMapping}
                                className="btn btn-primary flex items-center justify-center space-x-2"
                            >
                                <PlusIcon className="h-5 w-5" />
                                <span>Add Mapping</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
