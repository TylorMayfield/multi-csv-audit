'use client'

import { useState, useEffect } from "react";
import { PlusIcon, TrashIcon, PencilIcon } from "@heroicons/react/24/outline";

interface ColumnDefinition {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'email';
  required: boolean;
  userField?: string;
}

interface PlatformTypeSchema {
  columns: ColumnDefinition[];
  primaryKeyFields: string[];
  userIdentificationFields: {
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
  };
}

interface PlatformType {
  id: string;
  name: string;
  description: string;
  version: number;
  schema: PlatformTypeSchema;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NewPlatformType {
  name: string;
  description: string;
  schema: PlatformTypeSchema;
}

export default function PlatformTypeManager() {
  const [platformTypes, setPlatformTypes] = useState<PlatformType[]>([]);
  const [newType, setNewType] = useState<NewPlatformType>({
    name: "",
    description: "",
    schema: {
      columns: [],
      primaryKeyFields: [],
      userIdentificationFields: {}
    }
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newColumn, setNewColumn] = useState<ColumnDefinition>({
    name: "",
    type: "string",
    required: false,
    userField: ""
  });

  const fetchPlatformTypes = async () => {
    try {
      const response = await fetch("/api/platform-types");
      if (response.ok) {
        const data = await response.json();
        setPlatformTypes(data);
      }
    } catch (error) {
      console.error("Failed to fetch platform types:", error);
    }
  };

  useEffect(() => {
    fetchPlatformTypes();
  }, []);

  const handleAddColumn = () => {
    if (newColumn.name) {
      setNewType((prev) => ({
        ...prev,
        schema: {
          ...prev.schema,
          columns: [...prev.schema.columns, { ...newColumn }]
        }
      }));
      setNewColumn({
        name: "",
        type: "string",
        required: false,
        userField: ""
      });
    }
  };

  const handleRemoveColumn = (index: number) => {
    setNewType((prev) => ({
      ...prev,
      schema: {
        ...prev.schema,
        columns: prev.schema.columns.filter((_, i) => i !== index)
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId ? `/api/platform-types/${editingId}` : "/api/platform-types";
      const method = editingId ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newType),
      });

      if (response.ok) {
        resetForm();
        fetchPlatformTypes();
        alert(editingId ? "Platform type updated successfully!" : "Platform type created successfully!");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to save platform type");
      }
    } catch (error) {
      console.error("Failed to save platform type:", error);
      alert("Failed to save platform type");
    }
  };

  const resetForm = () => {
    setNewType({
      name: "",
      description: "",
      schema: {
        columns: [],
        primaryKeyFields: [],
        userIdentificationFields: {}
      }
    });
    setEditingId(null);
  };

  const handleEdit = (platformType: PlatformType) => {
    setNewType({
      name: platformType.name,
      description: platformType.description,
      schema: platformType.schema
    });
    setEditingId(platformType.id);
  };

  const handleDelete = async (id: string, forceDelete = false) => {
    const confirmMessage = forceDelete 
      ? "Are you sure you want to FORCE DELETE this platform type and ALL associated data? This cannot be undone!"
      : "Are you sure you want to delete this platform type?";
      
    if (confirm(confirmMessage)) {
      try {
        const url = forceDelete 
          ? `/api/platform-types/${id}?force=true`
          : `/api/platform-types/${id}`;
          
        const response = await fetch(url, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          const result = await response.json();
          fetchPlatformTypes();
          alert(result.message || "Platform type deleted successfully!");
        } else {
          const error = await response.json();
          
          // Check if this is a case where we can offer force delete
          if (error.canForceDelete) {
            const forceConfirm = confirm(
              `${error.details}\n\nAssociated data imports:\n${
                error.dataImports?.map((imp: any) => 
                  `- ${imp.filename} (${imp.recordCount} records)`
                ).join('\n') || 'Unknown imports'
              }\n\nDo you want to FORCE DELETE and remove all this data?`
            );
            
            if (forceConfirm) {
              // Retry with force delete
              await handleDelete(id, true);
              return;
            }
          } else {
            alert(error.error || "Failed to delete platform type");
          }
        }
      } catch (error) {
        console.error('Failed to delete platform type:', error);
        alert("Failed to delete platform type");
      }
    }
  };

  const updateUserIdentificationField = (field: string, value: string) => {
    setNewType(prev => ({
      ...prev,
      schema: {
        ...prev.schema,
        userIdentificationFields: {
          ...prev.schema.userIdentificationFields,
          [field]: value || undefined
        }
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg leading-6 font-medium text-white">
            {editingId ? "Edit Platform Type" : "Create Platform Type"}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Define the structure and user identification fields for a platform
          </p>
        </div>
        
        <div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Platform Name
                </label>
                <input
                  type="text"
                  value={newType.name}
                  onChange={(e) =>
                    setNewType((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="form-input"
                  placeholder="Enter platform name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={newType.description}
                  onChange={(e) =>
                    setNewType((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="form-input"
                  placeholder="Brief description of the platform"
                />
              </div>
            </div>

            {/* User Identification Fields */}
            <div className="border-t border-gray-700 pt-6">
              <h4 className="text-md font-medium text-white mb-4">User Identification Mapping</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    First Name Field
                  </label>
                  <select
                    value={newType.schema.userIdentificationFields.firstName || ""}
                    onChange={(e) => updateUserIdentificationField("firstName", e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select column...</option>
                    {newType.schema.columns.map((col, index) => (
                      <option key={index} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Last Name Field
                  </label>
                  <select
                    value={newType.schema.userIdentificationFields.lastName || ""}
                    onChange={(e) => updateUserIdentificationField("lastName", e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select column...</option>
                    {newType.schema.columns.map((col, index) => (
                      <option key={index} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email Field
                  </label>
                  <select
                    value={newType.schema.userIdentificationFields.email || ""}
                    onChange={(e) => updateUserIdentificationField("email", e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select column...</option>
                    {newType.schema.columns.map((col, index) => (
                      <option key={index} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Username Field
                  </label>
                  <select
                    value={newType.schema.userIdentificationFields.username || ""}
                    onChange={(e) => updateUserIdentificationField("username", e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select column...</option>
                    {newType.schema.columns.map((col, index) => (
                      <option key={index} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Columns Section */}
            <div className="border-t border-gray-700 pt-6">
              <h4 className="text-md font-medium text-white mb-4">CSV Columns</h4>

              {/* Column List */}
              <div className="space-y-2 mb-4">
                {newType.schema.columns.map((column, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-white">{column.name}</span>
                      <span className="status-badge status-info">
                        {column.type}
                      </span>
                      {column.required && (
                        <span className="status-badge status-warning">
                          Required
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveColumn(index)}
                      className="btn-icon text-red-400 hover:text-red-300 hover:bg-red-900/30 bg-red-900/10 border border-red-800/30"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Column Form */}
              <div className="bg-gray-700/30 border border-gray-600 p-4 rounded-lg">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <div>
                    <input
                      type="text"
                      placeholder="Column Name"
                      value={newColumn.name}
                      onChange={(e) =>
                        setNewColumn((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="form-input"
                    />
                  </div>
                  <div>
                    <select
                      value={newColumn.type}
                      onChange={(e) =>
                        setNewColumn((prev) => ({ ...prev, type: e.target.value as any }))
                      }
                      className="form-select"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="boolean">Boolean</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="required"
                      checked={newColumn.required}
                      onChange={(e) =>
                        setNewColumn((prev) => ({
                          ...prev,
                          required: e.target.checked,
                        }))
                      }
                      className="form-checkbox"
                    />
                    <label htmlFor="required" className="ml-2 text-sm text-gray-300">
                      Required
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddColumn}
                    className="btn btn-outline-success"
                  >
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-700">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn btn-success"
              >
                {editingId ? "Update" : "Create"} Platform Type
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Platform Types List */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg leading-6 font-medium text-white">
            Defined Platform Types
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Manage your platform type definitions and their schemas
          </p>
        </div>
        
        <div className="divide-y divide-gray-700">
          {platformTypes.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <div className="mx-auto h-12 w-12 text-gray-600 mb-3">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p>No platform types defined yet</p>
            </div>
          ) : (
            platformTypes.map((platformType) => (
              <div key={platformType.id} className="px-6 py-5 hover:bg-gray-700/20 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-lg font-medium text-white">
                        {platformType.name}
                      </h4>
                      <span className="ml-2 status-badge status-info">
                        v{platformType.version}
                      </span>
                      {!platformType.isActive && (
                        <span className="ml-2 status-badge status-warning">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-400">
                      {platformType.description}
                    </p>
                    <div className="mt-2">
                      <p className="text-xs text-gray-500">
                        {platformType.schema?.columns?.length || 0} columns • 
                        Created {new Date(platformType.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(platformType)}
                      className="btn-icon text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(platformType.id)}
                      className="btn-icon text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Column Details */}
                <div className="mt-4">
                  <h5 className="text-sm font-medium text-gray-300 mb-2">Columns:</h5>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {(platformType.schema?.columns || []).map((column, index) => (
                      <div
                        key={index}
                        className="text-xs bg-gray-700/50 border border-gray-600 p-2 rounded flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-200">{column.name}</span>
                        <span className="text-gray-400">{column.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
