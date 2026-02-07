import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { useClaudeSkillDetail } from '../../hooks/useClaudeSkills';
import { useApi } from '../../hooks/useApi';
import { border, button, claudeSkill, text } from '../../theme';
import { Spinner } from '../Spinner';

interface SkillDetailPanelProps {
  skillName: string;
  location: 'global' | 'project';
  onDeleted: () => void;
}

export function SkillDetailPanel({ skillName, location, onDeleted }: SkillDetailPanelProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { skill, isLoading, error, refetch } = useClaudeSkillDetail(skillName, location);

  const [editingMd, setEditingMd] = useState(false);
  const [mdDraft, setMdDraft] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveMd = async () => {
    if (!skill) return;
    await api.updateClaudeSkill(skillName, { location, skillMd: mdDraft });
    setEditingMd(false);
    refetch();
  };

  const handleDelete = async () => {
    await api.deleteClaudeSkill(skillName, location);
    queryClient.invalidateQueries({ queryKey: ['claudeSkills'] });
    onDeleted();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2">
        <Spinner size="sm" className={text.muted} />
        <p className={`${text.muted} text-sm`}>Loading skill...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className={`${text.error} text-sm`}>{error}</p>
      </div>
    );
  }

  if (!skill) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className={`${text.muted} text-sm`}>Select a skill to view details</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className={`flex-shrink-0 px-5 py-4 border-b ${border.section}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[10px] font-mono ${claudeSkill.accent}`}>
                {skill.name}
              </span>
              <span className={`text-[10px] ${claudeSkill.badge} px-1.5 py-0.5 rounded`}>
                {skill.location}
              </span>
            </div>
            <h2 className={`text-[15px] font-semibold ${text.primary} leading-snug px-2 py-1 -mx-2 -my-1`}>
              {skill.displayName}
            </h2>
          </div>
          <div className="flex-shrink-0 pt-1">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className={`p-1.5 rounded-lg ${text.muted} hover:text-red-400 hover:bg-red-900/20 transition-colors`}
              title="Delete skill"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-10">
        {/* Description */}
        {skill.description && (
          <section>
            <h3 className={`text-[11px] font-medium ${text.muted} mb-2`}>Description</h3>
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <p className={`text-xs ${text.secondary}`}>{skill.description}</p>
            </div>
          </section>
        )}

        {/* Frontmatter */}
        <section>
          <h3 className={`text-[11px] font-medium ${text.muted} mb-2`}>Configuration</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${text.dimmed} w-24`}>Allowed Tools</span>
              <span className={`text-xs font-mono ${text.secondary}`}>
                {skill.frontmatter.allowedTools || <span className={text.dimmed}>none</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${text.dimmed} w-24`}>Context</span>
              <span className={`text-xs font-mono ${text.secondary}`}>
                {skill.frontmatter.context || <span className={text.dimmed}>default</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] ${text.dimmed} w-24`}>Path</span>
              <span className={`text-[10px] font-mono ${text.dimmed} truncate`}>
                {skill.path}
              </span>
            </div>
          </div>
        </section>

        {/* SKILL.md content */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-[11px] font-medium ${text.muted}`}>SKILL.md</h3>
            {!editingMd && (
              <button
                type="button"
                onClick={() => { setMdDraft(skill.skillMd); setEditingMd(true); }}
                className={`text-[10px] ${claudeSkill.accent} hover:underline`}
              >
                Edit
              </button>
            )}
          </div>
          {editingMd ? (
            <div className="space-y-2">
              <textarea
                value={mdDraft}
                onChange={(e) => setMdDraft(e.target.value)}
                className={`w-full px-3 py-2 bg-white/[0.02] border border-white/[0.08] rounded-lg text-xs font-mono ${text.primary} focus:outline-none resize-none`}
                rows={16}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMd(false)}
                  className={`px-3 py-1 text-xs rounded-lg ${text.muted} hover:${text.secondary} transition-colors`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMd}
                  className={`px-3 py-1 text-xs font-medium ${button.primary} rounded-lg transition-colors`}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 max-h-80 overflow-y-auto">
              <pre className={`text-xs font-mono ${text.secondary} whitespace-pre-wrap`}>
                {skill.skillMd}
              </pre>
            </div>
          )}
        </section>

        {/* Reference */}
        {skill.hasReference && skill.referenceMd && (
          <section>
            <h3 className={`text-[11px] font-medium ${text.muted} mb-2`}>reference.md</h3>
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 max-h-60 overflow-y-auto">
              <pre className={`text-xs font-mono ${text.secondary} whitespace-pre-wrap`}>
                {skill.referenceMd}
              </pre>
            </div>
          </section>
        )}

        {/* Examples */}
        {skill.hasExamples && skill.examplesMd && (
          <section>
            <h3 className={`text-[11px] font-medium ${text.muted} mb-2`}>examples.md</h3>
            <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 max-h-60 overflow-y-auto">
              <pre className={`text-xs font-mono ${text.secondary} whitespace-pre-wrap`}>
                {skill.examplesMd}
              </pre>
            </div>
          </section>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-surface-panel rounded-xl shadow-2xl border border-white/[0.08] p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className={`text-sm font-medium ${text.primary} mb-2`}>Delete skill?</h3>
              <p className={`text-xs ${text.secondary} mb-1`}>
                This will delete the "{skill.displayName}" skill directory.
              </p>
              <p className={`text-xs ${text.muted} mb-4`}>
                Path: {skill.path}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className={`px-3 py-1.5 text-xs rounded-lg ${text.muted} hover:${text.secondary} transition-colors`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className={`px-3 py-1.5 text-xs font-medium ${button.confirm} rounded-lg transition-colors`}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
