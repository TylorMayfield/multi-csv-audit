import fs from "fs/promises";
import { join } from "path";
import { UPLOADS_DIR, PROCESSED_DIR } from "../config.js"; // Adjust path as needed
import { createReadStream } from "fs";
import { parse } from "csv-parse/sync";

// Upload file controller
export const uploadFile = async (req, res) => {
    try {
        const records = [];
        const parser = createReadStream(req.file.path).pipe(
            parse({
                columns: true,
                skip_empty_lines: true,
                trim: true,
                bom: true,
            })
        );

        for await (const record of parser) {
            records.push(record);
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
        };
        const uploadedFilesPath = join(UPLOADS_DIR, 'uploadedFiles.json');
        const uploadedFiles = JSON.parse(await fs.readFile(uploadedFilesPath, 'utf-8')) || [];
        uploadedFiles.push(fileInfo);
        await fs.writeFile(uploadedFilesPath, JSON.stringify(uploadedFiles, null, 2));

        res.status(200).json({
            message: 'File uploaded and processed successfully',
            data: records,
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload and process file' });
    }
};

// Get uploaded files controller
export const getUploadedFiles = async (req, res) => {
  try {
    const uploadedFiles = JSON.parse(
      await fs.readFile(join(UPLOADS_DIR, "uploadedFiles.json"), "utf-8")
    );
    res.json(uploadedFiles);
  } catch (error) {
    console.error("Failed to fetch uploaded files:", error);
    res.status(500).json({ error: "Failed to fetch uploaded files" });
  }
};
