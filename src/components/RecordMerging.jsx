import { useState, useEffect } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";

export default function RecordMerging() {
  const [files, setFiles] = useState([]);
  const [types, setTypes] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [keyFields, setKeyFields] = useState({}); // Object to hold key fields for each file
  const [mergeStrategy, setMergeStrategy] = useState("latest");
  const [mergeInProgress, setMergeInProgress] = useState(false);
  const [mergeResults, setMergeResults] = useState(null);
  const [caseSensitive, setCaseSensitive] = useState(false);

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

  const handleFileSelect = (fileId) => {
    setSelectedFiles((prev) => {
      if (prev.includes(fileId)) {
        return prev.filter((id) => id !== fileId);
      }
      return [...prev, fileId];
    });
  };

  const handleKeyFieldChange = (fileId, value) => {
    setKeyFields((prev) => ({ ...prev, [fileId]: value }));
  };

  const handleMerge = async () => {
    if (selectedFiles.length < 2) {
      alert("Please select at least 2 files to merge");
      return;
    }

    if (Object.keys(keyFields).length === 0) {
      alert("Please select at least one key field for merging");
      return;
    }

    setMergeInProgress(true);
    try {
      const response = await fetch("/api/merge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: selectedFiles,
          keyFields,
          strategy: mergeStrategy,
          caseSensitive,
        }),
      });

      if (response.ok) {
        const results = await response.json();
        setMergeResults(results);
      } else {
        throw new Error("Merge failed");
      }
    } catch (error) {
      console.error("Merge error:", error);
      alert("Failed to merge records");
    } finally {
      setMergeInProgress(false);
    }
  };

  const getAvailableColumnsForFile = (fileId) => {
    if (!fileId) {
      console.log('No file ID provided');
      return [];
    }
    const file = files.find(f => f.id === fileId);
    if (!file) {
      console.log(`File not found for ID: ${fileId}`);
      return [];
    }
    const fileType = types.find(t => t.id === file.type);
    return fileType ? fileType.columns.map(col => col.name) : [];
  };

  return (
    <div className="space-y-6">
      {/* File Selection */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Select Files to Merge</h2>
        <div className="space-y-4">
          {files.map((file) => {
            const fileType = types.find((t) => t.id === file.type);
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
                    Type: {fileType?.name || "Unknown"}
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
            {selectedFiles.map((fileId) => {
              const file = files.find(f => f.id === fileId);
              return file ? (
                <div key={fileId}>
                  <label>{file.originalName} Key Field:</label>
                  <select
                    value={keyFields[fileId] || ""}
                    onChange={(e) => handleKeyFieldChange(fileId, e.target.value)}
                  >
                    <option value="">Select Key Field</option>
                    {getAvailableColumnsForFile(fileId).map((column) => (
                      <option key={column} value={column}>{column}</option>
                    ))}
                  </select>
                </div>
              ) : null;
            })}
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={caseSensitive}
                  onChange={() => setCaseSensitive(!caseSensitive)}
                />
                Case Sensitive
              </label>
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
                  {mergeResults.conflicts} conflicts were resolved using the{" "}
                  {mergeStrategy} strategy
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() =>
                  (window.location.href = mergeResults.downloadUrl)
                }
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
