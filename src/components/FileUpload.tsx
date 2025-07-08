'use client'

import { useState, useCallback, useEffect } from "react";
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

interface PlatformType {
  id: string;
  name: string;
  version: number;
}

interface UploadResults {
  platformType: string;
  data: {
    recordCount: number;
  };
  consolidationResults?: {
    newUsers: number;
    existingUsers: number;
    errors: string[];
  };
}

interface UploadedFile {
  id: string;
  original_filename: string;
  platform_name: string;
  record_count: number;
  import_date: string;
  import_status: 'pending' | 'completed' | 'failed';
}

export default function FileUpload() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [platformTypes, setPlatformTypes] = useState<PlatformType[]>([]);
  const [selectedPlatformType, setSelectedPlatformType] = useState("");
  const [uploadResults, setUploadResults] = useState<UploadResults | null>(null);

  // Fetch platform types on mount
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
    fetchFiles();
  }, []);

  // Fetch uploaded files
  const fetchFiles = async () => {
    try {
      const response = await fetch("/api/files/uploaded-files");
      if (response.ok) {
        const data = await response.json();
        setFiles(data);
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (!selectedPlatformType) {
        alert("Please select a platform type first");
        return;
      }

      setUploading(true);
      setUploadResults(null);
      
      try {
        for (const file of acceptedFiles) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("type", selectedPlatformType);

          const response = await fetch("/api/files/upload", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.details || data.error || 'Upload failed');
          }

          setUploadResults(data);
        }
        
        fetchFiles();
        alert("File uploaded and processed successfully!");
      } catch (error) {
        console.error("Upload error:", error);
        alert((error as Error).message || "Failed to upload file(s)");
      } finally {
        setUploading(false);
      }
    },
    [selectedPlatformType]
  );

  // Handle file input change
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (fileList) {
      onDrop(Array.from(fileList));
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg leading-6 font-medium text-white">
            Upload CSV Files
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Upload CSV files from your various platforms for user consolidation
          </p>
        </div>
        
        <div className="card-body space-y-6">
          {/* Platform Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Platform Type
            </label>
            <select
              value={selectedPlatformType}
              onChange={(e) => setSelectedPlatformType(e.target.value)}
              className="form-select"
            >
              <option value="">Select a platform type...</option>
              {platformTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} (v{type.version})
                </option>
              ))}
            </select>
          </div>

          {/* Upload Area */}
          <div
            className={`upload-zone ${
              selectedPlatformType 
                ? (uploading ? 'upload-zone-active' : '') 
                : 'upload-zone-disabled'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (selectedPlatformType && !uploading) {
                const files = Array.from(e.dataTransfer.files);
                onDrop(files);
              }
            }}
          >
            <div className="text-center">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="flex text-sm leading-6 text-gray-300 justify-center">
                <label
                  htmlFor="file-upload"
                  className={`relative cursor-pointer rounded-md font-semibold focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-900 ${
                    selectedPlatformType && !uploading
                      ? 'text-blue-400 hover:text-blue-300 focus-within:ring-blue-500'
                      : 'text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <span>Upload files</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    multiple
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={uploading || !selectedPlatformType}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-gray-500 mt-2">CSV files only</p>
              {!selectedPlatformType && (
                <p className="text-xs leading-5 text-red-400 mt-2">
                  Please select a platform type first
                </p>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-4">
              <div className="flex items-center">
                <div className="spinner h-5 w-5 border-blue-400 mr-3"></div>
                <span className="text-sm text-blue-300">Processing upload...</span>
              </div>
            </div>
          )}

          {/* Upload Results */}
          {uploadResults && (
            <div className="bg-green-900/50 border border-green-700 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
                <span className="text-sm text-green-300 font-medium">
                  Upload completed successfully!
                </span>
              </div>
              <div className="text-sm text-green-300 space-y-1">
                <p>Platform: <span className="font-medium">{uploadResults.platformType}</span></p>
                <p>Records processed: <span className="font-medium">{uploadResults.data.recordCount}</span></p>
                {uploadResults.consolidationResults && (
                  <div className="mt-2 space-y-1">
                    <p>New users: <span className="font-medium">{uploadResults.consolidationResults.newUsers}</span></p>
                    <p>Existing users: <span className="font-medium">{uploadResults.consolidationResults.existingUsers}</span></p>
                    {uploadResults.consolidationResults.errors.length > 0 && (
                      <p className="text-red-400">
                        Errors: <span className="font-medium">{uploadResults.consolidationResults.errors.length}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File List */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg leading-6 font-medium text-white">
            Recent Uploads
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Files uploaded and processed for user consolidation
          </p>
        </div>
        
        <div className="divide-y divide-gray-700">
          {files.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-600 mb-3" />
              <p>No files uploaded yet</p>
            </div>
          ) : (
            files.slice(0, 10).map((file) => (
              <div key={file.id} className="px-6 py-4 hover:bg-gray-700/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <DocumentTextIcon className="h-8 w-8 text-blue-400 mr-4" />
                    <div>
                      <p className="text-sm font-medium text-white">
                        {file.original_filename}
                      </p>
                      <p className="text-sm text-gray-400">
                        <span className="font-medium">{file.platform_name}</span> • 
                        <span className="ml-1">{file.record_count} records</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(file.import_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    {file.import_status === 'completed' ? (
                      <div className="flex items-center">
                        <CheckCircleIcon className="h-5 w-5 text-green-400 mr-2" />
                        <span className="status-badge status-success">
                          Completed
                        </span>
                      </div>
                    ) : file.import_status === 'failed' ? (
                      <div className="flex items-center">
                        <ExclamationCircleIcon className="h-5 w-5 text-red-400 mr-2" />
                        <span className="status-badge status-error">
                          Failed
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <div className="spinner h-5 w-5 border-blue-400 mr-2"></div>
                        <span className="status-badge status-info">
                          Processing
                        </span>
                      </div>
                    )}
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
