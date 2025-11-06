import React, { useState, useEffect, useMemo, useRef } from 'react';
import { generateImage, editImage, combineImages } from '../services/geminiService';
import { fileToDataUrl } from '../utils/fileUtils';
import Loader from './Loader';
import { useProject, ImageStudioState } from '../contexts/ProjectContext';
import { StoredImage, ImageHistoryEntry, CustomClothing, CustomLocation } from '../types';
import { UndoIcon, RedoIcon, PlusIcon, TrashIcon, CloseIcon, CopyIcon } from './Icons';

type Mode = 'generate' | 'combine';
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

const clothingOptions = {
    'Классический костюм': 'a classic suit',
    'Повседневная одежда': 'casual clothes',
    'Клетчатая рубашка': 'a plaid shirt',
    'Бабушкина кофта с деталями': "a grandma's sweater with intricate details",
};

const locationOptions: { [key: string]: { [key: string]: string }} = {
    'Машина': {
        'За рулем': 'driving a car, typical for Russia (e.g., Lada, Kia Rio)',
        'На переднем пассажирском': 'in the front passenger seat of a car',
        'На заднем сиденье': 'in the back seat of a car',
    },
    'Офис': {
        'Элитный': 'in a luxury, modern office with glass walls, reflecting a top-tier Russian company',
        'Стандартный': 'The setting is a standard, modern open-plan office, typical for a contemporary Russian business. The background is slightly blurred, showing rows of desks with computers, neutral-toned dividers, and other employees working. A large window with vertical blinds and a potted ficus plant are visible in the distance.',
        'Простой': 'in a simple, possibly older-style office with basic furniture',
    },
    'Коридор': {
        'Коридор': 'in a generic corridor',
    },
    'ТЦ': {
        'Лифт': 'in an elevator in a modern shopping mall',
        'Кафе/бар': 'in a cafe/bar inside a bustling shopping mall',
        'Паркинг (в машине)': 'sitting in a car within an underground parking garage of a shopping mall',
        'Паркинг (снаружи)': 'standing in an underground parking garage of a shopping mall, outside a car',
        'Холл': 'in the main hall of a busy shopping mall with other people in the background',
    }
};

const getCameraAngleDescription = (horizontal: number, vertical: number): string => {
    const horizontalMap: { [key: number]: string } = {
        1: '–35°', 2: '–25°', 3: '–15°', 4: '–8°', 5: '0°',
        6: '+8°', 7: '+15°', 8: '+25°', 9: '+35°',
    };
    const verticalMap: { [key: number]: string } = {
        1: '–15°', 2: '–12°', 3: '–9°', 4: '–7°', 5: '–5°',
        6: '–2°', 7: '0°', 8: '+5°', 9: '+10°',
    };

    const horizontalDesc = horizontalMap[horizontal];
    const verticalDesc = verticalMap[vertical];
    
    return `The camera angle is set to Horizontal: ${horizontalDesc}, Vertical: ${verticalDesc}.`;
};

// --- Helper Components (Moved outside main component to prevent re-renders) ---

const commonInputClass = "w-full bg-zinc-900/70 border border-red-500/50 rounded-lg p-2 text-white placeholder-red-200/40 focus:outline-none focus:ring-2 focus:ring-red-500";
const commonModalInputClass = "w-full bg-zinc-800 border border-red-500/50 rounded-md py-2 px-3 text-white placeholder-red-200/40 focus:outline-none focus:ring-2 focus:ring-red-500";

const AngleControl = ({ label, value, onChange, descriptions }: { label: string, value: number, onChange: (val: number) => void, descriptions: { [key: number]: string }}) => (
    <div>
        <label className="block text-sm font-medium text-red-200/80 mb-2">{label}</label>
        <div className="flex justify-between gap-1">
            {Array.from({ length: 9 }, (_, i) => i + 1).map(num => (
                <button 
                    key={num} 
                    onClick={() => onChange(num)}
                    className={`h-10 w-full rounded-md border-2 text-xs font-bold transition-colors flex items-center justify-center ${value === num ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800/50 border-zinc-600/50 hover:bg-zinc-700/50'}`}
                    title={descriptions[num]}
                >
                    {num}
                </button>
            ))}
        </div>
        <p className="text-center text-xs text-red-300/70 mt-1">{descriptions[value]}</p>
    </div>
);

