import { nav } from '../theme';

export type View = 'workspace' | 'configuration' | 'integrations';

const tabs: { id: View; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'integrations', label: 'Integrations' },
];

export function NavBar({
  activeView,
  onChangeView,
}: {
  activeView: View;
  onChangeView: (view: View) => void;
}) {
  return (
    <div className={`flex-shrink-0 flex gap-1 px-4 py-1.5 ${nav.bg}`}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChangeView(t.id)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeView === t.id ? nav.active : nav.inactive
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
