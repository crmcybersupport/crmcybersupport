import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ChatMessage, StoredImage, ImageHistoryEntry, StoredVideo, CustomClothing, CustomLocation } from '../types';

// Define the shape of the state for each tab
interface AssistantState {
    messages: ChatMessage[];
}

export interface ImageStudioState {
    mode: 'generate' | 'combine';
    generatePrompt: string;
    combinePrompt: string;
    editPrompt: string;
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    combineImages: StoredImage[];
    
    // State for undo/redo
    history: ImageHistoryEntry[];
    historyIndex: number;

    resultImageUrl: string | null; // For combine mode result
    
    // New state for prompt builder
    jobTitle: string;
    age: string;
    facialFeatures: string;
    address: string;
    selectedClothing: string;
    selectedLocation: string;
    selectedLocationDetail: string;
    cameraHorizontal: number;
    cameraVertical: number;

    // State for custom prompt items
    customClothing: CustomClothing[];
    customLocations: CustomLocation[];
}

export interface VideoStudioState {
    mode: 'analyze' | 'generate';
    analysisPrompt: string;
    videoFile: StoredVideo | null;
    analysisResult: string;
    generationPrompt: string;
    imageFile: StoredImage | null;
    generatedVideoUrl: string | null;
    aspectRatio: '16:9' | '9:16';
    jobTitle: string;
    age: string;
    facialFeatures: string;
    locationCategory: string;
    address: string;
    // New state for prompt builder
    selectedClothing: string;
    selectedLocation: string;
    selectedLocationDetail: string;
    cameraHorizontal: number;
    cameraVertical: number;
}

// Define the overall project state
export interface ProjectState {
    activeTab: 'assistant' | 'image' | 'video';
    assistant: AssistantState;
    imageStudio: ImageStudioState;
    videoStudio: VideoStudioState;
}

// The context value will include the state and a function to update it
interface ProjectContextType {
    projectState: ProjectState;
    setProjectState: React.Dispatch<React.SetStateAction<ProjectState>>;
    resetProject: () => void;
}

// Default initial state
export const initialProjectState: ProjectState = {
    activeTab: 'assistant',
    assistant: {
        messages: [
            {
                role: 'model',
                text: "Привет! Чтобы использовать это приложение, вам понадобится API-ключ Gemini. Вы можете получить его в Google AI Studio.\n\nПосле того, как вы получите ключ, пожалуйста, настройте его в своей среде, чтобы это приложение могло его использовать. Из соображений безопасности приложение предназначено только для чтения ключа из переменной окружения `process.env.API_KEY` и не предоставляет поля для его прямого ввода."
            }
        ],
    },
    imageStudio: {
        mode: 'generate',
        generatePrompt: '',
        combinePrompt: '',
        editPrompt: '',
        aspectRatio: '1:1',
        combineImages: [],
        history: [],
        historyIndex: -1,
        resultImageUrl: null,
        jobTitle: '',
        age: '',
        facialFeatures: '',
        address: '',
        selectedClothing: '',
        selectedLocation: '',
        selectedLocationDetail: '',
        cameraHorizontal: 5,
        cameraVertical: 5,
        customClothing: [],
        customLocations: [],
    },
    videoStudio: {
        mode: 'generate',
        analysisPrompt: '',
        videoFile: null,
        analysisResult: '',
        generationPrompt: '',
        imageFile: null,
        generatedVideoUrl: null,
        aspectRatio: '9:16',
        jobTitle: '',
        age: '',
        facialFeatures: '',
        locationCategory: 'Office',
        address: '',
        selectedClothing: '',
        selectedLocation: '',
        selectedLocationDetail: '',
        cameraHorizontal: 5,
        cameraVertical: 5,
    },
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: ReactNode }) => {
    const [projectState, setProjectState] = useState<ProjectState>(initialProjectState);
    
    const resetProject = () => {
        // Revoke any blob URLs before resetting
        if (projectState.videoStudio.generatedVideoUrl) {
            URL.revokeObjectURL(projectState.videoStudio.generatedVideoUrl);
        }
        setProjectState(initialProjectState);
    };

    // FIX: Corrected typo in closing tag from 'Project-context.Provider' to 'ProjectContext.Provider'.
    return (
        <ProjectContext.Provider value={{ projectState, setProjectState, resetProject }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};
