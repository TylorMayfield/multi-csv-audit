import express from "express";
import { getCsvTypes } from "../controllers/csvTypeController.js";

const router = express.Router();

// Get CSV types route
router.get("/", getCsvTypes);

export default router;
