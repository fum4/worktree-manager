import { useState } from 'react';
import { FolderOpen, FolderSearch, HardDrive, ScanSearch, Settings2 } from 'lucide-react';

import { useServer } from '../contexts/ServerContext';
import { useApi } from '../hooks/useApi';
import type { McpScanResult } from '../types';
import { Modal } from './Modal';
import { button, input, text } from '../theme';
import { Spinner } from './Spinner';

const isWok3Server = (r: McpScanResult) =>
  r.key === 'wok3' || (r.command === 'npx' && r.args.includes('wok3'));

type ScanMode = 'project' | 'folder' | 'device';

interface McpServerScanModalProps {
  onImported: () => void;
  onClose: () => void;
}

const MODES: { id: ScanMode; label: string; description: string; icon: typeof ScanSearch }[] = [
  { id: 'project', label: 'Current Project', description: 'Scan this project for MCP config files', icon: Settings2 },
  { id: 'folder', label: 'Specific Folder', description: 'Recursively search a specific directory', icon: FolderSearch },
  { id: 'device', label: 'Entire Device', description: 'Search common locations across home directory', icon: HardDrive },
];

export function McpServerScanModal({ onImported, onClose }: McpServerScanModalProps) {
  const api = useApi();
  const { isElectron, selectFolder } = useServer();
  const [mode, setMode] = useState<ScanMode>('project');
  const [scanPath, setScanPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<McpScanResult[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    if (mode === 'folder' && !scanPath.trim()) return;

    setScanning(true);
    setError(null);
    setResults(null);

    const options: { mode: ScanMode; scanPath?: string } = { mode };
    if (mode === 'folder') options.scanPath = scanPath.trim();

    const res = await api.scanMcpServers(options);
    setScanning(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    const filtered = res.discovered.filter((r) => !isWok3Server(r));
    setResults(filtered);
    const preSelected = new Set<string>();
    for (const r of filtered) {
      if (!r.alreadyInRegistry) preSelected.add(r.key);
    }
    setSelected(preSelected);
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleImport = async () => {
    if (!results) return;

    const toImport = results
      .filter((r) => selected.has(r.key))
      .map((r) => ({
        key: r.key,
        name: r.key,
        command: r.command,
        args: r.args,
        env: r.env,
        source: r.foundIn[0]?.configPath,
      }));

    if (toImport.length === 0) return;

    setImporting(true);
    const res = await api.importMcpServers(toImport);
    setImporting(false);

    if (res.success) {
      onImported();
      onClose();
    } else {
      setError(res.error ?? 'Failed to import');
    }
  };

  const showResults = results !== null;

  return (
    <Modal
      title="Scan & Import"
      icon={<ScanSearch className="w-4 h-4 text-purple-400" />}
      onClose={onClose}
      width="lg"
      footer={
        showResults ? (
          <>
            <button
              type="button"
              onClick={() => setResults(null)}
              className={`px-3 py-1.5 text-xs rounded-lg ${text.muted} hover:${text.secondary} transition-colors`}
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className={`px-4 py-1.5 text-xs font-medium ${button.primary} rounded-lg disabled:opacity-50 transition-colors duration-150`}
            >
              {importing ? 'Importing...' : `Import ${selected.size} Server${selected.size !== 1 ? 's' : ''}`}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-1.5 text-xs rounded-lg ${text.muted} hover:${text.secondary} transition-colors`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning || (mode === 'folder' && !scanPath.trim())}
              className={`px-4 py-1.5 text-xs font-medium ${button.primary} rounded-lg disabled:opacity-50 transition-colors duration-150`}
            >
              {scanning ? 'Scanning...' : 'Scan'}
            </button>
          </>
        )
      }
    >
      {scanning ? (
        <div className="flex items-center justify-center gap-2 py-12">
          <Spinner size="sm" className={text.muted} />
          <span className={`text-xs ${text.muted}`}>
            {mode === 'device' ? 'Scanning home directory...' : mode === 'folder' ? 'Scanning folder...' : 'Scanning project...'}
          </span>
        </div>
      ) : showResults ? (
        /* Results view */
        results.length === 0 ? (
          <p className={`${text.muted} text-xs py-8 text-center`}>No MCP servers found.</p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {results.map((r) => (
              <label
                key={r.key}
                className={`flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  r.alreadyInRegistry ? 'opacity-50' : 'hover:bg-white/[0.04]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.key)}
                  onChange={() => toggleSelect(r.key)}
                  disabled={r.alreadyInRegistry}
                  className="mt-0.5 accent-purple-400"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${text.primary}`}>{r.key}</span>
                    {r.alreadyInRegistry && (
                      <span className={`text-[10px] ${text.dimmed}`}>(already imported)</span>
                    )}
                  </div>
                  <span className={`text-[11px] ${text.muted} font-mono`}>
                    {r.command} {r.args.join(' ')}
                  </span>
                  <div className={`text-[10px] ${text.dimmed} mt-0.5`}>
                    {r.foundIn.map((f) => (
                      <div key={f.configPath} className="truncate">{f.configPath}</div>
                    ))}
                  </div>
                </div>
              </label>
            ))}
            {error && (
              <p className={`${text.error} text-[11px] px-3 pt-2`}>{error}</p>
            )}
          </div>
        )
      ) : (
        /* Mode selection */
        <div className="space-y-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg border transition-colors ${
                  isActive
                    ? 'bg-purple-400/[0.06] border-purple-400/30'
                    : 'bg-transparent border-white/[0.06] hover:border-white/[0.10] hover:bg-white/[0.02]'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-purple-400' : text.muted}`} />
                <div>
                  <div className={`text-xs font-medium ${isActive ? text.primary : text.secondary}`}>
                    {m.label}
                  </div>
                  <div className={`text-[10px] ${text.dimmed}`}>{m.description}</div>
                </div>
              </button>
            );
          })}

          {mode === 'folder' && (
            <div className="pt-1">
              <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Folder Path</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={scanPath}
                  onChange={(e) => setScanPath(e.target.value)}
                  placeholder="/path/to/scan"
                  className={`flex-1 px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md ${input.text} placeholder-[#4b5563] text-xs focus:outline-none focus:bg-white/[0.06] focus:border-white/[0.15] transition-all duration-150`}
                  autoFocus
                />
                {isElectron && (
                  <button
                    type="button"
                    onClick={async () => {
                      const folder = await selectFolder();
                      if (folder) setScanPath(folder);
                    }}
                    className={`px-2 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md ${text.muted} hover:bg-white/[0.08] hover:${text.secondary} transition-colors`}
                    title="Browse..."
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className={`text-[10px] ${text.dimmed} mt-1`}>
                Will recursively search for MCP config files (settings.json, .mcp.json, config.toml, etc.)
              </p>
            </div>
          )}

          {mode === 'device' && (
            <p className={`text-[10px] ${text.dimmed} px-1`}>
              Scans your home directory (up to 5 levels deep) for any files containing MCP server definitions.
              Skips node_modules, .git, and other large directories.
            </p>
          )}

          {error && (
            <p className={`${text.error} text-[11px]`}>{error}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
