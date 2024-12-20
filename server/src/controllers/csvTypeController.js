import fs from 'fs/promises';
import { TYPES_FILE } from '../config.js'; // Adjust path as needed

// Get CSV types controller
export const getCsvTypes = async (req, res) => {
    try {
        const types = JSON.parse(await fs.readFile(TYPES_FILE, 'utf-8'));
        res.json(types);
    } catch (error) {
        console.error('Failed to fetch CSV types:', error);
        res.status(500).json({ error: 'Failed to fetch CSV types' });
    }
};
