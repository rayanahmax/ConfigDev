import { useState, useEffect, useId } from 'react';

interface SubnetResults {
  networkAddress: string;
  broadcastAddress: string;
  netmask: string;
  wildcardMask: string;
  firstUsable: string;
  lastUsable: string;
  totalHosts: number;
  usableHosts: number;
  cidrNotation: string;
  binaryMask: string;
}

interface CloudTemplate {
  name: string;
  ip: string;
  cidr: number;
  description: string;
}

export default function CIDRCalculator() {
  const [ipInput, setIpInput] = useState('10.0.0.0');
  const [cidrInput, setCidrInput] = useState(16);
  const [results, setResults] = useState<SubnetResults | null>(null);
  const [error, setError] = useState('');
  
  const ipId = useId();
  const cidrId = useId();
  const templateId = useId();

  // Cloud multi-AZ architectural profile layout templates
  const cloudTemplates: Record<string, CloudTemplate> = {
    awsVpc: {
      name: 'AWS Standard Multi-AZ VPC Layout',
      ip: '10.0.0.0',
      cidr: 16,
      description: 'Ideal starting space. Allocates 65,536 addresses across a clean internal topology standard.',
    },
    gcpVpc: {
      name: 'GCP Default Custom Subnet Space',
      ip: '10.128.0.0',
      cidr: 20,
      description: 'Optimized regional workspace partition mapping providing 4,096 usable internal nodes.',
    },
    azureVnet: {
      name: 'Azure Enterprise Infrastructure Blueprint',
      ip: '172.16.0.0',
      cidr: 12,
      description: 'High-density production enterprise network containing over 1 million private tracking IDs.',
    },
    smallBranch: {
      name: 'Micro-Service/Branch Office Link',
      ip: '192.168.1.0',
      cidr: 24,
      description: 'Standard local development node layout supporting 254 active computing interfaces.',
    }
  };

  const ipToLong = (ip: string): number => {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  };

  const longToIp = (long: number): string => {
    return [
      (long >>> 24) & 255,
      (long >>> 16) & 255,
      (long >>> 8) & 255,
      long & 255
    ].join('.');
  };

  const getBinaryString = (long: number): string => {
    const str = (long >>> 0).toString(2).padStart(32, '0');
    return str.match(/.{1,8}/g)?.join('.') || str;
  };

  const handleTemplateChange = (key: string) => {
    if (!key) return;
    const selected = cloudTemplates[key];
    if (selected) {
      setIpInput(selected.ip);
      setCidrInput(selected.cidr);
    }
  };

  useEffect(() => {
    setError('');
    
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipv4Regex.test(ipInput.trim())) {
      setError('Please enter a valid IPv4 address (e.g., 192.168.1.1).');
      setResults(null);
      return;
    }

    const cidr = Number(cidrInput);
    if (isNaN(cidr) || cidr < 0 || cidr > 32) {
      setError('CIDR suffix must be an integer between 0 and 32.');
      setResults(null);
      return;
    }

    try {
      const ipLong = ipToLong(ipInput.trim());
      const maskLong = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
      const wildcardLong = ~maskLong >>> 0;
      
      const networkLong = (ipLong & maskLong) >>> 0;
      const broadcastLong = (networkLong | wildcardLong) >>> 0;

      let firstUsableLong = networkLong + 1;
      let lastUsableLong = broadcastLong - 1;
      let totalHosts = Math.pow(2, 32 - cidr);
      let usableHosts = cidr >= 31 ? 0 : totalHosts - 2;

      if (cidr === 32) {
        firstUsableLong = networkLong;
        lastUsableLong = networkLong;
        usableHosts = 1;
      } else if (cidr === 31) {
        firstUsableLong = networkLong;
        lastUsableLong = broadcastLong;
        usableHosts = 2;
      }

      setResults({
        networkAddress: longToIp(networkLong),
        broadcastAddress: longToIp(broadcastLong),
        netmask: longToIp(maskLong),
        wildcardMask: longToIp(wildcardLong),
        firstUsable: longToIp(firstUsableLong),
        lastUsable: longToIp(lastUsableLong),
        totalHosts,
        usableHosts,
        cidrNotation: `${longToIp(networkLong)}/${cidr}`,
        binaryMask: getBinaryString(maskLong),
      });
    } catch (err) {
      setError('An error occurred during calculations.');
      setResults(null);
    }
  }, [ipInput, cidrInput]);

  // Generate dynamic structural visual tree chunks based on mathematical prefix depth
  const renderVisualBlocks = () => {
    const currentCidr = Number(cidrInput);
    if (currentCidr > 30) {
      return (
        <div className="text-center p-6 text-xs font-mono text-neutral-400 bg-neutral-50 rounded-lg border border-neutral-200 border-dashed">
          Subnet topology slice too narrow for progressive visual block breakdown. (/{currentCidr} provides negligible network depth).
        </div>
      );
    }

    // Determine safe layout block slicing constraints (Render up to 4 virtual layout blocks max)
    const renderCount = currentCidr >= 24 ? 4 : 2;
    const baseNetworkLong = ipToLong(results?.networkAddress || ipInput);
    const stepSize = Math.pow(2, 32 - (currentCidr + (renderCount === 4 ? 2 : 1)));

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider font-mono">
            Interactive IP Tree Map Splitter
          </span>
          <span className="text-[10px] bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded font-mono font-bold">
            Showing equal /{currentCidr + (renderCount === 4 ? 2 : 1)} slices
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: renderCount }).map((_, idx) => {
            const splitBlockLong = baseNetworkLong + (idx * stepSize);
            const splitNetworkAddress = longToIp(splitBlockLong);
            const targetSplitCidr = currentCidr + (renderCount === 4 ? 2 : 1);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setIpInput(splitNetworkAddress);
                  setCidrInput(targetSplitCidr);
                }}
                className="group flex flex-col justify-between text-left p-4 bg-white border border-neutral-200 hover:border-amber-500 rounded-xl transition-all shadow-sm cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500/20 active:scale-[0.99]"
              >
                <div>
                  <span className="text-[10px] font-bold text-amber-600 font-mono group-hover:text-amber-700 transition-colors block mb-1">
                    SUBNET CHUNK 0{idx + 1}
                  </span>
                  <span className="text-sm font-bold text-neutral-900 font-mono block break-all">
                    {splitNetworkAddress}/{targetSplitCidr}
                  </span>
                </div>
                <div className="mt-4 pt-2 border-t border-neutral-100 w-full flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                  <span>{stepSize.toLocaleString()} hosts</span>
                  <span className="text-neutral-300 group-hover:text-amber-500 transition-colors font-bold">&rarr; Drill Down</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6 text-neutral-800">
      {/* Cloud Presets Dropdown Block */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="max-w-xl">
          <label htmlFor={templateId} className="text-xs font-bold text-neutral-700 uppercase tracking-wider block mb-1 font-mono">
            Optimized Cloud Infrastructure Blueprint Layouts
          </label>
          <p className="text-xs text-neutral-500">
            Instantly ingest standardized industrial address space assignments from cloud reference blueprints.
          </p>
        </div>
        <select
          id={templateId}
          defaultValue=""
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="bg-white border border-neutral-300 rounded-lg px-3 py-2 text-sm font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer h-fit sm:w-72"
        >
          <option value="" disabled>-- Inject Cloud Reference Preset --</option>
          {Object.entries(cloudTemplates).map(([key, item]) => (
            <option key={key} value={key}>{item.name}</option>
          ))}
        </select>
      </div>

      {/* Parameter Entry Interface Slider Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-white border border-neutral-200 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col gap-1.5 lg:col-span-1">
          <label htmlFor={ipId} className="text-xs font-bold text-neutral-700 uppercase tracking-wider font-mono">
            IPv4 Base IP Range
          </label>
          <input
            id={ipId}
            type="text"
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            placeholder="e.g., 10.0.0.0"
            className="w-full px-3 py-2 text-sm font-mono text-neutral-800 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400 focus:ring-0"
          />
        </div>
        
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <div className="flex justify-between items-center">
            <label htmlFor={cidrId} className="text-xs font-bold text-neutral-700 uppercase tracking-wider font-mono">
              CIDR Mask Suffix Allocation (/{cidrInput})
            </label>
            <span className="text-xs font-mono font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
              {results ? `Netmask: ${results.netmask}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <input
              id={cidrId}
              type="range"
              min="0"
              max="32"
              value={cidrInput}
              onChange={(e) => setCidrInput(parseInt(e.target.value, 10))}
              className="flex-grow h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-neutral-900"
            />
            <input
              type="number"
              min="0"
              max="32"
              aria-label="CIDR numeric input suffix values"
              value={cidrInput}
              onChange={(e) => setCidrInput(Math.min(32, Math.max(0, parseInt(e.target.value, 10) || 0)))}
              className="w-16 text-center px-2 py-1 text-sm font-mono text-neutral-800 bg-white border border-neutral-200 rounded-lg focus:outline-none focus:border-neutral-400"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg font-mono shadow-inner" role="alert">
          {error}
        </div>
      )}

      {/* Reactive Calculation Matrix Display */}
      {results && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Primary Metrics Core */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'Network Address', val: results.networkAddress, desc: 'First boundary index tracking segment baseline identity' },
                { label: 'Subnet Mask', val: results.netmask, desc: 'Variable-length routing mask structure representation' },
                { label: 'Usable Host Range', val: `${results.firstUsable} - ${results.lastUsable}`, desc: 'Allocatable computer system physical endpoint boundaries' },
                { label: 'Broadcast Address', val: results.broadcastAddress, desc: 'Target link targeting all devices on this segment' },
                { label: 'Wildcard Mask', val: results.wildcardMask, desc: 'Inverted layout mask mapping engineering security ACL rules' },
                { label: 'Total Usable Hosts', val: results.usableHosts.toLocaleString(), desc: 'Available runtime host tracking assignment slots' }
              ].map((item, idx) => (
                <div key={idx} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm flex flex-col justify-between hover:border-neutral-300 transition-colors">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-0.5 font-mono">{item.label}</span>
                    <span className="text-base font-bold text-neutral-900 font-mono block break-all">{item.val}</span>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono mt-2 block border-t border-neutral-100 pt-1.5 leading-tight">{item.desc}</span>
                </div>
              ))}
            </div>

            {/* Quick-Copy Outputs */}
            <div className="flex flex-col gap-4 border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm min-h-[295px]">
              <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider font-mono">
                  Routing Notation Outgest
                </span>
              </div>
              <div className="p-4 flex-grow bg-neutral-900 flex flex-col justify-between font-mono text-xs text-neutral-100">
                <div>
                  <div className="text-[10px] uppercase font-bold text-neutral-400 mb-1.5 tracking-wider">Standard CIDR Target Block</div>
                  <pre className="bg-neutral-800 p-2.5 rounded text-emerald-400 font-bold text-sm mb-4 select-all border border-neutral-700/50">{results.cidrNotation}</pre>

                  <div className="text-[10px] uppercase font-bold text-neutral-400 mb-1.5 tracking-wider">Binary Mapping Mask Blueprint</div>
                  <pre className="bg-neutral-800 p-2.5 rounded text-neutral-300 text-[11px] whitespace-pre-wrap break-all tracking-tight leading-relaxed border border-neutral-700/50">{results.binaryMask}</pre>
                </div>
                <div className="text-[10px] text-neutral-400 italic mt-4 border-t border-neutral-800 pt-2.5 leading-normal">
                  Inject these address expressions into cloud infrastructure templates, hardware routing engines, or VPC partition layout sheets.
                </div>
              </div>
            </div>
          </div>

          {/* Render the Interactive Tree Splitter Grid Workspace Component */}
          {renderVisualBlocks()}
        </div>
      )}
    </div>
  );
}