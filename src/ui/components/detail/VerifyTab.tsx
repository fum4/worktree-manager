import { CheckCircle, ChevronDown, Circle, CircleCheck, FishingHook, Hand, ListChecks, Loader2, Play, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { HookStep, SkillHookResult, StepResult } from '../../hooks/api';
import { useApi } from '../../hooks/useApi';
import { useHooksConfig, useHookSkillResults } from '../../hooks/useHooks';
import { button, settings, text, hooks as hooksTheme } from '../../theme';

function statusIcon(status: StepResult['status']) {
  switch (status) {
    case 'passed': return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    case 'failed': return <XCircle className="w-3.5 h-3.5 text-red-400" />;
    case 'running': return <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />;
    case 'pending': return <div className="w-3.5 h-3.5 rounded-full border border-white/[0.15]" />;
  }
}

function statusBadge(status: StepResult['status']) {
  switch (status) {
    case 'passed': return hooksTheme.passed;
    case 'failed': return hooksTheme.failed;
    case 'running': return hooksTheme.running;
    case 'pending': return hooksTheme.pending;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function HooksTab({ worktreeId, visible }: { worktreeId: string; visible: boolean }) {
  const api = useApi();
  const { config } = useHooksConfig();
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
      refetchSkillResults();
    }
  }, [visible, fetchStatus, refetchSkillResults]);

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

  // Split steps by trigger
  const preSteps = (config?.steps ?? []).filter((s) => s.enabled !== false && s.trigger === 'pre-implementation');
  const postSteps = (config?.steps ?? []).filter((s) => s.enabled !== false && (s.trigger === 'post-implementation' || !s.trigger));
  const onDemandSteps = (config?.steps ?? []).filter((s) => s.enabled !== false && s.trigger === 'on-demand');
  const preSkills = (config?.skills ?? []).filter((s) => s.enabled && s.trigger === 'pre-implementation');
  const postSkills = (config?.skills ?? []).filter((s) => s.enabled && (s.trigger === 'post-implementation' || !s.trigger));
  const onDemandSkills = (config?.skills ?? []).filter((s) => s.enabled && s.trigger === 'on-demand');

  const hasPre = preSteps.length > 0 || preSkills.length > 0;
  const hasPost = postSteps.length > 0 || postSkills.length > 0;
  const hasOnDemand = onDemandSteps.length > 0 || onDemandSkills.length > 0;

  // Nothing configured at all
  if (!hasPre && !hasPost && !hasOnDemand) {
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
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      {/* On-Demand section */}
      {hasOnDemand && (
        <>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
            <Hand className="w-4 h-4 text-amber-400" />
            <span className={`text-xs font-medium ${text.primary}`}>On-Demand</span>
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
              isOnDemand
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-sky-400" />
              <span className={`text-xs font-medium ${text.primary}`}>Pre-Implementation</span>
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <CircleCheck className="w-4 h-4 text-emerald-400" />
              <span className={`text-xs font-medium ${text.primary}`}>Post-Implementation</span>
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
  isOnDemand,
}: {
  steps: HookStep[];
  stepResults: Record<string, StepResult>;
  runningSteps: Set<string>;
  runningAll: boolean;
  expandedStep: string | null;
  setExpandedStep: (id: string | null) => void;
  onRunSingle: (stepId: string) => void;
  isOnDemand?: boolean;
}) {
  return (
    <div className="px-4 py-2 space-y-1.5">
      {steps.map((step) => {
        const result = stepResults[step.id];
        const isRunning = runningSteps.has(step.id);
        const isExpanded = expandedStep === step.id;

        return (
          <div key={step.id} className={`rounded-lg border border-white/[0.04] ${settings.card} overflow-hidden`}>
            <div className="flex items-center gap-2.5 px-3 py-2">
              {isRunning ? (
                <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
              ) : result ? (
                statusIcon(result.status)
              ) : (
                <Circle className="w-3.5 h-3.5 text-white/[0.12]" fill="currentColor" />
              )}

              <button
                className="flex-1 flex items-center text-left min-w-0"
                onClick={() => result?.output && setExpandedStep(isExpanded ? null : step.id)}
              >
                <span className={`text-[11px] font-medium ${text.secondary}`}>{step.name}</span>
                <span className={`text-[10px] ${text.dimmed} ml-2 font-mono`}>{step.command}</span>
              </button>

              {result?.durationMs != null && (
                <span className={`text-[9px] ${text.dimmed} flex-shrink-0`}>
                  {formatDuration(result.durationMs)}
                </span>
              )}

              {result && !isRunning && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusBadge(result.status)}`}>
                  {result.status}
                </span>
              )}

              {result?.output && (
                <button onClick={() => setExpandedStep(isExpanded ? null : step.id)}>
                  <ChevronDown className={`w-3 h-3 ${text.dimmed} transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}

              {!runningAll && (
                <button
                  onClick={() => onRunSingle(step.id)}
                  disabled={isRunning}
                  className={`p-1 rounded ${isOnDemand ? 'text-emerald-400 hover:text-emerald-300' : `${text.dimmed} hover:text-emerald-400`} transition-colors disabled:opacity-50 flex-shrink-0`}
                >
                  {isRunning ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
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
}: {
  skills: Array<{ skillName: string; enabled: boolean }>;
  skillResultMap: Map<string, SkillHookResult>;
  expandedSkill: string | null;
  setExpandedSkill: (name: string | null) => void;
}) {
  return (
    <div className="px-4 py-2 space-y-1.5">
      {skills.map((skill) => {
        const result = skillResultMap.get(skill.skillName);
        const isExpanded = expandedSkill === skill.skillName;

        return (
          <div key={skill.skillName} className={`rounded-lg border border-white/[0.04] ${settings.card} overflow-hidden`}>
            <div className="flex items-center gap-2.5 px-3 py-2">
              {/* Status */}
              {result ? (
                result.success ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                )
              ) : (
                <Circle className="w-3.5 h-3.5 text-white/[0.12]" fill="currentColor" />
              )}

              {/* Info */}
              <button
                className="flex-1 flex items-center text-left min-w-0"
                onClick={() => result && setExpandedSkill(isExpanded ? null : skill.skillName)}
              >
                <span className={`text-[11px] font-medium ${text.secondary}`}>{skill.skillName}</span>
                {result && (
                  <span className={`text-[10px] ${text.muted} ml-2`}>{result.summary}</span>
                )}
              </button>

              {/* Status badge */}
              {result && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${result.success ? hooksTheme.passed : hooksTheme.failed}`}>
                  {result.success ? 'passed' : 'failed'}
                </span>
              )}

              {/* Expand toggle */}
              {result?.content && (
                <button onClick={() => setExpandedSkill(isExpanded ? null : skill.skillName)}>
                  <ChevronDown className={`w-3 h-3 ${text.dimmed} transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              )}
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
