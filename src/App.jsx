import { useState } from "react";
import Dashboard from "./components/Dashboard";
import PlatformTypeManagement from "./components/PlatformTypeManagement";
import FileUpload from "./components/FileUpload";
import UserAudit from "./components/UserAudit";
import DataViewer from "./components/DataViewer";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // Define the tab navigation structure
  const tabs = [
    {
      id: "dashboard",
      name: "Dashboard",
      description: "Overview of user audit system",
    },
    {
      id: "platforms",
      name: "Platform Types",
      description: "Manage data source definitions",
    },
    {
      id: "upload",
      name: "Upload Data",
      description: "Upload and process CSV files",
    },
    {
      id: "audit",
      name: "User Audit",
      description: "View consolidated user data",
    },
    {
      id: "data",
      name: "Data Viewer",
      description: "View and export processed data",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header Section */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Multi-Platform User Audit System
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Consolidate and audit users across multiple platforms
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Version 2.0
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Section */}
      <main className="flex-1 flex flex-col max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 w-full">
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                  ${
                    activeTab === tab.id
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <div className="flex flex-col items-center">
                  <span>{tab.name}</span>
                  <span className="text-xs text-gray-400 mt-1">
                    {tab.description}
                  </span>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content Section */}
        <div className="flex-1 flex flex-col">
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "platforms" && <PlatformTypeManagement />}
          {activeTab === "upload" && <FileUpload />}
          {activeTab === "audit" && <UserAudit />}
          {activeTab === "data" && <DataViewer />}
        </div>
      </main>

      {/* Footer Section */}
      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              &copy; 2025 Multi-Platform User Audit System. All rights reserved.
            </p>
            <div className="flex space-x-4 text-sm text-gray-500">
              <span>Built with React & Node.js</span>
              <span>•</span>
              <span>SQLite Database</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
