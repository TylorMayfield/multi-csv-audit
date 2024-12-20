# CSV Consolidation Tool

A powerful tool for consolidating and merging CSV data from multiple sources with different schemas.

## Features

- **CSV Type Definition**: Define different CSV types with expected columns and data types
- **Column Mapping**: Map columns between different CSV sources
- **Data Validation**: Validate CSV data against defined types
- **Record Merging**: Merge records from different sources based on key fields
- **Data Export**: Export consolidated data in various formats

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/multi-csv-audit.git
cd multi-csv-audit
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Start the backend server:
```bash
npm run server
```

## Project Structure

```
multi-csv-audit/
├── src/                    # Frontend React code
│   ├── components/         # React components
│   ├── services/          # Frontend services
│   └── styles/            # CSS styles
├── server/                # Backend server code
│   ├── src/
│   │   ├── models/       # Database models
│   │   ├── services/     # Business logic
│   │   └── routes/       # API routes
│   └── data/             # SQLite database and uploads
└── public/               # Static assets
```

## Usage

1. **Define CSV Types**
   - Create new CSV type definitions
   - Specify required columns and data types
   - Set validation rules

2. **Upload CSV Files**
   - Upload CSV files from different sources
   - Files are automatically validated against defined types
   - View validation results and errors

3. **Map Columns**
   - Create mappings between different CSV types
   - Define transformation rules
   - Handle different column names from various sources

4. **Merge Records**
   - Select key fields for merging
   - Configure merge strategy
   - Execute merge operation

5. **View and Export**
   - View consolidated data
   - Filter and search records
   - Export to various formats

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
