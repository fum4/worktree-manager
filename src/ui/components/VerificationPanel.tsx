import { CircleCheck, FishingHook, Hand, ListChecks, MessageSquareText, Plus, Sparkles, Terminal, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { HookSkillRef, HookStep, HookTrigger } from '../hooks/api';
import { useApi } from '../hooks/useApi';
import { useHooksConfig } from '../hooks/useHooks';
import { infoBanner, settings, text } from '../theme';

const BANNER_DISMISSED_KEY = 'work3:hooksBannerDismissed';

function CircleMinusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="8" strokeWidth="1.5" className="fill-none stroke-current group-hover/remove:fill-current" />
      <line x1="5.5" y1="9" x2="12.5" y2="9" strokeWidth="1.5" strokeLinecap="round" className="stroke-current group-hover/remove:stroke-[#12151a]" />
    </svg>
  );
}

export function HooksPanel() {
  const { config, saveConfig, refetch } = useHooksConfig();
  const api = useApi();
  const [addingStep, setAddingStep] = useState<HookTrigger | null>(null);
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newCondition, setNewCondition] = useState('');
  const [showImportPicker, setShowImportPicker] = useState<HookTrigger | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem(BANNER_DISMISSED_KEY) === '1',
  );
  const dismissBanner = () => {
    setBannerDismissed(true);
    localStorage.setItem(BANNER_DISMISSED_KEY, '1');
  };

  if (!config) return null;

  const addStep = (trigger: HookTrigger) => {
    const name = newName.trim();
    const command = newCommand.trim();
    if (!name || !command) return;
    if (trigger === 'custom' && !newCondition.trim()) return;

    const id = `step-${Date.now()}`;
    const step: HookStep = { id, name, command, enabled: true, trigger };
    if (trigger === 'custom') step.condition = newCondition.trim();
    const newSteps = [...config.steps, step];
    saveConfig({ ...config, steps: newSteps });
    setNewName('');
    setNewCommand('');
    setNewCondition('');
    setAddingStep(null);
  };

  const removeStep = (stepId: string) => {
    saveConfig({ ...config, steps: config.steps.filter((s) => s.id !== stepId) });
  };

  const updateStep = (stepId: string, updates: Partial<Pick<HookStep, 'name' | 'command' | 'enabled' | 'condition'>>) => {
    saveConfig({
      ...config,
      steps: config.steps.map((s) =>
        s.id === stepId ? { ...s, ...updates } : s,
      ),
    });
  };

  const handleToggleSkill = async (skillName: string, enabled: boolean, trigger?: HookTrigger) => {
    await api.toggleHookSkill(skillName, enabled, trigger);
    refetch();
  };

  const handleRemoveSkill = async (skillName: string, trigger?: HookTrigger) => {
    await api.removeHookSkill(skillName, trigger);
    refetch();
  };

  const handleImportSkill = async (skillName: string, trigger: HookTrigger, condition?: string) => {
    await api.importHookSkill(skillName, trigger, condition);
    refetch();
    setShowImportPicker(null);
  };

  // Split items by trigger
  const preSteps = config.steps.filter((s) => s.trigger === 'pre-implementation');
  const postSteps = config.steps.filter((s) => s.trigger === 'post-implementation' || !s.trigger);
  const onDemandSteps = config.steps.filter((s) => s.trigger === 'on-demand');
  const customSteps = config.steps.filter((s) => s.trigger === 'custom');
  const preSkills = config.skills.filter((s) => s.trigger === 'pre-implementation');
  const postSkills = config.skills.filter((s) => s.trigger === 'post-implementation' || !s.trigger);
  const onDemandSkills = config.skills.filter((s) => s.trigger === 'on-demand');
  const customSkills = config.skills.filter((s) => s.trigger === 'custom');

  const hasPreItems = preSteps.length > 0 || preSkills.length > 0;
  const hasPostItems = postSteps.length > 0 || postSkills.length > 0;
  const hasOnDemandItems = onDemandSteps.length > 0 || onDemandSkills.length > 0;
  const hasCustomItems = customSteps.length > 0 || customSkills.length > 0;

  return (
    <div className="max-w-2xl mx-auto p-6 flex flex-col gap-12">
      {/* Dismissible info banner */}
      {!bannerDismissed && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${infoBanner.border} ${infoBanner.bg}`}>
          <FishingHook className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className={`text-[11px] ${text.secondary} leading-relaxed flex-1`}>
            Hooks are automated checks and skills that validate your work.
            Add shell commands or import agent skills to build your verification pipeline.
          </p>
          <button
            type="button"
            onClick={dismissBanner}
            className="p-1 rounded-md hover:bg-emerald-400/10 text-emerald-400/40 hover:text-emerald-400/70 transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pre-Implementation section */}
      <HooksSection
        title="Pre-Implementation"
        description="Run before agents start working on a task"
        icon={<ListChecks className="w-3.5 h-3.5 text-sky-400" />}
        steps={preSteps}
        skills={preSkills}
        hasItems={hasPreItems}
        addingStep={addingStep === 'pre-implementation'}
        onStartAdding={() => { setShowImportPicker(null); setAddingStep('pre-implementation'); }}
        onCancelAdding={() => { setAddingStep(null); setNewName(''); setNewCommand(''); setNewCondition(''); }}
        onAddStep={() => addStep('pre-implementation')}
        onShowImportPicker={() => { setAddingStep(null); setNewName(''); setNewCommand(''); setNewCondition(''); setShowImportPicker('pre-implementation'); }}
        showImportPicker={showImportPicker === 'pre-implementation'}
        onImportSkill={(name) => handleImportSkill(name, 'pre-implementation')}
        onCloseImportPicker={() => setShowImportPicker(null)}
        newName={newName}
        setNewName={setNewName}
        newCommand={newCommand}
        setNewCommand={setNewCommand}
        nameRef={nameRef}
        updateStep={updateStep}
        removeStep={removeStep}
        handleToggleSkill={handleToggleSkill}
        handleRemoveSkill={handleRemoveSkill}
      />

      {/* Post-Implementation section */}
      <HooksSection
        title="Post-Implementation"
        description="Run after agents finish implementing a task"
        icon={<CircleCheck className="w-3.5 h-3.5 text-emerald-400" />}
        steps={postSteps}
        skills={postSkills}
        hasItems={hasPostItems}
        addingStep={addingStep === 'post-implementation'}
        onStartAdding={() => { setShowImportPicker(null); setAddingStep('post-implementation'); }}
        onCancelAdding={() => { setAddingStep(null); setNewName(''); setNewCommand(''); setNewCondition(''); }}
        onAddStep={() => addStep('post-implementation')}
        onShowImportPicker={() => { setAddingStep(null); setNewName(''); setNewCommand(''); setNewCondition(''); setShowImportPicker('post-implementation'); }}
        showImportPicker={showImportPicker === 'post-implementation'}
        onImportSkill={(name) => handleImportSkill(name, 'post-implementation')}
        onCloseImportPicker={() => setShowImportPicker(null)}
        newName={newName}
        setNewName={setNewName}
        newCommand={newCommand}
        setNewCommand={setNewCommand}
        nameRef={nameRef}
        updateStep={updateStep}
        removeStep={removeStep}
        handleToggleSkill={handleToggleSkill}
        handleRemoveSkill={handleRemoveSkill}
      />

      {/* Custom section */}
      <HooksSection
        title="Custom"
        description="Agent decides when to run based on your condition"
        icon={<MessageSquareText className="w-3.5 h-3.5 text-violet-400" />}
        steps={customSteps}
        skills={customSkills}
        hasItems={hasCustomItems}
        addingStep={addingStep === 'custom'}
        onStartAdding={() => { setShowImportPicker(null); setAddingStep('custom'); }}
        onCancelAdding={() => { setAddingStep(null); setNewName(''); setNewCommand(''); setNewCondition(''); }}
        onAddStep={() => addStep('custom')}
        onShowImportPicker={() => { setAddingStep(null); setNewName(''); setNewCommand(''); setNewCondition(''); setShowImportPicker('custom'); }}
        showImportPicker={showImportPicker === 'custom'}
        onImportSkill={(name, condition) => handleImportSkill(name, 'custom', condition)}
        onCloseImportPicker={() => setShowImportPicker(null)}
        newName={newName}
        setNewName={setNewName}
        newCommand={newCommand}
        setNewCommand={setNewCommand}
        newCondition={newCondition}
        setNewCondition={setNewCondition}
        showConditionInput
        nameRef={nameRef}
        updateStep={updateStep}
        removeStep={removeStep}
        handleToggleSkill={handleToggleSkill}
        handleRemoveSkill={handleRemoveSkill}
      />

      {/* On-Demand section */}
      <HooksSection
        title="On-Demand"
        description="Manually triggered from the worktree view"
        icon={<Hand className="w-3.5 h-3.5 text-amber-400" />}
        steps={onDemandSteps}
        skills={onDemandSkills}
        hasItems={hasOnDemandItems}
        addingStep={addingStep === 'on-demand'}
        onStartAdding={() => { setShowImportPicker(null); setAddingStep('on-demand'); }}
        onCancelAdding={() => { setAddingStep(null); setNewName(''); setNewCommand(''); setNewCondition(''); }}
        onAddStep={() => addStep('on-demand')}
        onShowImportPicker={() => { setAddingStep(null); setNewName(''); setNewCommand(''); setNewCondition(''); setShowImportPicker('on-demand'); }}
        showImportPicker={showImportPicker === 'on-demand'}
        onImportSkill={(name) => handleImportSkill(name, 'on-demand')}
        onCloseImportPicker={() => setShowImportPicker(null)}
        newName={newName}
        setNewName={setNewName}
        newCommand={newCommand}
        setNewCommand={setNewCommand}
        nameRef={nameRef}
        updateStep={updateStep}
        removeStep={removeStep}
        handleToggleSkill={handleToggleSkill}
        handleRemoveSkill={handleRemoveSkill}
      />
    </div>
  );
}

function HooksSection({
  title,
  description,
  icon,
  steps,
  skills,
  hasItems,
  addingStep,
  onStartAdding,
  onCancelAdding,
  onAddStep,
  onShowImportPicker,
  showImportPicker,
  onImportSkill,
  onCloseImportPicker,
  newName,
  setNewName,
  newCommand,
  setNewCommand,
  newCondition,
  setNewCondition,
  showConditionInput,
  nameRef,
  updateStep,
  removeStep,
  handleToggleSkill,
  handleRemoveSkill,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  steps: HookStep[];
  skills: HookSkillRef[];
  hasItems: boolean;
  addingStep: boolean;
  onStartAdding: () => void;
  onCancelAdding: () => void;
  onAddStep: () => void;
  onShowImportPicker: () => void;
  showImportPicker: boolean;
  onImportSkill: (name: string, condition?: string) => void;
  onCloseImportPicker: () => void;
  newName: string;
  setNewName: (v: string) => void;
  newCommand: string;
  setNewCommand: (v: string) => void;
  newCondition?: string;
  setNewCondition?: (v: string) => void;
  showConditionInput?: boolean;
  nameRef: React.RefObject<HTMLInputElement>;
  updateStep: (stepId: string, updates: Partial<Pick<HookStep, 'name' | 'command' | 'enabled' | 'condition'>>) => void;
  removeStep: (stepId: string) => void;
  handleToggleSkill: (skillName: string, enabled: boolean, trigger?: HookTrigger) => void;
  handleRemoveSkill: (skillName: string, trigger?: HookTrigger) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className={`text-xs font-semibold ${text.primary} uppercase tracking-wider`}>{title}</h3>
        <span className={`text-[10px] ${text.dimmed} ml-1`}>{description}</span>
      </div>
      <div className="space-y-2">
        {!hasItems && !addingStep && (
          <div className="text-center py-6">
            <p className={`text-xs ${text.muted}`}>No {title.toLowerCase()} hooks configured yet.</p>
          </div>
        )}

        {/* Command cards */}
        {steps.map((step) => (
          <StepCard
            key={step.id}
            step={step}
            onUpdate={(updates) => updateStep(step.id, updates)}
            onToggle={(enabled) => updateStep(step.id, { enabled })}
            onRemove={() => removeStep(step.id)}
          />
        ))}

        {/* Skill cards */}
        {skills.map((skill) => (
          <SkillCard
            key={`${skill.skillName}-${skill.trigger ?? 'post-implementation'}`}
            skill={skill}
            onToggle={(enabled) => handleToggleSkill(skill.skillName, enabled, skill.trigger)}
            onRemove={() => handleRemoveSkill(skill.skillName, skill.trigger)}
          />
        ))}

        {/* Add step form */}
        {addingStep && (
          <div className={`rounded-xl border border-white/[0.06] ${settings.card} p-4 space-y-3`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-medium ${text.primary}`}>Add command</span>
              <button onClick={onCancelAdding} className={`p-1 ${text.dimmed} hover:text-white`}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <input
              ref={nameRef}
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. Type check)"
              className={`w-full px-3 py-2 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-white placeholder-[#4b5563] focus:outline-none focus:border-white/[0.15]`}
            />
            <input
              value={newCommand}
              onChange={(e) => setNewCommand(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !showConditionInput) onAddStep(); if (e.key === 'Escape') onCancelAdding(); }}
              placeholder="Command (e.g. pnpm check-types)"
              className={`w-full px-3 py-2 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-white placeholder-[#4b5563] focus:outline-none focus:border-white/[0.15] font-mono`}
            />
            {showConditionInput && setNewCondition && (
              <textarea
                value={newCondition ?? ''}
                onChange={(e) => setNewCondition(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') onCancelAdding(); }}
                placeholder="When should agents run this? (e.g. &quot;When changes touch database models or migrations&quot;)"
                rows={2}
                className={`w-full px-3 py-2 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-white placeholder-[#4b5563] focus:outline-none focus:border-white/[0.15] resize-none`}
              />
            )}
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={onCancelAdding}
                className={`px-3 py-1.5 text-[11px] font-medium ${text.muted} hover:text-[#9ca3af] rounded-lg transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={onAddStep}
                disabled={!newName.trim() || !newCommand.trim() || (showConditionInput && !(newCondition ?? '').trim())}
                className="px-3 py-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 rounded-lg transition-colors disabled:opacity-40"
              >
                Add command
              </button>
            </div>
          </div>
        )}

        {/* Import skill picker */}
        {showImportPicker && (
          <ImportSkillPicker
            onImport={onImportSkill}
            onClose={onCloseImportPicker}
            showConditionInput={showConditionInput}
          />
        )}

        {/* Action buttons — only show when neither form is open */}
        {!addingStep && !showImportPicker && (
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={onStartAdding}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${text.muted} hover:text-[#9ca3af] border border-dashed border-white/[0.08] hover:border-white/[0.15] rounded-lg transition-colors`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add command
            </button>
            <button
              onClick={onShowImportPicker}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium ${text.muted} hover:text-[#9ca3af] border border-dashed border-white/[0.08] hover:border-white/[0.15] rounded-lg transition-colors`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add skill
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepCard({
  step,
  onUpdate,
  onToggle,
  onRemove,
}: {
  step: HookStep;
  onUpdate: (updates: Partial<Pick<HookStep, 'name' | 'command' | 'condition'>>) => void;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(step.name);
  const [editCommand, setEditCommand] = useState(step.command);
  const [editCondition, setEditCondition] = useState(step.condition ?? '');
  const enabled = step.enabled !== false;
  const isCustom = step.trigger === 'custom';

  const save = () => {
    const name = editName.trim();
    const command = editCommand.trim();
    if (name && command) {
      const updates: Partial<Pick<HookStep, 'name' | 'command' | 'condition'>> = { name, command };
      if (isCustom) updates.condition = editCondition.trim();
      onUpdate(updates);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`rounded-xl border border-white/[0.06] ${settings.card} p-4 space-y-3`}>
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className={`w-full px-3 py-2 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-white focus:outline-none focus:border-white/[0.15]`}
        />
        <input
          value={editCommand}
          onChange={(e) => setEditCommand(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !isCustom) save(); if (e.key === 'Escape') setEditing(false); }}
          className={`w-full px-3 py-2 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-white focus:outline-none focus:border-white/[0.15] font-mono`}
        />
        {isCustom && (
          <textarea
            value={editCondition}
            onChange={(e) => setEditCondition(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
            placeholder="When should agents run this?"
            rows={2}
            className={`w-full px-3 py-2 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-white placeholder-[#4b5563] focus:outline-none focus:border-white/[0.15] resize-none`}
          />
        )}
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => setEditing(false)}
            className={`px-3 py-1.5 text-[11px] font-medium ${text.muted} hover:text-[#9ca3af] rounded-lg transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="px-3 py-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/[0.06] ${settings.card} group`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => { setEditName(step.name); setEditCommand(step.command); setEditCondition(step.condition ?? ''); setEditing(true); }}
      >
        <Terminal className={`w-3.5 h-3.5 flex-shrink-0 ${enabled ? text.muted : text.dimmed}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${enabled ? text.primary : text.dimmed}`}>{step.name}</span>
          </div>
          <p className={`text-[11px] ${text.dimmed} mt-0.5 font-mono truncate`}>{step.command}</p>
          {isCustom && step.condition && (
            <p className={`text-[10px] text-violet-400/70 mt-1 italic truncate`}>{step.condition}</p>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(!enabled); }}
          className="relative w-7 h-4 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0"
          style={{ backgroundColor: enabled ? 'rgba(45,212,191,0.35)' : 'rgba(255,255,255,0.08)' }}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 ${
              enabled ? 'left-3.5 bg-teal-400' : 'left-0.5 bg-white/40'
            }`}
          />
        </button>

        {/* Remove */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className={`group/remove ${text.dimmed} hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0`}
        >
          <CircleMinusIcon className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  );
}

function SkillCard({
  skill,
  onToggle,
  onRemove,
}: {
  skill: HookSkillRef;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}) {
  const isPredefined = skill.skillName.startsWith('verify-');
  const isCustom = skill.trigger === 'custom';

  return (
    <div className={`rounded-xl border border-white/[0.06] ${settings.card} group`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${skill.enabled ? 'text-pink-400/70' : text.dimmed}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${skill.enabled ? text.primary : text.dimmed}`}>{skill.skillName}</span>
            {isPredefined && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">built-in</span>
            )}
          </div>
          <p className={`text-[11px] ${text.dimmed} mt-0.5 font-mono`}>/{skill.skillName}</p>
          {isCustom && skill.condition && (
            <p className={`text-[10px] text-violet-400/70 mt-1 italic truncate`}>{skill.condition}</p>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={() => onToggle(!skill.enabled)}
          className="relative w-7 h-4 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0"
          style={{ backgroundColor: skill.enabled ? 'rgba(45,212,191,0.35)' : 'rgba(255,255,255,0.08)' }}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 ${
              skill.enabled ? 'left-3.5 bg-teal-400' : 'left-0.5 bg-white/40'
            }`}
          />
        </button>

        {/* Remove */}
        <button
          onClick={onRemove}
          className={`group/remove ${text.dimmed} hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0`}
        >
          <CircleMinusIcon className="w-[18px] h-[18px]" />
        </button>
      </div>
    </div>
  );
}

function ImportSkillPicker({
  onImport,
  onClose,
  showConditionInput,
}: {
  onImport: (skillName: string, condition?: string) => void;
  onClose: () => void;
  showConditionInput?: boolean;
}) {
  const api = useApi();
  const [available, setAvailable] = useState<Array<{ name: string; displayName: string; description: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [condition, setCondition] = useState('');

  const fetchAvailable = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.fetchAvailableHookSkills();
      setAvailable(data.available);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchAvailable();
  }, [fetchAvailable]);

  const lowerSearch = search.toLowerCase();
  const filtered = lowerSearch
    ? available.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerSearch) ||
          s.displayName.toLowerCase().includes(lowerSearch) ||
          s.description.toLowerCase().includes(lowerSearch),
      )
    : available;

  const canImport = !showConditionInput || condition.trim();

  return (
    <div className={`rounded-xl border border-white/[0.06] ${settings.card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-medium ${text.primary}`}>Add skill</span>
        <button onClick={onClose} className={`p-1 ${text.dimmed} hover:text-white`}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Condition input for custom hooks */}
      {showConditionInput && (
        <textarea
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="When should agents run this? (e.g. &quot;When changes touch database models or migrations&quot;)"
          rows={2}
          className={`w-full px-3 py-2 mb-3 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-white placeholder-[#4b5563] focus:outline-none focus:border-white/[0.15] resize-none`}
          autoFocus
        />
      )}

      {/* Search input */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search skills..."
        className={`w-full px-3 py-2 mb-3 rounded-lg text-xs bg-white/[0.04] border border-white/[0.06] text-white placeholder-[#4b5563] focus:outline-none focus:border-white/[0.15]`}
        autoFocus={!showConditionInput}
      />

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <p className={`text-[11px] ${text.muted} text-center py-4`}>
          {search ? 'No skills match your search.' : 'No additional skills available in the registry.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((skill) => (
            <button
              key={skill.name}
              onClick={() => canImport && onImport(skill.name, condition.trim() || undefined)}
              disabled={!canImport}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${canImport ? 'hover:bg-white/[0.04]' : 'opacity-40 cursor-not-allowed'}`}
            >
              <span className={`text-xs font-medium ${text.secondary}`}>{skill.displayName}</span>
              {skill.description && (
                <p className={`text-[10px] ${text.muted} mt-0.5`}>{skill.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
