import { useState } from 'react';

import { discoverPorts } from '../hooks/useWorktrees';
import type { PortsInfo } from '../hooks/useWorktrees';

interface HeaderProps {
  runningCount: number;
  isConnected: boolean;
  portsInfo: PortsInfo;
  onPortsDiscovered: () => void;
}

export function Header({
  runningCount,
  isConnected,
  portsInfo,
  onPortsDiscovered,
}: HeaderProps) {
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  const handleDiscover = async () => {
    setIsDiscovering(true);
    setDiscoverError(null);
    const result = await discoverPorts();
    setIsDiscovering(false);
    if (result.success) {
      onPortsDiscovered();
    } else {
      setDiscoverError(result.error || 'Discovery failed');
    }
  };

  const hasPorts = portsInfo.discovered.length > 0;

  return (
    <header className="mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Worktree Manager</h1>
          {runningCount > 0 && (
            <span className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-full">
              {runningCount} running
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
          <span className="text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      <p className="mt-2 text-gray-400 text-sm">
        Manage git worktrees and their dev servers
      </p>

      <div className="mt-4 flex items-center gap-3">
        {hasPorts ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Ports:</span>
            <span className="text-gray-300 font-mono text-xs">
              {portsInfo.discovered.join(', ')}
            </span>
            <button
              type="button"
              onClick={handleDiscover}
              disabled={isDiscovering}
              className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
              title="Re-discover ports"
            >
              {isDiscovering ? 'Scanning...' : 'Rescan'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleDiscover}
            disabled={isDiscovering}
            className="px-3 py-1.5 text-xs font-medium text-yellow-400 bg-yellow-900/30 rounded hover:bg-yellow-900/50 disabled:opacity-50 transition-colors"
          >
            {isDiscovering
              ? 'Discovering ports (this may take ~20s)...'
              : 'Discover Ports'}
          </button>
        )}
      </div>

      {discoverError && (
        <div className="mt-2 text-red-400 text-xs">{discoverError}</div>
      )}
    </header>
  );
}
