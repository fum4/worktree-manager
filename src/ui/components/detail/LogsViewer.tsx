import { useEffect, useRef } from 'react';

import type { WorktreeInfo } from '../../types';
import { text } from '../../theme';

interface LogsViewerProps {
  worktree: WorktreeInfo;
  isRunning: boolean;
  isCreating: boolean;
  visible?: boolean;
}

export function LogsViewer({ worktree, isRunning, isCreating, visible = true }: LogsViewerProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLPreElement>(null);
  const userScrolledUp = useRef(false);

  useEffect(() => {
    userScrolledUp.current = false;
  }, [worktree.id]);

  useEffect(() => {
    if (userScrolledUp.current) return;
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [worktree.logs]);

  const handleScroll = () => {
    const el = logsContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    userScrolledUp.current = !atBottom;
  };

  if (isRunning || isCreating) {
    return (
      <pre
        ref={logsContainerRef}
        onScroll={handleScroll}
        className={`flex-1 min-h-0 ${text.secondary} text-xs font-mono p-4 overflow-y-auto`}
        style={{ display: visible ? undefined : 'none' }}
      >
        {worktree.logs?.length ? worktree.logs.join('\n') : 'No logs yet.'}
        <div ref={logsEndRef} />
      </pre>
    );
  }

  return (
    <div
      className={`flex-1 flex items-center justify-center ${text.dimmed} text-xs`}
      style={{ display: visible ? undefined : 'none' }}
    >
      Start this worktree to see logs
    </div>
  );
}
