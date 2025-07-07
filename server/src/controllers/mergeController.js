/* eslint-disable no-unused-vars */
import * as fs from "fs";
import { join } from "path";
import { PROCESSED_DIR } from "../config.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get merge results controller
export const getMergeResults = async (req, res) => {
  try {
    const mergeId = req.params.id;
    const mergeInfoPath = join(PROCESSED_DIR, `${mergeId}-info.json`);
    const mergeInfo = JSON.parse(
      await fs.promises.readFile(mergeInfoPath, "utf-8")
    );
    res.json(mergeInfo);
  } catch (error) {
    console.error("Failed to fetch merge results:", error);
    res.status(500).json({ error: "Failed to fetch merge results" });
  }
};

// Merge records controller
export const mergeRecords = async (req, res) => {
  try {
    const { files: fileIds, keyFields, strategy = 'latest', caseSensitive = false } = req.body;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    // Import uploadedFiles.json
    const uploadedFiles = JSON.parse(
      await fs.promises.readFile(
        join(__dirname, "../../data/uploads/uploadedFiles.json"),
        "utf-8"
      )
    );
    const fileMap = Object.fromEntries(
      uploadedFiles.map((file) => [file.id, file.filename.replace(/\.csv$/, '.json')])
    );

    console.log("Starting merge process...");
    console.log("Files to process:", fileIds);
    console.log("Key fields:", keyFields);
    console.log("Strategy:", strategy);

    // Read and parse all files
    const allData = [];
    const fileStats = [];
    for (const fileId of fileIds) {
      try {
        const filePath = join(PROCESSED_DIR, `${fileMap[fileId]}`);
        console.log(`Reading file: ${filePath}`);
        const fileContent = await fs.promises.readFile(filePath, "utf8");
        const parsedData = JSON.parse(fileContent);

        // Validate key field exists in file
        const keyField = keyFields[fileId];
        if (!keyField) {
          throw new Error(`No key field specified for file ${fileMap[fileId]}`);
        }

        const hasKeyField = parsedData.length > 0 && keyField in parsedData[0];
        if (!hasKeyField) {
          throw new Error(
            `Key field '${keyField}' not found in file ${fileMap[fileId]}`
          );
        }

        console.log(`File ${fileId} contains ${parsedData.length} records`);
        console.log(`Sample record from ${fileId}:`, parsedData[0]);

        allData.push({
          fileId,
          keyField: keyField,
          data: parsedData,
        });

        fileStats.push({
          fileId,
          fileName: fileMap[fileId],
          recordCount: parsedData.length,
          keyField: keyField,
        });
      } catch (error) {
        console.error(`Error reading file ${fileId}:`, error);
        throw error;
      }
    }

    const mergedResult = new Map();
    const duplicates = new Map(); // Track duplicate keys for reporting
    console.log(`Total files loaded: ${allData.length}`);

    // Process each file's data
    allData.forEach(({ fileId, keyField, data: fileData }) => {
      console.log(`\nProcessing file ${fileId} with key field ${keyField}`);

      if (!Array.isArray(fileData)) {
        console.error(`Data for file ${fileId} is not an array:`, fileData);
        return;
      }

      fileData.forEach((record, recordIndex) => {
        try {
          if (!record || typeof record !== "object") {
            console.warn(
              `Invalid record at index ${recordIndex} in file ${fileId}`
            );
            return;
          }

          const keyValue = record[keyField];
          if (keyValue === undefined || keyValue === null) {
            console.warn(
              `Missing key field '${keyField}' in record ${recordIndex} of file ${fileId}`
            );
            return;
          }

          // Handle case sensitivity
          const mergeKey = caseSensitive
            ? String(keyValue)
            : String(keyValue).toLowerCase();

          // Track duplicates
          if (mergedResult.has(mergeKey)) {
            if (!duplicates.has(mergeKey)) {
              duplicates.set(mergeKey, [fileStats[fileIds.indexOf(fileId)]]);
            } else {
              duplicates.get(mergeKey).push(fileStats[fileIds.indexOf(fileId)]);
            }
          }

          if (!mergedResult.has(mergeKey)) {
            mergedResult.set(mergeKey, { ...record });
            console.log(`Created new merged record for key: ${mergeKey}`);
          } else {
            // Apply merge strategy
            Object.entries(record).forEach(([field, value]) => {
              if (value === null || value === undefined || value === "") {
                return; // Skip empty values
              }

              const currentValue = mergedResult.get(mergeKey)[field];
              let newValue = value;

              switch (strategy) {
                case "first":
                  // Keep the first non-empty value
                  if (
                    currentValue !== null &&
                    currentValue !== undefined &&
                    currentValue !== ""
                  ) {
                    return;
                  }
                  break;
                case "concatenate":
                  // Concatenate values with comma if both exist
                  if (currentValue && currentValue !== value) {
                    newValue = `${currentValue}, ${value}`;
                  }
                  break;
                case "latest":
                default:
                  // Latest value wins (default behavior)
                  break;
              }

              mergedResult.get(mergeKey)[field] = newValue;
              console.log(
                `Updated field ${field} in record ${mergeKey} with value from file ${fileId}`
              );
            });
          }
        } catch (error) {
          console.error(
            `Error processing record ${recordIndex} in file ${fileId}:`,
            error
          );
        }
      });
    });

    console.log("\nMerge process completed");
    const finalResult = {
      records: Array.from(mergedResult.values()),
      stats: {
        totalRecords: mergedResult.size,
        duplicateKeys: Array.from(duplicates.entries()).map(([key, files]) => ({
          key,
          files,
        })),
        filesProcessed: fileStats,
      },
    };

    // Save merge results
    const mergeId = Date.now();
    const resultPath = join(PROCESSED_DIR, `${mergeId}-merged.json`);
    const statsPath = join(PROCESSED_DIR, `${mergeId}-info.json`);

    await Promise.all([
      fs.promises.writeFile(
        resultPath,
        JSON.stringify(finalResult.records, null, 2)
      ),
      fs.promises.writeFile(
        statsPath,
        JSON.stringify(finalResult.stats, null, 2)
      ),
    ]);

    res.json({
      mergeId,
      ...finalResult,
    });
  } catch (error) {
    console.error("Merge error:", error);
    res.status(500).json({
      error: "Failed to merge records",
      message: error.message,
      details: error.stack,
    });
  }
};
