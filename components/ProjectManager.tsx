
import React, { useState } from 'react';
import { Project } from '../hooks/useProjects';

interface ProjectManagerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onSave: (name: string) => void;
  onLoad: (project: Project) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ isOpen, onClose, projects, onSave, onLoad, onDelete, onNew }) => {
  const [newProjectName, setNewProjectName] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!newProjectName.trim()) {
      alert("Please enter a project name.");
      return;
    }
    onSave(newProjectName);
    setNewProjectName('');
    onClose();
  };
  
  const handleLoad = (project: Project) => {
    onLoad(project);
    onClose();
  }

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
        onDelete(id);
    }
  }

  const handleNew = () => {
      if (window.confirm("Are you sure you want to start a new project? Any unsaved changes will be lost.")) {
          onNew();
          onClose();
      }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
      <div className="bg-zinc-950 rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col border-2 border-red-500/50" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-red-500/50">
          <h2 className="text-xl font-bold text-red-400 font-black-ops tracking-wider">PROJECT MANAGER</h2>
          <button onClick={onClose} className="text-red-300/80 hover:text-white text-3xl font-bold">&times;</button>
        </header>
        
        <div className="p-4 space-y-4 overflow-y-auto">
            {/* Save Current Project */}
            <div className="bg-black/40 p-4 rounded-lg border border-red-500/30">
                <h3 className="font-semibold mb-2 text-white uppercase">Save Current Session</h3>
                <div className="flex gap-2">
                    <input 
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="Enter project name..."
                        className="flex-1 bg-zinc-900/70 border border-red-500/50 rounded-md py-2 px-3 text-white placeholder-red-200/40 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button onClick={handleSave} className="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md transition-colors uppercase">Save</button>
                </div>
            </div>

            {/* New Project */}
            <button onClick={handleNew} className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-bold py-2 px-4 rounded-md transition-colors uppercase">New Project</button>
            
            {/* Saved Projects List */}
            <div>
                <h3 className="font-semibold mb-2 text-white uppercase">Saved Projects</h3>
                <div className="bg-black/40 rounded-lg p-2 space-y-2">
                    {projects.length > 0 ? (
                        <ul className="space-y-2">
                            {projects.sort((a,b) => b.timestamp - a.timestamp).map(p => (
                                <li key={p.id} className="bg-zinc-900/60 p-3 rounded-lg flex items-center justify-between hover:bg-zinc-800/60 transition-colors border border-zinc-700/50">
                                    <div>
                                        <p className="font-semibold text-red-200/90">{p.name}</p>
                                        <p className="text-xs text-zinc-400">{new Date(p.timestamp).toLocaleString()}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleLoad(p)} className="bg-red-600 hover:bg-red-500 text-white py-1 px-3 rounded-md text-sm transition-colors uppercase">Load</button>
                                        <button onClick={() => handleDelete(p.id)} className="bg-zinc-700 hover:bg-zinc-600 text-white py-1 px-3 rounded-md text-sm transition-colors uppercase">Delete</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-zinc-400 text-center py-8">No saved projects.</p>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectManager;
