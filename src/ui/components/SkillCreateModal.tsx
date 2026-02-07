import { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { useApi } from '../hooks/useApi';
import { Modal } from './Modal';
import { button, input, text } from '../theme';

interface SkillCreateModalProps {
  onCreated: () => void;
  onClose: () => void;
}

export function SkillCreateModal({ onCreated, onClose }: SkillCreateModalProps) {
  const api = useApi();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allowedTools, setAllowedTools] = useState('');
  const [context, setContext] = useState('');
  const [location, setLocation] = useState<'global' | 'project'>('global');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError(null);

    const result = await api.createClaudeSkill({
      name: name.trim(),
      description: description.trim() || undefined,
      allowedTools: allowedTools.trim() || undefined,
      context: context.trim() || undefined,
      location,
      instructions: instructions.trim() || undefined,
    });

    setCreating(false);

    if (result.success) {
      onCreated();
      onClose();
    } else {
      setError(result.error ?? 'Failed to create skill');
    }
  };

  const inputClass = `w-full px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-md ${input.text} placeholder-[#4b5563] text-xs focus:outline-none focus:bg-white/[0.06] focus:border-white/[0.15] transition-all duration-150`;

  return (
    <Modal
      title="Create Skill"
      icon={<Sparkles className="w-4 h-4 text-[#D4A574]" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      width="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className={`px-3 py-1.5 text-xs rounded-lg ${text.muted} hover:${text.secondary} transition-colors`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || creating}
            className={`px-4 py-1.5 text-xs font-medium ${button.primary} rounded-lg disabled:opacity-50 transition-colors duration-150`}
          >
            {creating ? 'Creating...' : 'Create Skill'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. code-reviewer"
            className={inputClass}
            autoFocus
          />
        </div>

        <div>
          <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this skill do?"
            className={inputClass}
          />
        </div>

        <div>
          <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Allowed Tools</label>
          <input
            type="text"
            value={allowedTools}
            onChange={(e) => setAllowedTools(e.target.value)}
            placeholder="e.g. Read, Grep, Glob"
            className={inputClass}
          />
          <p className={`text-[10px] ${text.dimmed} mt-0.5`}>Comma-separated tool names</p>
        </div>

        <div>
          <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Context</label>
          <input
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. fork"
            className={inputClass}
          />
        </div>

        <div>
          <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Location</label>
          <div className="flex gap-2">
            {(['global', 'project'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocation(loc)}
                className={`flex-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                  location === loc
                    ? 'bg-[#D4A574]/[0.06] border-[#D4A574]/30 text-[#D4A574]'
                    : 'bg-transparent border-white/[0.06] hover:border-white/[0.10] hover:bg-white/[0.02] ' + text.secondary
                }`}
              >
                {loc === 'global' ? 'Global (~/.claude)' : 'Project (.claude)'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Markdown instructions for the skill..."
            rows={5}
            className={`${inputClass} resize-none`}
          />
        </div>

        {error && (
          <p className={`${text.error} text-[11px]`}>{error}</p>
        )}
      </div>
    </Modal>
  );
}
