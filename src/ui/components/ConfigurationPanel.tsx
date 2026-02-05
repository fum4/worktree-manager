import { useEffect, useState } from 'react';

import { saveConfig, type WorktreeConfig } from '../hooks/useConfig';
import { discoverPorts } from '../hooks/api';
import { border, button, input, settings, surface, text } from '../theme';

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={`text-xs font-medium ${settings.label}`}>{label}</label>
      {description && (
        <span className={`text-[11px] ${settings.description}`}>{description}</span>
      )}
      {children}
    </div>
  );
}

const fieldInputBase = `px-2.5 py-1.5 rounded-md text-xs bg-white/[0.04] border border-accent/0 ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.06] focus:border-accent/30 transition-all duration-150`;
const fieldInputClass = `w-full ${fieldInputBase}`;

function TextInput({
  value,
  onChange,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={fieldInputClass}
    />
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      className={fieldInputClass}
    />
  );
}

function EnvMappingEditor({
  mapping,
  onChange,
}: {
  mapping: Record<string, string>;
  onChange: (m: Record<string, string>) => void;
}) {
  const entries = Object.entries(mapping);

  const updateKey = (oldKey: string, newKey: string) => {
    const updated: Record<string, string> = {};
    for (const [k, v] of Object.entries(mapping)) {
      updated[k === oldKey ? newKey : k] = v;
    }
    onChange(updated);
  };

  const updateValue = (key: string, value: string) => {
    onChange({ ...mapping, [key]: value });
  };

  const addRow = () => {
    onChange({ ...mapping, '': '' });
  };

  const removeRow = (key: string) => {
    const updated = { ...mapping };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {entries.map(([key, value], i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <input
            value={key}
            onChange={(e) => updateKey(key, e.target.value)}
            placeholder="ENV_VAR"
            className={`flex-1 ${fieldInputBase}`}
          />
          <span className={`text-xs ${text.muted}`}>=</span>
          <input
            value={value}
            onChange={(e) => updateValue(key, e.target.value)}
            placeholder="http://localhost:${4000}"
            className={`flex-[2] ${fieldInputBase}`}
          />
          <button
            onClick={() => removeRow(key)}
            className={`text-xs ${text.muted} hover:text-red-400 px-1 transition-colors duration-150`}
          >
            x
          </button>
        </div>
      ))}
      <button
        onClick={addRow}
        className={`text-xs ${text.muted} hover:text-[#9ca3af] text-left transition-colors duration-150`}
      >
        + Add mapping
      </button>
    </div>
  );
}

export function ConfigurationPanel({
  config,
  onSaved,
}: {
  config: WorktreeConfig | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<WorktreeConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({ ...config, envMapping: { ...(config.envMapping ?? {}) } });
    }
  }, [config]);

  if (!form) {
    return (
      <div className={`flex-1 flex items-center justify-center ${text.muted} text-sm`}>
        Loading configuration...
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    const result = await saveConfig(form);
    setSaving(false);
    if (result.success) {
      setFeedback({ type: 'success', message: 'Configuration saved' });
      onSaved();
    } else {
      setFeedback({ type: 'error', message: result.error ?? 'Failed to save' });
    }
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    const result = await discoverPorts();
    setDiscovering(false);
    if (result.success && result.ports.length > 0) {
      setForm({
        ...form,
        ports: { ...form.ports, discovered: result.ports },
      });
    }
  };

  return (
    <div className={`flex-1 ${surface.panel} rounded-xl overflow-auto`}>
      <div className="max-w-2xl mx-auto p-6 flex flex-col gap-6">
        <h2 className={`text-sm font-semibold ${text.primary}`}>Settings</h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Command" description="Command to start dev server">
            <TextInput
              value={form.startCommand}
              onChange={(v) => setForm({ ...form, startCommand: v })}
            />
          </Field>
          <Field label="Install Command" description="Command to install dependencies">
            <TextInput
              value={form.installCommand}
              onChange={(v) => setForm({ ...form, installCommand: v })}
            />
          </Field>
          <Field label="Base Branch" description="Branch to create worktrees from">
            <TextInput
              value={form.baseBranch}
              onChange={(v) => setForm({ ...form, baseBranch: v })}
            />
          </Field>
          <Field label="Project Directory" description="Subdirectory to cd into before running">
            <TextInput
              value={form.projectDir}
              onChange={(v) => setForm({ ...form, projectDir: v })}
            />
          </Field>
          <Field label="Worktrees Directory" description="Where worktrees are stored">
            <TextInput
              value={form.worktreesDir}
              onChange={(v) => setForm({ ...form, worktreesDir: v })}
            />
          </Field>
          <Field label="Server Port" description="Port for the wok3 manager server">
            <NumberInput
              value={form.serverPort}
              onChange={(v) => setForm({ ...form, serverPort: v })}
            />
          </Field>
          <Field label="Port Offset Step" description="Increment per worktree instance">
            <NumberInput
              value={form.ports.offsetStep}
              onChange={(v) =>
                setForm({ ...form, ports: { ...form.ports, offsetStep: v } })
              }
            />
          </Field>
        </div>

        <Field label="Discovered Ports" description="Ports detected from your dev server (read-only)">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${text.secondary}`}>
              {form.ports.discovered.length > 0
                ? form.ports.discovered.join(', ')
                : 'None discovered'}
            </span>
            <button
              onClick={handleDiscover}
              disabled={discovering}
              className={`text-xs px-2.5 py-1 rounded-md ${button.secondary} disabled:opacity-50 transition-colors duration-150`}
            >
              {discovering ? 'Discovering...' : 'Discover'}
            </button>
          </div>
        </Field>

        <Field label="Env Mapping" description="Environment variable templates with port references (e.g. http://localhost:${4000})">
          <EnvMappingEditor
            mapping={form.envMapping ?? {}}
            onChange={(m) => setForm({ ...form, envMapping: m })}
          />
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-xs font-medium ${button.primary} disabled:opacity-50 transition-colors duration-150 active:scale-[0.98]`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          {feedback && (
            <span
              className={`text-xs ${
                feedback.type === 'success' ? 'text-emerald-400' : text.error
              }`}
            >
              {feedback.message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
