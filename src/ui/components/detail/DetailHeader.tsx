import { useEffect, useRef, useState } from 'react';

import type { WorktreeInfo } from '../../types';
import { badge, border, status, surface, text } from '../../theme';

interface DetailHeaderProps {
  worktree: WorktreeInfo;
  isRunning: boolean;
  isCreating: boolean;
  onRename: (changes: { name?: string; branch?: string }) => Promise<boolean>;
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
}: DetailHeaderProps) {
  const editable = !isRunning && !isCreating;

  return (
    <div className={`flex-shrink-0 px-5 py-4 border-b ${border.section}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <InlineEdit
            value={worktree.id}
            className={`text-[16px] font-semibold ${text.primary} truncate`}
            editClassName={`text-[16px] font-semibold ${text.primary} bg-transparent border-b border-accent/30 focus:border-accent/60 outline-none w-44 pb-0.5 transition-colors duration-150`}
            editable={editable}
            onSave={(v) => onRename({ name: v })}
          />
          <InlineEdit
            value={worktree.branch}
            className={`text-xs ${text.muted} truncate`}
            editClassName={`text-xs ${text.muted} bg-transparent border-b border-accent/20 focus:border-accent/50 outline-none w-72 pb-0.5 transition-colors duration-150`}
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
      {(worktree.jiraUrl || worktree.githubPrUrl) && (
        <div className="flex items-center gap-3 mt-2.5">
          {worktree.jiraUrl && (
            <a
              href={worktree.jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 text-[11px] ${badge.jira} ${badge.jiraHover} transition-colors duration-150`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
              </svg>
              Jira{worktree.jiraStatus ? ` \u00b7 ${worktree.jiraStatus}` : ''}
            </a>
          )}
          {worktree.githubPrUrl && (
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
          )}
        </div>
      )}
    </div>
  );
}
