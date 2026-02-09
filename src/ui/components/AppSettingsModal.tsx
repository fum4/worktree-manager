import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';

import { DEFAULT_PORT } from '../../constants';
import { Modal } from './Modal';
import { input, settings, text } from '../theme';

interface AppSettingsModalProps {
  onClose: () => void;
}

export function AppSettingsModal({ onClose }: AppSettingsModalProps) {
  const [basePort, setBasePort] = useState(DEFAULT_PORT);
  const [setupPreference, setSetupPreference] = useState<'ask' | 'auto' | 'manual'>('ask');

  useEffect(() => {
    window.electronAPI?.getPreferences().then((prefs) => {
      setBasePort(prefs.basePort);
      setSetupPreference(prefs.setupPreference);
    });
  }, []);

  const handleBasePortChange = (value: number) => {
    setBasePort(value);
    window.electronAPI?.updatePreferences({ basePort: value });
  };

  const handleSetupPreferenceChange = (value: 'ask' | 'auto' | 'manual') => {
    setSetupPreference(value);
    window.electronAPI?.updatePreferences({ setupPreference: value });
  };

  const fieldInputClass = `w-full px-2.5 py-1.5 rounded-md text-xs bg-white/[0.04] border border-white/[0.06] ${input.text} placeholder-[#4b5563] focus:outline-none focus:bg-white/[0.06] focus:border-white/[0.15] transition-all duration-150`;

  return (
    <Modal
      title="App Settings"
      icon={<Settings className="w-5 h-5 text-[#9ca3af]" />}
      onClose={onClose}
      width="sm"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className={`text-xs font-medium ${settings.label}`}>
            Base Server Port
          </label>
          <span className={`text-[11px] ${settings.description}`}>
            Starting port for project servers
          </span>
          <input
            type="number"
            value={basePort}
            onChange={(e) => handleBasePortChange(parseInt(e.target.value, 10) || DEFAULT_PORT)}
            className={fieldInputClass}
          />
          <span className={`text-[10px] ${text.dimmed}`}>
            Takes effect for newly opened projects
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={`text-xs font-medium ${settings.label}`}>
            New Project Setup
          </label>
          <span className={`text-[11px] ${settings.description}`}>
            How to handle projects without configuration
          </span>
          <select
            value={setupPreference}
            onChange={(e) => handleSetupPreferenceChange(e.target.value as 'ask' | 'auto' | 'manual')}
            className={fieldInputClass}
          >
            <option value="ask">Ask every time</option>
            <option value="auto">Auto-detect settings</option>
            <option value="manual">Show setup form</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
