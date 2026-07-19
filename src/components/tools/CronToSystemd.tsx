import { useState, useId, useEffect } from 'react';

export default function CronToSystemd() {
  const [cronInput, setCronInput] = useState('');
  const [unitName, setUnitName] = useState('app-task');
  const [execCommand, setExecCommand] = useState('/usr/bin/node /var/www/app/index.js');
  
  const [timerOutput, setTimerOutput] = useState('');
  const [serviceOutput, setServiceOutput] = useState('');
  const [nextRuns, setNextRuns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [copiedTimer, setCopiedTimer] = useState(false);
  const [copiedService, setCopiedService] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const cronInputId = useId();
  const unitNameId = useId();
  const execCommandId = useId();
  const fileUploadId = useId();
  const errorId = useId();

  const daysMap: Record<string, string> = {
    '0': 'Sun', '7': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat',
    'sun': 'Sun', 'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri', 'sat': 'Sat'
  };

  const calculateNextRuns = (min: string, hour: string, day: string, month: string, dow: string): string[] => {
    const dates: string[] = [];
    let current = new Date();
    current.setSeconds(0, 0);

    const parseTokenRange = (token: string, max: number, minVal = 0): number[] => {
      if (token === '*') return Array.from({ length: max - minVal + 1 }, (_, i) => i + minVal);
      if (token.startsWith('*/')) {
        const step = Number(token.replace('*/', ''));
        const res: number[] = [];
        for (let i = minVal; i <= max; i += step) res.push(i);
        return res;
      }
      const results: number[] = [];
      const parts = token.split(',');
      for (const part of parts) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let i = start; i <= end; i++) if (!isNaN(i) && i >= minVal && i <= max) results.push(i);
        } else {
          const val = Number(part);
          if (!isNaN(val) && val >= minVal && val <= max) results.push(val);
        }
      }
      return results.length ? [...new Set(results)].sort((a, b) => a - b) : [];
    };

    const parsedMins = parseTokenRange(min, 59);
    const parsedHours = parseTokenRange(hour, 23);
    const parsedMonths = parseTokenRange(month, 12, 1);

    let safetyCounter = 0;
    while (dates.length < 5 && safetyCounter < 2000) {
      safetyCounter++;
      current.setMinutes(current.getMinutes() + 1);

      const m = current.getMinutes();
      const h = current.getHours();
      const d = current.getDate();
      const mo = current.getMonth() + 1; 
      const dw = current.getDay();

      if (!parsedMins.includes(m)) continue;
      if (!parsedHours.includes(h)) continue;
      if (!parsedMonths.includes(mo)) continue;

      if (day !== '*') {
        const parsedDays = parseTokenRange(day, 31, 1);
        if (!parsedDays.includes(d)) continue;
      }

      if (dow !== '*') {
        const rawDowTokens = dow.split(',').map(d => {
          if (daysMap[d.toLowerCase()]) {
            const mapped = daysMap[d.toLowerCase()];
            const entries = Object.entries(daysMap);
            const found = entries.find(([k, v]) => v === mapped && !isNaN(Number(k)));
            return found ? Number(found[0]) : -1;
          }
          return Number(d);
        });
        const structuralDows = rawDowTokens.map(v => v === 7 ? 0 : v);
        if (!structuralDows.includes(dw)) continue;
      }

      const timestamp = current.toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      dates.push(timestamp);
    }
    return dates;
  };

  const getCleanJobName = (commandString: string, index: number): string => {
    if (!commandString) return `bulk-job-${index + 1}`;
    
    const executable = commandString.trim().split(/\s+/)[0]; 
    const baseName = executable.split('/').pop() || ''; 
    
    // Replace non-alphanumeric except dots, dashes, and underscores to preserve extensions cleanly
    let cleanName = baseName.replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
    // Convert trailing script extensions into clear dashes instead of running smash strings
    cleanName = cleanName.replace(/\./g, '-');
    
    if (!cleanName || ['sh', 'bash', 'python', 'python3', 'node', 'php'].includes(cleanName)) {
      const args = commandString.trim().split(/\s+/);
      if (args[1]) {
        const scriptName = args[1].split('/').pop()?.split('.')[0];
        if (scriptName) {
          return scriptName.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
        }
      }
      return `job-${index + 1}`;
    }
    
    return cleanName;
  };

  const convertCronToSystemdText = (line: string, baseUnit: string, command: string) => {
    const segments = line.trim().split(/\s+/);
    
    let finalCommand = command;
    let cronSegments = segments;

    if (segments.length > 5) {
      cronSegments = segments.slice(0, 5);
      finalCommand = segments.slice(5).join(' ');
    } else if (segments.length !== 5) {
      return null;
    }

    const finalUnitName = segments.length > 5 ? getCleanJobName(finalCommand, 0) : baseUnit;
    const [min, hour, day, month, dow] = cronSegments;

    let systemdDow = '';
    if (dow !== '*') {
      systemdDow = dow.split(',').map(d => daysMap[d.toLowerCase()] || d).join(',') + ' ';
    }

    // Build standard date blocks cleanly without padding asterisk placeholders
    const dateStr = (month === '*' && day === '*') ? '*-*-*' : `*-${month === '*' ? '*' : month.padStart(2, '0')}-${day === '*' ? '*' : day.padStart(2, '0')}`;

    // Compute type-safe Systemd scheduling components
    let hourStr = hour;
    let minStr = min;

    if (hour.startsWith('*/')) {
      hourStr = `0/${hour.replace('*/', '')}`;
    } else if (hour !== '*') {
      hourStr = hour.split(',').map(h => h.includes('-') ? h : h.padStart(2, '0')).join(',');
    }

    if (min.startsWith('*/')) {
      minStr = `0/${min.replace('*/', '')}`;
    } else if (min !== '*') {
      minStr = min.split(',').map(m => m.includes('-') ? m : m.padStart(2, '0')).join(',');
    }

    // Assemble unified OnCalendar structure securely
    let onCalendarStr = '';
    if (hour.startsWith('*/') && min === '0') {
      onCalendarStr = `*-*-* ${hourStr}:00:00`;
    } else if (min.startsWith('*/')) {
      onCalendarStr = `*-*-* ${hourStr === '*' ? '*' : hourStr}:${minStr}:00`;
    } else {
      onCalendarStr = `${systemdDow}${dateStr} ${hourStr === '*' ? '00' : hourStr}:${minStr === '*' ? '00' : minStr}:00`;
    }

    onCalendarStr = onCalendarStr.replace(/\s+/g, ' ').trim();

    const timer = `[Unit]\nDescription=Run ${finalUnitName} on a scheduled calendar matrix\nDocumentation=https://configdev.com\n\n[Timer]\nOnCalendar=${onCalendarStr}\nPersistent=true\nUnit=${finalUnitName}.service\n\n[Install]\nWantedBy=timers.target`;
    const service = `[Unit]\nDescription=${finalUnitName} execution engine daemon process\nAfter=network.target\n\n[Service]\nType=oneshot\nExecStart=${finalCommand || '/bin/bash'}\nUser=root\nGroup=root\n\n[Install]\nWantedBy=multi-user.target`;

    return { timer, service, rawSegments: cronSegments, extractedCommand: finalCommand, extractedName: finalUnitName };
  };

  useEffect(() => {
    const targetCron = cronInput.trim();
    if (!targetCron) {
      setError(null);
      setTimerOutput('');
      setServiceOutput('');
      setNextRuns([]);
      return;
    }

    const activeUnitName = execCommand ? getCleanJobName(execCommand, 0) : unitName;
    const conversion = convertCronToSystemdText(targetCron, activeUnitName, execCommand);
    
    if (!conversion) {
      setError('Invalid crontab expression: Must contain at least 5 standard tokens (min, hour, day, month, day-of-week).');
      setTimerOutput('');
      setServiceOutput('');
      setNextRuns([]);
      return;
    }

    setError(null);
    setTimerOutput(conversion.timer);
    setServiceOutput(conversion.service);

    if (conversion.extractedCommand && conversion.extractedCommand !== execCommand) {
      setExecCommand(conversion.extractedCommand);
    }

    if (conversion.extractedName && conversion.extractedName !== 'job-1' && conversion.extractedName !== unitName) {
      setUnitName(conversion.extractedName);
    }

    try {
      const [min, hour, day, month, dow] = conversion.rawSegments;
      const runs = calculateNextRuns(min, hour, day, month, dow);
      setNextRuns(runs);
    } catch (e) {
      setNextRuns([]);
    }
  }, [cronInput, unitName, execCommand]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n');
    
    const targets: Array<{ filename: string; content: string }> = [];

    lines.forEach((line, index) => {
      const sanitized = line.trim();
      if (!sanitized || sanitized.startsWith('#') || sanitized.includes('=')) return;

      const bits = sanitized.split(/\s+/);
      if (bits.length >= 5) {
        const cronExpr = bits.slice(0, 5).join(' ');
        const trailingCmd = bits.slice(5).join(' ');

        const dynamicJobId = getCleanJobName(trailingCmd, index);
        const conversion = convertCronToSystemdText(cronExpr, dynamicJobId, trailingCmd);
        
        if (conversion) {
          const actualName = conversion.extractedName;
          targets.push({ filename: `${actualName}.timer`, content: conversion.timer });
          targets.push({ filename: `${actualName}.service`, content: conversion.service });
        }
      }
    });

    if (targets.length === 0) {
      setError('No valid, un-commented standard 5-field cron rows detected inside your file.');
      return;
    }

    setIsZipping(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();

      targets.forEach(item => {
        zip.file(item.filename, item.content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(blob);
      const tempLink = document.createElement('a');
      tempLink.href = downloadUrl;
      tempLink.download = 'systemd-migration-bundle.zip';
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError('An issue occurred during localized bundle packaging generation.');
    } finally {
      setIsZipping(false);
      e.target.value = ''; 
    }
  };

  const handleLoadSample = () => {
    setCronInput('0 2 * * 1-5');
    setUnitName('backup-scheduler');
  };

  const handleCopyText = async (text: string, setCopyFlag: (f: boolean) => void) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFlag(true);
      setTimeout(() => setCopyFlag(false), 2000);
    } catch (err) { /* Fallback capture placeholder */ }
  };

  return (
    <div className="space-y-4 w-full text-neutral-800">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
        <div className="flex flex-col gap-1">
          <label htmlFor={unitNameId} className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
            Unit Name Base
          </label>
          <input
            id={unitNameId}
            type="text"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value.replace(/\s+/g, '-'))}
            placeholder="app-task"
            className="bg-white border border-neutral-300 rounded-md px-3 py-1.5 text-sm font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={execCommandId} className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">
            ExecStart Command Context
          </label>
          <input
            id={execCommandId}
            type="text"
            value={execCommand}
            onChange={(e) => setExecCommand(e.target.value)}
            placeholder="/usr/bin/node index.js"
            className="bg-white border border-neutral-300 rounded-md px-3 py-1.5 text-sm font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        
        <div className="flex flex-col gap-1 justify-end">
          <label htmlFor={fileUploadId} className="text-xs font-semibold text-amber-700 uppercase tracking-wider block mb-1">
            Drop Legacy Crontab File
          </label>
          <div className="relative">
            <input
              id={fileUploadId}
              type="file"
              accept=".txt,crontab,*"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="bg-amber-50/60 border border-dashed border-amber-300 text-amber-800 rounded-md px-3 py-1.5 text-xs text-center font-medium hover:bg-amber-100/80 transition-colors">
              {isZipping ? 'Compiling ZIP Packages...' : 'Upload Crontab -> Download Structural ZIP'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden bg-white">
          <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200 min-w-0">
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider font-mono">
              Cron Syntax Input String
            </span>
            <div className="flex items-center gap-3 min-w-0 ml-4">
              {error && (
                <p id={errorId} role="alert" aria-live="polite" className="text-xs font-medium text-rose-600 truncate max-w-[180px] sm:max-w-xs">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-2 py-1 bg-white border border-neutral-200 rounded-md shadow-sm shrink-0 cursor-pointer"
              >
                Ingest Sample Cron
              </button>
            </div>
          </div>
          
          <div className="p-4 space-y-4 flex-grow flex flex-col justify-between">
            <input
              id={cronInputId}
              type="text"
              value={cronInput}
              onChange={(e) => setCronInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder="e.g. 5 0 7 8 * /usr/bin/yearly-audit"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={`w-full px-4 py-3 border border-neutral-200 rounded-md font-mono text-base tracking-widest text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                error ? 'border-rose-500/50 focus:ring-rose-500' : ''
              }`}
            />

            <div className="bg-neutral-950 text-neutral-200 rounded-lg p-3 font-mono text-xs space-y-2 mt-2 border border-neutral-800">
              <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider flex justify-between">
                <span>Execution Timeline Dry-Run Tracker</span>
                <span className="text-emerald-500 text-[9px] animate-pulse">Native Client Simulation</span>
              </div>
              {nextRuns.length > 0 ? (
                <ol className="space-y-1 list-decimal list-inside text-neutral-300">
                  {nextRuns.map((time, idx) => (
                    <li key={idx} className="hover:text-amber-400 transition-colors">
                      <span className="text-neutral-500 ml-1">{time}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-neutral-600 text-[11px] italic">
                  {cronInput ? 'Evaluating runtime cron sequence boundaries...' : 'Provide a valid interval expression to simulate operational execution firing frames.'}
                </p>
              )}
            </div>

            <div className="text-xs text-neutral-400 font-mono space-y-1 bg-neutral-50 p-3 rounded-md border border-neutral-150 mt-2">
              <span className="block font-bold text-neutral-500 uppercase tracking-wide text-[10px] mb-1">Syntax Reference Sequence Matrix</span>
              <p>Min (0-59) · Hour (0-23) · Day of Month (1-31) · Month (1-12) · Day of Week (0-6)</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200">
              <span className="text-xs font-bold font-mono text-neutral-500 uppercase tracking-tight">
                {unitName || 'app-task'}.timer
              </span>
              <button
                type="button"
                disabled={!timerOutput}
                onClick={() => handleCopyText(timerOutput, setCopiedTimer)}
                className="text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded px-2.5 py-1 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {copiedTimer ? 'Copied!' : 'Copy Timer Configuration'}
              </button>
            </div>
            <div className="bg-neutral-900 px-4 py-3 h-[150px] overflow-auto shadow-inner">
              <pre className="font-mono text-xs text-neutral-100 leading-relaxed whitespace-pre-wrap break-all">
                {timerOutput || '# Processed systemd timer metadata will render here...'}
              </pre>
            </div>
          </div>

          <div className="flex flex-col border border-neutral-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200">
              <span className="text-xs font-bold font-mono text-neutral-500 uppercase tracking-tight">
                {unitName || 'app-task'}.service
              </span>
              <button
                type="button"
                disabled={!serviceOutput}
                onClick={() => handleCopyText(serviceOutput, setCopiedService)}
                className="text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 rounded px-2.5 py-1 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {copiedService ? 'Copied!' : 'Copy Service Configuration'}
              </button>
            </div>
            <div className="bg-neutral-900 px-4 py-3 h-[150px] overflow-auto shadow-inner">
              <pre className="font-mono text-xs text-neutral-100 leading-relaxed whitespace-pre-wrap break-all">
                {serviceOutput || '# Execution engine runtime configuration profiles will map here...'}
              </pre>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}