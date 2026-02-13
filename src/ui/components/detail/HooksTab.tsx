import { Ban, CheckCircle, ChevronDown, CircleCheck, FishingHook, Hand, ListChecks, Loader2, MessageSquareText, Play, Sparkles, Terminal, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { HookSkillRef, HookStep, SkillHookResult, StepResult } from '../../hooks/api';
import { useApi } from '../../hooks/useApi';
import { useEffectiveHooksConfig, useHookSkillResults } from '../../hooks/useHooks';
import { button, settings, text } from '../../theme';

function statusIcon(status: StepResult['status']) {
  switch (status) {
    case 'passed': return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    case 'failed': return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'running': return <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />;
    case 'pending': return <div className="w-3.5 h-3.5 rounded-full border border-white/[0.15]" />;
  }
}

function SweepingBorder() {
  const rectStyle: React.CSSProperties = {
    x: 0.5, y: 0.5,
    width: 'calc(100% - 1px)',
    height: 'calc(100% - 1px)',
    animation: 'border-sweep 2s linear infinite',
  };
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ animation: 'border-sweep-fade 2s linear infinite' }}>
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.01)" strokeWidth="2" strokeDasharray="45 55" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.02)" strokeWidth="2" strokeDasharray="43 57" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.03)" strokeWidth="2" strokeDasharray="42 58" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.04)" strokeWidth="2" strokeDasharray="40 60" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.05)" strokeWidth="2" strokeDasharray="38 62" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.06)" strokeWidth="2" strokeDasharray="37 63" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.07)" strokeWidth="2" strokeDasharray="35 65" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.08)" strokeWidth="2" strokeDasharray="33 67" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.09)" strokeWidth="2" strokeDasharray="32 68" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.10)" strokeWidth="2" strokeDasharray="30 70" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.11)" strokeWidth="1.5" strokeDasharray="28 72" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.12)" strokeWidth="1.5" strokeDasharray="27 73" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.13)" strokeWidth="1.5" strokeDasharray="25 75" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.14)" strokeWidth="1.5" strokeDasharray="23 77" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.15)" strokeWidth="1.5" strokeDasharray="22 78" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.16)" strokeWidth="1.5" strokeDasharray="20 80" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.17)" strokeWidth="1.5" strokeDasharray="18 82" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.18)" strokeWidth="1.5" strokeDasharray="17 83" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.19)" strokeWidth="1.5" strokeDasharray="15 85" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.20)" strokeWidth="1.5" strokeDasharray="13 87" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.21)" strokeWidth="1" strokeDasharray="12 88" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.22)" strokeWidth="1" strokeDasharray="10 90" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.23)" strokeWidth="1" strokeDasharray="9 91" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.24)" strokeWidth="1" strokeDasharray="8 92" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.25)" strokeWidth="1" strokeDasharray="7 93" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.26)" strokeWidth="1" strokeDasharray="6 94" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.27)" strokeWidth="1" strokeDasharray="5 95" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.28)" strokeWidth="1" strokeDasharray="4 96" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.29)" strokeWidth="1" strokeDasharray="3 97" strokeLinecap="round" style={rectStyle} />
      <rect rx="7.5" pathLength="100" fill="none" stroke="rgba(45,212,191,0.30)" strokeWidth="1" strokeDasharray="2 98" strokeLinecap="round" style={rectStyle} />
    </svg>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface HooksTabProps {
  worktreeId: string;
  visible: boolean;
  hasLinkedIssue?: boolean;
  onNavigateToIssue?: () => void;
  onCreateTask?: () => void;
  onNavigateToHooks?: () => void;
}

