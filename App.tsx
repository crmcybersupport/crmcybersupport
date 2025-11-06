import React, { useState } from 'react';
import AssistantTab from './components/AssistantTab';
import ImageStudioTab from './components/ImageStudioTab';
import VideoStudioTab from './components/VideoStudioTab';
import { ChatIcon, ImageIcon, VideoIcon, FolderIcon } from './components/Icons';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import { useProjects, Project } from './hooks/useProjects';
import ProjectManager from './components/ProjectManager';


type Tab = 'assistant' | 'image' | 'video';

const Petals = React.memo(() => {
  const petals = Array.from({ length: 20 }).map((_, i) => {
    const style = {
      left: `${Math.random() * 100}vw`,
      animationDuration: `${Math.random() * 7 + 8}s, ${Math.random() * 4 + 5}s`, // fall, sway
      animationDelay: `${Math.random() * 12}s, ${Math.random() * 5}s`,
      width: `${Math.random() * 10 + 15}px`,
      height: `${Math.random() * 10 + 15}px`,
      opacity: Math.random() * 0.5 + 0.4,
    };
    return <div key={i} className="petal" style={style} />;
  });
  return <div className="petal-container">{petals}</div>;
});

const MainApp = () => {
  const { projectState, setProjectState, resetProject } = useProject();
  const { activeTab } = projectState;

  const { projects, saveProject, deleteProject } = useProjects();
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);

  const setActiveTab = (tabName: Tab) => {
    setProjectState(prev => ({...prev, activeTab: tabName}));
  }

  const handleSaveProject = (name: string) => {
    const stateToSave = JSON.parse(JSON.stringify(projectState));
    if (stateToSave.videoStudio.generatedVideoUrl) {
      stateToSave.videoStudio.generatedVideoUrl = null;
    }
    saveProject(name, stateToSave);
  };

  const handleLoadProject = (project: Project) => {
    if (projectState.videoStudio.generatedVideoUrl) {
        URL.revokeObjectURL(projectState.videoStudio.generatedVideoUrl);
    }
    setProjectState(project.state);
  };
  
  const handleNewProject = () => {
    resetProject();
  };

  const renderTabContent = () => {
    return (
      <>
        <div className={activeTab === 'assistant' ? '' : 'hidden'}>
          <AssistantTab isActive={activeTab === 'assistant'} />
        </div>
        <div className={activeTab === 'image' ? '' : 'hidden'}>
          <ImageStudioTab isActive={activeTab === 'image'} />
        </div>
        <div className={activeTab === 'video' ? '' : 'hidden'}>
          <VideoStudioTab isActive={activeTab === 'video'} />
        </div>
      </>
    );
  };

  const TabButton = ({ tabName, label, icon }: { tabName: Tab; label:string; icon: React.ReactElement }) => (
    <button
      onClick={() => setActiveTab(tabName)}
      className={`relative flex items-center justify-center gap-2 px-4 py-3 text-sm md:text-base font-bold rounded-t-lg transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
        activeTab === tabName
          ? 'bg-zinc-900/80 text-white'
          : 'text-red-300/80 hover:bg-zinc-900/50 hover:text-white'
      }`}
    >
      {icon}
      <span className="hidden md:inline uppercase tracking-wider">{label}</span>
      {activeTab === tabName && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600"></div>
      )}
    </button>
  );

  return (
    <div className="min-h-screen sakura-mask-bg text-slate-200 font-roboto-condensed">
      <div className="min-h-screen bg-black/70 backdrop-blur-sm relative">
        <Petals />
        <header className="bg-transparent sticky top-0 z-20">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-20">
              <div>
                <h1 className="text-2xl md:text-4xl font-bold text-white font-black-ops tracking-widest uppercase">
                  GEMINI
                </h1>
              </div>
              <button
                onClick={() => setIsProjectManagerOpen(true)}
                className="flex items-center gap-2 bg-red-800/80 hover:bg-red-700/90 border border-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
                aria-label="Open project manager"
              >
                <FolderIcon />
                <span className="hidden md:inline uppercase">Projects</span>
              </button>
            </div>
            <nav className="flex space-x-1">
              <TabButton tabName="assistant" label="AI Assistant" icon={<ChatIcon />} />
              <TabButton tabName="image" label="Image Studio" icon={<ImageIcon />} />
              <TabButton tabName="video" label="Video Studio" icon={<VideoIcon />} />
            </nav>
          </div>
        </header>
        <main className="container mx-auto p-4 md:p-6 relative z-10">
          <div className="bg-zinc-950/80 backdrop-blur-md rounded-b-lg rounded-r-lg border border-red-500/40">
            {renderTabContent()}
          </div>
        </main>
        <footer className="text-center py-6 text-red-400/50 text-sm">
          <p>Powered by Google Gemini</p>
        </footer>
        <ProjectManager
          isOpen={isProjectManagerOpen}
          onClose={() => setIsProjectManagerOpen(false)}
          projects={projects}
          onSave={handleSaveProject}
          onLoad={handleLoadProject}
          onDelete={deleteProject}
          onNew={handleNewProject}
        />
      </div>
    </div>
  );
};


// FIX: Removed React.FC type as it's not necessary and can cause issues.
const App = () => {
  return (
    <ProjectProvider>
      <MainApp />
    </ProjectProvider>
  );
}

export default App;