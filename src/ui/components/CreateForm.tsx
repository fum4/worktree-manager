import { useEffect, useRef, useState } from 'react';

import { createFromJira, createWorktree } from '../hooks/api';
import { border, button, input, tab, text } from '../theme';

interface CreateFormProps {
  onCreated: () => void;
  jiraConfigured: boolean;
  defaultProjectKey: string | null;
  activeTab: 'branch' | 'jira';
  onTabChange: (tab: 'branch' | 'jira') => void;
}

function deriveName(branch: string): string {
  return branch
    .replace(/^(feature|fix|chore)\//, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function CreateForm({ onCreated, jiraConfigured, defaultProjectKey, activeTab, onTabChange }: CreateFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Branch form state
  const [branch, setBranch] = useState('');
  const [name, setName] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branchInputRef = useRef<HTMLInputElement>(null);

  // Jira form state
  const [taskId, setTaskId] = useState('');
  const [jiraBranch, setJiraBranch] = useState('');
  const [isJiraLoading, setIsJiraLoading] = useState(false);
  const [jiraError, setJiraError] = useState<string | null>(null);

  useEffect(() => {
    if (!nameManuallyEdited) {
      setName(deriveName(branch));
    }
  }, [branch, nameManuallyEdited]);

  const handleNameChange = (value: string) => {
    setName(value);
    setNameManuallyEdited(true);
  };

  const resetForm = () => {
    setBranch('');
    setName('');
    setNameManuallyEdited(false);
    setError(null);
    setTaskId('');
    setJiraBranch('');
    setJiraError(null);
  };

  const handleBranchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);

    const result = await createWorktree(branch.trim(), name.trim() || undefined);
    setIsCreating(false);

    if (result.success) {
      resetForm();
      setIsExpanded(false);
      onCreated();
    } else {
      setError(result.error || 'Failed to create worktree');
    }
  };

  const handleJiraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId.trim() || isJiraLoading) return;

    setIsJiraLoading(true);
    setJiraError(null);

    const result = await createFromJira(taskId.trim(), jiraBranch.trim() || undefined);
    setIsJiraLoading(false);

    if (result.success) {
      resetForm();
      setIsExpanded(false);
      onCreated();
    } else {
      setJiraError(result.error || 'Failed to create from Jira');
    }
  };

  const inputClass = `w-full px-2.5 py-1.5 ${input.bgSidebar} border border-accent/0 rounded-md ${input.text} ${input.placeholderSubtle} text-xs focus:outline-none focus:bg-white/[0.06] focus:border-accent/30 transition-all duration-150`;

  return (
    <div className={`border-b ${border.subtle}`}>
      {/* Sidebar navigation: tabs + create button */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        {jiraConfigured ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => { onTabChange('branch'); setError(null); setJiraError(null); }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 ${
                activeTab === 'branch' ? tab.active : tab.inactive
              }`}
            >
              Worktrees
            </button>
            <button
              type="button"
              onClick={() => { onTabChange('jira'); setError(null); setJiraError(null); }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors duration-150 ${
                activeTab === 'jira' ? tab.active : tab.inactive
              }`}
            >
              Jira
            </button>
          </div>
        ) : (
          <span className={`text-xs font-medium ${text.secondary}`}>Worktrees</span>
        )}

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-accent hover:text-accent-muted transition-colors duration-150"
          title={isExpanded ? 'Collapse' : 'New Worktree'}
        >
          {isExpanded ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M4 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
          )}
        </button>
      </div>

      {/* Collapsible create form */}
      {isExpanded && (
        <div className="px-3 pb-3">
          {activeTab === 'branch' ? (
            <form onSubmit={handleBranchSubmit} className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Worktree name"
                className={inputClass}
                disabled={isCreating}
              />
              <input
                ref={branchInputRef}
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Branch name (defaults to worktree name)"
                className={inputClass}
                disabled={isCreating}
              />
              {error && <p className={`${text.error} text-[11px]`}>{error}</p>}
              <button
                type="submit"
                disabled={!branch.trim() || isCreating}
                className={`w-full px-2.5 py-1.5 text-[11px] font-medium ${button.primary} rounded-lg disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]`}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJiraSubmit} className="space-y-2">
              <input
                type="text"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                placeholder="Task ID"
                className={inputClass}
                disabled={isJiraLoading}
              />
              <input
                type="text"
                value={jiraBranch}
                onChange={(e) => setJiraBranch(e.target.value)}
                placeholder="Branch name (defaults to task ID)"
                className={inputClass}
                disabled={isJiraLoading}
              />
              {jiraError && <p className={`${text.error} text-[11px]`}>{jiraError}</p>}
              <button
                type="submit"
                disabled={!taskId.trim() || isJiraLoading}
                className={`w-full px-2.5 py-1.5 text-[11px] font-medium ${button.primary} rounded-lg disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]`}
              >
                {isJiraLoading ? 'Creating...' : 'Fetch & Create'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
