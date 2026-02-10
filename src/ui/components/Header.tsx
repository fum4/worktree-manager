import type { View } from './NavBar';
import { badge, nav, text } from '../theme';

const tabs: { id: View; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'agents', label: 'Agents' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'configuration', label: 'Settings' },
];

interface HeaderProps {
  runningCount: number;
  activeView: View;
  onChangeView: (view: View) => void;
  configNeedsPush?: boolean;
  onCommitConfig?: () => void;
}

export function Header({
  runningCount,
  activeView,
  onChangeView,
  configNeedsPush,
  onCommitConfig,
}: HeaderProps) {
  return (
    <header
      className="h-12 flex-shrink-0 relative bg-[#0c0e12]/60 backdrop-blur-md z-40"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Center: nav tabs - using inset-x-0 + flex for pixel-perfect centering */}
      <div
        className="absolute inset-x-0 bottom-0.5 flex justify-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-0.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onChangeView(t.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors duration-150 ${
                activeView === t.id ? nav.active : nav.inactive
              }`}
            >
              {t.label}
            </button>
          ))}
          {runningCount > 0 && (
            <span className={`ml-2 px-1.5 py-0.5 text-[10px] font-semibold ${badge.running} rounded-full`}>
              {runningCount}
            </span>
          )}
        </div>
      </div>

      {/* Right: config warning indicator */}
      {configNeedsPush && (
        <div
          className="absolute right-4 bottom-0.5 flex items-center"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <div className="group relative">
            <button
              onClick={onCommitConfig}
              className="p-1.5 rounded-md hover:bg-amber-400/10 transition-colors duration-150"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className="absolute inline-flex h-full w-full rounded-full bg-amber-400"
                  style={{ animation: 'pulse-calm 2.5s ease-out infinite' }}
                />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
              </span>
              <style>{`
                @keyframes pulse-calm {
                  0%, 100% { transform: scale(1); opacity: 0.7; }
                  22% { transform: scale(2.8); opacity: 0; }
                  23% { transform: scale(1); opacity: 0; }
                }
              `}</style>
            </button>

            {/* Tooltip - shows on hover using CSS group-hover */}
            <div className="absolute -right-2 top-full pt-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
              <div className="w-72 p-3 rounded-lg bg-[#1a1d24] border border-white/[0.08] shadow-xl">
                <p className={`text-xs ${text.secondary} mb-2`}>
                  Configuration files are not pushed yet.
                  <br />
                  New worktrees won't have them until you push.
                </p>
                <button
                  onClick={onCommitConfig}
                  className="text-[11px] font-medium text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Push configuration →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
