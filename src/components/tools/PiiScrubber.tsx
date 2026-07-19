import { useState, useEffect, useId, type DragEvent } from 'react';import nlp from 'compromise';

interface ScrubberStats {
  emailCount: number;
  ipCount: number;
  secretCount: number;
  cardCount: number;
  jwtCount: number;
  nlpCount: number; // Added tracking for Named Entities
  total: number;
}

type MaskStyle = 'category' | 'custom' | 'sha256';

export default function PiiScrubber() {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Masking toggles
  const [maskEmails, setMaskEmails] = useState(true);
  const [maskIps, setMaskIps] = useState(true);
  const [maskSecrets, setMaskSecrets] = useState(true);
  const [maskCreditCards, setMaskCreditCards] = useState(true);
  const [maskJwts, setMaskJwts] = useState(true);
  const [maskNlp, setMaskNlp] = useState(false); // NLP entity recognition toggle

  // Masking format state
  const [maskStyle, setMaskStyle] = useState<MaskStyle>('category');
  const [customMaskText, setCustomMaskText] = useState('[REDACTED]');

  const [stats, setStats] = useState<ScrubberStats>({
    emailCount: 0,
    ipCount: 0,
    secretCount: 0,
    cardCount: 0,
    jwtCount: 0,
    nlpCount: 0,
    total: 0,
  });

  const emailToggleId = useId();
  const ipToggleId = useId();
  const secretToggleId = useId();
  const cardToggleId = useId();
  const jwtToggleId = useId();
  const nlpToggleId = useId();
  const formatToggleId = useId();
  const customMaskId = useId();
  const inputId = useId();

  // Pure deterministic fast string hashing representation for browser client sandboxes
  const getReplacement = (matchedValue: string, categoryTag: string): string => {
    if (maskStyle === 'custom') return customMaskText;
    if (maskStyle === 'sha256') {
      let hash = 0;
      for (let i = 0; i < matchedValue.length; i++) {
        hash = (hash << 5) - hash + matchedValue.charCodeAt(i);
        hash |= 0;
      }
      return `[HASH_${Math.abs(hash).toString(16).substring(0, 8).toUpperCase()}]`;
    }
    return categoryTag;
  };

  useEffect(() => {
    if (!inputText.trim()) {
      setOutputText('');
      setStats({
        emailCount: 0,
        ipCount: 0,
        secretCount: 0,
        cardCount: 0,
        jwtCount: 0,
        nlpCount: 0,
        total: 0,
      });
      return;
    }

    let temp = inputText;
    let emailCount = 0;
    let ipCount = 0;
    let secretCount = 0;
    let cardCount = 0;
    let jwtCount = 0;
    let nlpCount = 0;

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    const ipRegex = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
    const jwtRegex = /\beyJ[a-zA-Z0-9_-]{2,}\.[a-zA-Z0-9_-]{2,}\.[a-zA-Z0-9_-]{2,}\b/g;
    const ccRegex = /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b|\b\d{13,16}\b/g;
    const secretRegex = /\b(db_password|db-password|dbpassword|password|pass|passwd|secret|api_key|apikey|api-key|token|auth_token|jwt|credential|private_key|auth|authorization)\s*([:=])\s*(['"]?)([^"'\s,;{}()[\]\\]+)\3/gi;

    if (maskEmails) {
      emailCount = (temp.match(emailRegex) || []).length;
      temp = temp.replace(emailRegex, (m) => getReplacement(m, '[REDACTED_EMAIL]'));
    }
    if (maskIps) {
      ipCount = (temp.match(ipRegex) || []).length;
      temp = temp.replace(ipRegex, (m) => getReplacement(m, '[REDACTED_IP]'));
    }
    if (maskJwts) {
      jwtCount = (temp.match(jwtRegex) || []).length;
      temp = temp.replace(jwtRegex, (m) => getReplacement(m, '[REDACTED_JWT]'));
    }
    if (maskCreditCards) {
      cardCount = (temp.match(ccRegex) || []).length;
      temp = temp.replace(ccRegex, (m) => getReplacement(m, '[REDACTED_CARD]'));
    }
    if (maskSecrets) {
      const matches = temp.match(secretRegex) || [];
      secretCount = matches.length;
      temp = temp.replace(secretRegex, (match, key, operator, quote, val) => {
        const replacement = getReplacement(val, '[REDACTED_SECRET]');
        return `${key}${operator}${quote}${replacement}${quote}`;
      });
    }

    // Client-side execution of natural language token classification via compromise 
    if (maskNlp) {
      const doc = nlp(temp);
      const names = doc.people().out('array');
      const places = doc.places().out('array');
      
      const combinedEntities = Array.from(new Set([...names, ...places]));
      nlpCount = combinedEntities.length;

      combinedEntities.forEach(entity => {
        if (entity.trim().length > 1) {
          const escapedEntity = entity.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const entityRegex = new RegExp(`\\b${escapedEntity}\\b`, 'g');
          temp = temp.replace(entityRegex, (m) => getReplacement(m, '[REDACTED_IDENTIFIER]'));
        }
      });
    }

    setOutputText(temp);
    setStats({
      emailCount,
      ipCount,
      secretCount,
      cardCount,
      jwtCount,
      nlpCount,
      total: emailCount + ipCount + secretCount + cardCount + jwtCount + nlpCount,
    });
  }, [
    inputText,
    maskEmails,
    maskIps,
    maskSecrets,
    maskCreditCards,
    maskJwts,
    maskNlp,
    maskStyle,
    customMaskText,
  ]);

  // Integrated drag-and-drop mechanics
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
    if (droppedFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setInputText(event.target.result as string);
        }
      };
      reader.readAsText(droppedFile);
    }
  };

  const handleLoadSample = () => {
    const sampleLog = 
`2026-06-24 10:15:30 [INFO] User login request from IP 192.168.1.45 by admin@company.com
2026-06-24 10:15:31 [DEBUG] API Request parameters: {"auth_token": "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiaGFzaSJ9.abc123xyz", "password": "super-secret-password-123"}
2026-06-24 10:15:32 [ERROR] Failed connection to database. host=10.0.0.12, db_password=db_pass_xyz987, cc_number=4111-2222-3333-4444
2026-06-24 10:15:33 [INFO] System audit run cleared by Alice Logan in Bangalore server farms.`;
    setInputText(sampleLog);
  };

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access fallback
    }
  };

  return (
    <div className="space-y-4 w-full text-neutral-800">
      {/* Options Panel */}
      <div className="flex flex-col gap-4 p-4 bg-neutral-50 border border-neutral-200 rounded-lg shadow-sm">
        <div>
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-3 font-mono">
            Filters to Redact
          </span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {[
              { id: emailToggleId, label: 'Emails', checked: maskEmails, set: setMaskEmails },
              { id: ipToggleId, label: 'IP Addresses', checked: maskIps, set: setMaskIps },
              { id: secretToggleId, label: 'Passwords & Secrets', checked: maskSecrets, set: setMaskSecrets },
              { id: cardToggleId, label: 'Credit Cards', checked: maskCreditCards, set: setMaskCreditCards },
              { id: jwtToggleId, label: 'JWT Tokens', checked: maskJwts, set: setMaskJwts },
              { id: nlpToggleId, label: 'Names & Locations (NLP)', checked: maskNlp, set: setMaskNlp },
            ].map((f) => (
              <label key={f.id} htmlFor={f.id} className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id={f.id}
                  type="checkbox"
                  checked={f.checked}
                  onChange={(e) => f.set(e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-neutral-900 focus:ring-amber-500 accent-neutral-900"
                />
                <span className="text-sm font-medium text-neutral-700">{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-neutral-200/60 pt-3 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <label htmlFor={formatToggleId} className="text-sm font-medium text-neutral-700 select-none">
              Redaction Format
            </label>
            <select
              id={formatToggleId}
              value={maskStyle}
              onChange={(e) => setMaskStyle(e.target.value as MaskStyle)}
              className="bg-white border border-neutral-300 rounded-md px-2 py-1 text-sm font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
            >
              <option value="category">Category-Specific Tags (e.g. [REDACTED_EMAIL])</option>
              <option value="custom">Generic Custom Placeholder</option>
              <option value="sha256">Crypto Hashing Token (Pseudo SHA-256)</option>
            </select>
          </div>

          {maskStyle === 'custom' && (
            <div className="flex items-center gap-2 animate-fadeIn">
              <label htmlFor={customMaskId} className="text-sm font-medium text-neutral-700 select-none">
                Placeholder
              </label>
              <input
                id={customMaskId}
                type="text"
                value={customMaskText}
                onChange={(e) => setCustomMaskText(e.target.value)}
                placeholder="[REDACTED]"
                className="bg-white border border-neutral-300 rounded-md px-2.5 py-1 text-sm font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Editor Space */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Input Log Box */}
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
              Raw Log Input / Drop Files
            </span>
            <button
              type="button"
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 hover:border-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Ingest Sample Logs
            </button>
          </div>
          <div className="relative flex-grow">
            <textarea
              id={inputId}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-label="Paste raw logs or drop log files to scrub"
              placeholder="Paste raw data streams, or drag-and-drop log files (.log, .txt, .json) directly here..."
              translate="no"
              className="w-full h-full min-h-[250px] md:min-h-[400px] resize-none px-4 py-3 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500 text-neutral-800 bg-transparent border-0"
            />
          </div>
        </div>

        {/* Output Sanitized Box */}
        <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden min-w-0 bg-neutral-900">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700 shrink-0">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider font-mono">
              Scrubbed Output
            </span>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!outputText}
              aria-label="Copy scrubbed logs to clipboard"
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
                  Copy Scrubbed Log
                </>
              )}
            </button>
          </div>
          <div className="flex-grow overflow-auto min-h-[250px] md:min-h-[400px] px-4 py-3 shadow-inner">
            {outputText ? (
              <pre className="font-mono text-sm text-neutral-100 leading-relaxed whitespace-pre-wrap break-words">
                {outputText}
              </pre>
            ) : (
              <p className="font-mono text-sm text-neutral-500 italic mt-2 select-none">
                Scrubbed logs will render dynamically here as you type...
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Statistics Dashboard */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 pt-2">
          {[
            { label: 'Emails', val: stats.emailCount, color: 'text-amber-600 bg-amber-50 border-amber-200' },
            { label: 'IPs', val: stats.ipCount, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
            { label: 'Secrets', val: stats.secretCount, color: 'text-rose-600 bg-rose-50 border-rose-200' },
            { label: 'Cards', val: stats.cardCount, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
            { label: 'JWTs', val: stats.jwtCount, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
            { label: 'NLP Targets', val: stats.nlpCount, color: 'text-purple-600 bg-purple-50 border-purple-200' },
            { label: 'Total', val: stats.total, color: 'text-neutral-700 bg-neutral-100 border-neutral-300 font-bold' },
          ].map((stat, idx) => (
            <div key={idx} className={`flex flex-col items-center justify-center p-2.5 border rounded-lg ${stat.color}`}>
              <span className="text-base font-bold tracking-tight font-mono">{stat.val}</span>
              <span className="text-[9px] uppercase font-bold tracking-wider text-center mt-0.5">{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}