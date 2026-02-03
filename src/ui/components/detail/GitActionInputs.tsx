import { action, border, input, text } from '../../theme';

interface GitActionInputsProps {
  showCommitInput: boolean;
  showCreatePrInput: boolean;
  commitMessage: string;
  prTitle: string;
  isGitLoading: boolean;
  onCommitMessageChange: (value: string) => void;
  onPrTitleChange: (value: string) => void;
  onCommit: () => void;
  onCreatePr: () => void;
  onHideCommit: () => void;
  onHidePr: () => void;
}

export function GitActionInputs({
  showCommitInput,
  showCreatePrInput,
  commitMessage,
  prTitle,
  isGitLoading,
  onCommitMessageChange,
  onPrTitleChange,
  onCommit,
  onCreatePr,
  onHideCommit,
  onHidePr,
}: GitActionInputsProps) {
  return (
    <>
      {showCommitInput && (
        <div className={`flex-shrink-0 px-5 py-2 border-b ${border.section} flex items-center gap-2`}>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => onCommitMessageChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommit(); if (e.key === 'Escape') onHideCommit(); }}
            placeholder="Commit message..."
            className={`flex-1 px-2 py-1 ${input.bgDetail} border ${border.modal} rounded ${input.text} text-xs focus:outline-none focus:${border.focusCommit} focus-visible:ring-1 ${input.ringCommit}`}
            autoFocus
          />
          <button type="button" onClick={onCommit} disabled={isGitLoading || !commitMessage.trim()} className={`px-3 py-1 text-xs font-medium ${action.commit.text} ${action.commit.bgSubmit} rounded ${action.commit.bgSubmitHover} disabled:opacity-50 transition-colors`}>
            {isGitLoading ? 'Committing...' : 'Commit'}
          </button>
          <button type="button" onClick={onHideCommit} className={`px-2 py-1 text-xs ${action.cancel.text} ${action.cancel.textHover} transition-colors`}>
            Cancel
          </button>
        </div>
      )}

      {showCreatePrInput && (
        <div className={`flex-shrink-0 px-5 py-2 border-b ${border.section} flex items-center gap-2`}>
          <input
            type="text"
            value={prTitle}
            onChange={(e) => onPrTitleChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCreatePr(); if (e.key === 'Escape') onHidePr(); }}
            placeholder="PR title..."
            className={`flex-1 px-2 py-1 ${input.bgDetail} border ${border.modal} rounded ${input.text} text-xs focus:outline-none focus:${border.focusPr} focus-visible:ring-1 ${input.ringPr}`}
            autoFocus
          />
          <button type="button" onClick={onCreatePr} disabled={isGitLoading || !prTitle.trim()} className={`px-3 py-1 text-xs font-medium ${action.pr.text} ${action.pr.bgSubmit} rounded ${action.pr.bgSubmitHover} disabled:opacity-50 transition-colors`}>
            {isGitLoading ? 'Creating...' : 'Create PR'}
          </button>
          <button type="button" onClick={onHidePr} className={`px-2 py-1 text-xs ${action.cancel.text} ${action.cancel.textHover} transition-colors`}>
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
