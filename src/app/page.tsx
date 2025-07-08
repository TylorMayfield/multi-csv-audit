'use client'

import { useState } from 'react'
import PlatformTypeManager from '@/components/PlatformTypeManager'
import CSVUploadWizard from '@/components/CSVUploadWizard'
import UserAuditDashboard from '@/components/UserAuditDashboard'
import { Bars3Icon } from '@heroicons/react/24/outline'

const tabs = [
  {
    id: 'upload',
    name: 'Upload & Map CSV',
    description: 'Upload CSV files and automatically create platform types',
    component: CSVUploadWizard
  },
  {
    id: 'platforms',
    name: 'Manage Platform Types',
    description: 'View and edit existing platform type definitions',
    component: PlatformTypeManager
  },
  {
    id: 'audit',
    name: 'User Audit',
    description: 'View consolidated users and audit reports',
    component: UserAuditDashboard
  }
]

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('upload')
  
  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || CSVUploadWizard

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Multi-Platform User Audit System
              </h1>
              <p className="mt-1 text-gray-400">
                Consolidate and audit users across platforms
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-300">System Status</div>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-400">Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${
                  activeTab === tab.id ? 'nav-tab-active' : 'nav-tab-inactive'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">
              {tabs.find(tab => tab.id === activeTab)?.name}
            </h2>
            <p className="text-gray-400 mt-1">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>
          
          <ActiveComponent />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Multi-Platform User Audit System - Built with Next.js
            </p>
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>© 2025</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
