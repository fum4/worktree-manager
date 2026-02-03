import { useEffect, useRef, useState } from 'react';

import { createFromJira, createWorktree } from '../hooks/useWorktrees';

interface CreateFormProps {
  onCreated: () => void;
  jiraConfigured: boolean;
  defaultProjectKey: string | null;
}

function deriveName(branch: string): string {
  return branch
    .replace(/^(feature|fix|chore)\//, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function CreateForm({ onCreated, jiraConfigured, defaultProjectKey }: CreateFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'branch' | 'jira'>('branch');

  // Branch form state
  const [branch, setBranch] = useState('');
  const [name, setName] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branchInputRef = useRef<HTMLInputElement>(null);

  // Jira form state
  const [taskId, setTaskId] = useState('');
  const [isJiraLoading, setIsJiraLoading] = useState(false);
  const [jiraError, setJiraError] = useState<string | null>(null);

  useEffect(() => {
    if (!nameManuallyEdited) {
      setName(deriveName(branch));
    }
  }, [branch, nameManuallyEdited]);

  useEffect(() => {
    if (isOpen) {
      branchInputRef.current?.focus();
    }
  }, [isOpen, tab]);

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
      setIsOpen(false);
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

    const result = await createFromJira(taskId.trim());
    setIsJiraLoading(false);

    if (result.success) {
      resetForm();
      setIsOpen(false);
      onCreated();
    } else {
      setJiraError(result.error || 'Failed to create from Jira');
    }
  };

  if (!isOpen) {
    return (
      <div className="p-3 border-b border-gray-800">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 hover:text-white transition-colors flex items-center justify-center gap-1.5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
          </svg>
          New
        </button>
      </div>
    );
  }

  const jiraPlaceholder = defaultProjectKey
    ? `${defaultProjectKey}-1234 or just 1234`
    : 'PROJ-1234';

  return (
    <div className="p-3 border-b border-gray-800">
      {jiraConfigured && (
        <div className="flex mb-2 gap-1">
          <button
            type="button"
            onClick={() => { setTab('branch'); setError(null); setJiraError(null); }}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
              tab === 'branch'
                ? 'text-white bg-gray-700'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Branch
          </button>
          <button
            type="button"
            onClick={() => { setTab('jira'); setError(null); setJiraError(null); }}
            className={`flex-1 px-2 py-1 text-[10px] font-medium rounded transition-colors ${
              tab === 'jira'
                ? 'text-white bg-gray-700'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Jira
          </button>
        </div>
      )}

      {tab === 'branch' ? (
        <form onSubmit={handleBranchSubmit} className="space-y-2">
          <input
            ref={branchInputRef}
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="feature/ADH-1234"
            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-600 text-xs focus:outline-none focus:border-blue-500 focus-visible:ring-1 ring-blue-500/50"
            disabled={isCreating}
          />
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="worktree-name"
            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-600 text-xs focus:outline-none focus:border-blue-500 focus-visible:ring-1 ring-blue-500/50"
            disabled={isCreating}
          />
          {error && <p className="text-red-400 text-[10px]">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { resetForm(); setIsOpen(false); }}
              className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-400 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!branch.trim() || isCreating}
              className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleJiraSubmit} className="space-y-2">
          <input
            type="text"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            placeholder={jiraPlaceholder}
            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-700 rounded text-white placeholder-gray-600 text-xs focus:outline-none focus:border-blue-500 focus-visible:ring-1 ring-blue-500/50"
            disabled={isJiraLoading}
            autoFocus
          />
          {jiraError && <p className="text-red-400 text-[10px]">{jiraError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { resetForm(); setIsOpen(false); }}
              className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-400 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!taskId.trim() || isJiraLoading}
              className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isJiraLoading ? 'Creating...' : 'Fetch & Create'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
