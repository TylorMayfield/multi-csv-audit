import { useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function CSVTypeDefinition() {
    const [types, setTypes] = useState([]);
    const [newType, setNewType] = useState({
        name: '',
        description: '',
        columns: []
    });
    const [newColumn, setNewColumn] = useState({
        name: '',
        type: 'string',
        required: false
    });

    const fetchTypes = async () => {
        try {
            const response = await fetch('/api/csv-types');
            if (response.ok) {
                const data = await response.json();
                setTypes(data);
            }
        } catch (error) {
            console.error('Failed to fetch types:', error);
        }
    };

    const handleAddColumn = () => {
        if (newColumn.name) {
            setNewType(prev => ({
                ...prev,
                columns: [...prev.columns, { ...newColumn }]
            }));
            setNewColumn({
                name: '',
                type: 'string',
                required: false
            });
        }
    };

    const handleRemoveColumn = (index) => {
        setNewType(prev => ({
            ...prev,
            columns: prev.columns.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/csv-types', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newType)
            });

            if (response.ok) {
                setNewType({
                    name: '',
                    description: '',
                    columns: []
                });
                fetchTypes();
            }
        } catch (error) {
            console.error('Failed to create type:', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="card">
                <h2 className="text-lg font-semibold mb-4">Create CSV Type</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Type Name
                        </label>
                        <input
                            type="text"
                            value={newType.name}
                            onChange={(e) => setNewType(prev => ({ ...prev, name: e.target.value }))}
                            className="input mt-1"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            Description
                        </label>
                        <textarea
                            value={newType.description}
                            onChange={(e) => setNewType(prev => ({ ...prev, description: e.target.value }))}
                            className="input mt-1"
                            rows="3"
                        />
                    </div>

                    <div className="border-t pt-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">Columns</h3>
                        
                        {/* Column List */}
                        <div className="space-y-2 mb-4">
                            {newType.columns.map((column, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                                >
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm font-medium">{column.name}</span>
                                        <span className="text-xs text-gray-500">({column.type})</span>
                                        {column.required && (
                                            <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                                                Required
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveColumn(index)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add Column Form */}
                        <div className="grid grid-cols-3 gap-2">
                            <input
                                type="text"
                                placeholder="Column Name"
                                value={newColumn.name}
                                onChange={(e) => setNewColumn(prev => ({ ...prev, name: e.target.value }))}
                                className="input col-span-1"
                            />
                            <select
                                value={newColumn.type}
                                onChange={(e) => setNewColumn(prev => ({ ...prev, type: e.target.value }))}
                                className="input"
                            >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="date">Date</option>
                                <option value="boolean">Boolean</option>
                                <option value="email">Email</option>
                            </select>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="required"
                                    checked={newColumn.required}
                                    onChange={(e) => setNewColumn(prev => ({ ...prev, required: e.target.checked }))}
                                    className="h-4 w-4 text-blue-600 rounded"
                                />
                                <label htmlFor="required" className="text-sm text-gray-700">
                                    Required
                                </label>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddColumn}
                                className="btn btn-secondary col-span-3 flex items-center justify-center space-x-2"
                            >
                                <PlusIcon className="h-4 w-4" />
                                <span>Add Column</span>
                            </button>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button type="submit" className="btn btn-primary w-full">
                            Create CSV Type
                        </button>
                    </div>
                </form>
            </div>

            {/* Type List */}
            <div className="card">
                <h2 className="text-lg font-semibold mb-4">Defined Types</h2>
                <div className="space-y-4">
                    {types.map((type) => (
                        <div key={type.id} className="border rounded-lg p-4">
                            <h3 className="font-medium">{type.name}</h3>
                            <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                            <div className="mt-2">
                                <h4 className="text-sm font-medium text-gray-700">Columns:</h4>
                                <div className="mt-1 grid grid-cols-2 gap-2">
                                    {type.columns.map((column, index) => (
                                        <div
                                            key={index}
                                            className="text-sm bg-gray-50 p-2 rounded flex items-center justify-between"
                                        >
                                            <span>{column.name}</span>
                                            <span className="text-xs text-gray-500">{column.type}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
