import { useCallback, useEffect, useRef, useState } from 'react';
import { Columns2, Copy, ListChecks, Rows2, Sparkles } from 'lucide-react';

import { useNotes } from '../../hooks/useNotes';
import { notes as notesTheme, text } from '../../theme';
import { MarkdownContent } from '../MarkdownContent';
import { Tooltip } from '../Tooltip';
import { TodoList } from './TodoList';
import type { GitPolicyOverride } from '../../hooks/api';

interface NotesSectionProps {
  source: 'jira' | 'linear' | 'local';
  issueId: string;
}

type Tab = 'personal' | 'aiContext';
type Layout = 'tabs' | 'side-by-side';

const LAYOUT_KEY = 'work3:notes-layout';

function getPersistedLayout(): Layout {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    if (v === 'side-by-side') return 'side-by-side';
  } catch { /* ignore */ }
  return 'tabs';
}

export function NotesSection({ source, issueId }: NotesSectionProps) {
  const { notes, updateSection, addTodo, toggleTodo, deleteTodo, updateTodoText, updateGitPolicy } = useNotes(source, issueId);
  const [activeTab, setActiveTab] = useState<Tab>('aiContext');
  const [layout, setLayout] = useState<Layout>(getPersistedLayout);

  const toggleLayout = () => {
    const next: Layout = layout === 'tabs' ? 'side-by-side' : 'tabs';
    setLayout(next);
    try { localStorage.setItem(LAYOUT_KEY, next); } catch { /* ignore */ }
  };

  const personalContent = notes?.personal?.content ?? '';
  const aiContent = notes?.aiContext?.content ?? '';
  const todos = notes?.todos ?? [];

  const gitPolicy = notes?.gitPolicy;

  return (
    <section>
      {/* Header row: label + tabs + layout toggle */}
      <div className="flex items-center gap-3 mb-3">
        <h3 className={`text-[11px] font-medium ${text.muted}`}>Notes</h3>

        {layout === 'tabs' && (
          <div className="flex gap-0.5 bg-white/[0.04] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('aiContext')}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                activeTab === 'aiContext' ? `${notesTheme.tabActive} ${notesTheme.aiIcon}` : notesTheme.tabInactive
              }`}
            >
              Agents
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('personal')}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                activeTab === 'personal' ? notesTheme.tabActive : notesTheme.tabInactive
              }`}
            >
              Personal
            </button>
          </div>
        )}

        <Tooltip text={layout === 'tabs' ? 'Split side by side' : 'Show as tabs'} position="left">
          <button
            type="button"
            onClick={toggleLayout}
            className={`ml-auto p-1 rounded ${text.dimmed} hover:${text.muted} transition-colors`}
          >
            {layout === 'tabs' ? <Columns2 className="w-3.5 h-3.5" /> : <Rows2 className="w-3.5 h-3.5" />}
          </button>
        </Tooltip>
      </div>

      {/* Content */}
      {layout === 'tabs' ? (
        activeTab === 'aiContext' ? (
          <AiContextCard
            source={source}
            issueId={issueId}
            aiContent={aiContent}
            todos={todos}
            updateSection={updateSection}
            addTodo={addTodo}
            toggleTodo={toggleTodo}
            deleteTodo={deleteTodo}
            updateTodoText={updateTodoText}
            gitPolicy={gitPolicy}
            updateGitPolicy={updateGitPolicy}
          />
        ) : (
          <NotePane
            key={`${source}-${issueId}-personal`}
            content={personalContent}
            section="personal"
            updateSection={updateSection}
            onMoveToAiContext={(selectedText) => {
              const appended = aiContent ? `${aiContent}\n\n${selectedText}` : selectedText;
              updateSection('aiContext', appended);
            }}
            onAddTodo={addTodo}
            placeholder="Personal notes about this issue..."
            emptyText="Click to add personal notes..."
            accentBg={notesTheme.personalAccent}
            accentBorder={notesTheme.personalBorder}
          />
        )
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <span className={`text-[10px] font-medium ${text.dimmed} block mb-1.5`}>Agents</span>
            <AiContextCard
              source={source}
              issueId={issueId}
              aiContent={aiContent}
              todos={todos}
              updateSection={updateSection}
              addTodo={addTodo}
              toggleTodo={toggleTodo}
              deleteTodo={deleteTodo}
              updateTodoText={updateTodoText}
              gitPolicy={gitPolicy}
              updateGitPolicy={updateGitPolicy}
              stretch
            />
          </div>
          <div className="flex flex-col">
            <span className={`text-[10px] font-medium ${text.dimmed} block mb-1.5`}>Personal</span>
            <NotePane
              key={`${source}-${issueId}-personal`}
              content={personalContent}
              section="personal"
              updateSection={updateSection}
              onMoveToAiContext={(selectedText) => {
                const appended = aiContent ? `${aiContent}\n\n${selectedText}` : selectedText;
                updateSection('aiContext', appended);
              }}
              onAddTodo={addTodo}
              placeholder="Personal notes about this issue..."
              emptyText="Click to add personal notes..."
              accentBg={notesTheme.personalAccent}
              accentBorder={notesTheme.personalBorder}
              stretch
            />
          </div>
        </div>
      )}
    </section>
  );
}

