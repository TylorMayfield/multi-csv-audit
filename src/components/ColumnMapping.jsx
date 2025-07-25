import { useState, useEffect } from 'react';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';

export default function ColumnMapping() {
    const [types, setTypes] = useState([]);
    const [mappings, setMappings] = useState({});
    const [sourceType, setSourceType] = useState('');
    const [targetType, setTargetType] = useState('');
    const [columnMappings, setColumnMappings] = useState([]);
    const [primaryKey, setPrimaryKey] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch CSV types
    useEffect(() => {
        const fetchTypes = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/csv-types');
                if (response.ok) {
                    const data = await response.json();
                    setTypes(data || []);
                } else {
                    throw new Error('Failed to fetch types');
                }
            } catch (error) {
                console.error('Failed to fetch types:', error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchTypes();
    }, []);

    // Fetch existing mappings
    useEffect(() => {
        const fetchMappings = async () => {
            try {
                const response = await fetch('/api/mappings');
                if (response.ok) {
                    const data = await response.json();
                    setMappings(data || {});
                } else {
                    throw new Error('Failed to fetch mappings');
                }
            } catch (error) {
                console.error('Failed to fetch mappings:', error);
                setError(error.message);
            }
        };

        fetchMappings();
    }, []);

    // Handle type selection
    useEffect(() => {
        if (sourceType && targetType) {
            const mappingKey = `${sourceType}-${targetType}`;
            const existingMapping = mappings[mappingKey];
            if (existingMapping) {
                setColumnMappings(existingMapping.columnMappings);
                setPrimaryKey(existingMapping.primaryKey || '');
            } else {
                // Initialize empty mappings for all source columns
                const sourceTypeObj = types.find(t => t.id === sourceType);
                if (sourceTypeObj) {
                    setColumnMappings(
                        sourceTypeObj.columns.map(col => ({
                            sourceColumn: col.name,
                            targetColumn: '',
                            transformation: 'none'
                        }))
                    );
                    setPrimaryKey('');
                }
            }
        }
    }, [sourceType, targetType, mappings, types]);

    const handleSaveMapping = async () => {
        if (!primaryKey) {
            alert('Please select a primary key column for merging');
            return;
        }

        try {
            const response = await fetch('/api/mappings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sourceType,
                    targetType,
                    columnMappings,
                    primaryKey
                })
            });

            if (response.ok) {
                alert('Mapping saved successfully');
                // Refresh mappings
                const mappingsResponse = await fetch('/api/mappings');
                if (mappingsResponse.ok) {
                    const data = await mappingsResponse.json();
                    setMappings(data);
                }
            }
        } catch (error) {
            console.error('Failed to save mapping:', error);
            alert('Failed to save mapping');
        }
    };

    const updateColumnMapping = (index, field, value) => {
        setColumnMappings(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    return (
        <div className="space-y-6">
            <div className="card">
                <h2 className="text-lg font-semibold mb-4">Create Column Mapping</h2>

                {/* Type Selection */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Source Type
                        </label>
                        <select
                            value={sourceType}
                            onChange={(e) => setSourceType(e.target.value)}
                            className="input"
                        >
                            <option value="">Select source type...</option>
                            {(types || []).map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Target Type
                        </label>
                        <select
                            value={targetType}
                            onChange={(e) => setTargetType(e.target.value)}
                            className="input"
                        >
                            <option value="">Select target type...</option>
                            {(types || []).map((type) => (
                                <option key={type.id} value={type.id}>
                                    {type.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Primary Key Column
                        </label>
                        <select
                            value={primaryKey}
                            onChange={(e) => setPrimaryKey(e.target.value)}
                            className="input"
                        >
                            <option value="">Select primary key column...</option>
                            {(sourceType && types.find(t => t.id === sourceType)?.columns || []).map((col) => (
                                <option key={col.name} value={col.name}>
                                    {col.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Mapping Table */}
                {sourceType && targetType && (
                    <div className="space-y-4">
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead>
                                <tr>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                        Source Column
                                    </th>
                                    <th className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                                        <ArrowsRightLeftIcon className="h-5 w-5 inline" />
                                    </th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                        Target Column
                                    </th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                        Transformation
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {(columnMappings || []).map((mapping, index) => (
                                    <tr key={index}>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                            {mapping.sourceColumn}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-400 text-center">
                                            →
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                                            <select
                                                value={mapping.targetColumn}
                                                onChange={(e) => updateColumnMapping(index, 'targetColumn', e.target.value)}
                                                className="input"
                                            >
                                                <option value="">Select target column...</option>
                                                {(types.find(t => t.id === targetType)?.columns || []).map(col => (
                                                    <option key={col.name} value={col.name}>
                                                        {col.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                                            <select
                                                value={mapping.transformation}
                                                onChange={(e) => updateColumnMapping(index, 'transformation', e.target.value)}
                                                className="input"
                                            >
                                                <option value="none">None</option>
                                                <option value="uppercase">Uppercase</option>
                                                <option value="lowercase">Lowercase</option>
                                                <option value="trim">Trim</option>
                                                <option value="number">To Number</option>
                                                <option value="date">To Date</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex justify-end">
                            <button
                                onClick={handleSaveMapping}
                                className="btn btn-primary"
                            >
                                Save Mapping
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Existing Mappings */}
            <div className="card">
                <h2 className="text-lg font-semibold mb-4">Existing Mappings</h2>
                {loading ? (
                    <div className="text-center py-4">Loading...</div>
                ) : error ? (
                    <div className="text-center text-red-600 py-4">{error}</div>
                ) : (
                    <div className="space-y-4">
                        {Object.entries(mappings || {}).map(([key, mapping]) => {
                            const sourceTypeName = (types.find(t => t.id === mapping.sourceType)?.name) || 'Unknown';
                            const targetTypeName = (types.find(t => t.id === mapping.targetType)?.name) || 'Unknown';
                            
                            return (
                                <div key={key} className="border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-medium">
                                            {sourceTypeName} →{' '}
                                            {targetTypeName}
                                            <span className="ml-2 text-xs text-gray-500">
                                                (Primary Key: {mapping.primaryKey || 'None'})
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Created: {new Date(mapping.created).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(mapping.columnMappings || []).map((colMap, index) => (
                                            <div
                                                key={index}
                                                className="text-sm bg-gray-50 p-2 rounded flex items-center justify-between"
                                            >
                                                <span>{colMap.sourceColumn}</span>
                                                <ArrowsRightLeftIcon className="h-4 w-4 text-gray-400 mx-2" />
                                                <span>{colMap.targetColumn}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        {!Object.keys(mappings || {}).length && (
                            <p className="text-center text-sm text-gray-500 py-4">
                                No mappings created yet
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
