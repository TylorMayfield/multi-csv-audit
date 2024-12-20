import { useState, useEffect } from 'react';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function CSVTypeManager() {
    const [types, setTypes] = useState([]);
    const [selectedType, setSelectedType] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [newColumn, setNewColumn] = useState({
        name: '',
        displayName: '',
        dataType: 'string',
        required: false,
        validationRegex: '',
        description: ''
    });

    useEffect(() => {
        fetchTypes();
    }, []);

    const fetchTypes = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/csv-types');
            if (response.ok) {
                const data = await response.json();
                setTypes(data);
            }
        } catch (error) {
            console.error('Error fetching CSV types:', error);
        }
    };

    const handleCreateType = async () => {
        const newType = {
            name: '',
            description: '',
            columns: []
        };
        setSelectedType(newType);
        setIsEditing(true);
    };

    const handleSaveType = async () => {
        try {
            const method = selectedType.id ? 'PUT' : 'POST';
            const url = selectedType.id 
                ? `http://localhost:3001/api/csv-types/${selectedType.id}`
                : 'http://localhost:3001/api/csv-types';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(selectedType)
            });

            if (response.ok) {
                setIsEditing(false);
                fetchTypes();
            }
        } catch (error) {
            console.error('Error saving CSV type:', error);
        }
    };

    const handleAddColumn = () => {
        if (selectedType) {
            setSelectedType({
                ...selectedType,
                columns: [...(selectedType.columns || []), newColumn]
            });
            setNewColumn({
                name: '',
                displayName: '',
                dataType: 'string',
                required: false,
                validationRegex: '',
                description: ''
            });
        }
    };

    const handleRemoveColumn = (index) => {
        if (selectedType) {
            const newColumns = [...selectedType.columns];
            newColumns.splice(index, 1);
            setSelectedType({
                ...selectedType,
                columns: newColumns
            });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">CSV Type Management</h2>
                <button
                    onClick={handleCreateType}
                    className="btn btn-primary flex items-center space-x-2"
                >
                    <PlusIcon className="h-5 w-5" />
                    <span>New Type</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Type List */}
                <div className="card">
                    <h3 className="text-lg font-semibold mb-4">CSV Types</h3>
                    <div className="space-y-2">
                        {types.map((type) => (
                            <button
                                key={type.id}
                                onClick={() => setSelectedType(type)}
                                className={`w-full text-left px-4 py-2 rounded-md ${
                                    selectedType?.id === type.id
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'hover:bg-gray-50'
                                }`}
                            >
                                {type.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Type Details */}
                {selectedType && (
                    <div className="col-span-2 space-y-6">
                        <div className="card">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold">
                                        {isEditing ? 'Edit Type' : selectedType.name}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {selectedType.description}
                                    </p>
                                </div>
                                {!isEditing && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="btn btn-secondary"
                                    >
                                        <PencilIcon className="h-5 w-5" />
                                    </button>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Name
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedType.name}
                                            onChange={(e) =>
                                                setSelectedType({
                                                    ...selectedType,
                                                    name: e.target.value
                                                })
                                            }
                                            className="input mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">
                                            Description
                                        </label>
                                        <textarea
                                            value={selectedType.description}
                                            onChange={(e) =>
                                                setSelectedType({
                                                    ...selectedType,
                                                    description: e.target.value
                                                })
                                            }
                                            className="input mt-1"
                                            rows="3"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="prose">
                                    <p>{selectedType.description}</p>
                                </div>
                            )}
                        </div>

                        {/* Columns */}
                        <div className="card">
                            <h3 className="text-lg font-semibold mb-4">Columns</h3>
                            <div className="space-y-4">
                                {selectedType.columns?.map((column, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start space-x-4 p-4 bg-gray-50 rounded-md"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2">
                                                <span className="font-medium">
                                                    {column.displayName}
                                                </span>
                                                {column.required && (
                                                    <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                                        Required
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                {column.name} ({column.dataType})
                                            </div>
                                            {column.description && (
                                                <p className="text-sm text-gray-600 mt-1">
                                                    {column.description}
                                                </p>
                                            )}
                                        </div>
                                        {isEditing && (
                                            <button
                                                onClick={() => handleRemoveColumn(index)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {isEditing && (
                                    <div className="border-t pt-4">
                                        <h4 className="text-sm font-medium mb-2">Add New Column</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <input
                                                type="text"
                                                placeholder="Column Name"
                                                value={newColumn.name}
                                                onChange={(e) =>
                                                    setNewColumn({
                                                        ...newColumn,
                                                        name: e.target.value
                                                    })
                                                }
                                                className="input"
                                            />
                                            <input
                                                type="text"
                                                placeholder="Display Name"
                                                value={newColumn.displayName}
                                                onChange={(e) =>
                                                    setNewColumn({
                                                        ...newColumn,
                                                        displayName: e.target.value
                                                    })
                                                }
                                                className="input"
                                            />
                                            <select
                                                value={newColumn.dataType}
                                                onChange={(e) =>
                                                    setNewColumn({
                                                        ...newColumn,
                                                        dataType: e.target.value
                                                    })
                                                }
                                                className="input"
                                            >
                                                <option value="string">String</option>
                                                <option value="number">Number</option>
                                                <option value="date">Date</option>
                                                <option value="email">Email</option>
                                                <option value="boolean">Boolean</option>
                                            </select>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id="required"
                                                    checked={newColumn.required}
                                                    onChange={(e) =>
                                                        setNewColumn({
                                                            ...newColumn,
                                                            required: e.target.checked
                                                        })
                                                    }
                                                    className="h-4 w-4 text-primary-600"
                                                />
                                                <label
                                                    htmlFor="required"
                                                    className="text-sm text-gray-700"
                                                >
                                                    Required
                                                </label>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Validation Regex"
                                                value={newColumn.validationRegex}
                                                onChange={(e) =>
                                                    setNewColumn({
                                                        ...newColumn,
                                                        validationRegex: e.target.value
                                                    })
                                                }
                                                className="input col-span-2"
                                            />
                                            <textarea
                                                placeholder="Description"
                                                value={newColumn.description}
                                                onChange={(e) =>
                                                    setNewColumn({
                                                        ...newColumn,
                                                        description: e.target.value
                                                    })
                                                }
                                                className="input col-span-2"
                                                rows="2"
                                            />
                                            <button
                                                onClick={handleAddColumn}
                                                className="btn btn-secondary col-span-2"
                                            >
                                                Add Column
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {isEditing && (
                            <div className="flex justify-end space-x-4">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button onClick={handleSaveType} className="btn btn-primary">
                                    Save Type
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
