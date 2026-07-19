import { useState, useId, useEffect } from 'react';

type InferredType = 'string' | 'integer' | 'number' | 'boolean';

interface ColumnMetadata {
  name: string;
  inferredType: InferredType;
  selectedType: InferredType;
  hasEmptyCells: boolean;
}

export default function CsvToSchema() {
  const [csvInput, setCsvInput] = useState('');
  const [columns, setColumns] = useState<ColumnMetadata[]>([]);
  const [schemaOutput, setSchemaOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const csvInputId = useId();
  const fileUploadId = useId();
  const errorId = useId();

  // Classify a single raw cell value into its most-specific possible type
  const classifyCell = (val: string): InferredType => {
    const trimmed = val.trim();
    if (/^(true|false)$/i.test(trimmed)) return 'boolean';
    if (/^-?\d+$/.test(trimmed)) return 'integer';
    if (/^-?\d*\.\d+$/.test(trimmed)) return 'number';
    return 'string';
  };

  // Widening ladder: boolean → integer → number → string
  // Given a current accumulated column type and a newly observed cell type,
  // return the broader of the two so the column type only ever expands.
  const widenType = (current: InferredType, next: InferredType): InferredType => {
    const rank: Record<InferredType, number> = {
      boolean: 0,
      integer: 1,
      number: 2,
      string: 3,
    };
    return rank[next] > rank[current] ? next : current;
  };

  // Safe RFC 4180 structural comma/quote balancer split matrix routine
  const parseCsvLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim().replace(/^"|"$/g, ''));
    return fields;
  };

  // Build column configuration maps reactively when input modifies
  useEffect(() => {
    const cleanInput = csvInput.trim();
    if (!cleanInput) {
      setColumns([]);
      setSchemaOutput('');
      setError(null);
      return;
    }

    const lines = cleanInput.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 1) {
      setError('Insufficient Data: Provide a header row along with your comma-separated records.');
      return;
    }

    setError(null);
    const headers = parseCsvLine(lines[0]);
    const records = lines.slice(1).map(parseCsvLine);

    // Deep matrix-wide column scan: walk every cell in every row for this column,
    // progressively widening the inferred type whenever a new cell demands it.
    const metaList: ColumnMetadata[] = headers.map((header, colIdx) => {
      let hasEmptyCells = false;
      // Start at the most-specific possible type; widen as the matrix is scanned.
      let columnType: InferredType | null = null;

      records.forEach(row => {
        const value = row[colIdx];
        if (value === undefined || value.trim() === '') {
          // Track nullability separately — empty cells don't influence type widening
          hasEmptyCells = true;
          return;
        }

        const cellType = classifyCell(value);

        if (columnType === null) {
          // First non-empty value seeds the initial type for this column
          columnType = cellType;
        } else {
          // Each subsequent cell may widen the accumulated column type
          columnType = widenType(columnType, cellType);
        }
      });

      // A column with only empty cells defaults to string
      const winner: InferredType = columnType ?? 'string';

      // Preserve user-applied manual overrides when headers remain stable
      const matchingPrevious = columns.find(c => c.name === header);

      return {
        name: header || `column_${colIdx + 1}`,
        inferredType: winner,
        selectedType: matchingPrevious ? matchingPrevious.selectedType : winner,
        hasEmptyCells,
      };
    });

    setColumns(metaList);
  }, [csvInput]);

  // Generate valid structural Draft-07 JSON Schema specifications
  useEffect(() => {
    if (columns.length === 0) {
      setSchemaOutput('');
      return;
    }

    const properties: Record<string, { type: string; description: string }> = {};
    const required: string[] = [];

    columns.forEach(col => {
      properties[col.name] = {
        type: col.selectedType,
        description: `Automated rule parameter constraint mapping for field entry: ${col.name}`
      };
      if (!col.hasEmptyCells) {
        required.push(col.name);
      }
    });

    const schemaObj = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'ConfigDevGeneratedCsvSchema',
      description: 'Production schema verification parameters parsed automatically via CSV dataset matrix templates.',
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };

    setSchemaOutput(JSON.stringify(schemaObj, null, 2));
  }, [columns]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setCsvInput(text);
    } catch (err) {
      setError('An error occurred while reading the data contents of the file.');
    } finally {
      e.target.value = '';
    }
  };

  const handleTypeOverrideChange = (colName: string, type: InferredType) => {
    setColumns(prev => prev.map(c => c.name === colName ? { ...c, selectedType: type } : c));
  };

  const handleLoadSample = () => {
    setCsvInput(
      `id,product_name,sku,price,in_stock,release_date\n10482,Enterprise Firewall Appliance,FW-NET-09,1499.95,true,2025-11-14\n10483,Core Network Switch v2,,850.00,false,2026-02-11\n10484,Rackmount Patch Panel 24Port,PP-RJ45-24,89.00,true,`
    );
  };

  const handleCopyText = async () => {
    if (!schemaOutput) return;
    try {
      await navigator.clipboard.writeText(schemaOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { /* Operational catch */ }
  };

  return (
    <div className="space-y-4 w-full text-neutral-800">
      {/* File Loader Actions Layout Control Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
            Tabular Dataset Data Contract Method
          </span>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Paste raw values directly below or drop a flat file to infer type arrays, detect empty parameters, and auto-build validation metrics.
          </p>
        </div>

        <div className="flex flex-col gap-1 justify-end">
          <label htmlFor={fileUploadId} className="text-xs font-semibold text-amber-700 uppercase tracking-wider block mb-1">
            Drop Spreadsheet Spreadsheet Dataset (.csv)
          </label>
          <div className="relative">
            <input
              id={fileUploadId}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="bg-amber-50/60 border border-dashed border-amber-300 text-amber-800 rounded-md px-3 py-1.5 text-xs text-center font-medium hover:bg-amber-100/80 transition-colors">
              Select or Drop CSV Structured File
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Hand: Ingestion Interface Panel Sheets */}
        <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden bg-white">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200 min-w-0">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider font-mono">
              Raw Source CSV Input Stream
            </span>
            <div className="flex items-center gap-3 min-w-0 ml-4">
              {error && (
                <p id={errorId} role="alert" aria-live="polite" className="text-xs font-medium text-rose-600 truncate max-w-[150px] sm:max-w-xs">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-2 py-1 bg-white border border-neutral-200 rounded-md shadow-sm shrink-0 cursor-pointer"
              >
                Incorporate Sample Template Matrix
              </button>
            </div>
          </div>

          <div className="p-4 flex-grow flex flex-col justify-between space-y-4">
            <textarea
              id={csvInputId}
              value={csvInput}
              onChange={(e) => setCsvInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder="id,name,isActive&#10;1,App Engine Task Server,true&#10;2,Database Aggregator Worker,false"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="w-full h-[220px] px-3 py-2 border border-neutral-200 rounded-md font-mono text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none leading-relaxed"
            />

            {/* Interactive Schema Mapping Overrides Grid Controller Matrix Section */}
            <div className="flex-grow border border-neutral-150 rounded-lg overflow-hidden bg-neutral-50/50">
              <div className="px-3 py-1.5 bg-neutral-100 border-b border-neutral-200 text-[10px] font-bold uppercase text-neutral-500 tracking-wider">
                Granular Type Overrides & Compilation Matrix
              </div>
              <div className="h-[200px] overflow-y-auto p-2 space-y-2">
                {columns.length > 0 ? (
                  columns.map((col) => (
                    <div key={col.name} className="flex items-center justify-between bg-white px-3 py-2 border border-neutral-200 rounded-md shadow-sm text-xs">
                      <div className="flex flex-col gap-0.5 max-w-[50%]">
                        <span className="font-mono font-bold text-neutral-800 truncate">{col.name}</span>
                        <span className="text-[10px] text-neutral-400">
                          Detected: <code className="font-mono text-neutral-500">{col.inferredType}</code>
                          {col.hasEmptyCells && <span className="text-amber-600 font-medium ml-1">· Nullable</span>}
                        </span>
                      </div>
                      <select
                        value={col.selectedType}
                        onChange={(e) => handleTypeOverrideChange(col.name, e.target.value as InferredType)}
                        className="bg-white border border-neutral-300 rounded px-2 py-1 font-mono text-[11px] text-neutral-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                      >
                        <option value="string">string</option>
                        <option value="integer">integer</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                      </select>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-neutral-400 italic text-xs pt-16">
                    Structured column override control trees map interactively once data blocks are verified.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Hand Component: Structured Specification Sheet Layout Export */}
        <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden bg-white">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200">
            <span className="text-xs font-bold font-mono text-neutral-500 uppercase tracking-tight">
              schema-specification.json (Draft-07 Compliant)
            </span>
            <button
              type="button"
              disabled={!schemaOutput}
              onClick={handleCopyText}
              className="text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded px-2.5 py-1 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {copied ? 'Copied Specification!' : 'Copy Specification Output'}
            </button>
          </div>
          <div className="bg-neutral-900 px-4 py-3 h-[498px] overflow-auto shadow-inner">
            <pre className="font-mono text-xs text-emerald-400 leading-relaxed whitespace-pre-wrap break-all">
              {schemaOutput || '# Compliant structural draft parameters schema specifications render here...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}