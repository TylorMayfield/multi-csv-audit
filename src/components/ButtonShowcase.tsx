import { 
  DocumentIcon, 
  CheckIcon, 
  ExclamationTriangleIcon, 
  EyeIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpIcon 
} from '@heroicons/react/24/outline';

export default function ButtonShowcase() {
  return (
    <div className="space-y-8 p-8 bg-gray-900 min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Enhanced Button Styles</h1>
        <p className="text-gray-400">New button designs with gradients, shadows, and improved interactions</p>
      </div>

      {/* Primary Buttons */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Primary Actions</h2>
        <div className="flex flex-wrap gap-4">
          <button className="btn btn-primary">
            <DocumentIcon className="h-4 w-4 mr-2" />
            Save Document
          </button>
          <button className="btn btn-success">
            <CheckIcon className="h-4 w-4 mr-2" />
            Confirm Action
          </button>
          <button className="btn btn-danger">
            <TrashIcon className="h-4 w-4 mr-2" />
            Delete Item
          </button>
          <button className="btn btn-warning">
            <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
            Warning Action
          </button>
          <button className="btn btn-info">
            <EyeIcon className="h-4 w-4 mr-2" />
            View Details
          </button>
        </div>
      </div>

      {/* Outline Buttons */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Outline Variants</h2>
        <div className="flex flex-wrap gap-4">
          <button className="btn btn-outline-primary">
            <DocumentIcon className="h-4 w-4 mr-2" />
            Primary Outline
          </button>
          <button className="btn btn-outline-secondary">
            <EyeIcon className="h-4 w-4 mr-2" />
            Secondary Outline
          </button>
          <button className="btn btn-outline-danger">
            <TrashIcon className="h-4 w-4 mr-2" />
            Danger Outline
          </button>
          <button className="btn btn-outline-success">
            <CheckIcon className="h-4 w-4 mr-2" />
            Success Outline
          </button>
          <button className="btn btn-ghost">
            Ghost Button
          </button>
        </div>
      </div>

      {/* Size Variants */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Size Variants</h2>
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn btn-primary btn-xs">Extra Small</button>
          <button className="btn btn-primary btn-sm">Small</button>
          <button className="btn btn-primary">Default</button>
          <button className="btn btn-primary btn-lg">Large</button>
          <button className="btn btn-primary btn-xl">Extra Large</button>
        </div>
      </div>

      {/* Special Action Buttons */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Special Actions</h2>
        <div className="flex flex-wrap gap-4">
          <button className="btn btn-merge">
            <CheckIcon className="h-4 w-4 mr-2" />
            Merge Records
          </button>
          <button className="btn btn-export">
            <DocumentIcon className="h-4 w-4 mr-2" />
            Export Data
          </button>
          <button className="btn btn-view">
            <EyeIcon className="h-4 w-4 mr-2" />
            View Records
          </button>
        </div>
      </div>

      {/* Icon Buttons */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Icon Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <button className="btn-icon bg-blue-600 text-white hover:bg-blue-700">
            <PlusIcon className="h-5 w-5" />
          </button>
          <button className="btn-icon bg-red-600 text-white hover:bg-red-700">
            <TrashIcon className="h-5 w-5" />
          </button>
          <button className="btn-icon bg-green-600 text-white hover:bg-green-700">
            <CheckIcon className="h-5 w-5" />
          </button>
          <button className="btn-icon bg-gray-600 text-white hover:bg-gray-700">
            <EyeIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Loading States */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Loading States</h2>
        <div className="flex flex-wrap gap-4">
          <button className="btn btn-primary opacity-50 cursor-not-allowed" disabled>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Processing...
          </button>
          <button className="btn btn-success opacity-50 cursor-not-allowed" disabled>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Saving...
          </button>
          <button className="btn btn-danger opacity-50 cursor-not-allowed" disabled>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Deleting...
          </button>
        </div>
      </div>

      {/* Floating Action Button */}
      <button className="btn-floating btn-primary">
        <ArrowUpIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
