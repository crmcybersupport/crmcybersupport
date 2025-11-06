import { useState, useEffect } from 'react';
import { ProjectState } from '../contexts/ProjectContext';

const PROJECTS_STORAGE_KEY = 'gemini-creative-suite-projects';

export interface Project {
    id: string;
    name: string;
    timestamp: number;
    state: ProjectState;
}

export const useProjects = () => {
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        try {
            const storedProjects = localStorage.getItem(PROJECTS_STORAGE_KEY);
            if (storedProjects) {
                setProjects(JSON.parse(storedProjects));
            }
        } catch (error) {
            console.error("Failed to load projects from localStorage", error);
            localStorage.removeItem(PROJECTS_STORAGE_KEY);
        }
    }, []);

    const saveProject = (name: string, state: ProjectState): void => {
        const newProject: Project = {
            id: `proj-${Date.now()}`,
            name,
            timestamp: Date.now(),
            state,
        };

        try {
            const updatedProjects = [...projects, newProject];
            localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updatedProjects));
            setProjects(updatedProjects);
        } catch (error) {
            console.error("Failed to save project to localStorage", error);
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                 alert("Could not save project. Storage limit exceeded. Your project, especially with video files, might be too large. Please delete some old projects or clear browser data.");
            } else {
                 alert("An error occurred while saving the project.");
            }
        }
    };
    
    const deleteProject = (id: string) => {
        const updatedProjects = projects.filter(p => p.id !== id);
        localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(updatedProjects));
        setProjects(updatedProjects);
    };

    return { projects, saveProject, deleteProject };
};