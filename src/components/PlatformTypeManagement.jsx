import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';

export default function PlatformTypeManagement() {
    const [platformTypes, setPlatformTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        columns: []
    });
    const [newColumn, setNewColumn] = useState({
        name: '',
        type: 'string',
        required: false,
        isIdentifier: false,
        isPrimaryKey: false
    });

    useEffect(() => {
        fetchPlatformTypes();
    }, []);

    const fetchPlatformTypes = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/platform-types');
            if (response.ok) {
                const data = await response.json();
                setPlatformTypes(data);
            }
        } catch (error) {
            console.error('Error fetching platform types:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = editingType ? `/api/platform-types/${editingType.id}` : '/api/platform-types';
            const method = editingType ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                await fetchPlatformTypes();
                resetForm();
                setShowModal(false);
            } else {
                const error = await response.json();
                alert(`Error: ${error.error}`);
            }
        } catch (error) {
            console.error('Error saving platform type:', error);
            alert('Error saving platform type');
        }
    };

    const handleEdit = async (platformType) => {
        try {
            const response = await fetch(`/api/platform-types/${platformType.id}`);
            if (response.ok) {
                const data = await response.json();
                setEditingType(platformType);
                setFormData({
                    name: data.name,
                    description: data.description,
                    columns: data.schema || []
                });
                setShowModal(true);
            }
        } catch (error) {
            console.error('Error fetching platform type details:', error);
        }
    };

    const handleDelete = async (platformType) => {
        if (window.confirm(`Are you sure you want to delete "${platformType.name}"?`)) {
            try {
                const response = await fetch(`/api/platform-types/${platformType.id}`, {
                    method: 'DELETE',
                });

                if (response.ok) {
                    await fetchPlatformTypes();
                } else {
                    const error = await response.json();
                    alert(`Error: ${error.error}`);
                }
            } catch (error) {
                console.error('Error deleting platform type:', error);
                alert('Error deleting platform type');
            }
        }
    };

    const addColumn = () => {
        if (newColumn.name.trim()) {
            setFormData(prev => ({
                ...prev,
                columns: [...prev.columns, { ...newColumn }]
            }));
            setNewColumn({
                name: '',
                type: 'string',
                required: false,
                isIdentifier: false,
                isPrimaryKey: false
            });
        }
    };

    const removeColumn = (index) => {
        setFormData(prev => ({
            ...prev,
            columns: prev.columns.filter((_, i) => i !== index)
        }));
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            columns: []
        });
        setEditingType(null);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-xl font-semibold text-gray-900">Platform Types</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Define and manage data source types (platforms) for CSV imports
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                    <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
                    >
                        <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                        Add Platform Type
                    </button>
                </div>
            </div>

            {/* Platform Types List */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {platformTypes.map((platformType) => (
                        <li key={platformType.id}>
                            <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                                <span className="text-blue-600 font-medium">
                                                    {platformType.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            <div className="flex items-center">
                                                <p className="text-sm font-medium text-gray-900">
                                                    {platformType.name}
                                                </p>
                                                <span className="ml-2 text-xs text-gray-500">
                                                    v{platformType.version}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                {platformType.description}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                Created: {new Date(platformType.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleEdit(platformType)}
                                            className="text-blue-600 hover:text-blue-900"
                                        >
                                            <PencilIcon className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(platformType)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                        
                        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
                            <form onSubmit={handleSubmit}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="w-full">
                                            <div className="mt-3 text-center sm:mt-0 sm:text-left">
                                                <h3 className="text-lg leading-6 font-medium text-gray-900">
                                                    {editingType ? 'Edit Platform Type' : 'Add New Platform Type'}
                                                </h3>
                                                
                                                <div className="mt-6 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                                    <div className="sm:col-span-3">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Name
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={formData.name}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                            required
                                                        />
                                                    </div>
                                                    
                                                    <div className="sm:col-span-6">
                                                        <label className="block text-sm font-medium text-gray-700">
                                                            Description
                                                        </label>
                                                        <textarea
                                                            value={formData.description}
                                                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                                            rows={3}
                                                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Columns Section */}
                                                <div className="mt-6">
                                                    <h4 className="text-sm font-medium text-gray-700 mb-4">Columns</h4>
                                                    
                                                    {/* Existing Columns */}
                                                    <div className="space-y-2 mb-4">
                                                        {formData.columns.map((column, index) => (
                                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                                                <div className="flex items-center space-x-4">
                                                                    <span className="font-medium">{column.name}</span>
                                                                    <span className="text-sm text-gray-500">({column.type})</span>
                                                                    {column.required && (
                                                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Required</span>
                                                                    )}
                                                                    {column.isIdentifier && (
                                                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Identifier</span>
                                                                    )}
                                                                    {column.isPrimaryKey && (
                                                                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Primary Key</span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeColumn(index)}
                                                                    className="text-red-600 hover:text-red-800"
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Add New Column */}
                                                    <div className="grid grid-cols-6 gap-4 items-end">
                                                        <div className="col-span-2">
                                                            <label className="block text-sm font-medium text-gray-700">Column Name</label>
                                                            <input
                                                                type="text"
                                                                value={newColumn.name}
                                                                onChange={(e) => setNewColumn(prev => ({ ...prev, name: e.target.value }))}
                                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                                placeholder="e.g., Email"
                                                            />
                                                        </div>
                                                        
                                                        <div className="col-span-1">
                                                            <label className="block text-sm font-medium text-gray-700">Type</label>
                                                            <select
                                                                value={newColumn.type}
                                                                onChange={(e) => setNewColumn(prev => ({ ...prev, type: e.target.value }))}
                                                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                            >
                                                                <option value="string">String</option>
                                                                <option value="number">Number</option>
                                                                <option value="date">Date</option>
                                                                <option value="boolean">Boolean</option>
                                                                <option value="email">Email</option>
                                                            </select>
                                                        </div>
                                                        
                                                        <div className="col-span-2 space-y-2">
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={newColumn.required}
                                                                    onChange={(e) => setNewColumn(prev => ({ ...prev, required: e.target.checked }))}
                                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                                />
                                                                <label className="ml-2 block text-sm text-gray-900">Required</label>
                                                            </div>
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={newColumn.isIdentifier}
                                                                    onChange={(e) => setNewColumn(prev => ({ ...prev, isIdentifier: e.target.checked }))}
                                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                                />
                                                                <label className="ml-2 block text-sm text-gray-900">Identifier</label>
                                                            </div>
                                                            <div className="flex items-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={newColumn.isPrimaryKey}
                                                                    onChange={(e) => setNewColumn(prev => ({ ...prev, isPrimaryKey: e.target.checked }))}
                                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                                />
                                                                <label className="ml-2 block text-sm text-gray-900">Primary Key</label>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="col-span-1">
                                                            <button
                                                                type="button"
                                                                onClick={addColumn}
                                                                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                            >
                                                                <PlusIcon className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <button
                                        type="submit"
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        {editingType ? 'Update' : 'Create'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false);
                                            resetForm();
                                        }}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
