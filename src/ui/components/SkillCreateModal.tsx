import { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { useApi } from '../hooks/useApi';
import { Modal } from './Modal';
import { claudeSkill, input, text } from '../theme';

interface SkillCreateModalProps {
  onCreated: (skillName: string) => void;
  onClose: () => void;
}

export function SkillCreateModal({ onCreated, onClose }: SkillCreateModalProps) {
  const api = useApi();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allowedTools, setAllowedTools] = useState('');
  const [context, setContext] = useState('');
  const [agent, setAgent] = useState('');
  const [model, setModel] = useState('');
  const [argumentHint, setArgumentHint] = useState('');
  const [disableModelInvocation, setDisableModelInvocation] = useState(false);
  const [userInvocable, setUserInvocable] = useState(true);
  const [mode, setMode] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [scope, setScope] = useState<'global' | 'local'>('global');
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
      agent: agent.trim() || undefined,
      model: model.trim() || undefined,
      argumentHint: argumentHint.trim() || undefined,
      disableModelInvocation: disableModelInvocation || undefined,
      userInvocable: userInvocable ? undefined : false,
      mode: mode || undefined,
      instructions: instructions.trim() || undefined,
    });

    setCreating(false);

    if (result.success && result.skill) {
      await api.deployClaudeSkill(result.skill.name, scope);
      onCreated(result.skill.name);
      onClose();
    } else if (result.success) {
      onCreated(name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-'));
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
            className={`px-4 py-1.5 text-xs ${claudeSkill.button} rounded-lg disabled:opacity-50 transition-colors duration-150`}
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
          <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Deploy to</label>
          <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 w-fit">
            {(['global', 'local'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                  scope === s
                    ? 'text-[#d1d5db] bg-white/[0.06]'
                    : `${text.dimmed} hover:${text.muted}`
                }`}
              >
                {s === 'global' ? 'Global' : 'Project'}
              </button>
            ))}
          </div>
          <p className={`text-[10px] ${text.dimmed} mt-0.5`}>
            {scope === 'global' ? 'Available in all projects (~/.claude/skills/)' : 'Available only in this project (.claude/skills/)'}
          </p>
        </div>

        <div>
          <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this skill do? (used for auto-invocation)"
            className={inputClass}
          />
        </div>

        <div>
          <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Allowed Tools</label>
          <input
            type="text"
            value={allowedTools}
            onChange={(e) => setAllowedTools(e.target.value)}
            placeholder="e.g. Read, Grep, Glob, Bash(git:*)"
            className={inputClass}
          />
          <p className={`text-[10px] ${text.dimmed} mt-0.5`}>Comma-separated, supports wildcards</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Context</label>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className={inputClass}
            >
              <option value="">inline (default)</option>
              <option value="fork">fork (subagent)</option>
            </select>
          </div>
          <div>
            <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Agent</label>
            <input
              type="text"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              placeholder="e.g. Explore, Plan"
              className={inputClass}
              disabled={context !== 'fork'}
            />
            <p className={`text-[10px] ${text.dimmed} mt-0.5`}>Subagent type (when fork)</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={inputClass}
            >
              <option value="">inherit (default)</option>
              <option value="opus">opus</option>
              <option value="sonnet">sonnet</option>
              <option value="haiku">haiku</option>
            </select>
          </div>
          <div>
            <label className={`block text-[11px] font-medium ${text.muted} mb-1`}>Argument Hint</label>
            <input
              type="text"
              value={argumentHint}
              onChange={(e) => setArgumentHint(e.target.value)}
              placeholder="e.g. [issue-number]"
              className={inputClass}
            />
            <p className={`text-[10px] ${text.dimmed} mt-0.5`}>Shown in autocomplete</p>
          </div>
        </div>

        {/* Boolean toggles */}
        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={userInvocable}
              onChange={(e) => setUserInvocable(e.target.checked)}
              className="accent-teal-400"
            />
            <span className={`text-xs ${text.secondary} group-hover:${text.primary} transition-colors`}>
              User-invocable
            </span>
            <span className={`text-[10px] ${text.dimmed}`}>Show in /slash menu</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={disableModelInvocation}
              onChange={(e) => setDisableModelInvocation(e.target.checked)}
              className="accent-teal-400"
            />
            <span className={`text-xs ${text.secondary} group-hover:${text.primary} transition-colors`}>
              Disable model invocation
            </span>
            <span className={`text-[10px] ${text.dimmed}`}>Only user can trigger</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={mode}
              onChange={(e) => setMode(e.target.checked)}
              className="accent-teal-400"
            />
            <span className={`text-xs ${text.secondary} group-hover:${text.primary} transition-colors`}>
              Mode command
            </span>
            <span className={`text-[10px] ${text.dimmed}`}>Modifies Claude's behavior</span>
          </label>
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
