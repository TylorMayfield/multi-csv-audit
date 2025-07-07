import { useState, useCallback, useEffect } from "react";
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

export default function FileUpload() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [types, setTypes] = useState([]);
  const [selectedType, setSelectedType] = useState("");

  // Fetch CSV types on mount
  const fetchTypes = async () => {
    try {
      const response = await fetch("/api/csv-types");
      if (response.ok) {
        const data = await response.json();
        setTypes(data);
      }
    } catch (error) {
      console.error("Failed to fetch types:", error);
    }
  };

  useEffect(() => {
    fetchTypes();
    fetchFiles();
  }, []);

  // Fetch uploaded files
  const fetchFiles = async () => {
    try {
      const response = await fetch("/api/uploaded-files");
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
      if (!selectedType) {
        alert("Please select a CSV type first");
        return;
      }

      setUploading(true);
      try {
        for (const file of acceptedFiles) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("type", selectedType);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.details || data.error || 'Upload failed');
          }
        }
        fetchFiles();
        alert("File uploaded successfully!");
      } catch (error) {
        console.error("Upload error:", error);
        alert(error.message || "Failed to upload file(s)");
      } finally {
        setUploading(false);
      }
    },
    [selectedType]
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
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Upload CSV Files</h2>

        {/* Type Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select CSV Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="input"
          >
            <option value="">Select a type...</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        {/* Upload Area */}
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const files = Array.from(e.dataTransfer.files);
            onDrop(files);
          }}
        >
          <div className="text-center">
            <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
            <div className="mt-4 flex text-sm leading-6 text-gray-600">
              <label
                htmlFor="file-upload"
                className="relative cursor-pointer rounded-md bg-white font-semibold text-primary-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-600 focus-within:ring-offset-2 hover:text-primary-500"
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
                  disabled={uploading || !selectedType}
                />
              </label>
              <p className="pl-1">or drag and drop</p>
            </div>
            <p className="text-xs leading-5 text-gray-600">CSV files only</p>
          </div>
        </div>
      </div>

      {/* File List */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Uploaded Files</h2>
        <div className="space-y-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {file.originalName}
                  </p>
                  <p className="text-xs text-gray-500">
                    Uploaded on {new Date(file.uploadDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Type: {types.find((t) => t.id === file.type)?.name || "Unknown"}
              </div>
            </div>
          ))}

          {files.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-4">
              No files uploaded yet
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
