import { useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { useClaudeSkillDetail, useSkillDeploymentStatus } from '../../hooks/useClaudeSkills';
import { useApi } from '../../hooks/useApi';
import { border, button, claudeSkill, text } from '../../theme';
import { Modal } from '../Modal';
import { Spinner } from '../Spinner';

interface SkillDetailPanelProps {
  skillName: string;
  onDeleted: () => void;
}

export function SkillDetailPanel({ skillName, onDeleted }: SkillDetailPanelProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { status: allDeploymentStatus, refetch: refetchDeployment } = useSkillDeploymentStatus();

  const deploymentStatus = allDeploymentStatus[skillName] ?? { global: false, local: false, localIsSymlink: false, localIsCopy: false, inRegistry: true };
  const hasLocalCopy = deploymentStatus.localIsCopy;
  const inRegistry = deploymentStatus.inRegistry;

  const [viewingLocation, setViewingLocation] = useState<'global' | 'local'>('global');
  useEffect(() => {
    if (!inRegistry) setViewingLocation('local');
    else if (!hasLocalCopy) setViewingLocation('global');
  }, [skillName, hasLocalCopy, inRegistry]);

  const locationParam = viewingLocation === 'local' ? 'local' as const : undefined;
  const { skill, isLoading, error, refetch } = useClaudeSkillDetail(skillName, locationParam);

  const [editingRef, setEditingRef] = useState(false);
  const [editingExamples, setEditingExamples] = useState(false);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);
  const [configDraft, setConfigDraft] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [pendingDeploy, setPendingDeploy] = useState<{ scope: 'global' | 'local'; action: 'enable' | 'disable' } | null>(null);

  useEffect(() => {
    setEditingRef(false);
    setEditingExamples(false);
    setEditingConfig(null);
  }, [skillName, viewingLocation]);

  const saveUpdate = useCallback(async (updates: Parameters<typeof api.updateClaudeSkill>[1]) => {
    await api.updateClaudeSkill(skillName, updates, locationParam);
    refetch();
    queryClient.invalidateQueries({ queryKey: ['claudeSkills'] });
  }, [api, skillName, locationParam, refetch, queryClient]);

  const handleSaveConfig = async (key: string, value: string | boolean) => {
    await saveUpdate({ frontmatter: { [key]: value } });
    setEditingConfig(null);
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    setDeploying('delete');

    if (viewingLocation === 'local') {
      // Remove the local/project copy
      await api.undeployClaudeSkill(skillName, 'local');
      setDeploying(null);
      if (inRegistry) {
        setViewingLocation('global');
        refetchDeployment();
      } else {
        // Project-only skill — fully gone
        queryClient.invalidateQueries({ queryKey: ['claudeSkills'] });
        onDeleted();
      }
    } else {
      // Delete from registry (also cleans up symlinks, but not local copies)
      await api.deleteClaudeSkill(skillName);
      setDeploying(null);
      queryClient.invalidateQueries({ queryKey: ['claudeSkills'] });
      if (hasLocalCopy) {
        // Project copy survives — switch to it
        refetchDeployment();
        setViewingLocation('local');
      } else {
        onDeleted();
      }
    }
  };

  const handleDeploy = async (scope: 'global' | 'local', isDeployed: boolean) => {
    if (isDeployed) {
      // Disabling local copy → files get deleted, confirm first
      if (scope === 'local' && hasLocalCopy) {
        setPendingDeploy({ scope: 'local', action: 'disable' });
        return;
      }
      setDeploying(scope);
      await api.undeployClaudeSkill(skillName, scope);
      setDeploying(null);
      refetchDeployment();
      return;
    }

    // Enabling — check if the other scope is active (mutual exclusion)
    const otherActive = scope === 'global' ? deploymentStatus.local : deploymentStatus.global;
    if (otherActive) {
      setPendingDeploy({ scope, action: 'enable' });
      return;
    }

    setDeploying(scope);
    await api.deployClaudeSkill(skillName, scope);
    setDeploying(null);
    refetchDeployment();
  };

  const handleConfirmDeploy = async () => {
    if (!pendingDeploy) return;
    const { scope, action } = pendingDeploy;
    const otherScope = scope === 'global' ? 'local' : 'global';
    setPendingDeploy(null);
    setDeploying(scope);
    if (action === 'disable') {
      await api.undeployClaudeSkill(skillName, scope);
    } else {
      await api.undeployClaudeSkill(skillName, otherScope);
      await api.deployClaudeSkill(skillName, scope);
    }
    setDeploying(null);
    // If local copy was removed, switch to global view
    if (scope === 'local' || otherScope === 'local') {
      setViewingLocation(scope === 'local' && action === 'enable' ? 'local' : 'global');
    }
    refetchDeployment();
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    await api.duplicateSkillToProject(skillName);
    if (deploymentStatus.global) {
      await api.undeployClaudeSkill(skillName, 'global');
    }
    setDuplicating(false);
    refetchDeployment();
    setViewingLocation('local');
  };

  const handleMakeGlobal = async () => {
    setDuplicating(true);
    const displayName = skill?.frontmatter?.name || skillName;
    await api.createGlobalFromProject(skillName, displayName);
    // Remove project copy, deploy as global symlink
    await api.undeployClaudeSkill(skillName, 'local');
    await api.deployClaudeSkill(skillName, 'global');
    setDuplicating(false);
    queryClient.invalidateQueries({ queryKey: ['claudeSkills'] });
    refetchDeployment();
    setViewingLocation('global');
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

  const fm = skill.frontmatter;

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
              {fm.mode && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${claudeSkill.badge}`}>mode</span>
              )}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${claudeSkill.badge}`}>
                {viewingLocation === 'local' ? 'Project' : 'Global'}
              </span>
            </div>
            <h2 className={`text-[15px] font-semibold ${text.primary} leading-snug px-2 py-1 -mx-2 -my-1`}>
              {skill.displayName}
            </h2>
          </div>
          <div className="flex-shrink-0 pt-1 flex items-center gap-3">
            {hasLocalCopy && inRegistry && (
              <LocationSwitch
                value={viewingLocation}
                onChange={setViewingLocation}
              />
            )}
            {duplicating ? (
              <Spinner size="xs" className={text.dimmed} />
            ) : viewingLocation === 'global' && inRegistry && !hasLocalCopy ? (
              <button
                type="button"
                onClick={handleDuplicate}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] ${button.secondary} transition-colors`}
              >
                Create project copy
              </button>
            ) : !inRegistry ? (
              <button
                type="button"
                onClick={handleMakeGlobal}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] ${button.secondary} transition-colors`}
              >
                Make global
              </button>
            ) : null}
            <div className="flex items-center gap-1.5">
              {deploying ? (
                <Spinner size="xs" className={text.dimmed} />
              ) : (
                <DeployToggle
                  active={viewingLocation === 'local' ? deploymentStatus.local : deploymentStatus.global}
                  onToggle={() => {
                    const scope = viewingLocation === 'local' ? 'local' : 'global';
                    const isDeployed = scope === 'local' ? deploymentStatus.local : deploymentStatus.global;
                    handleDeploy(scope, isDeployed);
                  }}
                  title={
                    (viewingLocation === 'local' ? deploymentStatus.local : deploymentStatus.global)
                      ? 'Deactivate'
                      : 'Activate'
                  }
                />
              )}
              <span className={`text-[10px] ${text.dimmed} w-10`}>
                {(viewingLocation === 'local' ? deploymentStatus.local : deploymentStatus.global) ? 'Enabled' : 'Disabled'}
              </span>
            </div>
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
      <div className="flex-1 overflow-y-auto p-5 space-y-12">
        {/* Description — auto-save */}
        <AutoSaveTextSection
          key={`desc-${skillName}-${viewingLocation}`}
          title="Description"
          content={fm.description || ''}
          emptyText="Click to add description..."
          rows={3}
          onSave={(v) => saveUpdate({ frontmatter: { description: v } })}
        />

        {/* Configuration */}
        <section>
          <h3 className={`text-[11px] font-medium ${text.muted} mb-2`}>Configuration</h3>
          <div className="space-y-2">
            <EditableConfigRow label="Allowed Tools" configKey="allowedTools" value={fm.allowedTools} fallback="none" editingConfig={editingConfig} configDraft={configDraft} setEditingConfig={setEditingConfig} setConfigDraft={setConfigDraft} onSave={handleSaveConfig} />
            <EditableConfigRow label="Context" configKey="context" value={fm.context} fallback="inline" editingConfig={editingConfig} configDraft={configDraft} setEditingConfig={setEditingConfig} setConfigDraft={setConfigDraft} onSave={handleSaveConfig} options={['inline', 'file', 'tool', 'none']} />
            <EditableConfigRow label="Agent" configKey="agent" value={fm.agent} fallback="general-purpose" editingConfig={editingConfig} configDraft={configDraft} setEditingConfig={setEditingConfig} setConfigDraft={setConfigDraft} onSave={handleSaveConfig} />
            <EditableConfigRow label="Model" configKey="model" value={fm.model} fallback="inherit" editingConfig={editingConfig} configDraft={configDraft} setEditingConfig={setEditingConfig} setConfigDraft={setConfigDraft} onSave={handleSaveConfig} options={['', 'sonnet', 'opus', 'haiku']} />
            <EditableConfigRow label="Argument Hint" configKey="argumentHint" value={fm.argumentHint} editingConfig={editingConfig} configDraft={configDraft} setEditingConfig={setEditingConfig} setConfigDraft={setConfigDraft} onSave={handleSaveConfig} />
            <ToggleConfigRow label="User-invocable" value={fm.userInvocable} onToggle={(v) => handleSaveConfig('userInvocable', v)} />
            <ToggleConfigRow label="Model invocation" value={!fm.disableModelInvocation} onToggle={(v) => handleSaveConfig('disableModelInvocation', !v)} />
            <ToggleConfigRow label="Mode" value={fm.mode} onToggle={(v) => handleSaveConfig('mode', v)} />
            <div className="flex items-center gap-2 pt-1">
              <span className={`text-[10px] ${text.dimmed} w-28 flex-shrink-0`}>Path</span>
              <span className={`text-[10px] font-mono ${text.dimmed} truncate`}>
                {skill.path}
              </span>
            </div>
          </div>
        </section>

        {/* SKILL.md */}
        <AutoSaveFileSection
          key={`md-${skillName}-${viewingLocation}`}
          title="SKILL.md"
          content={skill.skillMd}
          rows={16}
          onSave={(v) => saveUpdate({ skillMd: v })}
        />

        {/* reference.md */}
        {skill.hasReference || editingRef ? (
          <AutoSaveFileSection
            key={`ref-${skillName}-${viewingLocation}`}
            title="reference.md"
            content={skill.referenceMd ?? ''}
            rows={12}
            onSave={(v) => saveUpdate({ referenceMd: v })}
            onDelete={async () => { await saveUpdate({ referenceMd: '' }); setEditingRef(false); }}
            startEditing={!skill.hasReference}
          />
        ) : (
          <section>
            <h3 className={`text-[11px] font-medium ${text.muted} mb-2`}>reference.md</h3>
            <button
              type="button"
              onClick={() => setEditingRef(true)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] ${text.dimmed} hover:${text.muted} hover:bg-white/[0.04] transition-colors`}
            >
              <Plus className="w-3 h-3" />
              Add reference
            </button>
          </section>
        )}

        {/* examples.md */}
        {skill.hasExamples || editingExamples ? (
          <AutoSaveFileSection
            key={`ex-${skillName}-${viewingLocation}`}
            title="examples.md"
            content={skill.examplesMd ?? ''}
            rows={12}
            onSave={(v) => saveUpdate({ examplesMd: v })}
            onDelete={async () => { await saveUpdate({ examplesMd: '' }); setEditingExamples(false); }}
            startEditing={!skill.hasExamples}
          />
        ) : (
          <section>
            <h3 className={`text-[11px] font-medium ${text.muted} mb-2`}>examples.md</h3>
            <button
              type="button"
              onClick={() => setEditingExamples(true)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] ${text.dimmed} hover:${text.muted} hover:bg-white/[0.04] transition-colors`}
            >
              <Plus className="w-3 h-3" />
              Add examples
            </button>
          </section>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <Modal
          title={hasLocalCopy ? `Delete ${viewingLocation === 'local' ? 'project' : 'global'} skill?` : 'Delete skill?'}
          icon={<Trash2 className="w-4 h-4 text-red-400" />}
          onClose={() => setShowDeleteConfirm(false)}
          width="sm"
          footer={
            <>
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
            </>
          }
        >
          <p className={`text-xs ${text.secondary}`}>
            The {viewingLocation === 'local' ? 'project' : 'global'} skill "{skill.displayName}" will be deleted.
          </p>
        </Modal>
      )}

      {/* Deploy mutual exclusion confirmation */}
      {pendingDeploy && (
        <Modal
          title={
            `${pendingDeploy.action.charAt(0).toUpperCase() +
              pendingDeploy.action.slice(1)} ${pendingDeploy.scope === 'local' ? 'project' : 'global'} skill?`
          }
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          onClose={() => setPendingDeploy(null)}
          width="sm"
          footer={
            <>
              <button
                type="button"
                onClick={() => setPendingDeploy(null)}
                className={`px-3 py-1.5 text-xs rounded-lg ${text.muted} hover:${text.secondary} transition-colors`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeploy}
                className="px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-900/30 hover:bg-amber-900/50 rounded-lg transition-colors"
              >
                Continue
              </button>
            </>
          }
        >
          <p className={`text-xs ${text.secondary}`}>
            {pendingDeploy.scope === 'local' && pendingDeploy.action === 'enable'
              ? 'This will disable the global skill.'
              : `The project skill "${skill.displayName}" will be deleted.`}
          </p>
        </Modal>
      )}

    </div>
  );
}

