import { useEffect, useState } from 'react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

export default function RecentUploads() {
  const [uploads, setUploads] = useState([]);

  useEffect(() => {
    fetchRecentUploads();
  }, []);

  const fetchRecentUploads = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/uploads');
      if (response.ok) {
        const data = await response.json();
        setUploads(data);
      }
    } catch (error) {
      console.error('Error fetching uploads:', error);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Recent Uploads</h2>
      <div className="space-y-4">
        {uploads.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No recent uploads</p>
        ) : (
          uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center p-3 bg-gray-50 rounded-lg"
            >
              <DocumentTextIcon className="h-6 w-6 text-gray-400 mr-3" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {upload.filename}
                </p>
                <p className="text-sm text-gray-500">
                  {upload.source} • {new Date(upload.timestamp).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
