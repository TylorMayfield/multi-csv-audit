import { useState, useRef } from 'react';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';

export default function FileUploader({ onFileUpload }) {
    const [isDragging, setIsDragging] = useState(false);
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = Array.from(e.dataTransfer.files).filter(
            file => file.type === 'text/csv'
        );
        handleFiles(droppedFiles);
    };

    const handleFileSelect = (e) => {
        const selectedFiles = Array.from(e.target.files).filter(
            file => file.type === 'text/csv'
        );
        handleFiles(selectedFiles);
    };

    const handleFiles = (newFiles) => {
        setFiles(prevFiles => [...prevFiles, ...newFiles]);
    };

    const uploadFiles = async () => {
        setUploading(true);
        try {
            for (const file of files) {
                const formData = new FormData();
                formData.append('csvFile', file);
                formData.append('source', 'upload');

                const response = await fetch('http://localhost:3001/api/upload', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    onFileUpload?.(data.id);
                } else {
                    throw new Error(`Failed to upload ${file.name}`);
                }
            }
            setFiles([]);
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setUploading(false);
        }
    };

    const removeFile = (index) => {
        setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    };

    return (
        <div className="space-y-6">
            {/* Upload Area */}
            <div
                className={`border-2 border-dashed rounded-lg p-8 text-center ${
                    isDragging
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-300 hover:border-primary-500'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".csv"
                    multiple
                    className="hidden"
                />
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                    <p className="text-sm text-gray-600">
                        Drag and drop CSV files here, or click to select files
                    </p>
                </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">Selected Files</h3>
                    <div className="space-y-2">
                        {files.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                            >
                                <span className="text-sm text-gray-600">{file.name}</span>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="text-red-600 hover:text-red-800 text-sm"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={uploadFiles}
                        disabled={uploading}
                        className="btn btn-primary w-full"
                    >
                        {uploading ? 'Uploading...' : 'Upload Files'}
                    </button>
                </div>
            )}
        </div>
    );
}
