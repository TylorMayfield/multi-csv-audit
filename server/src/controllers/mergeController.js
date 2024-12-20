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
    const { files: fileIds, strategy, keyFields, caseSensitive } = req.body;
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
      uploadedFiles.map((file) => [file.id, file.filename])
    );

    console.log("Starting merge process...");
    console.log("Files to process:", fileIds);
    console.log("Key fields configuration:", keyFields);

    // Read and parse all files
    const allData = [];
    for (const fileId of fileIds) {
      try {
        const filePath = join(PROCESSED_DIR, `${fileMap[fileId]}`);
        console.log(`Reading file: ${filePath}`);
        const fileContent = await fs.promises.readFile(filePath, "utf8");
        const parsedData = JSON.parse(fileContent);
        console.log(`File ${fileId} contains ${parsedData.length} records`);
        console.log(`Sample record from ${fileId}:`, parsedData[0]);
        allData.push(parsedData);
      } catch (error) {
        console.error(`Error reading file ${fileId}:`, error);
        throw error;
      }
    }

    const mergedResult = {};
    console.log(`Total files loaded: ${allData.length}`);

    // Process each file's data
    allData.forEach((fileData, index) => {
      const fileId = fileIds[index];
      const key = keyFields[fileId];
      console.log(`\nProcessing file ${fileId} with key field: ${key}`);

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

          const mergeKey = caseSensitive
            ? String(record[key]).toLowerCase()
            : String(record[key]).toLowerCase()
            ? String(record[key]).toLowerCase()
            : undefined;

          if (!mergeKey) {
            console.warn(
              `No merge key found for record ${recordIndex} in file ${fileId}`
            );
            return;
          }

          console.log(`Processing record with key: ${mergeKey}`);

          if (!mergedResult[mergeKey]) {
            mergedResult[mergeKey] = { ...record };
            console.log(`Created new merged record for key: ${mergeKey}`);
          } else {
            Object.entries(record).forEach(([field, value]) => {
              if (!mergedResult[mergeKey][field]) {
                mergedResult[mergeKey][field] = value;
                console.log(
                  `Added field ${field} to existing record ${mergeKey}`
                );
              }
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
    console.log(`Total merged records: ${Object.keys(mergedResult).length}`);
    if (Object.keys(mergedResult).length > 0) {
      console.log("Sample merged record:", Object.values(mergedResult)[0]);
    }

    // Send the merged result as response
    const mergeId = Date.now(); // Use timestamp as a unique ID
    console.log(
      `Final mergedResult contains ${Object.keys(mergedResult).length} records.`
    );
    console.log(`Sample record:`, Object.values(mergedResult).slice(0, 5)); // Log first 5 records
    fs.writeFileSync(
      join(PROCESSED_DIR, `${mergeId}-merged.json`),
      JSON.stringify(mergedResult, null, 2)
    );
    res.json(mergedResult);
  } catch (error) {
    console.error("Merge error:", error.message);
    res
      .status(500)
      .json({ error: "Failed to merge records", message: error.message });
  }
};
