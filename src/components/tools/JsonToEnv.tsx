import { useState, useEffect, useId } from 'react';

export default function JsonToEnv() {
  // Initial state is now clean and empty
  const [jsonInput, setJsonInput] = useState('');
  const [envOutput, setEnvOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [uppercaseKeys, setUppercaseKeys] = useState(true);
  const [delimiter, setDelimiter] = useState('__');

  const uppercaseId = useId();
  const delimiterId = useId();
  const jsonInputId = useId();
  const errorId = useId();

  useEffect(() => {
    try {
      if (!jsonInput.trim()) {
        setEnvOutput('');
        setError(null);
        return;
      }

      const parsed = JSON.parse(jsonInput);
      setError(null);

      const lines: string[] = [];

      const flattenObject = (obj: Record<string, unknown>, prefix = '') => {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            let formatedKey = key;
            if (uppercaseKeys) {
              formatedKey = key.toUpperCase();
            }

            const fullKey = prefix ? `${prefix}${delimiter}${formatedKey}` : formatedKey;
            const value = obj[key];

            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
              flattenObject(value as Record<string, unknown>, fullKey);
            } else if (Array.isArray(value)) {
              lines.push(`${fullKey}=${value.join(',')}`);
            } else if (value === null) {
              lines.push(`${fullKey}=null`);
            } else {
              lines.push(`${fullKey}=${value}`);
            }
          }
        }
      };

      flattenObject(parsed as Record<string, unknown>);
      setEnvOutput(lines.join('\n'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown parse error';
      setError(`Invalid JSON structure: ${message}`);
      setEnvOutput('');
    }
  }, [jsonInput, uppercaseKeys, delimiter]);

  // Handler to safely ingest mock parameters on command
  const handleLoadSample = () => {
    const sampleJson = '{\n  "app": {\n    "name": "ConfigDev",\n    "version": 2.5\n  },\n  "database": {\n    "host": "127.0.0.1",\n    "secure": true\n  }\n}';
    setJsonInput(sampleJson);
  };

  const handleCopy = async () => {
    if (!envOutput) return;
    try {
      await navigator.clipboard.writeText(envOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access fallback
    }
  };

  return (
    <div className="space-y-4 w-full">
      <nav className="flex gap-2 border-b border-neutral-200 mb-6" aria-label="Conversion direction">
        <a
          href="/env-to-json"
          className="px-4 py-2 font-medium text-sm text-neutral-500 hover:text-neutral-900"
        >
          .env to JSON
        </a>
        <a
          href="/json-to-env"
          aria-current="page"
          className="px-4 py-2 font-medium text-sm border-b-2 border-amber-500 text-neutral-900"
        >
          JSON to .env
        </a>
      </nav>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-lg">
        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Options</span>

        <label htmlFor={uppercaseId} className="flex items-center gap-2 cursor-pointer select-none">
          <input
            id={uppercaseId}
            name="uppercase-keys"
            type="checkbox"
            checked={uppercaseKeys}
            onChange={(e) => setUppercaseKeys(e.target.checked)}
            className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus-visible:ring-2 focus-visible:ring-[#D4AF37] accent-neutral-900"
          />
          <span className="text-sm font-medium text-neutral-700">Uppercase Keys</span>
        </label>

        <div className="flex items-center gap-2">
          <label htmlFor={delimiterId} className="text-sm font-medium text-neutral-700">
            Nesting Delimiter
          </label>
          <select
            id={delimiterId}
            name="nesting-delimiter"
            value={delimiter}
            onChange={(e) => setDelimiter(e.target.value)}
            className="bg-white border border-neutral-300 rounded-md px-2 py-1 text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] cursor-pointer"
          >
            <option value="__">Double Underscore (__)</option>
            <option value=".">Dot Notation (.)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* JSON Input Panel */}
        <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden min-w-0">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200 min-w-0">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider font-mono shrink-0">
              JSON Input
            </span>
            <div className="flex items-center gap-3 min-w-0 ml-4">
              {error && (
                <p
                  id={errorId}
                  role="alert"
                  aria-live="polite"
                  className="text-xs font-medium text-rose-600 truncate min-w-0"
                >
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={handleLoadSample}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 text-[#D4AF37]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            Ingest Sample JSON
              </button>
            </div>
          </div>
          <div className="relative flex-grow">
            <textarea
              id={jsonInputId}
              name="json-input"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-label="Paste JSON object to convert"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              placeholder={'{\n  "paste_your_json_object": true\n}…'}
              translate="no"
              className={`w-full h-full min-h-[250px] md:min-h-[400px] resize-none px-4 py-3 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#D4AF37] text-neutral-900 bg-white ${
                error ? 'border-rose-500/50 focus-visible:ring-rose-500' : ''
              }`}
            />
          </div>
        </div>

        {/* .env Output Panel */}
        <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden min-w-0">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider font-mono">
              .env Output
            </span>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!envOutput}
              aria-label="Copy .env output to clipboard"
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
                  Copy .env
                </>
              )}
            </button>
          </div>
          <div className="flex-grow overflow-auto min-h-[250px] md:min-h-[400px] bg-neutral-900 px-4 py-3 shadow-inner">
            {envOutput ? (
              <pre
                className="font-mono text-sm text-neutral-100 leading-relaxed whitespace-pre-wrap break-words"
                translate="no"
              >
                {envOutput}
              </pre>
            ) : (
              <p className="font-mono text-sm text-neutral-500 italic mt-2 select-none">
                {error
                  ? 'Fix the JSON input to generate .env output.'
                  : '.env output will appear here as you type…'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}