import { useState } from 'react';
import { GitCommit } from 'lucide-react';

import { input, text } from '../theme';
import { Button } from './Button';
import { Modal } from './Modal';

interface SetupCommitModalProps {
  onCommit: (message: string) => Promise<void>;
  onSkip: () => void;
}

export function SetupCommitModal({ onCommit, onSkip }: SetupCommitModalProps) {
  const [message, setMessage] = useState('chore: add wok3 configuration');
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCommit = async () => {
    if (!message.trim()) return;
    setIsCommitting(true);
    setError(null);
    try {
      await onCommit(message.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to commit');
      setIsCommitting(false);
    }
  };

  const inputClass = `w-full px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/[0.06] ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.05] focus:border-white/[0.12] transition-all text-xs`;

  return (
    <Modal
      title="Commit Configuration"
      icon={<GitCommit className="w-5 h-5 text-[#9ca3af]" />}
      onClose={onSkip}
      footer={
        <>
          <Button onClick={onSkip} disabled={isCommitting}>
            Later
          </Button>
          <Button
            onClick={handleCommit}
            variant="primary"
            disabled={!message.trim()}
            loading={isCommitting}
          >
            Commit
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className={`text-xs ${text.secondary} leading-relaxed`}>
          Configuration files need to be committed for worktrees to work properly.
        </p>

        <div>
          <label className={`block text-xs font-medium ${text.muted} mb-1.5`}>
            Commit message
          </label>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={inputClass}
            placeholder="Enter commit message..."
            disabled={isCommitting}
          />
        </div>

        <div className={`text-[11px] ${text.dimmed}`}>
          <p className="mb-1">Files to commit:</p>
          <p className="font-mono text-[10px]">.wok3/config.json, .wok3/.gitignore</p>
        </div>

        {error && <p className={`text-[11px] ${text.error}`}>{error}</p>}
      </div>
    </Modal>
  );
}
