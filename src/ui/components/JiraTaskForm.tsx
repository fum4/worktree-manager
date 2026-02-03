import { useState } from 'react';

import { createFromJira } from '../hooks/useWorktrees';

interface JiraTaskFormProps {
  defaultProjectKey: string | null;
  onCreated: () => void;
}

export function JiraTaskForm({ defaultProjectKey, onCreated }: JiraTaskFormProps) {
  const [taskId, setTaskId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<{
    key: string;
    summary: string;
    status: string;
    type: string;
    url: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setLastCreated(null);

    const result = await createFromJira(taskId.trim());

    setIsLoading(false);

    if (result.success && result.task) {
      setLastCreated(result.task);
      setTaskId('');
      onCreated();
    } else {
      setError(result.error || 'Failed to create worktree from Jira');
    }
  };

  const placeholder = defaultProjectKey
    ? `${defaultProjectKey}-1234 or just 1234`
    : 'PROJ-1234';

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h2 className="text-sm font-medium text-gray-300 mb-3">
        Create from Jira
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!taskId.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isLoading ? 'Creating...' : 'Fetch & Create'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {lastCreated && (
          <div className="text-sm text-gray-400 bg-gray-900 rounded-lg p-3 border border-gray-700">
            <span className="text-white font-medium">{lastCreated.key}</span>
            {' — '}
            {lastCreated.summary}
            <span className="ml-2 text-gray-500">
              ({lastCreated.type} · {lastCreated.status})
            </span>
          </div>
        )}
      </form>
    </div>
  );
}
