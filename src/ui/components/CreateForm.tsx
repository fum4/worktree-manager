import { useEffect, useRef, useState } from 'react';

import { createWorktree } from '../hooks/useWorktrees';

interface CreateFormProps {
  onCreated: () => void;
}

function deriveName(branch: string): string {
  return branch
    .replace(/^(feature|fix|chore)\//, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function CreateForm({ onCreated }: CreateFormProps) {
  const [branch, setBranch] = useState('');
  const [name, setName] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!nameManuallyEdited) {
      setName(deriveName(branch));
    }
  }, [branch, nameManuallyEdited]);

  const handleNameChange = (value: string) => {
    setName(value);
    setNameManuallyEdited(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch.trim() || isCreating) return;

    setIsCreating(true);
    setError(null);

    const result = await createWorktree(
      branch.trim(),
      name.trim() || undefined,
    );

    setIsCreating(false);

    if (result.success) {
      setBranch('');
      setName('');
      setNameManuallyEdited(false);
      onCreated();
    } else {
      setError(result.error || 'Failed to create worktree');
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h2 className="text-sm font-medium text-gray-300 mb-3">
        Create New Worktree
      </h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="worktree-name"
            className="w-40 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            disabled={isCreating}
          />
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="feature/ADH-1234"
            className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
            disabled={isCreating}
          />
          <button
            type="submit"
            disabled={!branch.trim() || isCreating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </div>
  );
}
