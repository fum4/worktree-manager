import { useEffect, useRef, useState } from 'react';

import { createFromJira, createWorktree } from '../hooks/api';
import { border, button, input, tab, text } from '../theme';

interface CreateFormProps {
  onCreated: () => void;
  jiraConfigured: boolean;
  defaultProjectKey: string | null;
  onTabChange?: (tab: 'branch' | 'jira') => void;
}

function deriveName(branch: string): string {
  return branch
    .replace(/^(feature|fix|chore)\//, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function CreateForm({ onCreated, jiraConfigured, defaultProjectKey, onTabChange }: CreateFormProps) {
  const [activeTab, setActiveTab] = useState<'branch' | 'jira'>('branch');

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
      onCreated();
    } else {
      setJiraError(result.error || 'Failed to create from Jira');
    }
  };

  const inputClass = `w-full px-2 py-1.5 ${input.bg} border ${border.input} rounded ${input.text} ${input.placeholder} text-xs focus:outline-none focus:${border.focusPrimary} focus-visible:ring-1 ${input.ring}`;

  return (
    <div className={`p-3 border-b ${border.subtle}`}>
      {jiraConfigured && (
        <div className="flex mb-2 gap-1">
          <button
            type="button"
            onClick={() => { setActiveTab('branch'); setError(null); setJiraError(null); onTabChange?.('branch'); }}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
              activeTab === 'branch' ? tab.active : tab.inactive
            }`}
          >
            Worktree
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('jira'); setError(null); setJiraError(null); onTabChange?.('jira'); }}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
              activeTab === 'jira' ? tab.active : tab.inactive
            }`}
          >
            Jira
          </button>
        </div>
      )}

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
          {error && <p className={`${text.error} text-[10px]`}>{error}</p>}
          <button
            type="submit"
            disabled={!branch.trim() || isCreating}
            className={`w-full px-2 py-1.5 text-xs font-medium ${button.primary} rounded disabled:opacity-50 transition-colors`}
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
          {jiraError && <p className={`${text.error} text-[10px]`}>{jiraError}</p>}
          <button
            type="submit"
            disabled={!taskId.trim() || isJiraLoading}
            className={`w-full px-2 py-1.5 text-xs font-medium ${button.primary} rounded disabled:opacity-50 transition-colors`}
          >
            {isJiraLoading ? 'Creating...' : 'Fetch & Create'}
          </button>
        </form>
      )}
    </div>
  );
}
