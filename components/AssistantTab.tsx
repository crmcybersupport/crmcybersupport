import React, { useState, useRef, useEffect } from 'react';
import { generateText } from '../services/geminiService';
import { ChatMessage, GroundingChunk, StoredImage, CustomClothing, CustomLocation } from '../types';
import { SendIcon, LocationIcon, PaperclipIcon, CloseIcon, AddToBuilderIcon } from './Icons';
import Loader from './Loader';
import { useProject } from '../contexts/ProjectContext';
import { fileToDataUrl } from '../utils/fileUtils';

const AssistantTab: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const { projectState, setProjectState } = useProject();
  const { messages } = projectState.assistant;
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useThinkingMode, setUseThinkingMode] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<StoredImage | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [promptToSave, setPromptToSave] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);
  
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      if (isLoading) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      let imageFile: File | null = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const pastedItem = items[i].getAsFile();
          if (pastedItem instanceof File) {
            imageFile = pastedItem;
            break;
          }
        }
      }
      if (imageFile) {
        event.preventDefault();
        const dataUrl = await fileToDataUrl(imageFile);
        setImage({ dataUrl, name: imageFile.name, type: imageFile.type });
      }
    };
    if (isActive) {
      window.addEventListener('paste', handlePaste);
    }
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isLoading, isActive]);

  const handleLocationRequest = () => {
    if (image) {
      setError("Location services cannot be used while an image is attached.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setUseMaps(true);
          setError(null);
        },
        (err) => {
          setError(`Location Error: ${err.message}`);
          setUseMaps(false);
        }
      );
    } else {
      setError("Geolocation is not supported by this browser.");
      setUseMaps(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const dataUrl = await fileToDataUrl(file);
      setImage({ dataUrl, name: file.name, type: file.type });
      e.target.value = ''; // Reset file input
      setUseMaps(false); // Disable maps when image is uploaded
      setLocation(null);
    }
  };

  const setMessages = (newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setProjectState(prev => {
      const updatedMessages = typeof newMessages === 'function' ? newMessages(prev.assistant.messages) : newMessages;
      return {
        ...prev,
        assistant: {
          ...prev.assistant,
          messages: updatedMessages,
        },
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !image) || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: input, image };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setImage(null);
    setIsLoading(true);
    setError(null);

    try {
      const imagePayload = image ? { base64: image.dataUrl.split(',')[1], mimeType: image.type } : null;
      const shouldUseMaps = useMaps && !image; // Disable maps if image is present

      const { text, groundingChunks } = await generateText(input, imagePayload, useThinkingMode, shouldUseMaps, location);
      const modelMessage: ChatMessage = { role: 'model', text, groundingChunks };
      setMessages(prev => [...prev, modelMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(errorMessage);
      setMessages(prev => [...prev, { role: 'model', text: `Sorry, I ran into an error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
      setUseMaps(false); // Reset after each query
      setLocation(null);
    }
  };
  
  const GroundingSource = ({ chunk }: { chunk: GroundingChunk }) => {
    if (chunk.web?.uri) {
      return <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{chunk.web.title || chunk.web.uri}</a>;
    }
    if (chunk.maps?.uri) {
      return <a href={chunk.maps.uri} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">{chunk.maps.title || chunk.maps.uri}</a>;
    }
    return null;
  };

  const handleAddToBuilder = (text: string) => {
    setPromptToSave(text);
    setIsModalOpen(true);
  };
  
  const SaveToBuilderModal = () => {
    const [saveType, setSaveType] = useState<'clothing' | 'location'>('clothing');
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [detail, setDetail] = useState('');
    const [promptText, setPromptText] = useState(promptToSave);

    const handleSave = () => {
        if (saveType === 'clothing') {
            if (!name.trim() || !promptText.trim()) return;
            const newClothing: CustomClothing = {
                id: `c-cloth-${Date.now()}`,
                name,
                prompt: promptText
            };
            setProjectState(prev => ({
                ...prev,
                imageStudio: {
                    ...prev.imageStudio,
                    customClothing: [...prev.imageStudio.customClothing, newClothing]
                }
            }));
        } else {
            if (!category.trim() || !detail.trim() || !promptText.trim()) return;
            const newLocation: CustomLocation = {
                id: `c-loc-${Date.now()}`,
                category,
                detail,
                prompt: promptText
            };
             setProjectState(prev => ({
                ...prev,
                imageStudio: {
                    ...prev.imageStudio,
                    customLocations: [...prev.imageStudio.customLocations, newLocation]
                }
            }));
        }
        setIsModalOpen(false);
        setPromptToSave('');
    };

    const commonInputClass = "w-full bg-zinc-800 border border-red-500/50 rounded-md py-2 px-3 text-white placeholder-red-200/40 focus:outline-none focus:ring-2 focus:ring-red-500";

    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setIsModalOpen(false)}>
        <div className="bg-zinc-950 rounded-lg w-full max-w-lg border-2 border-red-500/50 p-6 space-y-4" onClick={e => e.stopPropagation()}>
          <h2 className="text-xl font-bold text-red-400 font-black-ops tracking-wider">Add to Prompt Builder</h2>
          <div>
            <label className="block text-sm font-medium text-red-200/80 mb-2">Save as:</label>
            <div className="flex gap-4">
                <button onClick={() => setSaveType('clothing')} className={`py-2 px-4 rounded-lg border-2 w-full transition-colors ${saveType === 'clothing' ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800/50 border-zinc-600/50'}`}>Clothing</button>
                <button onClick={() => setSaveType('location')} className={`py-2 px-4 rounded-lg border-2 w-full transition-colors ${saveType === 'location' ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800/50 border-zinc-600/50'}`}>Location</button>
            </div>
          </div>
          {saveType === 'clothing' ? (
            <div>
                <label className="block text-sm font-medium text-red-200/80 mb-1">Clothing Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Summer Dress" className={commonInputClass} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-red-200/80 mb-1">Location Category</label>
                    <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Park" className={commonInputClass} />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-red-200/80 mb-1">Location Detail</label>
                    <input type="text" value={detail} onChange={e => setDetail(e.target.value)} placeholder="e.g., Near the fountain" className={commonInputClass} />
                </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-red-200/80 mb-1">Prompt Text</label>
            <textarea value={promptText} onChange={e => setPromptText(e.target.value)} rows={5} className={commonInputClass} />
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
    <div className="p-4 md:p-6 flex flex-col h-[calc(100vh-14rem)]">
      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xl p-4 rounded-2xl ${msg.role === 'user' ? 'bg-red-800/80 text-white rounded-br-none' : 'bg-zinc-800/70 text-gray-200 rounded-bl-none'}`}>
              {msg.image && (
                <div className="mb-2">
                  <img src={msg.image.dataUrl} alt="User upload" className="rounded-lg max-h-60 w-auto" />
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.text}</p>
              {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                <div className="mt-3 pt-3 border-t border-red-500/30">
                  <h4 className="text-xs font-semibold text-red-300/80 mb-1">Sources:</h4>
                  <ul className="text-xs space-y-1">
                    {msg.groundingChunks.map((chunk, i) => (
                      <React.Fragment key={i}>
                        {(chunk.web?.uri || chunk.maps?.uri) && (
                          <li key={`chunk-${i}`}><GroundingSource chunk={chunk} /></li>
                        )}
                        {chunk.maps?.placeAnswerSources?.reviewSnippets?.map((snippet, j) => (
                          snippet.uri && (
                            <li key={`snippet-${i}-${j}`} className="pl-4">
                              <a href={snippet.uri} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">
                                <span className="italic">Review:</span> "{snippet.snippet}"
                              </a>
                            </li>
                          )
                        ))}
                      </React.Fragment>
                    ))}
                  </ul>
                </div>
              )}
              {msg.role === 'model' && msg.text.trim() && (
                <div className="mt-2 pt-2 border-t border-red-500/30 text-right">
                    <button 
                        onClick={() => handleAddToBuilder(msg.text)}
                        className="inline-flex items-center gap-2 text-xs text-red-300/80 hover:text-white transition-colors p-1"
                        aria-label="Add to Prompt Builder"
                    >
                        <AddToBuilderIcon />
                        <span>Add to Prompt Builder</span>
                    </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-xl p-3 rounded-lg">
              <Loader text={useThinkingMode ? "Engaging deep thought..." : "Processing..."} />
            </div>
          </div>
        )}
        {error && <p className="text-red-400 text-center">{error}</p>}
        <div ref={messagesEndRef} />
      </div>
      <div className="mt-4 pt-4 border-t border-red-500/30">
        {image && (
          <div className="relative w-24 h-24 mb-2 p-1 bg-zinc-800 rounded-lg">
            <img src={image.dataUrl} alt="Preview" className="w-full h-full object-cover rounded" />
            <button
              onClick={() => setImage(null)}
              className="absolute -top-2 -right-2 bg-black hover:bg-red-700 border-2 border-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center transition-transform duration-200 hover:scale-110"
              aria-label="Remove image"
            >
              <CloseIcon />
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 md:gap-4">
          <button type="button" onClick={handleLocationRequest} className={`p-2 rounded-full transition-colors ${useMaps ? 'bg-green-600 text-white ring-2 ring-green-400' : 'bg-zinc-800/70 hover:bg-zinc-700/80 text-red-300/80'} ${image ? 'opacity-50 cursor-not-allowed' : ''}`} aria-label="Use current location">
              <LocationIcon />
          </button>
          <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="hidden"/>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={`p-2 rounded-full transition-colors ${image ? 'bg-red-600 text-white ring-2 ring-red-400' : 'bg-zinc-800/70 hover:bg-zinc-700/80 text-red-300/80'}`} aria-label="Attach image">
            <PaperclipIcon />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={image ? "Add instructions for the image..." : "Ask me anything..."}
            className="flex-1 bg-zinc-900/70 border border-red-500/50 rounded-full py-3 px-5 text-white placeholder-red-200/40 focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button type="submit" disabled={isLoading} className="bg-red-700 hover:bg-red-800 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white p-3 rounded-full transition-colors">
            <SendIcon />
          </button>
        </form>
        <div className="flex items-center justify-center mt-3">
            <label className="flex items-center cursor-pointer">
              <input type="checkbox" checked={useThinkingMode} onChange={(e) => setUseThinkingMode(e.target.checked)} className="sr-only peer" />
              <div className="relative w-11 h-6 bg-zinc-800/70 rounded-full peer peer-focus:ring-2 peer-focus:ring-red-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              <span className="ml-3 text-sm font-medium text-red-300/80 uppercase">Thinking Mode</span>
            </label>
        </div>
      </div>
      {isModalOpen && <SaveToBuilderModal />}
    </div>
  );
};

export default AssistantTab;