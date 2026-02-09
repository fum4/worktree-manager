import { useCallback, useEffect, useRef, useState } from 'react';
import { Columns2, Rows2 } from 'lucide-react';

import { useNotes } from '../../hooks/useNotes';
import { notes as notesTheme, text } from '../../theme';
import { MarkdownContent } from '../MarkdownContent';
import { Tooltip } from '../Tooltip';

interface NotesSectionProps {
  source: 'jira' | 'linear' | 'local';
  issueId: string;
}

type Tab = 'personal' | 'aiContext';
type Layout = 'tabs' | 'side-by-side';

const LAYOUT_KEY = 'wok3:notes-layout';

function getPersistedLayout(): Layout {
  try {
    const v = localStorage.getItem(LAYOUT_KEY);
    if (v === 'side-by-side') return 'side-by-side';
  } catch { /* ignore */ }
  return 'tabs';
}

export function NotesSection({ source, issueId }: NotesSectionProps) {
  const { notes, updateSection } = useNotes(source, issueId);
  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [layout, setLayout] = useState<Layout>(getPersistedLayout);

  const toggleLayout = () => {
    const next: Layout = layout === 'tabs' ? 'side-by-side' : 'tabs';
    setLayout(next);
    try { localStorage.setItem(LAYOUT_KEY, next); } catch { /* ignore */ }
  };

  const personalContent = notes?.personal?.content ?? '';
  const aiContent = notes?.aiContext?.content ?? '';

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h3 className={`text-[11px] font-medium ${text.muted}`}>Notes</h3>

        {layout === 'tabs' && (
          <div className="flex gap-0.5 bg-white/[0.04] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('personal')}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                activeTab === 'personal' ? notesTheme.tabActive : notesTheme.tabInactive
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('aiContext')}
              className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
                activeTab === 'aiContext' ? `${notesTheme.tabActive} ${notesTheme.aiIcon}` : notesTheme.tabInactive
              }`}
            >
              AI Context
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

      {layout === 'tabs' ? (
        <NotePane
          key={`${source}-${issueId}-${activeTab}`}
          content={activeTab === 'personal' ? personalContent : aiContent}
          section={activeTab}
          updateSection={updateSection}
          placeholder={activeTab === 'aiContext' ? 'Directions for AI agents working on this issue...' : 'Personal notes about this issue...'}
          emptyText={activeTab === 'aiContext' ? 'Click to add AI context directions...' : 'Click to add personal notes...'}
          accentBg={activeTab === 'aiContext' ? notesTheme.aiAccent : notesTheme.personalAccent}
          accentBorder={activeTab === 'aiContext' ? notesTheme.aiBorder : notesTheme.personalBorder}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={`text-[10px] font-medium ${text.dimmed} block mb-1.5`}>Personal</span>
            <NotePane
              key={`${source}-${issueId}-personal`}
              content={personalContent}
              section="personal"
              updateSection={updateSection}
              placeholder="Personal notes about this issue..."
              emptyText="Click to add personal notes..."
              accentBg={notesTheme.personalAccent}
              accentBorder={notesTheme.personalBorder}
            />
          </div>
          <div>
            <span className={`text-[10px] font-medium ${text.dimmed} block mb-1.5`}>AI Context</span>
            <NotePane
              key={`${source}-${issueId}-aiContext`}
              content={aiContent}
              section="aiContext"
              updateSection={updateSection}
              placeholder="Directions for AI agents working on this issue..."
              emptyText="Click to add AI context directions..."
              accentBg={notesTheme.aiAccent}
              accentBorder={notesTheme.aiBorder}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Single note pane (used both in tabs and side-by-side) ───

function NotePane({
  content,
  section,
  updateSection,
  placeholder,
  emptyText,
  accentBg,
  accentBorder,
}: {
  content: string;
  section: Tab;
  updateSection: (section: Tab, content: string) => Promise<unknown>;
  placeholder: string;
  emptyText: string;
  accentBg: string;
  accentBorder: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef('');

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

  if (editing) {
    return (
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
        className={`w-full px-4 py-3 ${accentBg} border ${accentBorder} rounded-lg text-xs ${text.primary} focus:outline-none resize-none placeholder-[#4b5563]`}
        style={{ minHeight: 80 }}
      />
    );
  }

  return (
    <div
      className={`rounded-lg ${accentBg} border ${accentBorder} px-4 py-3 cursor-pointer hover:border-white/[0.08] transition-colors min-h-[60px]`}
      onClick={startEdit}
    >
      {content ? (
        <MarkdownContent content={content} />
      ) : (
        <p className={`text-xs ${notesTheme.emptyText} italic`}>{emptyText}</p>
      )}
    </div>
  );
}
