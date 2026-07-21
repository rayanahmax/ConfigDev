import { useState, useEffect, useId, type DragEvent } from 'react';

interface K8sStats {
  totalSecrets: number;
  decodedFields: number;
  encodedFields: number;
  sanitizedFields: number;
}

type ToolMode = 'decode' | 'encode' | 'sanitize';

export default function K8sManifestSanitizer() {
  const [inputYaml, setInputYaml] = useState('');
  const [outputYaml, setOutputYaml] = useState('');
  const [mode, setMode] = useState<ToolMode>('decode');
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [stats, setStats] = useState<K8sStats>({
    totalSecrets: 0,
    decodedFields: 0,
    encodedFields: 0,
    sanitizedFields: 0,
  });

  const inputId = useId();
  const modeSelectId = useId();

  // Safe Base64 decode with UTF-8 support
  const safeBase64Decode = (str: string): string => {
    try {
      // Handle both standard base64 and URL-safe base64
      const normalized = str.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(normalized);
      // Convert to UTF-8
      return decodeURIComponent(
        decoded
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
    } catch {
      return str; // Return original if decode fails
    }
  };

  // Safe Base64 encode with UTF-8 support
  const safeBase64Encode = (str: string): string => {
    try {
      // Convert UTF-8 to percent-encoding, then to base64
      const encoded = encodeURIComponent(str)
        .replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
      return btoa(encoded);
    } catch {
      return str; // Return original if encode fails
    }
  };

  // Parse and transform Kubernetes Secret YAML
  const processK8sYaml = (yaml: string, processingMode: ToolMode): { output: string; stats: K8sStats } => {
    const stats: K8sStats = {
      totalSecrets: 0,
      decodedFields: 0,
      encodedFields: 0,
      sanitizedFields: 0,
    };

    if (!yaml.trim()) {
      return { output: '', stats };
    }

    // Split multi-document YAML (separated by ---)
    const documents = yaml.split(/^---$/m).filter((doc) => doc.trim());
    const processedDocs: string[] = [];

    documents.forEach((doc) => {
      // Check if this is a Secret resource
      const isSecret = /kind:\s*Secret/i.test(doc);
      if (!isSecret) {
        processedDocs.push(doc);
        return;
      }

      stats.totalSecrets++;

      let processedDoc = doc;

      // Process data: block (base64 encoded values)
      const dataBlockMatch = processedDoc.match(/^([ \t]*data:[ \t]*\r?\n)((?:[ \t]+.+\r?\n)*)/m);
      if (dataBlockMatch) {
        const indent = dataBlockMatch[1];
        const dataContent = dataBlockMatch[2];
        const lines = dataContent.split('\n');
        const processedLines: string[] = [];

        lines.forEach((line) => {
          const keyValueMatch = line.match(/^([ \t]+)([a-zA-Z0-9._-]+):\s*(.+)$/);
          if (keyValueMatch) {
            const lineIndent = keyValueMatch[1];
            const key = keyValueMatch[2];
            const value = keyValueMatch[3].trim();

            let newValue = value;

            if (processingMode === 'decode') {
              // Decode base64 to plain text
              newValue = safeBase64Decode(value);
              if (newValue !== value) stats.decodedFields++;
            } else if (processingMode === 'encode') {
              // Encode plain text to base64
              newValue = safeBase64Encode(value);
              if (newValue !== value) stats.encodedFields++;
            } else if (processingMode === 'sanitize') {
              // Replace with redacted placeholder
              newValue = '<REDACTED_SECRET>';
              stats.sanitizedFields++;
            }

            processedLines.push(`${lineIndent}${key}: ${newValue}`);
          } else if (line.trim()) {
            processedLines.push(line);
          }
        });

        processedDoc = processedDoc.replace(
          dataBlockMatch[0],
          indent + processedLines.join('\n') + '\n'
        );
      }

      // Process stringData: block (plain text values)
      const stringDataBlockMatch = processedDoc.match(/^([ \t]*stringData:[ \t]*\r?\n)((?:[ \t]+.+\r?\n)*)/m);
      if (stringDataBlockMatch) {
        const indent = stringDataBlockMatch[1];
        const stringDataContent = stringDataBlockMatch[2];
        const lines = stringDataContent.split('\n');
        const processedLines: string[] = [];

        lines.forEach((line) => {
          const keyValueMatch = line.match(/^([ \t]+)([a-zA-Z0-9._-]+):\s*(.+)$/);
          if (keyValueMatch) {
            const lineIndent = keyValueMatch[1];
            const key = keyValueMatch[2];
            const value = keyValueMatch[3].trim();

            let newValue = value;

            if (processingMode === 'encode') {
              // Encode plain text to base64 and move to data: block
              newValue = safeBase64Encode(value);
              stats.encodedFields++;
              processedLines.push(`${lineIndent}${key}: ${newValue}`);
            } else if (processingMode === 'sanitize') {
              // Replace with redacted placeholder
              newValue = '<REDACTED_SECRET>';
              stats.sanitizedFields++;
              processedLines.push(`${lineIndent}${key}: ${newValue}`);
            } else {
              // decode mode: leave stringData as-is
              processedLines.push(line);
            }
          } else if (line.trim()) {
            processedLines.push(line);
          }
        });

        if (processingMode === 'encode') {
          // Convert stringData: to data: when encoding
          processedDoc = processedDoc.replace(
            stringDataBlockMatch[0],
            indent.replace('stringData', 'data') + processedLines.join('\n') + '\n'
          );
        } else {
          processedDoc = processedDoc.replace(
            stringDataBlockMatch[0],
            indent + processedLines.join('\n') + '\n'
          );
        }
      }

      processedDocs.push(processedDoc);
    });

    return {
      output: processedDocs.join('---\n'),
      stats,
    };
  };

  useEffect(() => {
    const result = processK8sYaml(inputYaml, mode);
    setOutputYaml(result.output);
    setStats(result.stats);
  }, [inputYaml, mode]);

  // Drag-and-drop file handling
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.yaml') || droppedFile.name.endsWith('.yml'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setInputYaml(event.target.result as string);
        }
      };
      reader.readAsText(droppedFile);
    }
  };

  const handleLoadSample = () => {
    const sampleYaml = `apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: production
type: Opaque
data:
  username: YWRtaW4=
  password: UEBzc3cwcmQxMjMh
  database-url: cG9zdGdyZXNxbDovL2FkbWluOlBAc3N3MHJkMTIzIUBkYi5leGFtcGxlLmNvbTo1NDMyL215ZGI=
---
apiVersion: v1
kind: Secret
metadata:
  name: api-keys
type: Opaque
stringData:
  stripe-key: sk_live_abc123xyz789
  sendgrid-api-key: SG.1234567890abcdefghijklmnop
  jwt-secret: my-super-secret-jwt-signing-key`;
    setInputYaml(sampleYaml);
  };

  const handleCopy = async () => {
    if (!outputYaml) return;
    try {
      await navigator.clipboard.writeText(outputYaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access fallback
    }
  };

  const handleDownload = () => {
    if (!outputYaml) return;
    const blob = new Blob([outputYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'sanitize' ? 'secret.sanitized.yaml' : 'secret.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 w-full text-neutral-800">
      {/* Mode Selector Panel */}
      <div className="flex flex-col gap-4 p-4 bg-neutral-50 border border-neutral-200 rounded-lg shadow-sm">
        <div>
          <label htmlFor={modeSelectId} className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-3 font-mono">
            Transformation Mode
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {[
              { value: 'decode', label: 'Decode Base64 → Plain Text', desc: 'View secrets in readable format' },
              { value: 'encode', label: 'Encode Plain Text → Base64', desc: 'Convert stringData to data format' },
              { value: 'sanitize', label: 'Sanitize for Git', desc: 'Replace secrets with <REDACTED_SECRET>' },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex-1 min-w-[180px] flex flex-col gap-1.5 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  mode === option.value
                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-500/20'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={(e) => setMode(e.target.value as ToolMode)}
                  className="sr-only"
                />
                <span className="text-sm font-bold text-neutral-900">{option.label}</span>
                <span className="text-xs text-neutral-500">{option.desc}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Editor Space */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input YAML Box */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col border rounded-lg overflow-hidden min-w-0 bg-white transition-all duration-200 ${
            isDragging ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10' : 'border-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200 min-w-0">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider font-mono shrink-0">
              Input YAML / Drop Files
            </span>
            <button
              type="button"
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Load Sample Secret
            </button>
          </div>
          <div className="relative flex-grow">
            <textarea
              id={inputId}
              value={inputYaml}
              onChange={(e) => setInputYaml(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-label="Paste Kubernetes Secret YAML or drop YAML files"
              placeholder="Paste Kubernetes Secret manifests here, or drag-and-drop .yaml/.yml files..."
              translate="no"
              className="w-full h-full min-h-[300px] md:min-h-[450px] resize-none px-4 py-3 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 text-neutral-800 bg-transparent border-0"
            />
          </div>
        </div>

        {/* Output YAML Box */}
        <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden min-w-0 bg-neutral-900">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700 shrink-0">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider font-mono">
              Transformed Output
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!outputYaml}
                aria-label="Copy transformed YAML to clipboard"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-md hover:bg-neutral-700 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!outputYaml}
                aria-label="Download transformed YAML as file"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-md hover:bg-neutral-700 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </div>
          <div className="flex-grow overflow-auto min-h-[300px] md:min-h-[450px] px-4 py-3 shadow-inner">
            {outputYaml ? (
              <pre className="font-mono text-sm text-neutral-100 leading-relaxed whitespace-pre-wrap break-words">
                {outputYaml}
              </pre>
            ) : (
              <p className="font-mono text-sm text-neutral-500 italic mt-2 select-none">
                Transformed YAML will appear here as you type...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      {stats.totalSecrets > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {[
            { label: 'Secrets Found', val: stats.totalSecrets, color: 'text-blue-600 bg-blue-50 border-blue-200' },
            { label: 'Decoded Fields', val: stats.decodedFields, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
            { label: 'Encoded Fields', val: stats.encodedFields, color: 'text-amber-600 bg-amber-50 border-amber-200' },
            { label: 'Sanitized Fields', val: stats.sanitizedFields, color: 'text-rose-600 bg-rose-50 border-rose-200' },
          ].map((stat, idx) => (
            <div key={idx} className={`flex flex-col items-center justify-center p-3 border rounded-lg ${stat.color}`}>
              <span className="text-lg font-bold tracking-tight font-mono">{stat.val}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-center mt-1">{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
