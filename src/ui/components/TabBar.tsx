import { Plus, X, Folder, Loader2 } from 'lucide-react';

import { useServer } from '../contexts/ServerContext';
import type { Project } from '../contexts/ServerContext';
import { surface } from '../theme';

export function TabBar() {
  const { projects, activeProject, switchProject, closeProject, selectFolder, openProject, isElectron } = useServer();

  // Only show in Electron mode with at least one project
  if (!isElectron || projects.length === 0) {
    return null;
  }

  const handleAddProject = async () => {
    const folderPath = await selectFolder();
    if (folderPath) {
      await openProject(folderPath);
    }
  };

  return (
    <div className="flex-shrink-0 flex items-center bg-[#0c0e12] pl-5 pr-4 pb-5 gap-1">
      {projects.map((project) => (
        <Tab
          key={project.id}
          project={project}
          isActive={project.id === activeProject?.id}
          onSelect={() => switchProject(project.id)}
          onClose={() => closeProject(project.id)}
        />
      ))}

      {/* Add project button */}
      <button
        onClick={handleAddProject}
        className="flex items-center justify-center w-7 h-7 rounded-md text-[#6b7280] hover:text-[#e5e7eb] hover:bg-white/[0.06] transition-colors duration-150"
        title="Open Project"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

interface TabProps {
  project: Project;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function Tab({ project, isActive, onSelect, onClose }: TabProps) {
  const isStarting = project.status === 'starting';
  const hasError = project.status === 'error';

  return (
    <div
      className={`
        group relative flex items-center gap-2 h-7 px-3 rounded-md cursor-pointer
        transition-colors duration-150
        ${isActive
          ? `${surface.panelSelected} text-[#6b7280]`
          : 'text-[#6b7280] hover:bg-white/[0.04] hover:text-[#9ca3af]'
        }
        ${hasError ? 'text-red-400' : ''}
      `}
      onClick={onSelect}
    >
      {/* Icon */}
      {isStarting ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2dd4bf]" />
      ) : (
        <Folder className={`w-3.5 h-3.5 ${hasError ? 'text-red-400' : ''}`} />
      )}

      {/* Project name */}
      <span className="text-xs font-medium truncate max-w-[120px]">
        {project.name}
      </span>

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={`
          flex items-center justify-center w-4 h-4 rounded
          opacity-0 group-hover:opacity-100
          hover:bg-white/10 transition-opacity duration-150
        `}
        title="Close"
      >
        <X className="w-3 h-3" />
      </button>

    </div>
  );
}
