import type { WorktreeInfo } from '../hooks/useWorktrees';
import { badge, border, status, surface, text } from '../theme';

interface WorktreeItemProps {
  worktree: WorktreeInfo;
  isSelected: boolean;
  onSelect: () => void;
}

export function WorktreeItem({ worktree, isSelected, onSelect }: WorktreeItemProps) {
  const isRunning = worktree.status === 'running';
  const isCreating = worktree.status === 'creating';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-3 py-2.5 flex items-center gap-2.5 text-left transition-colors duration-150 border-l-2 ${
        isSelected
          ? `${surface.panelSelected} ${border.accent}`
          : `border-transparent hover:${surface.panelHover}`
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isCreating
            ? `${status.creating.dot} animate-pulse`
            : isRunning
              ? `${status.running.dot} ${status.running.glow}`
              : status.stopped.dot
        }`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${text.primary} truncate`}>
            {worktree.id}
          </span>
          {worktree.hasUncommitted && (
            <span className={`w-1.5 h-1.5 rounded-full ${status.uncommitted.dot} flex-shrink-0`} title="Uncommitted changes" />
          )}
        </div>
        <div className={`text-[10px] ${text.muted} truncate`}>
          {isCreating
            ? (worktree.statusMessage || 'Creating...')
            : worktree.branch}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {worktree.jiraUrl && (
          <span className={badge.jira} title="Jira linked">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
            </svg>
          </span>
        )}
        {worktree.githubPrUrl && (
          <span className={`${
            worktree.githubPrState === 'merged' ? 'text-purple-400' :
            worktree.githubPrState === 'open' ? 'text-green-400' :
            text.secondary
          }`} title={`PR: ${worktree.githubPrState}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
            </svg>
          </span>
        )}
        {worktree.hasUnpushed && (
          <span className={`text-[9px] font-medium ${badge.unpushed}`} title={`${worktree.commitsAhead || ''} unpushed`}>
            {worktree.commitsAhead ? `↑${worktree.commitsAhead}` : '↑'}
          </span>
        )}
      </div>
    </button>
  );
}
