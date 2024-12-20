/* eslint-disable no-unused-vars */
import express from "express";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs/promises";
import fileRoutes from "./routes/fileRoutes.js";
import csvTypeRoutes from "./routes/csvTypeRoutes.js";
import mergeRoutes from "./routes/mergeRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Setup storage directories
const DATA_DIR = join(__dirname, "../data");
const UPLOADS_DIR = join(DATA_DIR, "uploads");
const TYPES_FILE = join(DATA_DIR, "csvTypes.json");
const MAPPINGS_FILE = join(DATA_DIR, "mappings.json");
const PROCESSED_DIR = join(DATA_DIR, "processed");

// Ensure directories exist
await fs.mkdir(DATA_DIR, { recursive: true });
await fs.mkdir(UPLOADS_DIR, { recursive: true });
await fs.mkdir(PROCESSED_DIR, { recursive: true });

// Initialize JSON files if they don't exist
try {
  await fs.access(TYPES_FILE);
} catch {
  await fs.writeFile(TYPES_FILE, JSON.stringify([]));
}

try {
  await fs.access(MAPPINGS_FILE);
} catch {
  await fs.writeFile(MAPPINGS_FILE, JSON.stringify({}));
}

try {
  await fs.access(join(UPLOADS_DIR, "uploadedFiles.json"));
} catch {
  await fs.writeFile(
    join(UPLOADS_DIR, "uploadedFiles.json"),
    JSON.stringify([])
  );
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "text/csv") {
      cb(new Error("Only CSV files are allowed"));
      return;
    }
    cb(null, true);
  },
});

// Use routes
app.use("/api", fileRoutes);
app.use("/api/csv-types", csvTypeRoutes);
app.use("/api/merge", mergeRoutes);

app.get("/api/types", async (req, res) => {
  try {
    const types = JSON.parse(await fs.readFile(TYPES_FILE, "utf-8"));
    res.json(types);
  } catch (error) {
    console.error("Failed to fetch types:", error);
    res.status(500).json({ error: "Failed to fetch types" });
  }
});

app.post("/api/types", async (req, res) => {
  try {
    await fs.writeFile(TYPES_FILE, JSON.stringify(req.body));
    res.status(200).send("Types updated successfully");
  } catch (error) {
    console.error("Failed to update types:", error);
    res.status(500).json({ error: "Failed to update types" });
  }
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  res.status(200).send("File uploaded successfully");
});

app.get("/api/mappings", async (req, res) => {
  try {
    const mappings = JSON.parse(await fs.readFile(MAPPINGS_FILE, "utf-8"));
    res.json(mappings);
  } catch (error) {
    console.error("Failed to fetch mappings:", error);
    res.status(500).json({ error: "Failed to fetch mappings" });
  }
});

app.post("/api/mappings", async (req, res) => {
  try {
    await fs.writeFile(MAPPINGS_FILE, JSON.stringify(req.body));
    res.status(200).send("Mappings updated successfully");
  } catch (error) {
    console.error("Failed to update mappings:", error);
    res.status(500).json({ error: "Failed to update mappings" });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
