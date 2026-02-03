/**
 * Centralized theme configuration.
 *
 * All color values used across the UI live here so you can tweak
 * the entire look from a single file.  Values are Tailwind class
 * fragments — they get interpolated into className strings.
 */

// ─── Surface / Layout ────────────────────────────────────────────
export const surface = {
  /** Page background (visible between panels & behind header) */
  page:            'bg-gray-900',
  /** Both panels (sidebar + detail) */
  panel:           'bg-[#0d1117]',
  /** Selected sidebar item — darker than panel */
  panelSelected:   'bg-[#080b10]',
  /** Sidebar item hover */
  panelHover:      'bg-white/[0.03]',
  /** Inline editable text hover */
  editableHover:   'bg-gray-800/50',
  /** Modal overlay */
  overlay:         'bg-black/60',
  /** Modal card */
  modal:           'bg-gray-800',
} as const;

// ─── Borders ─────────────────────────────────────────────────────
export const border = {
  /** Default subtle divider inside panels */
  subtle:          'border-white/[0.06]',
  /** Panel section dividers (toolbar, header rows) */
  section:         'border-gray-800',
  /** Modal border */
  modal:           'border-gray-700',
  /** Input borders */
  input:           'border-white/[0.06]',
  /** Selected sidebar accent */
  accent:          'border-blue-500',
  /** Focus ring on inputs */
  focusPrimary:    'border-blue-500',
  focusCommit:     'border-orange-500',
  focusPr:         'border-purple-500',
} as const;

// ─── Input fields ────────────────────────────────────────────────
export const input = {
  bg:              'bg-white/[0.04]',
  /** Inputs inside detail panel (edit mode, commit, PR) */
  bgDetail:        'bg-gray-900',
  text:            'text-white',
  placeholder:     'placeholder-gray-600',
  ring:            'ring-blue-500/50',
  ringCommit:      'ring-orange-500/50',
  ringPr:          'ring-purple-500/50',
} as const;

// ─── Text hierarchy ──────────────────────────────────────────────
export const text = {
  primary:         'text-white',
  secondary:       'text-gray-400',
  muted:           'text-gray-500',
  dimmed:          'text-gray-600',
  body:            'text-gray-100',
  error:           'text-red-400',
  errorBanner:     'text-red-300',
} as const;

// ─── Status indicators ──────────────────────────────────────────
export const status = {
  running: {
    dot:           'bg-green-500',
    glow:          'shadow-[0_0_6px_rgba(74,222,128,0.5)]',
    badge:         'text-green-400 bg-green-900/30',
  },
  stopped: {
    dot:           'bg-gray-600',
    badge:         'text-gray-400 bg-gray-800',
  },
  creating: {
    dot:           'bg-yellow-500',
    badge:         'text-yellow-400 bg-yellow-900/30',
  },
  deleting: {
    dot:           'bg-red-500',
  },
  uncommitted: {
    dot:           'bg-orange-400',
  },
} as const;

// ─── Action buttons (ghost style) ───────────────────────────────
export const action = {
  start: {
    text:          'text-green-400',
    hover:         'hover:bg-green-900/30',
  },
  stop: {
    text:          'text-red-400',
    hover:         'hover:bg-red-900/30',
  },
  delete: {
    text:          'text-red-400',
    hover:         'hover:bg-red-900/30',
  },
  commit: {
    text:          'text-orange-400',
    textActive:    'text-orange-300',
    hover:         'hover:bg-orange-900/30',
    bgActive:      'bg-orange-900/40',
    bgSubmit:      'bg-orange-900/30',
    bgSubmitHover: 'hover:bg-orange-900/50',
  },
  push: {
    text:          'text-cyan-400',
    hover:         'hover:bg-cyan-900/30',
  },
  pr: {
    text:          'text-purple-400',
    textActive:    'text-purple-300',
    hover:         'hover:bg-purple-900/30',
    bgActive:      'bg-purple-900/40',
    bgSubmit:      'bg-purple-900/30',
    bgSubmitHover: 'hover:bg-purple-900/50',
  },
  rename: {
    text:          'text-gray-400',
    hover:         'hover:bg-gray-700',
  },
  cancel: {
    text:          'text-gray-500',
    textHover:     'hover:text-gray-300',
  },
} as const;

// ─── Primary button ─────────────────────────────────────────────
export const button = {
  primary:         'bg-blue-600 text-white hover:bg-blue-700',
  secondary:       'bg-gray-700 text-gray-300 hover:bg-gray-600',
  confirm:         'text-red-400 bg-red-900/30 hover:bg-red-900/50',
} as const;

// ─── Tabs (create form Branch / Jira) ───────────────────────────
export const tab = {
  active:          'text-white bg-white/[0.08]',
  inactive:        'text-gray-500 hover:text-gray-300',
} as const;

// ─── Integration badges ─────────────────────────────────────────
export const badge = {
  running:         'bg-blue-600 text-white',
  jira:            'text-blue-400',
  jiraHover:       'hover:text-blue-300',
  jiraStatus:      'bg-blue-900/30',
  prOpen:          'text-green-400 bg-green-900/30',
  prDraft:         'text-gray-300 bg-gray-700',
  prMerged:        'text-purple-400 bg-purple-900/30',
  prClosed:        'text-red-400 bg-red-900/30',
  unpushed:        'text-cyan-400',
} as const;

// ─── Header bar ─────────────────────────────────────────────────
export const header = {
  bg:              'bg-gray-900',
  ports:           'text-gray-600',
  portsDiscover:   'text-yellow-400 hover:text-yellow-300',
  rescan:          'text-gray-500 hover:text-gray-300',
  connection:      'text-gray-500',
  connectedDot:    'bg-green-500',
  disconnectedDot: 'bg-gray-500',
} as const;

// ─── Navigation bar ─────────────────────────────────────────────
export const nav = {
  bg:              'bg-gray-900',
  active:          'text-white bg-white/[0.08]',
  inactive:        'text-gray-500 hover:text-gray-300',
} as const;

// ─── Settings / Configuration ───────────────────────────────────
export const settings = {
  label:           'text-gray-300',
  description:     'text-gray-500',
  card:            'bg-white/[0.03]',
} as const;

// ─── Jira priority / type ────────────────────────────────────────
export const jiraPriority: Record<string, string> = {
  highest: 'text-red-500',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-green-400',
  lowest: 'text-blue-400',
};

export const jiraType: Record<string, string> = {
  bug: 'text-red-400 bg-red-900/30',
  story: 'text-green-400 bg-green-900/30',
  task: 'text-blue-400 bg-blue-900/30',
  subtask: 'text-gray-400 bg-gray-800',
  epic: 'text-purple-400 bg-purple-900/30',
};

// ─── Error banner ────────────────────────────────────────────────
export const errorBanner = {
  bg:              'bg-red-900/30',
  panelBg:         'bg-red-900/20',
  border:          'border-red-900/30',
} as const;
