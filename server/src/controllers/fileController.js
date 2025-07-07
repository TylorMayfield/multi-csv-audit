import fs from "fs/promises";
import { join } from "path";
import { UPLOADS_DIR, PROCESSED_DIR } from "../config.js"; 
import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { finished } from "stream/promises";

// Upload file controller
export const uploadFile = async (req, res) => {
    try {
        // Validate request
        if (!req.file) {
            return res.status(400).json({ 
                error: 'No file uploaded',
                details: 'Please select a file to upload'
            });
        }

        if (!req.body.type) {
            return res.status(400).json({ 
                error: 'No CSV type specified',
                details: 'Please select a CSV type for the file'
            });
        }

        // Ensure directories exist
        await fs.mkdir(PROCESSED_DIR, { recursive: true });
        await fs.mkdir(UPLOADS_DIR, { recursive: true });

        const records = [];
        try {
            // Create parser
            const parser = parse({
                columns: true,
                skip_empty_lines: true,
                trim: true,
                bom: true
            });

            // Set up parser event handlers
            parser.on('readable', function() {
                let record;
                while ((record = parser.read()) !== null) {
                    records.push(record);
                }
            });

            // Create read stream and pipe to parser
            const fileStream = createReadStream(req.file.path);
            fileStream.pipe(parser);

            // Wait for parsing to complete
            await finished(parser);

        } catch (parseError) {
            console.error('CSV parsing error:', parseError);
            return res.status(400).json({ 
                error: 'Failed to parse CSV file',
                details: parseError.message,
                type: 'PARSE_ERROR'
            });
        }

        if (records.length === 0) {
            return res.status(400).json({ 
                error: 'Empty CSV file',
                details: 'The uploaded CSV file contains no records',
                type: 'EMPTY_FILE'
            });
        }

        // Save processed records as JSON
        const processedPath = join(PROCESSED_DIR, `${req.file.filename}.json`);
        await fs.writeFile(processedPath, JSON.stringify(records, null, 2));

        // Save file metadata
        const fileInfo = {
            id: Date.now().toString(),
            originalName: req.file.originalname,
            filename: req.file.filename,
            type: req.body.type,
            uploadDate: new Date().toISOString(),
            recordCount: records.length,
            columns: Object.keys(records[0])
        };

        // Load and update uploadedFiles.json
        const uploadedFilesPath = join(UPLOADS_DIR, 'uploadedFiles.json');
        let uploadedFiles = [];
        try {
            const fileContent = await fs.readFile(uploadedFilesPath, 'utf-8');
            uploadedFiles = JSON.parse(fileContent);
        } catch (error) {
            // If file doesn't exist or is invalid, start with empty array
            console.log('Creating new uploadedFiles.json');
        }
        
        uploadedFiles.push(fileInfo);
        await fs.writeFile(uploadedFilesPath, JSON.stringify(uploadedFiles, null, 2));

        res.status(200).json({
            message: 'File uploaded and processed successfully',
            data: fileInfo,
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ 
            error: 'Failed to upload and process file',
            details: error.message,
            type: error.code || 'UNKNOWN_ERROR'
        });
    }
};

// Get uploaded files controller
export const getUploadedFiles = async (req, res) => {
  try {
    const uploadedFilesPath = join(UPLOADS_DIR, "uploadedFiles.json");
    let uploadedFiles = [];
    
    try {
      const content = await fs.readFile(uploadedFilesPath, "utf-8");
      uploadedFiles = JSON.parse(content);
    } catch (error) {
      // If file doesn't exist, return empty array
      if (error.code === 'ENOENT') {
        return res.json([]);
      }
      throw error;
    }
    
    res.json(uploadedFiles);
  } catch (error) {
    console.error("Failed to fetch uploaded files:", error);
    res.status(500).json({ 
      error: "Failed to fetch uploaded files",
      details: error.message,
      type: error.code || 'UNKNOWN_ERROR'
    });
  }
};
