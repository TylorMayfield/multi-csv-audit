import { useState, useCallback, useEffect } from "react";
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

export default function FileUpload() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [platformTypes, setPlatformTypes] = useState([]);
  const [selectedPlatformType, setSelectedPlatformType] = useState("");
  const [uploadResults, setUploadResults] = useState(null);

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
    async (acceptedFiles) => {
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
        alert(error.message || "Failed to upload file(s)");
      } finally {
        setUploading(false);
      }
    },
    [selectedPlatformType]
  );

  // Handle file input change
  const handleFileChange = (event) => {
    const fileList = event.target.files;
    if (fileList) {
      onDrop(Array.from(fileList));
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Upload CSV Files
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Upload CSV files from your various platforms for user consolidation
          </p>
        </div>
        
        <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
          {/* Platform Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Platform Type
            </label>
            <select
              value={selectedPlatformType}
              onChange={(e) => setSelectedPlatformType(e.target.value)}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
            className={`border-2 border-dashed rounded-lg p-6 ${
              selectedPlatformType 
                ? 'border-gray-300 hover:border-gray-400' 
                : 'border-gray-200 bg-gray-50'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (selectedPlatformType) {
                const files = Array.from(e.dataTransfer.files);
                onDrop(files);
              }
            }}
          >
            <div className="text-center">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4 flex text-sm leading-6 text-gray-600">
                <label
                  htmlFor="file-upload"
                  className={`relative cursor-pointer rounded-md bg-white font-semibold focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 ${
                    selectedPlatformType
                      ? 'text-blue-600 hover:text-blue-500 focus-within:ring-blue-600'
                      : 'text-gray-400 cursor-not-allowed'
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
              <p className="text-xs leading-5 text-gray-600">CSV files only</p>
              {!selectedPlatformType && (
                <p className="text-xs leading-5 text-red-600 mt-2">
                  Please select a platform type first
                </p>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-blue-600">Processing upload...</span>
              </div>
            </div>
          )}

          {/* Upload Results */}
          {uploadResults && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                <span className="ml-2 text-sm text-green-600 font-medium">
                  Upload completed successfully!
                </span>
              </div>
              <div className="mt-2 text-sm text-green-600">
                <p>Platform: {uploadResults.platformType}</p>
                <p>Records processed: {uploadResults.data.recordCount}</p>
                {uploadResults.consolidationResults && (
                  <div className="mt-2">
                    <p>New users: {uploadResults.consolidationResults.newUsers}</p>
                    <p>Existing users: {uploadResults.consolidationResults.existingUsers}</p>
                    {uploadResults.consolidationResults.errors.length > 0 && (
                      <p className="text-red-600">
                        Errors: {uploadResults.consolidationResults.errors.length}
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
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Recent Uploads
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Files uploaded and processed for user consolidation
          </p>
        </div>
        
        <div className="border-t border-gray-200">
          <div className="divide-y divide-gray-200">
            {files.length === 0 ? (
              <div className="px-4 py-5 sm:px-6 text-center text-gray-500">
                No files uploaded yet
              </div>
            ) : (
              files.slice(0, 10).map((file) => (
                <div key={file.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-900">
                          {file.original_filename}
                        </p>
                        <p className="text-sm text-gray-500">
                          {file.platform_name} • {file.record_count} records
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(file.import_date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {file.import_status === 'completed' ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : file.import_status === 'failed' ? (
                        <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                      ) : (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      )}
                      <span className="ml-2 text-sm text-gray-500 capitalize">
                        {file.import_status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