export function HooksTab({ worktreeId, visible, hasLinkedIssue, onNavigateToIssue, onCreateTask, onNavigateToHooks }: HooksTabProps) {
  const api = useApi();
  const { config, refetch: refetchConfig } = useEffectiveHooksConfig(visible ? worktreeId : null);
  const { results: skillResults, refetch: refetchSkillResults } = useHookSkillResults(visible ? worktreeId : null);
  const [stepResults, setStepResults] = useState<Record<string, StepResult>>({});
  const [runningSteps, setRunningSteps] = useState<Set<string>>(new Set());
  const [runningAll, setRunningAll] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // Fetch latest status on mount / worktree change
  const fetchStatus = useCallback(async () => {
    const result = await api.fetchHooksStatus(worktreeId);
    if (result.status?.steps) {
      const map: Record<string, StepResult> = {};
      for (const step of result.status.steps) {
        map[step.stepId] = step;
      }
      setStepResults(map);
    }
  }, [api, worktreeId]);

  useEffect(() => {
    if (visible) {
      fetchStatus();
      refetchConfig();
      refetchSkillResults();
    }
  }, [visible, fetchStatus, refetchConfig, refetchSkillResults]);

  const handleRunAll = async () => {
    if (!config) return;
    setRunningAll(true);
    const postSteps = config.steps.filter((s) => s.enabled !== false && s.trigger !== 'on-demand');
    setRunningSteps(new Set(postSteps.map((s) => s.id)));
    // Clear previous results
    setStepResults({});
    try {
      const run = await api.runHooks(worktreeId);
      const map: Record<string, StepResult> = {};
      for (const step of run.steps) {
        map[step.stepId] = step;
      }
      setStepResults(map);
    } finally {
      setRunningAll(false);
      setRunningSteps(new Set());
    }
  };

  const handleRunSingle = async (stepId: string) => {
    setRunningSteps((prev) => new Set(prev).add(stepId));
    try {
      const result = await api.runHookStep(worktreeId, stepId);
      setStepResults((prev) => ({ ...prev, [stepId]: result }));
    } finally {
      setRunningSteps((prev) => {
        const next = new Set(prev);
        next.delete(stepId);
        return next;
      });
    }
  };

  if (!visible) return null;

  // Split steps by trigger (include disabled items)
  const preSteps = (config?.steps ?? []).filter((s) => s.trigger === 'pre-implementation');
  const postSteps = (config?.steps ?? []).filter((s) => s.trigger === 'post-implementation' || !s.trigger);
  const customSteps = (config?.steps ?? []).filter((s) => s.trigger === 'custom');
  const onDemandSteps = (config?.steps ?? []).filter((s) => s.trigger === 'on-demand');
  const preSkills = (config?.skills ?? []).filter((s) => s.trigger === 'pre-implementation');
  const postSkills = (config?.skills ?? []).filter((s) => s.trigger === 'post-implementation' || !s.trigger);
  const customSkills = (config?.skills ?? []).filter((s) => s.trigger === 'custom');
  const onDemandSkills = (config?.skills ?? []).filter((s) => s.trigger === 'on-demand');

  const hasPre = preSteps.length > 0 || preSkills.length > 0;
  const hasPost = postSteps.length > 0 || postSkills.length > 0;
  const hasCustom = customSteps.length > 0 || customSkills.length > 0;
  const hasOnDemand = onDemandSteps.length > 0 || onDemandSkills.length > 0;

  // Group custom items by condition
  const customGroups: Record<string, { steps: HookStep[]; skills: HookSkillRef[]; title?: string }> = {};
  for (const step of customSteps) {
    const key = step.condition ?? '';
    const g = (customGroups[key] ??= { steps: [], skills: [] });
    g.steps.push(step);
    if (step.conditionTitle) g.title = step.conditionTitle;
  }
  for (const skill of customSkills) {
    const key = skill.condition ?? '';
    const g = (customGroups[key] ??= { steps: [], skills: [] });
    g.skills.push(skill);
    if (skill.conditionTitle) g.title = skill.conditionTitle;
  }

  // Nothing configured at all
  if (!hasPre && !hasPost && !hasCustom && !hasOnDemand) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
        <FishingHook className="w-8 h-8 text-emerald-400/30" />
        <p className={`text-xs ${text.muted} text-center`}>
          No hook steps or skills configured.
          <br />
          Add them in the Hooks view to run checks on this worktree.
        </p>
      </div>
    );
  }

  // Build skill result map for quick lookup
  const skillResultMap = new Map<string, SkillHookResult>();
  for (const r of skillResults) {
    skillResultMap.set(r.skillName, r);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto pb-4">
      {/* On-Demand section */}
      {hasOnDemand && (
        <>
          <div className="flex items-center gap-2 px-4 pt-2 pb-3 mt-8">
            <Hand className="w-4 h-4 text-amber-400" />
            <span className={`text-xs ${text.primary}`}>On-Demand</span>
            <span className={`text-[10px] ${text.muted}`}>
              {onDemandSteps.length + onDemandSkills.length} item{(onDemandSteps.length + onDemandSkills.length) !== 1 ? 's' : ''}
            </span>
          </div>

          {onDemandSteps.length > 0 && (
            <StepList
              steps={onDemandSteps}
              stepResults={stepResults}
              runningSteps={runningSteps}
              runningAll={false}
              expandedStep={expandedStep}
              setExpandedStep={setExpandedStep}
              onRunSingle={handleRunSingle}
            />
          )}

          {onDemandSkills.length > 0 && (
            <SkillList
              skills={onDemandSkills}
              skillResultMap={skillResultMap}
              expandedSkill={expandedSkill}
              setExpandedSkill={setExpandedSkill}
            />
          )}
        </>
      )}

      {/* Pre-Implementation */}
      {hasPre && (
        <>
          <div className="flex items-center justify-between px-4 pt-2 pb-3 mt-8">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-sky-400" />
              <span className={`text-xs ${text.primary}`}>Pre-Implementation</span>
              <span className={`text-[10px] ${text.muted}`}>
                {preSteps.length + preSkills.length} item{(preSteps.length + preSkills.length) !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {preSteps.length > 0 && (
            <StepList
              steps={preSteps}
              stepResults={stepResults}
              runningSteps={runningSteps}
              runningAll={false}
              expandedStep={expandedStep}
              setExpandedStep={setExpandedStep}
              onRunSingle={handleRunSingle}
            />
          )}

          {preSkills.length > 0 && (
            <SkillList
              skills={preSkills}
              skillResultMap={skillResultMap}
              expandedSkill={expandedSkill}
              setExpandedSkill={setExpandedSkill}
            />
          )}
        </>
      )}

      {/* Post-Implementation */}
      {hasPost && (
        <>
          <div className="flex items-center justify-between px-4 pt-2 pb-3 mt-8">
            <div className="flex items-center gap-2">
              <CircleCheck className="w-4 h-4 text-emerald-400" />
              <span className={`text-xs ${text.primary}`}>Post-Implementation</span>
              <span className={`text-[10px] ${text.muted}`}>
                {postSteps.length + postSkills.length} item{(postSteps.length + postSkills.length) !== 1 ? 's' : ''}
              </span>
            </div>
            {postSteps.length > 0 && (
              <button
                onClick={handleRunAll}
                disabled={runningAll}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${button.primary} disabled:opacity-50`}
              >
                {runningAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {runningAll ? 'Running...' : 'Run All'}
              </button>
            )}
          </div>

          {postSteps.length > 0 && (
            <StepList
              steps={postSteps}
              stepResults={stepResults}
              runningSteps={runningSteps}
              runningAll={runningAll}
              expandedStep={expandedStep}
              setExpandedStep={setExpandedStep}
              onRunSingle={handleRunSingle}
            />
          )}

          {postSkills.length > 0 && (
            <SkillList
              skills={postSkills}
              skillResultMap={skillResultMap}
              expandedSkill={expandedSkill}
              setExpandedSkill={setExpandedSkill}
            />
          )}
        </>
      )}

      {/* Custom — grouped by condition */}
      {hasCustom && (
        <>
          <div className="flex items-center gap-2 px-4 pt-2 pb-3 mt-8">
            <MessageSquareText className="w-4 h-4 text-violet-400" />
            <span className={`text-xs ${text.primary}`}>Custom</span>
            <span className={`text-[10px] ${text.muted}`}>
              {customSteps.length + customSkills.length} item{(customSteps.length + customSkills.length) !== 1 ? 's' : ''}
            </span>
          </div>

          {Object.entries(customGroups).map(([condition, group]) => (
            <div key={condition} className="mb-3">
              {/* Group header */}
              <div className="px-4 pt-2 pb-3">
                {group.title && (
                  <p className="text-[11px] font-medium text-violet-300">{group.title}</p>
                )}
                <p className={`text-[10px] text-violet-400/60 italic ${group.title ? 'mt-0.5' : ''}`}>
                  {condition || 'No condition set'}
                </p>
              </div>

              {group.steps.length > 0 && (
                <StepList
                  steps={group.steps}
                  stepResults={stepResults}
                  runningSteps={runningSteps}
                  runningAll={false}
                  expandedStep={expandedStep}
                  setExpandedStep={setExpandedStep}
                  onRunSingle={handleRunSingle}
                />
              )}

              {group.skills.length > 0 && (
                <SkillList
                  skills={group.skills}
                  skillResultMap={skillResultMap}
                  expandedSkill={expandedSkill}
                  setExpandedSkill={setExpandedSkill}
                />
              )}
            </div>
          ))}
        </>
      )}

      </div>
      {/* Configure hooks footer */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-center gap-1 text-[11px] flex-wrap">
          {hasLinkedIssue && onNavigateToIssue ? (
            <>
              <button
                type="button"
                onClick={onNavigateToIssue}
                className={`font-medium ${text.muted} hover:text-white transition-colors inline-flex items-center gap-1`}
              >
                Configure hooks for this worktree
              </button>
              {onNavigateToHooks && (
                <>
                  <span className={text.dimmed}>or</span>
                  <button
                    type="button"
                    onClick={onNavigateToHooks}
                    className={`font-medium ${text.muted} hover:text-white transition-colors inline-flex items-center gap-1`}
                  >
                    configure globally
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <span className={text.dimmed}>
                {onCreateTask && (
                  <>
                    <button
                      type="button"
                      onClick={onCreateTask}
                      className={`font-medium ${text.muted} hover:text-white transition-colors`}
                    >
                      Create a task
                    </button>
                    {' to configure hooks, or '}
                  </>
                )}
              </span>
              {onNavigateToHooks && (
                <button
                  type="button"
                  onClick={onNavigateToHooks}
                  className={`font-medium ${text.muted} hover:text-white transition-colors inline-flex items-center gap-1`}
                >
                  configure globally
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StepList({
  steps,
  stepResults,
  runningSteps,
  runningAll,
  expandedStep,
  setExpandedStep,
  onRunSingle,
  nested,
}: {
  steps: HookStep[];
  stepResults: Record<string, StepResult>;
  runningSteps: Set<string>;
  runningAll: boolean;
  expandedStep: string | null;
  setExpandedStep: (id: string | null) => void;
  onRunSingle: (stepId: string) => void;
  nested?: boolean;
}) {
  return (
    <div className={`${nested ? 'px-2' : 'px-4'} py-[2.5px] space-y-[5px]`}>
      {steps.map((step) => {
        const disabled = step.enabled === false;
        const result = stepResults[step.id];
        const isRunning = runningSteps.has(step.id);
        const isExpanded = expandedStep === step.id;

        return (
          <div key={step.id} className={`relative rounded-lg border ${!result && !isRunning && !disabled ? 'border-dashed border-white/[0.08]' : 'border-white/[0.04]'} ${result || disabled ? settings.card : ''} overflow-visible ${disabled ? 'opacity-50' : ''}`}>
            {isRunning && <SweepingBorder />}
            <div className="flex items-center gap-2.5 px-3 py-2">
              {/* Type icon */}
              <Terminal className={`w-3.5 h-3.5 flex-shrink-0 ${disabled ? text.dimmed : text.muted}`} />

              <button
                className="flex-1 flex items-center text-left min-w-0"
                onClick={() => !disabled && result?.output && setExpandedStep(isExpanded ? null : step.id)}
              >
                <span className={`text-[11px] font-medium ${disabled ? text.dimmed : text.secondary}`}>{step.name}</span>
                <span className={`text-[10px] ${text.dimmed} ml-2 font-mono`}>{step.command}</span>
              </button>

              {!disabled && result?.durationMs != null && (
                <span className={`text-[9px] ${text.dimmed} flex-shrink-0`}>
                  {formatDuration(result.durationMs)}
                </span>
              )}

              {!disabled && result?.output && (
                <button onClick={() => setExpandedStep(isExpanded ? null : step.id)}>
                  <ChevronDown className={`w-3 h-3 ${text.dimmed} transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}

              {/* Status icon (right side, before run button) */}
              {disabled ? (
                <Ban className="w-3.5 h-3.5 text-white/[0.2] flex-shrink-0" />
              ) : isRunning ? (
                <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin flex-shrink-0" />
              ) : result ? (
                statusIcon(result.status)
              ) : null}

              {!disabled && !runningAll && (
                <button
                  onClick={() => onRunSingle(step.id)}
                  disabled={isRunning}
                  className="p-1 rounded text-teal-400 hover:text-teal-300 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <Play className="w-3 h-3" />
                </button>
              )}
            </div>

            {isExpanded && result?.output && (
              <div className="px-3 pb-3 pt-1 border-t border-white/[0.04]">
                <pre className={`text-[10px] ${text.muted} whitespace-pre-wrap break-words font-mono leading-relaxed max-h-60 overflow-y-auto`}>
                  {result.output}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkillList({
  skills,
  skillResultMap,
  expandedSkill,
  setExpandedSkill,
  nested,
}: {
  skills: Array<{ skillName: string; enabled: boolean }>;
  skillResultMap: Map<string, SkillHookResult>;
  expandedSkill: string | null;
  setExpandedSkill: (name: string | null) => void;
  nested?: boolean;
}) {
  return (
    <div className={`${nested ? 'px-2' : 'px-4'} py-[2.5px] space-y-[5px]`}>
      {skills.map((skill) => {
        const disabled = !skill.enabled;
        const result = skillResultMap.get(skill.skillName);
        const isExpanded = expandedSkill === skill.skillName;

        return (
          <div key={skill.skillName} className={`relative rounded-lg border ${!result && !disabled ? 'border-dashed border-white/[0.08]' : 'border-white/[0.04]'} ${result || disabled ? settings.card : ''} overflow-visible ${disabled ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-2.5 px-3 py-2">
              {/* Type icon */}
              <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 ${disabled ? text.dimmed : 'text-pink-400/70'}`} />

              <button
                className="flex-1 flex items-center text-left min-w-0"
                onClick={() => !disabled && result && setExpandedSkill(isExpanded ? null : skill.skillName)}
              >
                <span className={`text-[11px] font-medium ${disabled ? text.dimmed : text.secondary}`}>{skill.skillName}</span>
                {!disabled && result && (
                  <span className={`text-[10px] ${text.muted} ml-2`}>{result.summary}</span>
                )}
              </button>

              {/* Expand toggle */}
              {!disabled && result?.content && (
                <button onClick={() => setExpandedSkill(isExpanded ? null : skill.skillName)}>
                  <ChevronDown className={`w-3 h-3 ${text.dimmed} transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}

              {/* Status icon (right side) */}
              {disabled ? (
                <Ban className="w-3.5 h-3.5 text-white/[0.2] flex-shrink-0" />
              ) : result ? (
                result.success ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                )
              ) : null}
            </div>

            {/* Expanded content */}
            {isExpanded && result?.content && (
              <div className="px-3 pb-3 pt-1 border-t border-white/[0.04]">
                <pre className={`text-[10px] ${text.muted} whitespace-pre-wrap break-words font-mono leading-relaxed max-h-60 overflow-y-auto`}>
                  {result.content}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
