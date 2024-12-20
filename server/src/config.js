import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const UPLOADS_DIR = path.join(__dirname, "..", "data", "uploads");
export const PROCESSED_DIR = path.join(__dirname, "..", "data", "processed");
export const TYPES_FILE = path.join(__dirname, "..", "data", "csvTypes.json");
export const MAPPINGS_FILE = path.join(
  __dirname,
  "..",
  "data",
  "mappings.json"
);
