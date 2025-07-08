'use client'

import { useState, useCallback } from "react";
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";

interface CSVColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'email';
  sampleValues: string[];
}

interface PlatformTypeMapping {
  platformName: string;
  description: string;
  columns: CSVColumn[];
  userIdentificationFields: {
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
  };
}

export default function CSVUploadWizard() {
  const [step, setStep] = useState(1); // 1: Upload, 2: Map Columns, 3: Save Platform Type
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvColumns, setCsvColumns] = useState<CSVColumn[]>([]);
  const [platformMapping, setPlatformMapping] = useState<PlatformTypeMapping>({
    platformName: '',
    description: '',
    columns: [],
    userIdentificationFields: {}
  });
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Parse CSV and extract columns
  const parseCSV = (file: File): Promise<{data: any[], columns: CSVColumn[]}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length < 2) {
            reject(new Error('CSV must have at least a header and one data row'));
            return;
          }

          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const dataRows = lines.slice(1, Math.min(11, lines.length)) // Take first 10 rows for analysis
            .map(line => {
              const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
              const row: any = {};
              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });
              return row;
            });

          const columns: CSVColumn[] = headers.map(header => {
            const sampleValues = dataRows
              .map(row => row[header])
              .filter(val => val && val.trim())
              .slice(0, 5);

            // Auto-detect column type based on sample values
            let type: CSVColumn['type'] = 'string';
            if (sampleValues.some(val => val.includes('@'))) {
              type = 'email';
            } else if (sampleValues.every(val => !isNaN(Number(val)))) {
              type = 'number';
            } else if (sampleValues.some(val => /^\d{4}-\d{2}-\d{2}/.test(val) || /^\d{1,2}\/\d{1,2}\/\d{4}/.test(val))) {
              type = 'date';
            }

            return {
              name: header,
              type,
              sampleValues
            };
          });

          resolve({ data: dataRows, columns });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploadedFile(file);
    setUploading(true);

    try {
      const { data, columns } = await parseCSV(file);
      setCsvData(data);
      setCsvColumns(columns);
      
      // Check if this CSV matches an existing platform type
      const detectionResponse = await fetch('/api/platform-types/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          columns: columns.map(col => col.name)
        })
      });
      
      if (detectionResponse.ok) {
        const detectionResult = await detectionResponse.json();
        
        if (detectionResult.match && detectionResult.platformType) {
          // Found a matching platform type - use it directly
          const confirmed = window.confirm(
            `This CSV matches an existing platform type: "${detectionResult.platformType.name}". ` +
            `Would you like to use the existing platform type and upload the data directly?\n\n` +
            `Click OK to use existing platform type or Cancel to create a new one.`
          );
          
          if (confirmed) {
            // Upload file directly using existing platform type
            setProcessing(true);
            try {
              const formData = new FormData();
              formData.append('file', file);
              formData.append('type', detectionResult.platformType.id.toString());

              const uploadResponse = await fetch('/api/files/upload', {
                method: 'POST',
                body: formData
              });

              if (!uploadResponse.ok) {
                throw new Error('Failed to upload and process file');
              }

              alert(`File uploaded successfully using existing platform type: ${detectionResult.platformType.name}`);
              resetWizard();
              return;
            } catch (error) {
              console.error('Error uploading file:', error);
              alert((error as Error).message || 'Failed to upload file');
            } finally {
              setProcessing(false);
            }
          }
        }
      }
      
      // Continue with normal flow (either no match found or user chose to create new)
      setPlatformMapping(prev => ({
        ...prev,
        columns,
        platformName: file.name.replace('.csv', '').replace(/[_-]/g, ' ')
      }));
      setStep(2);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      alert((error as Error).message || 'Failed to parse CSV file');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (fileList) {
      onDrop(Array.from(fileList));
    }
  };

  const updateUserIdentificationField = (field: string, columnName: string) => {
    setPlatformMapping(prev => ({
      ...prev,
      userIdentificationFields: {
        ...prev.userIdentificationFields,
        [field]: columnName || undefined
      }
    }));
  };

  const updateColumnType = (columnName: string, type: CSVColumn['type']) => {
    setCsvColumns(prev => prev.map(col => 
      col.name === columnName ? { ...col, type } : col
    ));
    setPlatformMapping(prev => ({
      ...prev,
      columns: prev.columns.map(col => 
        col.name === columnName ? { ...col, type } : col
      )
    }));
  };

  const savePlatformTypeAndProcess = async () => {
    setProcessing(true);
    try {
      // First, save the platform type
      const platformTypeResponse = await fetch('/api/platform-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: platformMapping.platformName,
          description: platformMapping.description,
          columns: platformMapping.columns.map(col => {
            // Find which user field this column maps to
            let userField = undefined;
            for (const [field, columnName] of Object.entries(platformMapping.userIdentificationFields)) {
              if (columnName === col.name) {
                userField = field;
                break;
              }
            }
            
            return {
              name: col.name,
              type: col.type,
              required: ['firstName', 'lastName', 'email', 'username'].some(field => 
                platformMapping.userIdentificationFields[field as keyof typeof platformMapping.userIdentificationFields] === col.name
              ),
              userField: userField
            };
          })
        })
      });

      if (!platformTypeResponse.ok) {
        throw new Error('Failed to save platform type');
      }

      const platformType = await platformTypeResponse.json();

      // Then upload and process the CSV file
      const formData = new FormData();
      formData.append('file', uploadedFile!);
      formData.append('type', platformType.id);

      const uploadResponse = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload and process file');
      }

      setStep(3);
    } catch (error) {
      console.error('Error saving platform type and processing file:', error);
      alert((error as Error).message || 'Failed to save platform type and process file');
    } finally {
      setProcessing(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setUploadedFile(null);
    setCsvData([]);
    setCsvColumns([]);
    setPlatformMapping({
      platformName: '',
      description: '',
      columns: [],
      userIdentificationFields: {}
    });
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className={`flex items-center space-x-2 ${step >= 1 ? 'text-blue-400' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600' : 'bg-gray-600'}`}>
                1
              </div>
              <span className="text-sm font-medium">Upload CSV</span>
            </div>
            <ArrowRightIcon className="w-5 h-5 text-gray-400" />
            <div className={`flex items-center space-x-2 ${step >= 2 ? 'text-blue-400' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600' : 'bg-gray-600'}`}>
                2
              </div>
              <span className="text-sm font-medium">Map Columns</span>
            </div>
            <ArrowRightIcon className="w-5 h-5 text-gray-400" />
            <div className={`flex items-center space-x-2 ${step >= 3 ? 'text-blue-400' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600' : 'bg-gray-600'}`}>
                3
              </div>
              <span className="text-sm font-medium">Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 1: Upload CSV */}
      {step === 1 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Upload CSV File</h3>
            <p className="text-sm text-gray-400">
              Upload a CSV file to automatically detect columns and create a platform type
            </p>
          </div>
          <div className="card-body">
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-gray-500 transition-colors">
              <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm font-medium text-white">
                    Drop your CSV file here, or click to browse
                  </span>
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                </label>
                <p className="mt-2 text-xs text-gray-400">
                  CSV files only. The first row should contain column headers.
                </p>
              </div>
              {uploading && (
                <div className="mt-4">
                  <div className="spinner h-6 w-6 border-blue-400 mx-auto"></div>
                  <p className="mt-2 text-sm text-gray-400">Processing CSV...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Map Columns */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Configure Platform Type</h3>
              <p className="text-sm text-gray-400">
                Define how to identify users and map columns from your CSV
              </p>
            </div>
            <div className="card-body space-y-6">
              {/* Platform Info */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Platform Name
                  </label>
                  <input
                    type="text"
                    value={platformMapping.platformName}
                    onChange={(e) => setPlatformMapping(prev => ({ ...prev, platformName: e.target.value }))}
                    className="form-input"
                    placeholder="Enter platform name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={platformMapping.description}
                    onChange={(e) => setPlatformMapping(prev => ({ ...prev, description: e.target.value }))}
                    className="form-input"
                    placeholder="Brief description"
                  />
                </div>
              </div>

              {/* User Identification Mapping */}
              <div>
                <h4 className="text-md font-medium text-white mb-4">User Identification Fields</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    { key: 'firstName', label: 'First Name Field' },
                    { key: 'lastName', label: 'Last Name Field' },
                    { key: 'email', label: 'Email Field' },
                    { key: 'username', label: 'Username Field' }
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {label}
                      </label>
                      <select
                        value={platformMapping.userIdentificationFields[key as keyof typeof platformMapping.userIdentificationFields] || ''}
                        onChange={(e) => updateUserIdentificationField(key, e.target.value)}
                        className="form-select"
                      >
                        <option value="">Select column...</option>
                        {csvColumns.map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* CSV Columns Preview */}
              <div>
                <h4 className="text-md font-medium text-white mb-4">CSV Columns ({csvColumns.length})</h4>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Column Name</th>
                        <th>Data Type</th>
                        <th>Sample Values</th>
                        <th>User Field</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvColumns.map((col) => {
                        const userField = Object.entries(platformMapping.userIdentificationFields)
                          .find(([_, value]) => value === col.name)?.[0];
                        
                        return (
                          <tr key={col.name}>
                            <td className="font-medium">{col.name}</td>
                            <td>
                              <select
                                value={col.type}
                                onChange={(e) => updateColumnType(col.name, e.target.value as CSVColumn['type'])}
                                className="form-select"
                              >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="email">Email</option>
                                <option value="date">Date</option>
                                <option value="boolean">Boolean</option>
                              </select>
                            </td>
                            <td>
                              <div className="text-xs text-gray-400">
                                {col.sampleValues.slice(0, 3).join(', ')}
                                {col.sampleValues.length > 3 && '...'}
                              </div>
                            </td>
                            <td>
                              {userField && (
                                <span className="status-badge status-success">
                                  {userField.charAt(0).toUpperCase() + userField.slice(1)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="btn-ghost"
                >
                  <ArrowLeftIcon className="w-4 h-4 mr-2" />
                  Back
                </button>
                <button
                  onClick={savePlatformTypeAndProcess}
                  disabled={!platformMapping.platformName || processing}
                  className="btn-success disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <div className="spinner h-4 w-4 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      Save & Process File
                      <ArrowRightIcon className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 3 && (
        <div className="card">
          <div className="card-body text-center">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-green-400" />
            <h3 className="mt-4 text-lg font-medium text-white">Successfully Processed!</h3>
            <p className="mt-2 text-sm text-gray-400">
              Your platform type "{platformMapping.platformName}" has been created and the CSV file has been processed.
            </p>
            <div className="mt-6">
              <button
                onClick={resetWizard}
                className="btn-info"
              >
                Upload Another File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
