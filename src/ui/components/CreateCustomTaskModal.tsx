import { useState } from 'react';
import { FileText, X } from 'lucide-react';

import { customTask, getLabelColor, text } from '../theme';
import { Modal } from './Modal';

interface CreateCustomTaskModalProps {
  onCreated: (taskId?: string) => void;
  onClose: () => void;
  onCreate: (data: { title: string; description?: string; priority?: string; labels?: string[] }) => Promise<{ success: boolean; task?: { id: string }; error?: string }>;
}

export function CreateCustomTaskModal({ onCreated, onClose, onCreate }: CreateCustomTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsCreating(true);
    setError(null);

    const result = await onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      labels: labels.length > 0 ? labels : undefined,
    });

    setIsCreating(false);

    if (result.success) {
      onCreated(result.task?.id);
      onClose();
    } else {
      setError(result.error ?? 'Failed to create task');
    }
  };

  const addLabel = () => {
    const trimmed = labelInput.trim();
    if (trimmed && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed]);
    }
    setLabelInput('');
  };

  const removeLabel = (label: string) => {
    setLabels(labels.filter((l) => l !== label));
  };

  const priorities = ['high', 'medium', 'low'] as const;

  return (
    <Modal
      title="Create Local Task"
      icon={<FileText className="w-4 h-4 text-amber-400" />}
      onClose={onClose}
      onSubmit={handleSubmit}
      width="lg"
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
            disabled={!title.trim() || isCreating}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg ${customTask.button} disabled:opacity-50 transition-colors`}
          >
            {isCreating ? 'Creating...' : 'Create Task'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className={`block text-[11px] font-medium ${text.secondary} mb-1.5`}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className={`w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs ${text.primary} placeholder-[#4b5563] outline-none focus:border-white/[0.15] transition-colors`}
            autoFocus
          />
        </div>

        {/* Priority */}
        <div>
          <label className={`block text-[11px] font-medium ${text.secondary} mb-1.5`}>Priority</label>
          <div className="flex gap-1">
            {priorities.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                  priority === p
                    ? `${customTask.priority[p]} bg-white/[0.08]`
                    : `${text.muted} hover:bg-white/[0.04]`
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Labels */}
        <div>
          <label className={`block text-[11px] font-medium ${text.secondary} mb-1.5`}>Labels</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  addLabel();
                }
              }}
              placeholder="Add a label..."
              className={`flex-1 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs ${text.primary} placeholder-[#4b5563] outline-none focus:border-white/[0.15] transition-colors`}
            />
            <button
              type="button"
              onClick={addLabel}
              disabled={!labelInput.trim()}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-lg bg-white/[0.06] ${text.secondary} hover:bg-white/[0.10] disabled:opacity-30 transition-colors`}
            >
              Add
            </button>
          </div>
          {labels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {labels.map((label) => {
                const colorSet = getLabelColor(label);
                return (
                  <span
                    key={label}
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded ${colorSet.text} ${colorSet.bg}`}
                  >
                    {label}
                    <button
                      type="button"
                      onClick={() => removeLabel(label)}
                      className="hover:opacity-70 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className={`block text-[11px] font-medium ${text.secondary} mb-1.5`}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, markdown supported..."
            rows={4}
            className={`w-full px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs ${text.primary} placeholder-[#4b5563] outline-none focus:border-white/[0.15] transition-colors resize-none`}
          />
        </div>

        {error && (
          <p className={`${text.error} text-[11px]`}>{error}</p>
        )}
      </div>
    </Modal>
  );
}
