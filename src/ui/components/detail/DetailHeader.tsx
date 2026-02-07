import { useEffect, useRef, useState } from 'react';

import type { WorktreeInfo } from '../../types';
import { badge, border, status, surface, text } from '../../theme';
import { Tooltip } from '../Tooltip';

interface DetailHeaderProps {
  worktree: WorktreeInfo;
  isRunning: boolean;
  isCreating: boolean;
  onRename: (changes: { name?: string; branch?: string }) => Promise<boolean>;
  onSelectJiraIssue?: (key: string) => void;
  onSelectLinearIssue?: (identifier: string) => void;
  onSelectLocalIssue?: (identifier: string) => void;
}

function InlineEdit({
  value,
  className,
  editClassName,
  editable,
  onSave,
}: {
  value: string;
  className: string;
  editClassName: string;
  editable: boolean;
  onSave: (newValue: string) => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      const ok = await onSave(trimmed);
      if (!ok) setDraft(value);
    } else {
      setDraft(value);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') inputRef.current?.blur();
          if (e.key === 'Escape') { setDraft(value); setIsEditing(false); }
        }}
        className={editClassName}
      />
    );
  }

  return (
    <span
      className={`${className} ${editable ? `cursor-text hover:${surface.editableHover} px-1 -mx-1 rounded transition-colors duration-150` : ''}`}
      onClick={editable ? () => setIsEditing(true) : undefined}
      title={editable ? 'Click to edit' : undefined}
    >
      {value}
    </span>
  );
}

export function DetailHeader({
  worktree,
  isRunning,
  isCreating,
  onRename,
  onSelectJiraIssue,
  onSelectLinearIssue,
  onSelectLocalIssue,
}: DetailHeaderProps) {
  const editable = !isRunning && !isCreating;

  return (
    <div className={`flex-shrink-0 px-5 py-4 border-b ${border.section}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <InlineEdit
            value={worktree.id}
            className={`text-[16px] font-semibold ${text.primary} truncate`}
            editClassName={`text-[16px] font-semibold ${text.primary} bg-transparent border-b border-white/[0.15] focus:border-white/[0.30] outline-none w-44 pb-0.5 transition-colors duration-150`}
            editable={editable}
            onSave={(v) => onRename({ name: v })}
          />
          <InlineEdit
            value={worktree.branch}
            className={`text-xs ${text.muted} truncate`}
            editClassName={`text-xs ${text.muted} bg-transparent border-b border-white/[0.10] focus:border-white/[0.25] outline-none w-72 pb-0.5 transition-colors duration-150`}
            editable={editable}
            onSave={(v) => onRename({ branch: v })}
          />
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {isCreating && (
            <span className={`px-2 py-0.5 text-[11px] font-medium ${status.creating.badge} rounded-full`}>
              Creating
            </span>
          )}
          {isRunning && (
            <span className={`px-2 py-0.5 text-[11px] font-medium ${status.running.badge} rounded-full`}>
              Running
            </span>
          )}
          {!isRunning && !isCreating && (
            <span className={`px-2 py-0.5 text-[11px] font-medium ${status.stopped.badge} rounded-full`}>
              Stopped
            </span>
          )}
          {worktree.ports.length > 0 && (
            <span className={`text-[11px] font-mono ${text.muted}`}>
              {worktree.ports.map((p) => `:${p}`).join(' ')}
            </span>
          )}
        </div>
      </div>

      {/* Integration links — flat, no nested badges */}
      {(worktree.jiraUrl || worktree.linearUrl || worktree.localIssueId || worktree.githubPrUrl) && (
        <div className="flex items-center gap-3 mt-2.5">
          {worktree.jiraUrl && (() => {
            const jiraKey = worktree.jiraUrl!.match(/\/browse\/([A-Z]+-\d+)/)?.[1];
            return (
              <Tooltip position="right" text="View issue">
                <button
                  type="button"
                  onClick={() => jiraKey && onSelectJiraIssue?.(jiraKey)}
                  className={`flex items-center gap-1.5 text-[11px] ${badge.jira} ${badge.jiraHover} transition-colors duration-150`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                    <path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
                  </svg>
                  Jira{worktree.jiraStatus ? ` \u00b7 ${worktree.jiraStatus}` : ''}
                </button>
              </Tooltip>
            );
          })()}
          {worktree.linearUrl && (() => {
            const linearId = worktree.linearUrl!.match(/\/issue\/([A-Z]+-\d+)/)?.[1];
            return (
              <Tooltip position="right" text="View issue">
                <button
                  type="button"
                  onClick={() => linearId && onSelectLinearIssue?.(linearId)}
                  className={`flex items-center gap-1.5 text-[11px] ${badge.linear} ${badge.linearHover} transition-colors duration-150`}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  Linear{worktree.linearStatus ? ` \u00b7 ${worktree.linearStatus}` : ''}
                </button>
              </Tooltip>
            );
          })()}
          {worktree.localIssueId && (
            <Tooltip position="right" text="View issue">
              <button
                type="button"
                onClick={() => onSelectLocalIssue?.(worktree.localIssueId!)}
                className={`flex items-center gap-1.5 text-[11px] ${badge.localIssue} ${badge.localIssueHover} transition-colors duration-150`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                Local{worktree.localIssueStatus ? ` \u00b7 ${worktree.localIssueStatus}` : ''}
              </button>
            </Tooltip>
          )}
          {worktree.githubPrUrl && (
            <Tooltip position="right" text="Open pull request">
              <a
                href={worktree.githubPrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 text-[11px] transition-colors duration-150 ${
                  worktree.githubPrState === 'merged' ? 'text-purple-400 hover:text-purple-300'
                    : worktree.githubPrState === 'open' ? 'text-emerald-400 hover:text-emerald-300'
                      : 'text-[#9ca3af] hover:text-white'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
                </svg>
                PR{worktree.githubPrState ? ` \u00b7 ${worktree.githubPrState === 'draft' ? 'Draft' : worktree.githubPrState === 'open' ? 'Open' : worktree.githubPrState === 'merged' ? 'Merged' : 'Closed'}` : ''}
              </a>
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