// ─── Helper components ───────────────────────────────────────

function DeployToggle({ active, onToggle, title, disabled }: { active: boolean; onToggle: () => void; title: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      className={`relative w-7 h-4 rounded-full transition-colors duration-200 focus:outline-none ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
      style={{ backgroundColor: active ? 'rgba(45,212,191,0.35)' : 'rgba(255,255,255,0.08)' }}
      title={title}
      disabled={disabled}
    >
      <span
        className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 ${
          active ? 'left-3.5 bg-teal-400' : 'left-0.5 bg-white/40'
        }`}
      />
    </button>
  );
}

function LocationSwitch({ value, onChange }: { value: 'global' | 'local'; onChange: (v: 'global' | 'local') => void }) {
  return (
    <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
      {(['global', 'local'] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => onChange(loc)}
          className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
            value === loc
              ? 'text-[#d1d5db] bg-white/[0.06]'
              : `${text.dimmed} hover:${text.muted}`
          }`}
        >
          {loc === 'global' ? 'Global' : 'Project'}
        </button>
      ))}
    </div>
  );
}

function ToggleConfigRow({ label, value, onToggle }: { label: string; value: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] ${text.dimmed} w-28 flex-shrink-0`}>{label}</span>
      <button
        type="button"
        onClick={() => onToggle(!value)}
        className="relative w-7 h-4 rounded-full transition-colors duration-200 focus:outline-none"
        style={{ backgroundColor: value ? 'rgba(45,212,191,0.35)' : 'rgba(255,255,255,0.08)' }}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 ${
            value ? 'left-3.5 bg-teal-400' : 'left-0.5 bg-white/40'
          }`}
        />
      </button>
    </div>
  );
}

function EditableConfigRow({
  label,
  configKey,
  value,
  fallback,
  editingConfig,
  configDraft,
  setEditingConfig,
  setConfigDraft,
  onSave,
  options,
}: {
  label: string;
  configKey: string;
  value?: string;
  fallback?: string;
  editingConfig: string | null;
  configDraft: string;
  setEditingConfig: (k: string | null) => void;
  setConfigDraft: (v: string) => void;
  onSave: (key: string, value: string) => void;
  options?: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const isEditing = editingConfig === configKey;
  const hasValue = value && value !== '';

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      if (selectRef.current) {
        selectRef.current.focus();
        try { selectRef.current.showPicker(); } catch { /* unsupported */ }
      }
    }
  }, [isEditing]);

  if (isEditing && options) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-[10px] ${text.dimmed} w-28 flex-shrink-0`}>{label}</span>
        <select
          ref={selectRef}
          value={configDraft}
          onChange={(e) => { onSave(configKey, e.target.value); }}
          onBlur={() => setEditingConfig(null)}
          className={`text-xs font-mono bg-white/[0.04] border border-white/[0.12] rounded px-1.5 py-0.5 ${text.primary} focus:outline-none`}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt || (fallback ? `(${fallback})` : '—')}</option>
          ))}
        </select>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className={`text-[10px] ${text.dimmed} w-28 flex-shrink-0`}>{label}</span>
        <input
          ref={inputRef}
          value={configDraft}
          onChange={(e) => setConfigDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onSave(configKey, configDraft); }
            if (e.key === 'Escape') { setEditingConfig(null); }
          }}
          onBlur={() => onSave(configKey, configDraft)}
          className={`text-xs font-mono bg-white/[0.04] border border-white/[0.12] rounded px-1.5 py-0.5 ${text.primary} focus:outline-none flex-1`}
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-[10px] ${text.dimmed} w-28 flex-shrink-0`}>{label}</span>
      <span
        className={`text-xs font-mono ${hasValue ? text.secondary : text.dimmed} cursor-pointer hover:bg-white/[0.04] px-1.5 py-0.5 -mx-1.5 rounded transition-colors`}
        onClick={() => { setConfigDraft(value ?? ''); setEditingConfig(configKey); }}
      >
        {hasValue ? value : (fallback ?? '—')}
      </span>
    </div>
  );
}

// ─── Auto-save text section (description) ────────────────────

function AutoSaveTextSection({
  title,
  content,
  emptyText,
  rows,
  onSave,
}: {
  title: string;
  content: string;
  emptyText: string;
  rows: number;
  onSave: (value: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef('');

  const flush = useCallback((v: string) => {
    if (v !== lastSaved.current) { lastSaved.current = v; onSave(v); }
  }, [onSave]);

  const schedule = useCallback((v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(v), 600);
  }, [flush]);

  const finish = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    flush(draft);
    setEditing(false);
  }, [draft, flush]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <section>
      <h3 className={`text-[11px] font-medium ${text.muted} mb-2`}>{title}</h3>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => { setDraft(e.target.value); schedule(e.target.value); }}
          onBlur={finish}
          onKeyDown={(e) => { if (e.key === 'Escape') finish(); }}
          className={`w-full px-3 py-2 bg-white/[0.02] border border-white/[0.08] rounded-lg text-xs ${text.primary} focus:outline-none resize-none`}
          rows={rows}
          autoFocus
        />
      ) : (
        <div
          className="rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] px-3 py-2 cursor-pointer transition-colors"
          onClick={() => { setDraft(content); lastSaved.current = content; setEditing(true); }}
        >
          <p className={`text-xs ${content ? text.secondary : text.dimmed}`}>
            {content || emptyText}
          </p>
        </div>
      )}
    </section>
  );
}

// ─── Auto-save file section (SKILL.md / reference / examples) ─

function AutoSaveFileSection({
  title,
  content,
  rows,
  onSave,
  onDelete,
  startEditing,
}: {
  title: string;
  content: string;
  rows: number;
  onSave: (value: string) => Promise<unknown>;
  onDelete?: () => void;
  startEditing?: boolean;
}) {
  const [editing, setEditing] = useState(!!startEditing);
  const [draft, setDraft] = useState(startEditing ? content : '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(content);

  const flush = useCallback((v: string) => {
    if (v !== lastSaved.current) { lastSaved.current = v; onSave(v); }
  }, [onSave]);

  const schedule = useCallback((v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(v), 600);
  }, [flush]);

  const finish = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    flush(draft);
    setEditing(false);
  }, [draft, flush]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className={`text-[11px] font-medium ${text.muted}`}>{title}</h3>
        {onDelete && !startEditing && (
          <button
            type="button"
            onClick={onDelete}
            className={`p-0.5 rounded ${text.dimmed} hover:text-red-400 transition-colors`}
            title={`Delete ${title}`}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => { setDraft(e.target.value); schedule(e.target.value); }}
          onBlur={finish}
          onKeyDown={(e) => { if (e.key === 'Escape') finish(); }}
          className={`w-full px-3 py-2 bg-white/[0.02] border border-white/[0.08] rounded-lg text-xs font-mono ${text.primary} focus:outline-none resize-none`}
          rows={rows}
          autoFocus
        />
      ) : content ? (
        <div
          className="rounded-lg bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] px-3 py-2 max-h-80 overflow-y-auto cursor-pointer transition-colors"
          onClick={() => { setDraft(content); lastSaved.current = content; setEditing(true); }}
        >
          <pre className={`text-xs font-mono ${text.secondary} whitespace-pre-wrap`}>
            {content}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