const ImagePromptBuilder = ({
  state,
  updateState,
  handleAddCustomItem,
  handleDeleteCustomClothing,
  handleDeleteCustomLocation,
}: {
  state: ImageStudioState;
  updateState: (updates: Partial<ImageStudioState>) => void;
  handleAddCustomItem: (mode: 'clothing' | 'location') => void;
  handleDeleteCustomClothing: (id: string) => void;
  handleDeleteCustomLocation: (id: string) => void;
}) => {
    const {
        jobTitle, age, facialFeatures, address, selectedClothing, selectedLocation, selectedLocationDetail,
        cameraHorizontal, cameraVertical, customClothing, customLocations
    } = state;
    
    const customLocationCategories = useMemo(() => {
        return [...new Set(customLocations.map(loc => loc.category))];
    }, [customLocations]);

    return (
    <div className="space-y-4 p-4 bg-black/30 backdrop-blur-sm rounded-lg border border-red-500/30 h-full">
        <h3 className="text-lg font-bold text-red-400 font-black-ops tracking-wider">PROMPT BUILDER</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label htmlFor="img-job-title" className="block text-sm font-medium text-red-200/80 mb-1">1. Character: Job Title</label>
                <input id="img-job-title" type="text" value={jobTitle} onChange={e => updateState({ jobTitle: e.target.value })} placeholder="e.g., Chief Engineer" className={commonInputClass}/>
            </div>
            <div>
                <label htmlFor="img-age" className="block text-sm font-medium text-red-200/80 mb-1">Age</label>
                <input id="img-age" type="text" value={age} onChange={e => updateState({ age: e.target.value })} placeholder="e.g., 65" className={commonInputClass}/>
            </div>
        </div>

        <div>
            <label htmlFor="img-facial-features" className="block text-sm font-medium text-red-200/80 mb-1">Facial Features / Details</label>
            <textarea id="img-facial-features" value={facialFeatures} onChange={e => updateState({ facialFeatures: e.target.value })} placeholder="e.g., Wrinkles, gray hair, glasses" rows={2} className={commonInputClass}/>
        </div>
        
        {/* Clothing */}
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-red-200/80">2. Clothing</label>
                <button onClick={() => handleAddCustomItem('clothing')} className="p-1 rounded-full hover:bg-red-700/50 transition-colors" aria-label="Add custom clothing"><PlusIcon /></button>
            </div>
            <div className="flex flex-wrap gap-2">
                {Object.keys(clothingOptions).map(key => (
                    <button 
                        key={key} 
                        onClick={() => updateState({ selectedClothing: key })}
                        className={`py-1 px-3 rounded-lg border-2 text-sm transition-colors ${selectedClothing === key ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800/50 border-zinc-600/50 hover:bg-zinc-700/50'}`}
                    >{key}</button>
                ))}
                {customClothing.map(item => (
                    <button 
                        key={item.id} 
                        onClick={() => updateState({ selectedClothing: item.name })}
                        className={`relative group py-1 pl-3 pr-7 rounded-lg border-2 text-sm transition-colors ${selectedClothing === item.name ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-700 border-zinc-500 hover:bg-zinc-600'}`}
                    >
                      {item.name}
                      <span onClick={(e) => { e.stopPropagation(); handleDeleteCustomClothing(item.id); }} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-50 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity"><TrashIcon /></span>
                    </button>
                ))}
            </div>
        </div>

        {/* Location */}
        <div>
            <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-red-200/80">3. Location</label>
                <button onClick={() => handleAddCustomItem('location')} className="p-1 rounded-full hover:bg-red-700/50 transition-colors" aria-label="Add custom location"><PlusIcon /></button>
            </div>
            <div className="space-y-3">
                {Object.keys(locationOptions).map(locKey => (
                    <div key={locKey}>
                        <p className="text-sm font-semibold text-red-300">{locKey}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                             {Object.keys(locationOptions[locKey as keyof typeof locationOptions]).map(detailKey => (
                                <button 
                                    key={detailKey} 
                                    onClick={() => updateState({ selectedLocation: locKey, selectedLocationDetail: detailKey })}
                                    className={`py-1 px-3 rounded-lg border-2 text-sm transition-colors ${selectedLocation === locKey && selectedLocationDetail === detailKey ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800/50 border-zinc-600/50 hover:bg-zinc-700/50'}`}
                                >{detailKey}</button>
                             ))}
                        </div>
                    </div>
                ))}
                 {customLocationCategories.map(category => (
                    <div key={category}>
                        <p className="text-sm font-semibold text-red-300">{category} (Custom)</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                             {customLocations.filter(l => l.category === category).map(item => (
                                <button 
                                    key={item.id} 
                                    onClick={() => updateState({ selectedLocation: item.category, selectedLocationDetail: item.detail })}
                                    className={`relative group py-1 pl-3 pr-7 rounded-lg border-2 text-sm transition-colors ${selectedLocation === item.category && selectedLocationDetail === item.detail ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-700 border-zinc-500 hover:bg-zinc-600'}`}
                                >
                                  {item.detail}
                                  <span onClick={(e) => { e.stopPropagation(); handleDeleteCustomLocation(item.id); }} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-50 group-hover:opacity-100 text-white hover:text-red-300 transition-opacity"><TrashIcon /></span>
                                </button>
                             ))}
                        </div>
                    </div>
                 ))}
            </div>
        </div>
        
        <div className="space-y-3">
             <h3 className="text-sm font-medium text-red-200/80">4. Camera</h3>
             <AngleControl 
                label="Vertical Angle"
                value={cameraVertical}
                onChange={(val) => updateState({ cameraVertical: val })}
                descriptions={{1: 'Extreme Low', 2: 'Low', 3: 'Mid-Low', 4: 'Slight Low', 5: 'Eye-Level', 6: 'Slight High', 7: 'Mid-High', 8: 'High', 9: 'Extreme High'}}
             />
             <AngleControl 
                label="Horizontal Angle"
                value={cameraHorizontal}
                onChange={(val) => updateState({ cameraHorizontal: val })}
                descriptions={{1: 'Far Left', 2: 'Left', 3: 'Mid-Left', 4: 'Slight Left', 5: 'Frontal', 6: 'Slight Right', 7: 'Mid-Right', 8: 'Right', 9: 'Far Right'}}
             />
        </div>


        <div>
            <label htmlFor="img-address" className="block text-sm font-medium text-red-200/80 mb-1">5. Address (Optional)</label>
            <input id="img-address" type="text" value={address} onChange={e => updateState({ address: e.target.value })} placeholder="e.g., Moscow, Russia" className={commonInputClass}/>
        </div>
    </div>
    );
};

