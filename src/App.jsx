import { useState } from 'react';
import CSVTypeManager from './components/CSVTypeManager';
import ColumnMappings from './components/ColumnMappings';
import DiscrepancyViewer from './components/DiscrepancyViewer';
import FileUploader from './components/FileUploader';
import { Tabs } from './components/ui/Tabs';

function App() {
    const [selectedTab, setSelectedTab] = useState('upload');
    const [selectedTypeId, setSelectedTypeId] = useState(null);
    const [selectedFileId, setSelectedFileId] = useState(null);

    const tabs = [
        { id: 'upload', label: 'Upload Files' },
        { id: 'types', label: 'CSV Types' },
        { id: 'mappings', label: 'Column Mappings' },
        { id: 'discrepancies', label: 'Discrepancies' }
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                    <h1 className="text-3xl font-bold text-gray-900">CSV Audit Tool</h1>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="px-4 py-6 sm:px-0">
                    <Tabs tabs={tabs} selected={selectedTab} onChange={setSelectedTab} />

                    <div className="mt-6">
                        {selectedTab === 'upload' && (
                            <FileUploader onFileUpload={(fileId) => setSelectedFileId(fileId)} />
                        )}
                        {selectedTab === 'types' && (
                            <CSVTypeManager onTypeSelect={(typeId) => setSelectedTypeId(typeId)} />
                        )}
                        {selectedTab === 'mappings' && selectedTypeId && (
                            <ColumnMappings csvTypeId={selectedTypeId} />
                        )}
                        {selectedTab === 'discrepancies' && selectedFileId && (
                            <DiscrepancyViewer fileId={selectedFileId} />
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default App;
