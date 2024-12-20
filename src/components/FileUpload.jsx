import { useState } from 'react';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';

export default function FileUpload() {
  const [file, setFile] = useState(null);
  const [source, setSource] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !source) return;

    const formData = new FormData();
    formData.append('csvFile', file);
    formData.append('source', source);

    try {
      const response = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        // Handle success
        setFile(null);
        setSource('');
      } else {
        // Handle error
        console.error('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Upload CSV File</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
            Data Source
          </label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="input"
            required
          >
            <option value="">Select a source</option>
            <option value="active-directory">Active Directory</option>
            <option value="verizon">Verizon</option>
            <option value="mdm">MDM</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="csvFile" className="block text-sm font-medium text-gray-700 mb-1">
            CSV File
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files[0])}
                    required
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">CSV files only</p>
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary w-full">
          Upload
        </button>
      </form>
    </div>
  );
}