const EditImageModal = ({
  isOpen,
  onClose,
  currentImage,
  editPrompt,
  onEditPromptChange,
  onSubmit,
  isLoading,
  loadingText
}: {
  isOpen: boolean;
  onClose: () => void;
  currentImage: ImageHistoryEntry | null;
  editPrompt: string;
  onEditPromptChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  isLoading: boolean;
  loadingText: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
        <div className="bg-zinc-950 rounded-lg w-full max-w-2xl border-2 border-red-500/50 p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-red-400 font-black-ops tracking-wider">EDIT IMAGE</h2>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <p className="text-sm font-medium text-red-200/80 mb-2">Current Image</p>
                    {currentImage && <img src={currentImage.dataUrl} alt="Image to edit" className="rounded-lg max-w-full" />}
                </div>
                <div className="flex flex-col">
                    <label htmlFor="img-edit-prompt-modal" className="block text-sm font-medium text-red-200/80 mb-2">Edit Prompt</label>
                    <textarea
                        id="img-edit-prompt-modal"
                        value={editPrompt}
                        onChange={onEditPromptChange}
                        placeholder="e.g., Make the hat blue."
                        rows={8}
                        className={commonInputClass + " flex-grow"}
                    />
                </div>
            </div>
            <div className="flex justify-end gap-4">
                <button onClick={onClose} className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-md uppercase">Cancel</button>
                <button onClick={onSubmit} disabled={!currentImage || isLoading} className="bg-red-700 hover:bg-red-600 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md uppercase">
                    {isLoading && loadingText === 'Applying edit...' ? 'Applying...' : 'Apply Edit'}
                </button>
            </div>
        </div>
    </div>
  );
};

const ZoomableViewerModal = ({ imageUrl, onClose }: { imageUrl: string | null; onClose: () => void; }) => {
    if (!imageUrl) return null;

    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const startDragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

    useEffect(() => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    }, [imageUrl]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const zoomFactor = 1.1;
        const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
        setZoom(Math.max(0.5, Math.min(newZoom, 8))); // Clamp zoom
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        startDragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startPosX: position.x,
            startPosY: position.y
        };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
        const dx = e.clientX - startDragRef.current.startX;
        const dy = e.clientY - startDragRef.current.startY;
        setPosition({
            x: startDragRef.current.startPosX + dx,
            y: startDragRef.current.startPosY + dy
        });
    };
    
    const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4 backdrop-blur-md transition-opacity duration-300"
            onClick={onClose}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            role="dialog"
            aria-modal="true"
        >
            <div 
                className="relative bg-black border-2 border-red-500/50 shadow-2xl shadow-red-900/50 flex flex-col items-center justify-center gap-4 p-4 rounded-lg"
                style={{ width: 'calc(90vh * 16 / 9)', maxWidth: '95vw', height: 'auto' }}
                onClick={e => e.stopPropagation()}
            >
                <h2 id="image-viewer-title" className="sr-only">Image Zoom Viewer</h2>
                <div 
                    className="relative w-full overflow-hidden bg-zinc-900/50"
                    style={{ aspectRatio: '16/9' }}
                    onWheel={handleWheel}
                >
                    <img 
                        src={imageUrl} 
                        alt="Zoomable view" 
                        className="absolute top-0 left-0"
                        style={{
                           width: '100%',
                           height: '100%',
                           objectFit: 'contain',
                           transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                           cursor: isDraggingRef.current ? 'grabbing' : 'grab',
                           willChange: 'transform',
                           transition: isDraggingRef.current ? 'none' : 'transform 0.1s ease-out',
                        }}
                        onMouseDown={handleMouseDown}
                        draggable={false}
                    />
                </div>
                <div className="w-full max-w-md flex items-center gap-3 text-red-200/80">
                    <span className="text-sm">Zoom</span>
                    <input
                        type="range"
                        min="0.5"
                        max="8"
                        step="0.1"
                        value={zoom}
                        onChange={e => setZoom(parseFloat(e.target.value))}
                        className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-red-600"
                    />
                    <span className="text-sm w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
                </div>
                <button 
                    onClick={onClose} 
                    className="absolute -top-5 -right-5 bg-black/80 hover:bg-red-700/80 border-2 border-red-600 text-white rounded-full h-10 w-10 flex items-center justify-center text-2xl font-bold transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Close image viewer"
                >
                    &times;
                </button>
            </div>
        </div>
    );
};


// --- Main Component ---