// ─── AI Context card (todos + directions in one container) ──────

const POLICY_OPTIONS: { value: GitPolicyOverride; label: string }[] = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'allow', label: 'Allow' },
  { value: 'deny', label: 'Deny' },
];

function AiContextCard({
  source,
  issueId,
  aiContent,
  todos,
  updateSection,
  addTodo,
  toggleTodo,
  deleteTodo,
  updateTodoText,
  gitPolicy,
  updateGitPolicy,
  stretch,
}: {
  source: string;
  issueId: string;
  aiContent: string;
  todos: Array<{ id: string; text: string; checked: boolean; createdAt: string }>;
  updateSection: (section: 'personal' | 'aiContext', content: string) => Promise<unknown>;
  addTodo: (text: string) => void;
  toggleTodo: (todoId: string) => void;
  deleteTodo: (todoId: string) => void;
  updateTodoText: (todoId: string, text: string) => void;
  gitPolicy?: { agentCommits?: GitPolicyOverride; agentPushes?: GitPolicyOverride; agentPRs?: GitPolicyOverride };
  updateGitPolicy: (policy: { agentCommits?: GitPolicyOverride; agentPushes?: GitPolicyOverride; agentPRs?: GitPolicyOverride }) => void;
  stretch?: boolean;
}) {
  const operations = [
    { key: 'agentCommits' as const, label: 'Commits' },
    { key: 'agentPushes' as const, label: 'Pushes' },
    { key: 'agentPRs' as const, label: 'PRs' },
  ];

  return (
    <div className={`rounded-lg ${notesTheme.aiAccent} border ${notesTheme.aiBorder} overflow-hidden ${stretch ? 'flex-1' : ''}`}>
      {/* Directions */}
      <DirectionsPane
        key={`${source}-${issueId}-aiContext`}
        content={aiContent}
        updateSection={updateSection}
      />

      {/* Divider */}
      <div className="mx-4 border-t border-white/[0.04]" />

      {/* Todos */}
      <div className="px-4 pt-1 pb-3">
        <TodoList
          todos={todos}
          onAdd={addTodo}
          onToggle={toggleTodo}
          onDelete={deleteTodo}
          onUpdate={updateTodoText}
        />
      </div>

      {/* Git Policy */}
      <div className="mx-4 border-t border-white/[0.04]" />
      <div className="px-4 py-3">
        <span className={`text-[10px] font-medium ${text.dimmed} block mb-2`}>Git Policy</span>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {operations.map((op) => {
            const value: GitPolicyOverride = gitPolicy?.[op.key] ?? 'inherit';
            return (
              <div key={op.key} className="flex items-center gap-1.5">
                <span className={`text-[10px] ${text.muted} w-12`}>{op.label}</span>
                <div className="flex gap-0.5 bg-white/[0.04] rounded-md p-0.5">
                  {POLICY_OPTIONS.map((opt) => {
                    let selectedStyle = 'text-[#4b5563] hover:text-[#6b7280]';
                    if (value === opt.value) {
                      if (opt.value === 'allow') selectedStyle = 'bg-teal-500/[0.15] text-teal-300';
                      else if (opt.value === 'deny') selectedStyle = 'bg-red-500/[0.15] text-red-300';
                      else selectedStyle = 'bg-white/[0.10] text-[#e0e2e5]';
                    }
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateGitPolicy({ [op.key]: opt.value })}
                        className={`px-1.5 py-0.5 text-[9px] font-medium rounded transition-colors ${selectedStyle}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Directions pane (inline in the AI Context card) ──────────────

function DirectionsPane({
  content,
  updateSection,
}: {
  content: string;
  updateSection: (section: 'personal' | 'aiContext', content: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef('');

  const flushSave = useCallback((value: string) => {
    if (value !== lastSaved.current) {
      lastSaved.current = value;
      updateSection('aiContext', value);
    }
  }, [updateSection]);

  const scheduleSave = useCallback((value: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushSave(value), 600);
  }, [flushSave]);

  const finishEditing = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flushSave(draft);
    setEditing(false);
  }, [draft, flushSave]);

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 56) + 'px';
    el.focus();
  }, []);

  const startEdit = () => {
    setDraft(content);
    lastSaved.current = content;
    setEditing(true);
  };

  if (editing) {
    return (
      <div className="px-4 pb-3 pt-2">
        <textarea
          ref={autoResize}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            scheduleSave(e.target.value);
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = Math.max(textareaRef.current.scrollHeight, 56) + 'px';
            }
          }}
          onBlur={finishEditing}
          onKeyDown={(e) => { if (e.key === 'Escape') finishEditing(); }}
          placeholder="Directions for AI agents..."
          className={`w-full bg-transparent text-xs ${text.primary} focus:outline-none resize-none placeholder-[#3b4049] leading-relaxed`}
          style={{ minHeight: 56 }}
        />
      </div>
    );
  }

  return (
    <div
      className="px-4 pb-3 pt-2 cursor-pointer hover:bg-white/[0.01] transition-colors"
      onClick={startEdit}
    >
      {content ? (
        <MarkdownContent content={content} />
      ) : (
        <p className={`text-xs ${notesTheme.emptyText} italic`}>Click to add directions for AI agents...</p>
      )}
    </div>
  );
}

// ─── Selection menu (appears on text selection in personal notes) ───

function SelectionMenu({
  position,
  onCopy,
  onMoveToAiContext,
  onAddTodo,
}: {
  position: { x: number; y: number };
  onCopy: () => void;
  onMoveToAiContext: () => void;
  onAddTodo: () => void;
}) {
  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-[#1e2028] border border-white/[0.1] shadow-xl shadow-black/40"
      style={{ left: position.x, top: position.y }}
    >
      <Tooltip text="Copy" position="top">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onCopy(); }}
          className={`p-1.5 rounded-md ${text.dimmed} hover:${text.primary} hover:bg-white/[0.06] transition-colors`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip text="Move to AI context" position="top">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onMoveToAiContext(); }}
          className={`p-1.5 rounded-md ${text.dimmed} hover:text-purple-400 hover:bg-purple-400/[0.08] transition-colors`}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
      <Tooltip text="Add to AI todos" position="top">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onAddTodo(); }}
          className={`p-1.5 rounded-md ${text.dimmed} hover:text-teal-400 hover:bg-teal-400/[0.08] transition-colors`}
        >
          <ListChecks className="w-3.5 h-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}

// ─── Personal note pane (standalone card) ──────────────────────

function NotePane({
  content,
  section,
  updateSection,
  onMoveToAiContext,
  onAddTodo,
  placeholder,
  emptyText,
  accentBg,
  accentBorder,
  stretch,
}: {
  content: string;
  section: Tab;
  updateSection: (section: Tab, content: string) => Promise<unknown>;
  onMoveToAiContext?: (selectedText: string) => void;
  onAddTodo?: (text: string) => void;
  placeholder: string;
  emptyText: string;
  accentBg: string;
  accentBorder: string;
  stretch?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef('');
  const [selectionMenu, setSelectionMenu] = useState<{ x: number; y: number; text: string } | null>(null);

  const flushSave = useCallback((value: string) => {
    if (value !== lastSaved.current) {
      lastSaved.current = value;
      updateSection(section, value);
    }
  }, [updateSection, section]);

  const scheduleSave = useCallback((value: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flushSave(value), 600);
  }, [flushSave]);

  const finishEditing = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flushSave(draft);
    setEditing(false);
  }, [draft, flushSave]);

  useEffect(() => {
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, []);

  // Detect text selection inside the note pane
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !containerRef.current) {
        setSelectionMenu(null);
        return;
      }

      // Only show menu if selection is inside this pane
      const anchorNode = sel.anchorNode;
      if (!anchorNode || !containerRef.current.contains(anchorNode)) {
        setSelectionMenu(null);
        return;
      }

      const selectedText = sel.toString().trim();
      if (!selectedText) {
        setSelectionMenu(null);
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionMenu({
        x: rect.left + rect.width / 2 - 52,
        y: rect.top - 38,
        text: selectedText,
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    setSelectionMenu(null);
  };

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 80) + 'px';
    el.focus();
  }, []);

  const startEdit = () => {
    setDraft(content);
    lastSaved.current = content;
    setEditing(true);
  };

  const stretchClass = stretch ? 'flex-1 flex flex-col' : '';

  if (editing) {
    return (
      <div ref={containerRef} className={stretchClass}>
        <textarea
          ref={autoResize}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            scheduleSave(e.target.value);
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = Math.max(textareaRef.current.scrollHeight, 80) + 'px';
            }
          }}
          onBlur={finishEditing}
          onKeyDown={(e) => { if (e.key === 'Escape') finishEditing(); }}
          placeholder={placeholder}
          className={`w-full px-4 py-3 ${accentBg} border ${accentBorder} rounded-lg text-xs ${text.primary} focus:outline-none resize-none placeholder-[#4b5563] ${stretch ? 'flex-1' : ''}`}
          style={{ minHeight: 80 }}
        />

        {selectionMenu && (onMoveToAiContext || onAddTodo) && (
          <SelectionMenu
            position={selectionMenu}
            onCopy={() => {
              navigator.clipboard.writeText(selectionMenu.text);
              clearSelection();
            }}
            onMoveToAiContext={() => {
              onMoveToAiContext?.(selectionMenu.text);
              clearSelection();
            }}
            onAddTodo={() => {
              onAddTodo?.(selectionMenu.text);
              clearSelection();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={stretchClass}>
      <div
        className={`rounded-lg ${accentBg} border ${accentBorder} px-4 py-3 cursor-pointer hover:border-white/[0.08] transition-colors min-h-[60px] ${stretch ? 'flex-1' : ''}`}
        onClick={() => {
          // Don't enter edit mode if user is selecting text
          const sel = window.getSelection();
          if (sel && !sel.isCollapsed) return;
          startEdit();
        }}
      >
        {content ? (
          <MarkdownContent content={content} />
        ) : (
          <p className={`text-xs ${notesTheme.emptyText} italic`}>{emptyText}</p>
        )}
      </div>

      {selectionMenu && (onMoveToAiContext || onAddTodo) && (
        <SelectionMenu
          position={selectionMenu}
          onCopy={() => {
            navigator.clipboard.writeText(selectionMenu.text);
            clearSelection();
          }}
          onMoveToAiContext={() => {
            onMoveToAiContext?.(selectionMenu.text);
            clearSelection();
          }}
          onAddTodo={() => {
            onAddTodo?.(selectionMenu.text);
            clearSelection();
          }}
        />
      )}
    </div>
  );
}
