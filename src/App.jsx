import { useState } from 'react'
import CSVTypeDefinition from './components/CSVTypeDefinition'
import FileUpload from './components/FileUpload'
import ColumnMapping from './components/ColumnMapping'
import RecordMerging from './components/RecordMerging'
import DataViewer from './components/DataViewer'

function App() {
  const [activeTab, setActiveTab] = useState('upload')

  const tabs = [
    { id: 'upload', name: 'Upload CSV', description: 'Upload and process CSV files' },
    { id: 'types', name: 'CSV Types', description: 'Define and manage CSV types' },
    { id: 'mapping', name: 'Column Mapping', description: 'Map columns between different CSV types' },
    { id: 'merge', name: 'Merge Records', description: 'Merge records based on key fields' },
    { id: 'view', name: 'View Data', description: 'View and export processed data' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">
            CSV Consolidation Tool
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'upload' && <FileUpload />}
          {activeTab === 'types' && <CSVTypeDefinition />}
          {activeTab === 'mapping' && <ColumnMapping />}
          {activeTab === 'merge' && <RecordMerging />}
          {activeTab === 'view' && <DataViewer />}
        </div>
      </main>
    </div>
  )
}

export default App