const ImageStudioTab: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const { projectState, setProjectState } = useProject();
  const { imageStudio: state } = projectState;
  const { 
    mode, generatePrompt, combinePrompt, editPrompt, aspectRatio, combineImages: combineImageFiles, 
    history, historyIndex,
    customClothing, customLocations
  } = state;

  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'clothing' | 'location'>('clothing');
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  
  const currentImage = historyIndex > -1 ? history[historyIndex] : null;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  
  const updateState = (updates: Partial<ImageStudioState>) => {
    setProjectState(prev => ({
      ...prev,
      imageStudio: { ...prev.imageStudio, ...updates },
    }));
  };

  const addHistoryState = (newImage: ImageHistoryEntry) => {
    setProjectState(prev => {
        const { history, historyIndex } = prev.imageStudio;
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newImage);
        return {
            ...prev,
            imageStudio: {
                ...prev.imageStudio,
                history: newHistory,
                historyIndex: newHistory.length - 1,
            }
        };
    });
  };

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (isLoading) return;

      const items = event.clipboardData?.items;
      if (!items) return;

      let imageFile: File | null = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const pastedItem = items[i].getAsFile();
          // FIX: Use `instanceof File` for robust type guarding instead of a simple truthiness check,
          // which could fail if a non-File object is pasted.
          if (pastedItem instanceof File) {
            imageFile = pastedItem;
            break;
          }
        }
      }

      if (!imageFile) return;
      
      event.preventDefault();

      if (mode === 'generate') {
        setError(null);
        setIsLoading(true);
        setLoadingText('Loading pasted image...');
        
        try {
            const dataUrl = await fileToDataUrl(imageFile);
            const newImageEntry: ImageHistoryEntry = { dataUrl, mimeType: imageFile.type };
            updateState({ 
                history: [newImageEntry],
                historyIndex: 0,
            });
        } catch (err) {
            setError("Failed to load pasted image.");
        } finally {
            setIsLoading(false);
        }
      } else if (mode === 'combine') {
        if (combineImageFiles.length < 3) {
            const newStoredImage: StoredImage = {
                dataUrl: await fileToDataUrl(imageFile),
                name: imageFile.name,
                type: imageFile.type,
            };
            updateState({ 
                combineImages: [...combineImageFiles, newStoredImage].slice(0, 3),
                resultImageUrl: null,
            });
        } else {
            setError("Maximum of 3 images reached. Cannot add pasted image.");
            setTimeout(() => setError(null), 3000);
        }
      }
    };

    if (isActive) {
      window.addEventListener('paste', handlePaste);
    }
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [mode, combineImageFiles, isLoading, isActive]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            setViewingImage(null);
            setIsEditModalOpen(false);
            setIsModalOpen(false);
        }
    };
    if (isActive) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);


  const handleModeChange = (newMode: Mode) => {
    setError(null);
    updateState({ mode: newMode });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    if (mode === 'combine') {
        const files = Array.from(e.target.files);
        const slotsAvailable = 3 - combineImageFiles.length;
        if (slotsAvailable <= 0) return;

        const newImages = await Promise.all(
            files.slice(0, slotsAvailable).map(async file => ({
                dataUrl: await fileToDataUrl(file),
                name: file.name,
                type: file.type,
            }))
        );

        updateState({
            combineImages: [...combineImageFiles, ...newImages],
            resultImageUrl: null,
        });

    } else if (mode === 'generate') {
        const file = e.target.files[0];
        setError(null);
        setIsLoading(true);
        setLoadingText('Loading image...');

        try {
            const dataUrl = await fileToDataUrl(file);
            const newImageEntry: ImageHistoryEntry = { dataUrl, mimeType: file.type };
            updateState({ 
                history: [newImageEntry],
                historyIndex: 0,
            });
        } catch (err) {
            setError("Failed to load image.");
        } finally {
            setIsLoading(false);
        }
    }
    e.target.value = ''; // Reset file input
  };
  
  const removeImage = (indexToRemove: number) => {
    updateState({
        combineImages: combineImageFiles.filter((_, index) => index !== indexToRemove)
    });
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleGenerateSubmit();
    }
  };

  const handleBuildPrompt = () => {
    const { 
        jobTitle, age, facialFeatures, address, selectedClothing, 
        selectedLocation, selectedLocationDetail, cameraHorizontal, cameraVertical 
    } = state;
    
    let newPrompt = '';

    // Helper to get clothing description
    const getClothingDescription = () => {
        return customClothing.find(c => c.name === selectedClothing)?.prompt 
            || clothingOptions[selectedClothing as keyof typeof clothingOptions];
    };

    const persona = `The subject is a ${jobTitle || 'person'}${age ? ` who is around ${age} years old` : ''}.${facialFeatures ? ` Modify or add these facial features: ${facialFeatures}.` : ''}`;
    const camera = getCameraAngleDescription(cameraHorizontal, cameraVertical);
    const addressInfo = address ? `The background details should be subtly influenced by this address: "${address}".` : '';

    if (selectedLocation === 'Машина' && selectedLocationDetail === 'За рулем') {
        const basePrompt = `A realistic selfie based on a reference photo. Keep the face identity, age, and all facial details unchanged (no retouching or beautification; preserve skin texture, pores, wrinkles, moles, fine hairs). {persona} Neutral, calm expression.
Setting: inside a modern car, driver’s seat (left-hand drive).
Pose/Framing: shoulders almost square to the seat (turn 0–5° only). Right hand on the steering wheel (part of wheel visible at lower-right). Left forearm extends toward the camera from lower-left as if holding the phone; phone out of frame. Head centered; upper torso in frame; dashboard, left A-pillar and roof console visible.
Camera geometry: handheld at arm’s length ~45–60 cm. {camera} Focal length ≈ 28–30 mm equiv. Keep verticals mostly straight (no strong side shift).
Background: underground parking through windows (concrete pillars with red/white markings, parked cars, fluorescent strip lights). {address}
Lighting: soft interior roof light + ambient from the garage; balanced exposure; gentle shadows under eyes and chin; natural reflections; no cinematic glow.
Clothing: {clothing}.
Style: high-quality realistic photograph; true-to-life color, moderate contrast, natural shadow depth.`;

        const clothingDesc = getClothingDescription() || 'dark navy lightweight quilted/puffer jacket, zipped to mid-chest; dark crew-neck/T-shirt underneath; jeans; no hat, minimal/no visible logos';

        newPrompt = basePrompt
            .replace('{persona}', persona)
            .replace('{camera}', camera)
            .replace('{address}', addressInfo)
            .replace('{clothing}', clothingDesc);

    } else if (selectedLocation === 'Офис' && selectedLocationDetail === 'Стандартный') {
        const basePrompt = `A realistic selfie based on a reference photo. Keep the individuality of the face, age, and all facial details unchanged (no retouching or beautification; preserve skin texture, pores, wrinkles, moles, and fine hairs). {persona} Neutral, confident facial expression.
The person is sitting in a black leather office chair in a private office. The posture is upright, shoulders relaxed, and the body is turned slightly to the right (~10–15°).
{camera} This creates a mild upward and sideward angle typical of a seated webcam or handheld selfie placed on a desk.
The framing captures the upper torso and head, with the shoulder line visible and the head centered.
Background: a simple office interior — light beige walls, framed documents or certificates on the wall, a wooden cabinet with folders, and a suspended ceiling with square fluorescent light panels. The environment looks like a typical administrative or executive office. {address}
Lighting: cool white fluorescent ceiling lighting (~5000 K), even and diffused, softly illuminating the face from above. Natural shadows appear under the chin and around the neck.
Clothing: {clothing}.
Style: realistic indoor photo, high-quality, natural contrast, true-to-life colors, minimal depth blur. The perspective should feel like an authentic office selfie taken from a seated position behind the desk.`;
        
        const clothingDesc = getClothingDescription() || 'a dark business jacket over a light shirt';
        
        newPrompt = basePrompt
            .replace('{persona}', persona)
            .replace('{camera}', camera)
            .replace('{address}', addressInfo)
            .replace('{clothing}', clothingDesc);

    } else if (selectedLocation === 'Офис' && selectedLocationDetail === 'Простой') {
        const basePrompt = `A realistic selfie based on a reference photo. Keep the individuality of the face, age, and all facial details unchanged (no retouching or beautification; preserve skin texture, pores, wrinkles, moles, and fine hairs). {persona} Neutral facial expression.
The person is sitting at an office desk in a chair, looking directly into the camera. The photo is framed as if taken by the person themselves at arm’s length, but the phone is not visible in the image.
{camera} This produces a natural handheld selfie perspective with a mild ¾ frontal view from the lower right side.
The desk surface with a few documents, a mug, or a keyboard is partially visible in the lower part of the frame. The body is slightly turned (~15° to the right), but the eyes are focused directly on the camera, giving a realistic in-person feel.
Background: a modest post-Soviet office interior in good condition — plain light walls, ceiling with square fluorescent panels, minimal furniture such as a monitor, a noticeboard, or a small plant. The background should be visually simple and slightly desaturated, keeping focus on the person. {address}
Lighting: soft, even, cool fluorescent office lighting (~4800–5200 K) from the ceiling, evenly illuminating the face and upper body with gentle shadows under the chin and around the neck. No dramatic or cinematic light; just natural indoor brightness.
Clothing: {clothing}.
Style: high-quality realistic photograph, handheld framing, natural depth, true-to-life skin tones, balanced contrast, and realistic indoor atmosphere.`;
        
        const clothingDesc = getClothingDescription() || 'everyday office attire — a neutral-colored shirt, polo, or light business jacket, appropriate for a modern office, casual but neat';

        newPrompt = basePrompt
            .replace('{persona}', persona)
            .replace('{camera}', camera)
            .replace('{address}', addressInfo)
            .replace('{clothing}', clothingDesc);
            
    } else if (selectedLocation === 'ТЦ' && selectedLocationDetail === 'Кафе/бар') {
        const basePrompt = `A realistic selfie based on a reference photo. Keep the individuality of the face, age, and all facial details unchanged (no retouching or beautification; preserve skin texture, pores, wrinkles, moles, and fine hairs). {persona} Neutral facial expression.
The person is sitting in a dark cushioned chair in a cozy café, facing the camera. {camera} This produces a natural ¾ close-up perspective. The framing includes the head, shoulders, and part of the upper torso.
The body is slightly turned (~15° to the right), but the eyes look directly into the camera.
Background: a warm café interior with light-colored walls, wooden shelves with small decorative items (plants, framed photos, cups), and a few people sitting at tables in the background, casually drinking coffee or talking. The background should have moderate depth of field — recognizable but softly defocused, to keep the focus on the person. {address}
Lighting: warm indoor tone (~3800–4200 K), natural and soft, with slight reflections from nearby lights. No cinematic glow or harsh contrast. The lighting is coming from a combination of window daylight and soft ceiling lamps, illuminating the face evenly with gentle shadows under the chin.
Clothing: {clothing}.
Style: high-quality realistic photograph, handheld selfie perspective, natural depth, authentic café lighting, and balanced color tones with true-to-life textures.`;

        const clothingDesc = getClothingDescription() || 'everyday business-casual outfit — a dark blazer or jacket (gray, navy, or charcoal) over a light blouse or white shirt';

        newPrompt = basePrompt
            .replace('{persona}', persona)
            .replace('{camera}', camera)
            .replace('{address}', addressInfo)
            .replace('{clothing}', clothingDesc);

    } else { // Fallback for other locations
        const promptParts = [
          `A realistic, high-resolution photo in a selfie-style video call perspective (like FaceTime or a Telegram video message). The shot is from the point of view of the person on the other end of the call.`
        ];
        promptParts.push(`The subject is a ${jobTitle || 'person'}. The final image should accurately reflect the facial features and identity of the person in the provided reference photo.`);
        if (age) promptParts.push(`They should be depicted as being around ${age} years old.`);
        if (facialFeatures) promptParts.push(`Modify or add these facial features: ${facialFeatures}.`);
        promptParts.push(`The person is sitting at a table, holding the camera at arm's length, giving a natural, slightly distorted wide-angle look. They are looking into the camera but are slightly turned, not in a direct frontal shot.`);
        promptParts.push(camera);
        const clothingPrompt = getClothingDescription();
        if (clothingPrompt) promptParts.push(`They are wearing ${clothingPrompt}.`);

        let background = 'The background is a casual, lived-in room with details like a nightstand, a lamp, or a bookshelf.';
        const customLoc = customLocations.find(l => l.category === selectedLocation && l.detail === selectedLocationDetail);
        if (customLoc) {
            background = `The setting is ${customLoc.prompt}, seen from a personal, close-up video call perspective.`;
        } else if (selectedLocation && selectedLocationDetail && locationOptions[selectedLocation as keyof typeof locationOptions]?.[selectedLocationDetail as keyof typeof locationOptions[keyof typeof locationOptions]]) {
            const locationDescription = locationOptions[selectedLocation as keyof typeof locationOptions][selectedLocationDetail as keyof typeof locationOptions[keyof typeof locationOptions]];
            background = `The setting is ${locationDescription}, but seen from a personal, close-up video call perspective.`;
        }
        promptParts.push(background);
        if (address) promptParts.push(addressInfo);
        promptParts.push(`The style should be photorealistic with natural lighting, as if from a phone's front camera.`);
        newPrompt = promptParts.join(' ');
    }
    
    updateState({ generatePrompt: newPrompt.replace(/\s+/g, ' ').trim() });
  }

  const handleGenerateSubmit = async () => {
    if (!generatePrompt.trim()) {
      setError("Please provide a prompt.");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      if (history.length > 0) {
        // Image-to-Image generation using the input image as a reference
        setLoadingText('Generating from reference...');
        const imagePayload = [{
            base64: history[0].dataUrl.split(',')[1],
            mimeType: history[0].mimeType
        }];
        const resultUrl = await combineImages(generatePrompt, imagePayload);
        const mimeType = resultUrl.substring(resultUrl.indexOf(':') + 1, resultUrl.indexOf(';'));
        addHistoryState({ dataUrl: resultUrl, mimeType });
      } else {
        // Text-to-Image generation (no input image)
        setLoadingText('Generating...');
        const results = await generateImage(generatePrompt, aspectRatio, 1);
        if (results.length > 0) {
          const imageUrl = results[0];
          const mimeType = imageUrl.substring(imageUrl.indexOf(':') + 1, imageUrl.indexOf(';'));
          addHistoryState({ dataUrl: imageUrl, mimeType });
        } else {
          throw new Error("Model did not return an image.");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Failed to generate image: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditSubmit = async () => {
    if (!currentImage) {
        setError("Please provide an input image first.");
        return;
    }
    if (!editPrompt.trim()) {
      setError("Please provide an edit prompt.");
      return;
    }

    setIsLoading(true);
    setLoadingText('Applying edit...');
    setError(null);

    try {
        const base64 = currentImage.dataUrl.split(',')[1];
        const result = await editImage(editPrompt, base64, currentImage.mimeType);
        addHistoryState({ dataUrl: result, mimeType: 'image/png' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Failed to edit image: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSubmitWithModal = () => {
    handleEditSubmit();
    setIsEditModalOpen(false);
  }
  
  const handleCombineSubmit = async () => {
      if (!combinePrompt.trim()) {
        setError("Please provide a prompt.");
        return;
      }
      if (combineImageFiles.length < 2) {
        setError("Please provide at least two images to combine.");
        return;
      }

      setIsLoading(true);
      setLoadingText('Combining images...');
      setError(null);
      updateState({ resultImageUrl: null });

      try {
        const imagePayload = combineImageFiles.map(img => ({
            base64: img.dataUrl.split(',')[1],
            mimeType: img.type,
        }));
        const result = await combineImages(combinePrompt, imagePayload);
        updateState({ resultImageUrl: result });
      } catch (err)
 {
        const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
        setError(`Failed to combine images: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
  };
  
  const handleUndo = () => {
    if (canUndo) {
      updateState({ historyIndex: historyIndex - 1 });
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      updateState({ historyIndex: historyIndex + 1 });
    }
  };

  const handleAddCustomItem = (mode: 'clothing' | 'location') => {
    setModalMode(mode);
    setIsModalOpen(true);
  };
  
  const handleDeleteCustomClothing = (id: string) => {
    if (window.confirm("Are you sure you want to delete this custom clothing item?")) {
      updateState({ customClothing: customClothing.filter(c => c.id !== id) });
    }
  };

  const handleDeleteCustomLocation = (id: string) => {
    if (window.confirm("Are you sure you want to delete this custom location?")) {
      updateState({ customLocations: customLocations.filter(l => l.id !== id) });
    }
  };

  const handleEditPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateState({ editPrompt: e.target.value });
  };

  const handleCopyImage = async () => {
    if (!currentImage || copyStatus === 'copied') return;

    try {
        const response = await fetch(currentImage.dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([
            new ClipboardItem({
                [blob.type]: blob
            })
        ]);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
        console.error('Failed to copy image: ', err);
        setError('Failed to copy image to clipboard.');
        setTimeout(() => setError(null), 3000);
    }
  };

  const ModeButton = ({ buttonMode, children }: { buttonMode: Mode; children: React.ReactNode }) => (
    <button
      onClick={() => handleModeChange(buttonMode)}
      className={`px-6 py-2 rounded-full text-sm font-bold uppercase transition-all duration-300 w-1/2 ${mode === buttonMode ? 'bg-red-700 text-white' : 'bg-transparent text-red-300/80'}`}
    >
      {children}
    </button>
  );
  
  const AspectRatioButton = ({ value }: { value: AspectRatio }) => (
    <button
        onClick={() => updateState({ aspectRatio: value })}
        className={`py-2 px-3 rounded-lg border-2 text-xs font-semibold transition-colors w-full ${aspectRatio === value ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800/50 border-zinc-600/50 hover:bg-zinc-700/50'}`}>
        {value}
    </button>
  );
  
  const renderGenerateMode = () => (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Reference & Actions */}
        <div className="md:col-span-3 space-y-4 flex flex-col">
            <div className="bg-black/40 rounded-lg p-3 border border-red-500/30 flex-grow flex flex-col">
                <h3 className="text-center font-bold text-red-300/80 uppercase mb-2">Reference Photo</h3>
                <div className="w-full flex-1 flex items-center justify-center min-h-[150px] bg-black/30 rounded-md">
                    {history.length > 0 ? (
                         <img src={history[0].dataUrl} alt="Reference" className="rounded-lg max-w-full max-h-full object-contain"/>
                    ) : (
                        <div className="text-zinc-400 text-center p-4">
                           <p className="text-sm">Upload or paste an image to use as a reference.</p>
                           <label htmlFor="img-upload-generate" className="mt-2 inline-block w-full text-center bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-white font-bold py-2 px-3 rounded-lg transition-colors uppercase text-xs cursor-pointer">
                                Upload Image
                           </label>
                           <input 
                               id="img-upload-generate" 
                               type="file" 
                               accept="image/*" 
                               onChange={handleFileChange}
                               className="hidden"
                           />
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-black/40 rounded-lg p-3 border border-red-500/30">
                <h3 className="text-center font-bold text-red-300/80 uppercase mb-2">6. Build & Generate</h3>
                <button onClick={handleBuildPrompt} className="w-full bg-zinc-800 hover:bg-zinc-700 border border-red-500/50 text-white font-bold py-2 px-4 rounded-lg transition-colors uppercase tracking-wider text-sm mb-2">
                    Build Prompt
                </button>
                <textarea 
                  value={generatePrompt} 
                  onChange={(e) => updateState({ generatePrompt: e.target.value })} 
                  onKeyDown={handleKeyDown}
                  placeholder={"Prompt will appear here, or write your own..."} 
                  rows={4} 
                  className={commonInputClass + " text-sm"}/>
            </div>
            
            <div className="bg-black/40 rounded-lg p-3 border border-red-500/30">
                <h3 className="text-center font-bold text-red-300/80 uppercase mb-2">7. Aspect Ratio</h3>
                <div className="grid grid-cols-3 gap-2">
                    <AspectRatioButton value="1:1" />
                    <AspectRatioButton value="16:9" />
                    <AspectRatioButton value="9:16" />
                    <AspectRatioButton value="4:3" />
                    <AspectRatioButton value="3:4" />
                </div>
            </div>
            
            <button onClick={handleGenerateSubmit} disabled={isLoading} className="w-full bg-red-700 hover:bg-red-600 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors uppercase tracking-wider">
                {isLoading ? loadingText : 'Generate Image'}
            </button>
        </div>

        {/* Middle Column: Prompt Builder */}
        <div className="md:col-span-5">
             <ImagePromptBuilder
                state={state}
                updateState={updateState}
                handleAddCustomItem={handleAddCustomItem}
                handleDeleteCustomClothing={handleDeleteCustomClothing}
                handleDeleteCustomLocation={handleDeleteCustomLocation}
              />
        </div>

        {/* Right Column: Generated Image */}
        <div className="md:col-span-4 space-y-4 flex flex-col">
            <div className="bg-black/40 rounded-lg p-3 border border-red-500/30 flex-grow flex flex-col items-center justify-center min-h-[300px]">
                <div className="w-full flex-1 flex items-center justify-center bg-black/30 rounded-md min-h-0">
                   {isLoading ? (
                       <Loader text={loadingText} />
                   ) : currentImage ? (
                       <img 
                          src={currentImage.dataUrl} 
                          alt="Current" 
                          className="rounded-lg max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setViewingImage(currentImage.dataUrl)}
                       />
                   ) : (
                       <div className="text-zinc-400 text-center p-4">
                          <p>Your image will appear here.</p>
                       </div>
                   )}
               </div>
            </div>
            <div className="flex items-center justify-center gap-2 bg-black/40 p-2 rounded-lg border border-red-500/30">
                 <button onClick={handleUndo} disabled={!canUndo || isLoading} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900/50 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    <UndoIcon /> Undo
                </button>
                <button onClick={handleRedo} disabled={!canRedo || isLoading} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900/50 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    <RedoIcon /> Redo
                </button>
                <button 
                    onClick={handleCopyImage} 
                    disabled={!currentImage || isLoading || copyStatus === 'copied'} 
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900/50 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                    <CopyIcon /> {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={() => setIsEditModalOpen(true)} disabled={!currentImage || isLoading} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900/50 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    Edit...
                </button>
            </div>
        </div>
    </div>
  );

  const renderCombineMode = () => {
    const { combineImages: combineImageFiles, resultImageUrl } = state;

    const handleCopyCombinedImage = async () => {
        if (!resultImageUrl || copyStatus === 'copied') return;
    
        try {
            const response = await fetch(resultImageUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 2000);
        } catch (err) {
            console.error('Failed to copy combined image: ', err);
            setError('Failed to copy image to clipboard.');
            setTimeout(() => setError(null), 3000);
        }
    };

    return (
     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left side: Controls */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-red-400 font-black-ops tracking-wider">COMBINE IMAGES WITH GEMINI</h2>
            <div>
              <label htmlFor="img-upload-combine" className="block text-sm font-medium text-red-200/80 mb-2">
                Upload up to 3 Images to Combine
              </label>
              <input 
                id="img-upload-combine" 
                type="file" 
                accept="image/*" 
                multiple
                onChange={handleFileChange}
                disabled={combineImageFiles.length >= 3}
                className="block w-full text-sm text-red-200/80 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-800 file:text-white hover:file:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:file:bg-red-800"/>
                <p className="text-xs text-zinc-400 mt-1">
                  {combineImageFiles.length} of 3 images selected.
                  {combineImageFiles.length < 3 && ` You can add ${3 - combineImageFiles.length} more.`}
                  <br/>
                  (You can also paste an image to add it)
                </p>
            </div>
          
          {combineImageFiles.length > 0 && (
            <div className="flex flex-wrap gap-3 p-2 bg-black/50 rounded-lg">
                {combineImageFiles.map((img, index) => (
                    <div key={img.dataUrl.slice(-20)} className="relative">
                        <img src={img.dataUrl} alt={`Input ${index + 1}`} className="h-24 w-24 object-cover rounded-md border-2 border-red-500/50"/>
                        <button 
                            onClick={() => removeImage(index)} 
                            className="absolute -top-2 -right-2 bg-black hover:bg-red-700 border-2 border-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold leading-none transition-transform duration-200 hover:scale-110"
                            aria-label="Remove image"
                        >
                            &times;
                        </button>
                    </div>
                ))}
            </div>
           )}
          
          <div>
            <label htmlFor="img-combine-prompt" className="block text-sm font-medium text-red-200/80 mb-2">Prompt</label>
            <textarea 
              id="img-combine-prompt" 
              value={combinePrompt} 
              onChange={(e) => updateState({ combinePrompt: e.target.value })} 
              placeholder="Describe how to combine the images."
              rows={4} 
              className="w-full bg-zinc-900/70 border border-red-500/50 rounded-lg p-3 text-white placeholder-red-200/40 focus:outline-none focus:ring-2 focus:ring-red-500"/>
          </div>

          <button onClick={handleCombineSubmit} disabled={isLoading} className="w-full bg-red-700 hover:bg-red-600 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors uppercase tracking-wider">
            {isLoading ? 'Processing...' : 'Combine Images'}
          </button>
          
          {error && <p className="text-red-300 text-center bg-black/50 p-2 rounded">{error}</p>}
        </div>
        {/* Right side: Result */}
        <div className="bg-black/40 rounded-lg flex flex-col items-center justify-center p-4 min-h-[300px] md:min-h-full border border-red-500/30">
            <div className="w-full flex-1 flex items-center justify-center bg-black/30 rounded-md min-h-0">
                {isLoading && loadingText === 'Combining images...' ? (
                  <Loader text="Combining..." />
                ) : resultImageUrl ? (
                    <img src={resultImageUrl} alt="Combined result" className="rounded-lg max-w-full max-h-full"/>
                ) : (
                  <p className="text-zinc-400 text-center">The combined image will appear here.</p>
                )}
            </div>
            {resultImageUrl && !isLoading && (
                <div className="mt-4">
                    <button 
                        onClick={handleCopyCombinedImage} 
                        disabled={copyStatus === 'copied'} 
                        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900/50 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                        <CopyIcon /> {copyStatus === 'copied' ? 'Copied!' : 'Copy Image'}
                    </button>
                </div>
            )}
        </div>
     </div>
    );
  };
  
  const CustomItemModal = () => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [detail, setDetail] = useState('');
    const [promptText, setPromptText] = useState('');
    
    const handleSave = () => {
        if (modalMode === 'clothing') {
            if (!name.trim() || !promptText.trim()) return;
            const newClothing: CustomClothing = { id: `c-cloth-${Date.now()}`, name, prompt: promptText };
            updateState({ customClothing: [...customClothing, newClothing] });
        } else {
            if (!category.trim() || !detail.trim() || !promptText.trim()) return;
            const newLocation: CustomLocation = { id: `c-loc-${Date.now()}`, category, detail, prompt: promptText };
            updateState({ customLocations: [...customLocations, newLocation] });
        }
        setIsModalOpen(false);
    };
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setIsModalOpen(false)}>
        <div className="bg-zinc-950 rounded-lg w-full max-w-lg border-2 border-red-500/50 p-6 space-y-4" onClick={e => e.stopPropagation()}>
          <h2 className="text-xl font-bold text-red-400 font-black-ops tracking-wider">Add Custom {modalMode === 'clothing' ? 'Clothing' : 'Location'}</h2>
          {modalMode === 'clothing' ? (
            <div>
                <label className="block text-sm font-medium text-red-200/80 mb-1">Clothing Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Leather Jacket" className={commonModalInputClass} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-red-200/80 mb-1">Location Category</label>
                    <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Beach" className={commonModalInputClass} />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-red-200/80 mb-1">Location Detail</label>
                    <input type="text" value={detail} onChange={e => setDetail(e.target.value)} placeholder="e.g., At sunset" className={commonModalInputClass} />
                </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-red-200/80 mb-1">Prompt Text</label>
            <textarea value={promptText} onChange={e => setPromptText(e.target.value)} placeholder="Enter a descriptive prompt..." rows={5} className={commonModalInputClass} />
          </div>
          <div className="flex justify-end gap-4">
            <button onClick={() => setIsModalOpen(false)} className="bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-2 px-4 rounded-md uppercase">Cancel</button>
            <button onClick={handleSave} className="bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-md uppercase">Save</button>
          </div>
        </div>
      </div>
    );
  };


  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-center mb-6 bg-zinc-900/50 border border-red-500/50 p-1 rounded-full max-w-sm mx-auto">
        {/* FIX: Added children to ModeButton components to satisfy the component's prop types. */}
        <ModeButton buttonMode="generate">Generate &amp; Edit</ModeButton>
        {/* FIX: Added children to ModeButton components to satisfy the component's prop types. */}
        <ModeButton buttonMode="combine">Combine</ModeButton>
      </div>

      {error && <p className="text-red-300 text-center bg-black/50 p-3 rounded-lg mb-4">{error}</p>}

      {mode === 'generate' ? renderGenerateMode() : renderCombineMode()}
      
      {isModalOpen && <CustomItemModal />}
      <EditImageModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentImage={currentImage}
        editPrompt={editPrompt}
        onEditPromptChange={handleEditPromptChange}
        onSubmit={handleEditSubmitWithModal}
        isLoading={isLoading}
        loadingText={loadingText}
      />
      <ZoomableViewerModal imageUrl={viewingImage} onClose={() => setViewingImage(null)} />
    </div>
  );
};

export default ImageStudioTab;