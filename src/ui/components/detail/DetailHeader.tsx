import type { WorktreeInfo } from '../../types';
import { action, badge, border, input, status, surface, text } from '../../theme';

interface DetailHeaderProps {
  worktree: WorktreeInfo;
  isEditing: boolean;
  editName: string;
  editBranch: string;
  isLoading: boolean;
  isRunning: boolean;
  isCreating: boolean;
  onEditNameChange: (value: string) => void;
  onEditBranchChange: (value: string) => void;
  onEditStart: () => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

export function DetailHeader({
  worktree,
  isEditing,
  editName,
  editBranch,
  isLoading,
  isRunning,
  isCreating,
  onEditNameChange,
  onEditBranchChange,
  onEditStart,
  onEditSave,
  onEditCancel,
}: DetailHeaderProps) {
  return (
    <div className={`flex-shrink-0 px-5 py-3 border-b ${border.section}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {isEditing ? (
            <>
              <input
                type="text"
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel(); }}
                className={`px-1 py-0.5 ${input.bgDetail} border ${border.modal} rounded ${text.primary} text-base font-semibold focus:outline-none focus:${border.focusPrimary} w-40`}
                autoFocus
              />
              <input
                type="text"
                value={editBranch}
                onChange={(e) => onEditBranchChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel(); }}
                className={`px-1 py-0.5 ${input.bgDetail} border ${border.modal} rounded ${text.secondary} text-xs focus:outline-none focus:${border.focusPrimary} w-48`}
              />
              <button type="button" onClick={onEditSave} disabled={isLoading} className="px-2 py-0.5 text-[10px] font-medium text-blue-400 bg-blue-900/30 rounded hover:bg-blue-900/50 disabled:opacity-50 transition-colors">
                {isLoading ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={onEditCancel} className={`px-2 py-0.5 text-[10px] font-medium ${action.cancel.text} ${action.cancel.textHover} transition-colors`}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <h2
                className={`text-base font-semibold ${text.primary} truncate ${!isRunning && !isCreating ? `cursor-text hover:${surface.editableHover} px-1 -mx-1 rounded transition-colors` : ''}`}
                onClick={!isRunning && !isCreating ? onEditStart : undefined}
                title={!isRunning && !isCreating ? 'Click to edit' : undefined}
              >
                {worktree.id}
              </h2>
              <span
                className={`text-xs ${text.muted} truncate ${!isRunning && !isCreating ? `cursor-text hover:${text.secondary} transition-colors` : ''}`}
                onClick={!isRunning && !isCreating ? onEditStart : undefined}
                title={!isRunning && !isCreating ? 'Click to edit' : undefined}
              >
                {worktree.branch}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isCreating && (
            <span className={`px-2 py-0.5 text-[10px] font-medium ${status.creating.badge} rounded`}>
              Creating
            </span>
          )}
          {isRunning && (
            <span className={`px-2 py-0.5 text-[10px] font-medium ${status.running.badge} rounded`}>
              Running
            </span>
          )}
          {!isRunning && !isCreating && (
            <span className={`px-2 py-0.5 text-[10px] font-medium ${status.stopped.badge} rounded`}>
              Stopped
            </span>
          )}
          {worktree.ports.length > 0 && (
            <span className={`text-[10px] font-mono ${text.muted}`}>
              {worktree.ports.map((p) => `:${p}`).join(' ')}
            </span>
          )}
        </div>
      </div>

      {/* Integration badges */}
      {(worktree.jiraUrl || worktree.githubPrUrl) && (
        <div className="flex items-center gap-2 mt-2">
          {worktree.jiraUrl && (
            <a
              href={worktree.jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1 text-[10px] ${badge.jira} ${badge.jiraHover} transition-colors`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
              </svg>
              Jira
              {worktree.jiraStatus && (
                <span className={`px-1 py-0.5 ${badge.jiraStatus} rounded text-[9px]`}>
                  {worktree.jiraStatus}
                </span>
              )}
            </a>
          )}
          {worktree.githubPrUrl && (
            <a
              href={worktree.githubPrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
              </svg>
              PR
              {worktree.githubPrState && (
                <span className={`px-1 py-0.5 rounded text-[9px] ${
                  worktree.githubPrState === 'draft' ? badge.prDraft
                    : worktree.githubPrState === 'open' ? badge.prOpen
                      : worktree.githubPrState === 'merged' ? badge.prMerged
                        : badge.prClosed
                }`}>
                  {worktree.githubPrState === 'draft' ? 'Draft' : worktree.githubPrState === 'open' ? 'Open' : worktree.githubPrState === 'merged' ? 'Merged' : 'Closed'}
                </span>
              )}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
