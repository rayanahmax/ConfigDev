import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Options {
  normalizeKeys: boolean;
  castTypes: boolean;
  collapseNested: boolean;
}

// ─── Parsing Logic ────────────────────────────────────────────────────────────

function castValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== '') return num;
  return trimmed;
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let cursor = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (typeof cursor[segment] !== 'object' || cursor[segment] === null) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
}

function parseEnv(input: string, options: Options): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = input.split('\n');

  let i = 0;
  while (i < lines.length) {
    let line = lines[i].trim();
    i++;

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Handle multiline quoted values: KEY="line1\nline2"
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    let key = line.slice(0, eqIdx).trim();
    let rawValue = line.slice(eqIdx + 1).trim();

    // Collect multiline double-quoted values
    if (rawValue.startsWith('"') && !rawValue.endsWith('"')) {
      while (i < lines.length) {
        rawValue += '\n' + lines[i];
        i++;
        if (lines[i - 1].trim().endsWith('"')) break;
      }
    }

    // Strip surrounding quotes
    if (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) {
      rawValue = rawValue.slice(1, -1);
    }

    // Strip inline comments (e.g. KEY=value # comment)
    rawValue = rawValue.replace(/\s+#.*$/, '');

    if (!key) continue;

    if (options.normalizeKeys) key = normalizeKey(key);

    const finalValue: unknown = options.castTypes ? castValue(rawValue) : rawValue;

    if (options.collapseNested) {
      // Split on __ or . to build nested paths
      const segments = key.split(/__|\./).map((s) => s.toLowerCase());
      setNestedValue(result, segments, finalValue);
    } else {
      result[key] = finalValue;
    }
  }

  return result;
}

// ─── Sample Data ──────────────────────────────────────────────────────────────

const SAMPLE_ENV = `# Application Environment
NODE_ENV=production
PORT=3000
DEBUG=false

# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=myapp_db
DB_USER=admin
DB_PASSWORD=s3cr3t_passw0rd

# Auth
JWT_SECRET=ey.abc.def
JWT_EXPIRES_IN=7d
SESSION_TIMEOUT=null

# Feature Flags
FEATURE_ANALYTICS=true
FEATURE_NEW_UI=false
`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function EnvToJson() {
  const [input, setInput] = useState('');
  const [options, setOptions] = useState<Options>({
    normalizeKeys: false,
    castTypes: true,
    collapseNested: false,
  });
  const [copied, setCopied] = useState(false);

  const parsed = useCallback(() => {
    if (!input.trim()) return null;
    try {
      return parseEnv(input, options);
    } catch {
      return null;
    }
  }, [input, options])();

  const outputJson = parsed ? JSON.stringify(parsed, null, 2) : '';

  const handleCopy = async () => {
    if (!outputJson) return;
    await navigator.clipboard.writeText(outputJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInjectSample = () => setInput(SAMPLE_ENV);

  const toggleOption = (key: keyof Options) =>
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      <nav className="flex gap-2 border-b border-neutral-200 mb-6" aria-label="Conversion direction">
        <a
          href="/env-to-json"
          aria-current="page"
          className="px-4 py-2 font-medium text-sm border-b-2 border-amber-500 text-neutral-900"
        >
          .env to JSON
        </a>
        <a
          href="/json-to-env"
          className="px-4 py-2 font-medium text-sm text-neutral-500 hover:text-neutral-900"
        >
          JSON to .env
        </a>
      </nav>

      {/* Options Banner */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-lg">
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Options</span>
        {(
          [
            { key: 'normalizeKeys', label: 'Normalize Keys' },
            { key: 'castTypes', label: 'Cast Data Types' },
            { key: 'collapseNested', label: 'Collapse Nested Paths' },
          ] as { key: keyof Options; label: string }[]
        ).map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={options[key]}
              onChange={() => toggleOption(key)}
              className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus-visible:ring-2 focus-visible:ring-[#D4AF37] accent-neutral-900"
            />
            <span className="text-sm font-medium text-neutral-700">{label}</span>
          </label>
        ))}
      </div>

      {/* Workspace: Input + Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left: Input Panel */}
        <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider font-mono">.env input</span>
            <button
              type="button"
              onClick={handleInjectSample}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-[#D4AF37]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Inject Sample .env
            </button>
          </div>
          <div className="relative flex-grow">
            <textarea
              id="env-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder={'Paste your .env file contents here\u2026'}
              aria-label="Paste .env file contents"
              className="w-full h-full min-h-[250px] md:min-h-[400px] resize-none px-4 py-3 font-mono text-sm text-neutral-800 bg-white placeholder-neutral-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D4AF37] leading-relaxed"
            />
          </div>
        </div>

        {/* Right: Output Panel */}
        <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider font-mono">JSON Output</span>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!outputJson}
              aria-label="Copy JSON output to clipboard"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy JSON
                </>
              )}
            </button>
          </div>
          <div className="flex-grow overflow-auto min-h-[250px] md:min-h-[400px] bg-neutral-950 px-4 py-3">
            {outputJson ? (
              <pre className="font-mono text-sm text-emerald-400 leading-relaxed whitespace-pre-wrap break-words">
                {outputJson}
              </pre>
            ) : (
              <p className="font-mono text-sm text-neutral-600 italic mt-2">
                {input.trim() ? 'No valid key=value pairs found.' : 'JSON output will appear here as you type\u2026'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
