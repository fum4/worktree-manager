import { useState } from 'react';

import { discoverPorts } from '../hooks/useWorktrees';
import type { PortsInfo } from '../hooks/useWorktrees';

interface HeaderProps {
  projectName: string | null;
  runningCount: number;
  isConnected: boolean;
  portsInfo: PortsInfo;
  onPortsDiscovered: () => void;
}

export function Header({
  projectName,
  runningCount,
  isConnected,
  portsInfo,
  onPortsDiscovered,
}: HeaderProps) {
  const [isDiscovering, setIsDiscovering] = useState(false);

  const handleDiscover = async () => {
    setIsDiscovering(true);
    const result = await discoverPorts();
    setIsDiscovering(false);
    if (result.success) {
      onPortsDiscovered();
    }
  };

  const hasPorts = portsInfo.discovered.length > 0;

  return (
    <header className="h-10 flex-shrink-0 flex items-center justify-between px-4 border-b border-gray-800 bg-gray-900">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white">{projectName || 'Worktree Manager'}</span>
        <span className="text-xs text-gray-500">wok3</span>
        {hasPorts && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-600 text-[10px] font-mono">
              {portsInfo.discovered.map((p) => `:${p}`).join(' ')}
            </span>
            <button
              type="button"
              onClick={handleDiscover}
              disabled={isDiscovering}
              className="text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
              title="Re-discover ports"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 0 1 .75.75v3.182a.75.75 0 0 1-.75.75h-3.182a.75.75 0 0 1 0-1.5h1.37l-.84-.841a4.5 4.5 0 0 0-7.08.932.75.75 0 0 1-1.3-.75 6 6 0 0 1 9.44-1.242l.842.84V3.227a.75.75 0 0 1 .75-.75Zm-.911 7.5A.75.75 0 0 1 13.199 11a6 6 0 0 1-9.44 1.241l-.84-.84v1.371a.75.75 0 0 1-1.5 0V9.591a.75.75 0 0 1 .75-.75H5.35a.75.75 0 0 1 0 1.5H3.98l.841.841a4.5 4.5 0 0 0 7.08-.932.75.75 0 0 1 1.025-.273Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
        {!hasPorts && (
          <button
            type="button"
            onClick={handleDiscover}
            disabled={isDiscovering}
            className="text-[10px] text-yellow-400 hover:text-yellow-300 transition-colors disabled:opacity-50"
          >
            {isDiscovering ? 'Scanning...' : 'Discover Ports'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {runningCount > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-600 text-white rounded-full">
            {runningCount} running
          </span>
        )}
        <div className="flex items-center gap-1.5 text-xs">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
          <span className="text-gray-500">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </header>
  );
}
