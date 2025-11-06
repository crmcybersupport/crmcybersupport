import React, { useState, useEffect, useRef } from 'react';
import { analyzeVideo, generateVideo, getVideosOperation } from '../services/geminiService';
import { fileToDataUrl, dataUrlToFile, fileToBase64 } from '../utils/fileUtils';
import Loader from './Loader';
import ApiKeySelector from './ApiKeySelector';
import { useProject, VideoStudioState } from '../contexts/ProjectContext';
import { StoredImage, StoredVideo } from '../types';

type Mode = 'analyze' | 'generate';
type AspectRatio = '16:9' | '9:16';

const FRAME_COUNT = 10; // Number of frames to sample for analysis

const clothingOptions = {
    'Классический костюм': 'a classic suit',
    'Повседневная одежда': 'casual clothes',
    'Клетчатая рубашка': 'a plaid shirt',
    'Бабушкина кофта с деталями': "a grandma's sweater with intricate details",
};

const locationOptions = {
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

const commonInputClass = "w-full bg-zinc-900/70 border border-red-500/50 rounded-lg p-3 text-white placeholder-red-200/40 focus:outline-none focus:ring-2 focus:ring-red-500";

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

const VideoPromptBuilder = ({
  state,
  updateState,
}: {
  state: VideoStudioState;
  updateState: (updates: Partial<VideoStudioState>) => void;
}) => {
  const { 
    selectedClothing, selectedLocation, selectedLocationDetail,
    cameraHorizontal, cameraVertical, address
  } = state;
  return (
    <div className="space-y-4 p-4 bg-black/30 backdrop-blur-sm rounded-lg border border-red-500/30">
        <h3 className="text-lg font-semibold text-red-400 font-black-ops tracking-wider">PROMPT BUILDER</h3>
        
        {/* Clothing */}
        <div>
            <label className="block text-sm font-medium text-red-200/80 mb-2">3. Clothing</label>
            <div className="flex flex-wrap gap-2">
                {Object.keys(clothingOptions).map(key => (
                    <button 
                        key={key} 
                        onClick={() => updateState({ selectedClothing: key })}
                        className={`py-2 px-3 rounded-lg border-2 text-sm transition-colors ${selectedClothing === key ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800/50 border-zinc-600/50 hover:bg-zinc-700/50'}`}
                    >{key}</button>
                ))}
            </div>
        </div>

        {/* Location */}
        <div>
            <label className="block text-sm font-medium text-red-200/80 mb-2">4. Location</label>
            <div className="space-y-3">
                {Object.keys(locationOptions).map(locKey => (
                    <div key={locKey}>
                        <p className="text-sm font-semibold text-red-300">{locKey}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                             {Object.keys(locationOptions[locKey as keyof typeof locationOptions]).map(detailKey => (
                                <button 
                                    key={detailKey} 
                                    onClick={() => updateState({ selectedLocation: locKey, selectedLocationDetail: detailKey })}
                                    className={`py-2 px-3 rounded-lg border-2 text-sm transition-colors ${selectedLocation === locKey && selectedLocationDetail === detailKey ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800/50 border-zinc-600/50 hover:bg-zinc-700/50'}`}
                                >{detailKey}</button>
                             ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="space-y-3">
             <h3 className="text-sm font-medium text-red-200/80">5. Camera Angle</h3>
             <AngleControl 
                label="Vertical"
                value={cameraVertical}
                onChange={(val) => updateState({ cameraVertical: val })}
                descriptions={{1: 'Extreme Low', 2: 'Low', 3: 'Mid-Low', 4: 'Slight Low', 5: 'Eye-Level', 6: 'Slight High', 7: 'Mid-High', 8: 'High', 9: 'Extreme High'}}
             />
             <AngleControl 
                label="Horizontal"
                value={cameraHorizontal}
                onChange={(val) => updateState({ cameraHorizontal: val })}
                descriptions={{1: 'Far Left', 2: 'Left', 3: 'Mid-Left', 4: 'Slight Left', 5: 'Frontal', 6: 'Slight Right', 7: 'Mid-Right', 8: 'Right', 9: 'Far Right'}}
             />
        </div>

        <div>
            <label htmlFor="vid-address" className="block text-sm font-medium text-red-200/80 mb-2">6. Location Address (Optional)</label>
            <input id="vid-address" type="text" value={address} onChange={e => updateState({ address: e.target.value })} placeholder="e.g., 1600 Amphitheatre Parkway, Mountain View, CA" className={commonInputClass}/>
        </div>
    </div>
  );
}


// --- Main Component ---

const VideoStudioTab: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  const { projectState, setProjectState } = useProject();
  const { videoStudio: state } = projectState;
  const { 
    mode, analysisPrompt, videoFile, analysisResult, 
    generationPrompt, imageFile, generatedVideoUrl, aspectRatio, 
    jobTitle, age, facialFeatures
  } = state;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApiKeySelected, setIsApiKeySelected] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const updateState = (updates: Partial<VideoStudioState>) => {
    setProjectState(prev => ({
      ...prev,
      videoStudio: { ...prev.videoStudio, ...updates },
    }));
  };

  useEffect(() => {
    if (mode === 'generate') {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        // @ts-ignore
        window.aistudio.hasSelectedApiKey().then(setIsApiKeySelected);
      }
    }
  }, [mode]);

  // Clean up blob URLs on component unmount or when generatedVideoUrl changes
  useEffect(() => {
    return () => {
        if (generatedVideoUrl && generatedVideoUrl.startsWith('blob:')) {
            URL.revokeObjectURL(generatedVideoUrl);
        }
    };
  }, [generatedVideoUrl]);

  const handleModeChange = (newMode: Mode) => {
    setError(null);
    if (generatedVideoUrl) URL.revokeObjectURL(generatedVideoUrl);
    updateState({
        mode: newMode,
        analysisPrompt: '',
        videoFile: null,
        analysisResult: '',
        generationPrompt: '',
        imageFile: null,
        generatedVideoUrl: null,
    });
  };
  
  const ModeButton = ({ buttonMode, children }: { buttonMode: Mode; children: React.ReactNode }) => (
    <button
      onClick={() => handleModeChange(buttonMode)}
      className={`px-6 py-2 rounded-full text-sm font-bold uppercase transition-all duration-300 w-1/2 ${mode === buttonMode ? 'bg-red-700 text-white' : 'bg-transparent text-red-300/80'}`}
    >
      {children}
    </button>
  );

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const dataUrl = await fileToDataUrl(file);
        updateState({ videoFile: { dataUrl, name: file.name, type: file.type }});
      } catch (err) {
        setError("Failed to load video file.");
      }
    }
  };
  
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const dataUrl = await fileToDataUrl(file);
        updateState({ imageFile: { dataUrl, name: file.name, type: file.type } });
      } catch (err) {
        setError("Failed to load image file.");
      }
    }
  };

  const handleAnalyze = async () => {
    if (!videoFile || !analysisPrompt.trim()) {
      setError("Please upload a video and enter a prompt.");
      return;
    }

    setIsLoading(true);
    setError(null);
    updateState({ analysisResult: '' });

    try {
      const file = await dataUrlToFile(videoFile.dataUrl, videoFile.name, videoFile.type);
      const frames = await sampleFrames(file);
      const result = await analyzeVideo(analysisPrompt, frames);
      updateState({ analysisResult: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(`Analysis failed: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sampleFrames = (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return reject("Video or canvas element not found.");

      const videoUrl = URL.createObjectURL(file);
      video.src = videoUrl;
      const frames: string[] = [];
      
      video.onloadedmetadata = () => {
        const duration = video.duration;
        let processedFrames = 0;

        for (let i = 0; i < FRAME_COUNT; i++) {
          const time = (duration / FRAME_COUNT) * i;
          video.currentTime = time;
        }

        video.onseeked = () => {
          if (processedFrames < FRAME_COUNT) {
             const ctx = canvas.getContext('2d');
              if (!ctx) return;
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg');
              frames.push(dataUrl.split(',')[1]);
              processedFrames++;

              if (processedFrames === FRAME_COUNT) {
                 URL.revokeObjectURL(videoUrl);
                 resolve(frames);
              }
          }
        };
      };
      video.onerror = (e) => reject("Error loading video for frame sampling.");
    });
  };

  const handleBuildPrompt = () => {
    const { 
        selectedClothing, selectedLocation, selectedLocationDetail, 
        jobTitle, age, facialFeatures, address,
        cameraHorizontal, cameraVertical
    } = state;
    
    let newPrompt = '';
    
    const getClothingDescription = () => {
        return clothingOptions[selectedClothing as keyof typeof clothingOptions];
    };

    const persona = `The subject is a ${jobTitle || 'person'}${age ? ` who is around ${age} years old` : ''}.${facialFeatures ? ` Modify or add these facial features: ${facialFeatures}.` : ''}`;
    const camera = getCameraAngleDescription(cameraHorizontal, cameraVertical);
    const addressInfo = address ? `The background details should be subtly influenced by this address: "${address}".` : '';

    if (selectedLocation === 'Машина' && selectedLocationDetail === 'За рулем') {
        const basePrompt = `A realistic short video selfie based on a reference photo. Keep the face identity, age, and all facial details unchanged (no retouching or beautification; preserve skin texture, pores, wrinkles, moles, fine hairs). {persona} Neutral, calm expression with natural, subtle movements like blinking and slight head turns.
Setting: inside a modern car, driver’s seat (left-hand drive).
Pose/Framing: shoulders almost square to the seat (turn 0–5° only). Right hand on the steering wheel (part of wheel visible at lower-right). Left forearm extends toward the camera from lower-left as if holding the phone; phone out of frame. Head centered; upper torso in frame; dashboard, left A-pillar and roof console visible.
Camera geometry: handheld at arm’s length ~45–60 cm. {camera} Focal length ≈ 28–30 mm equiv. Keep verticals mostly straight (no strong side shift).
Background: underground parking through windows (concrete pillars with red/white markings, parked cars, fluorescent strip lights). {address}
Lighting: soft interior roof light + ambient from the garage; balanced exposure; gentle shadows under eyes and chin; natural reflections; no cinematic glow.
Clothing: {clothing}.
Style: high-quality realistic video; true-to-life color, moderate contrast, natural shadow depth.`;

        const clothingDesc = getClothingDescription() || 'dark navy lightweight quilted/puffer jacket, zipped to mid-chest; dark crew-neck/T-shirt underneath; jeans; no hat, minimal/no visible logos';

        newPrompt = basePrompt
            .replace('{persona}', persona)
            .replace('{camera}', camera)
            .replace('{address}', addressInfo)
            .replace('{clothing}', clothingDesc);

    } else if (selectedLocation === 'Офис' && selectedLocationDetail === 'Стандартный') {
        const basePrompt = `A realistic short video selfie based on a reference photo. Keep the individuality of the face, age, and all facial details unchanged (no retouching or beautification; preserve skin texture, pores, wrinkles, moles, and fine hairs). {persona} Neutral, confident facial expression with subtle, natural movements.
The person is sitting in a black leather office chair in a private office. The posture is upright, shoulders relaxed, and the body is turned slightly to the right (~10–15°).
{camera} This creates a mild upward and sideward angle typical of a seated webcam or handheld selfie placed on a desk.
The framing captures the upper torso and head, with the shoulder line visible and the head centered.
Background: a simple office interior — light beige walls, framed documents or certificates on the wall, a wooden cabinet with folders, and a suspended ceiling with square fluorescent light panels. The environment looks like a typical administrative or executive office. {address}
Lighting: cool white fluorescent ceiling lighting (~5000 K), even and diffused, softly illuminating the face from above. Natural shadows appear under the chin and around the neck.
Clothing: {clothing}.
Style: realistic indoor video, high-quality, natural contrast, true-to-life colors, minimal depth blur. The perspective should feel like an authentic office selfie video taken from a seated position behind the desk.`;
        
        const clothingDesc = getClothingDescription() || 'a dark business jacket over a light shirt';
        
        newPrompt = basePrompt
            .replace('{persona}', persona)
            .replace('{camera}', camera)
            .replace('{address}', addressInfo)
            .replace('{clothing}', clothingDesc);
            
    } else if (selectedLocation === 'Офис' && selectedLocationDetail === 'Простой') {
        const basePrompt = `A realistic short video selfie based on a reference photo. Keep the individuality of the face, age, and all facial details unchanged (no retouching or beautification; preserve skin texture, pores, wrinkles, moles, and fine hairs). {persona} Neutral facial expression with natural, subtle movements.
The person is sitting at an office desk in a chair, looking directly into the camera. The video is framed as if taken by the person themselves at arm’s length, but the phone is not visible.
{camera} This produces a natural handheld selfie perspective with a mild ¾ frontal view from the lower right side.
The desk surface with a few documents, a mug, or a keyboard is partially visible in the lower part of the frame. The body is slightly turned (~15° to the right), but the eyes are focused directly on the camera, giving a realistic in-person feel.
Background: a modest post-Soviet office interior in good condition — plain light walls, ceiling with square fluorescent panels, minimal furniture such as a monitor, a noticeboard, or a small plant. The background should be visually simple and slightly desaturated, keeping focus on the person. {address}
Lighting: soft, even, cool fluorescent office lighting (~4800–5200 K) from the ceiling, evenly illuminating the face and upper body with gentle shadows under the chin and around the neck. No dramatic or cinematic light; just natural indoor brightness.
Clothing: {clothing}.
Style: high-quality realistic video, handheld framing, natural depth, true-to-life skin tones, balanced contrast, and realistic indoor atmosphere.`;
        
        const clothingDesc = getClothingDescription() || 'everyday office attire — a neutral-colored shirt, polo, or light business jacket, appropriate for a modern office, casual but neat';

        newPrompt = basePrompt
            .replace('{persona}', persona)
            .replace('{camera}', camera)
            .replace('{address}', addressInfo)
            .replace('{clothing}', clothingDesc);
            
    } else if (selectedLocation === 'ТЦ' && selectedLocationDetail === 'Кафе/бар') {
        const basePrompt = `A realistic short video selfie based on a reference photo. Keep the individuality of the face, age, and all facial details unchanged (no retouching or beautification; preserve skin texture, pores, wrinkles, moles, and fine hairs). {persona} Neutral facial expression with natural, subtle movements like sipping coffee or glancing around.
The person is sitting in a dark cushioned chair in a cozy café, facing the camera. {camera} This produces a natural ¾ close-up perspective. The framing includes the head, shoulders, and part of the upper torso.
The body is slightly turned (~15° to the right), but the eyes look directly into the camera.
Background: a warm café interior with light-colored walls, wooden shelves with small decorative items (plants, framed photos, cups), and a few people sitting at tables in the background, casually drinking coffee or talking. The background should have moderate depth of field — recognizable but softly defocused, to keep the focus on the person. {address}
Lighting: warm indoor tone (~3800–4200 K), natural and soft, with slight reflections from nearby lights. No cinematic glow or harsh contrast. The lighting is coming from a combination of window daylight and soft ceiling lamps, illuminating the face evenly with gentle shadows under the chin.
Clothing: {clothing}.
Style: high-quality realistic video, handheld selfie perspective, natural depth, authentic café lighting, and balanced color tones with true-to-life textures.`;
        
        const clothingDesc = getClothingDescription() || 'everyday business-casual outfit — a dark blazer or jacket (gray, navy, or charcoal) over a light blouse or white shirt';

        newPrompt = basePrompt
            .replace('{persona}', persona)
            .replace('{camera}', camera)
            .replace('{address}', addressInfo)
            .replace('{clothing}', clothingDesc);

    } else { // Fallback
        const promptParts = [
          `A short video of a ${jobTitle || 'person'}, who looks like the person in the provided image. The video should be in the style of a casual video call (like FaceTime), shot from a handheld phone at arm's length.`,
          `The person is sitting at a table, looking into the camera and speaking or reacting, with natural, subtle movements.`
        ];
    
        promptParts.push(camera);
        if (age) promptParts.push(`The person is around ${age} years old.`);
        if (facialFeatures) promptParts.push(`Key facial features to include or modify: ${facialFeatures}.`);
        if (selectedClothing && clothingOptions[selectedClothing as keyof typeof clothingOptions]) {
            promptParts.push(`The person is wearing ${clothingOptions[selectedClothing as keyof typeof clothingOptions]}.`);
        }
        
        let background = 'The background is a casual room setting, slightly blurred, with details like a lamp or a window.';
        if (selectedLocation && selectedLocationDetail && locationOptions[selectedLocation as keyof typeof locationOptions]?.[selectedLocationDetail as keyof typeof locationOptions[keyof typeof locationOptions]]) {
            const locationDescription = locationOptions[selectedLocation as keyof typeof locationOptions][selectedLocationDetail as keyof typeof locationOptions[keyof typeof locationOptions]];
            background = `The setting is ${locationDescription}, seen from a personal video call perspective.`;
        }
        promptParts.push(background);
        if (address) promptParts.push(addressInfo);
        newPrompt = promptParts.join(' ');
    }

    updateState({ generationPrompt: newPrompt.replace(/\s+/g, ' ').trim() });
  };

  const handleGenerate = async () => {
      if (!imageFile) {
        setError("Please upload an image.");
        return;
      }
      if (!generationPrompt) {
        setError("Please build a prompt first.");
        return;
      }
      setIsLoading(true);
      setError(null);
      if (generatedVideoUrl) URL.revokeObjectURL(generatedVideoUrl);
      updateState({ generatedVideoUrl: null });
      setGenerationStatus("Preparing video generation...");
      
      try {
        const file = await dataUrlToFile(imageFile.dataUrl, imageFile.name, imageFile.type);
        const imageBase64 = await fileToBase64(file);
        
        setGenerationStatus("Sending request to Veo model... This may take a moment.");
        let operation = await generateVideo(generationPrompt, imageBase64, imageFile.type, aspectRatio);
        
        const reassuringMessages = [
          "Compositing video frames...",
          "Applying lighting and shadows...",
          "Rendering audio track...",
          "Finalizing high-resolution output...",
          "Almost there, just polishing the pixels..."
        ];
        let messageIndex = 0;

        while (!operation.done) {
            setGenerationStatus(reassuringMessages[messageIndex % reassuringMessages.length]);
            messageIndex++;
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await getVideosOperation(operation);
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (downloadLink) {
            const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            const blob = await response.blob();
            const videoUrl = URL.createObjectURL(blob);
            updateState({ generatedVideoUrl: videoUrl });
            setGenerationStatus("Video generated successfully!");
        } else {
            throw new Error("Video generation completed, but no download link was found.");
        }

      } catch (err) {
        let msg = err instanceof Error ? err.message : "An unknown error occurred.";
        if (msg.includes("Requested entity was not found.")) {
          msg += " Your API Key might be invalid. Please try selecting it again.";
          setIsApiKeySelected(false);
        }
        setError(`Video generation failed: ${msg}`);
      } finally {
        setIsLoading(false);
      }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-center mb-6 bg-zinc-900/50 border border-red-500/50 p-1 rounded-full max-w-sm mx-auto">
        {/* FIX: Added children to ModeButton components to satisfy the component's prop types. */}
        <ModeButton buttonMode="generate">Generate</ModeButton>
        {/* FIX: Added children to ModeButton components to satisfy the component's prop types. */}
        <ModeButton buttonMode="analyze">Analyze</ModeButton>
      </div>

      {mode === 'analyze' ? (
        <div className="space-y-6 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-red-400 font-black-ops tracking-wider">VIDEO ANALYSIS WITH GEMINI PRO</h2>
          <div>
            <label htmlFor="vid-upload-analyze" className="block text-sm font-medium text-red-200/80 mb-2">Upload Video</label>
            <input id="vid-upload-analyze" type="file" accept="video/*" onChange={handleVideoFileChange} className="block w-full text-sm text-red-200/80 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-800 file:text-white hover:file:bg-red-700 transition-colors"/>
          </div>
          <div>
            <label htmlFor="vid-analysis-prompt" className="block text-sm font-medium text-red-200/80 mb-2">What to analyze?</label>
            <textarea id="vid-analysis-prompt" value={analysisPrompt} onChange={e => updateState({ analysisPrompt: e.target.value })} placeholder="e.g., Summarize the key points of this video." rows={3} className={commonInputClass}/>
          </div>
          <button onClick={handleAnalyze} disabled={isLoading} className="w-full bg-red-800 hover:bg-red-700 border border-red-600 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors uppercase tracking-wider">
            {isLoading ? 'Analyzing...' : 'Analyze Video'}
          </button>
          
          {isLoading && <Loader text="Analyzing video frames..." />}
          {error && <p className="text-red-300 text-center bg-black/50 p-2 rounded">{error}</p>}
          {analysisResult && (
            <div className="bg-zinc-900/50 p-4 rounded-lg border border-red-500/30">
                <h3 className="text-lg font-semibold mb-2 text-red-400">Analysis Result:</h3>
                <p className="whitespace-pre-wrap text-gray-200">{analysisResult}</p>
            </div>
          )}
        </div>
      ) : ( // Generate Mode
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-red-400 font-black-ops tracking-wider">PHOTO-TO-VIDEO WITH VEO</h2>
          {!isApiKeySelected ? (
            <ApiKeySelector onKeySelected={() => setIsApiKeySelected(true)} />
          ) : (
            <>
              {isLoading ? (
                <div className="text-center p-8">
                  <Loader text={generationStatus} />
                </div>
              ) : generatedVideoUrl ? (
                <div className="text-center">
                    <h3 className="text-lg font-semibold mb-4 text-red-300">Your video is ready!</h3>
                    <video src={generatedVideoUrl} controls className="max-w-full mx-auto rounded-lg border-2 border-red-500/50"></video>
                    <button onClick={() => updateState({ generatedVideoUrl: null })} className="mt-6 bg-red-800 hover:bg-red-700 border border-red-600 text-white font-bold py-2 px-4 rounded-lg uppercase">Generate Another Video</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Form */}
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="vid-upload-generate" className="block text-sm font-medium text-red-200/80 mb-2">1. Upload Face Photo</label>
                            <input id="vid-upload-generate" type="file" accept="image/*" onChange={handleImageFileChange} className="block w-full text-sm text-red-200/80 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-800 file:text-white hover:file:bg-red-700 transition-colors"/>
                             {imageFile && <img src={imageFile.dataUrl} alt="Upload preview" className="rounded-lg mt-4 max-h-40 w-auto border-2 border-red-500/50"/>}
                        </div>
                        <div className="p-4 bg-black/30 backdrop-blur-sm rounded-lg border border-red-500/30 space-y-4">
                           <h3 className="text-lg font-semibold text-red-400 font-black-ops tracking-wider">2. CHARACTER DETAILS</h3>
                           <div>
                                <label htmlFor="vid-job-title" className="block text-sm font-medium text-red-200/80 mb-2">Person's Job Title</label>
                                <input id="vid-job-title" type="text" value={jobTitle} onChange={e => updateState({ jobTitle: e.target.value })} placeholder="e.g., Chief Engineer" className={commonInputClass}/>
                            </div>
                            <div>
                                <label htmlFor="vid-age" className="block text-sm font-medium text-red-200/80 mb-2">Age (Optional)</label>
                                <input id="vid-age" type="text" value={age} onChange={e => updateState({ age: e.target.value })} placeholder="e.g., 65" className={commonInputClass}/>
                            </div>
                            <div>
                                <label htmlFor="vid-facial-features" className="block text-sm font-medium text-red-200/80 mb-2">Facial Features / Aging (Optional)</label>
                                <textarea id="vid-facial-features" value={facialFeatures} onChange={e => updateState({ facialFeatures: e.target.value })} placeholder="e.g., Add wrinkles and gray hair" rows={2} className={commonInputClass}/>
                            </div>
                        </div>

                        <VideoPromptBuilder state={state} updateState={updateState} />
                        
                         <div>
                            <label className="block text-sm font-medium text-red-200/80 mb-2">7. Aspect Ratio</label>
                            <div className="flex gap-4">
                                <button onClick={() => updateState({ aspectRatio: '16:9'})} className={`py-2 px-4 rounded-lg border-2 w-full transition-colors ${aspectRatio === '16:9' ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800/50 border-zinc-600/50'}`}>Landscape (16:9)</button>
                                <button onClick={() => updateState({ aspectRatio: '9:16'})} className={`py-2 px-4 rounded-lg border-2 w-full transition-colors ${aspectRatio === '9:16' ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-800/50 border-zinc-600/50'}`}>Portrait (9:16)</button>
                            </div>
                        </div>
                    </div>
                    {/* Preview & Generation */}
                    <div className="space-y-4">
                       <div className="bg-black/30 rounded-lg p-4 border border-red-500/30">
                          <h3 className="text-lg font-semibold text-red-400 mb-2 font-black-ops tracking-wider">8. BUILD & GENERATE</h3>
                           <button onClick={handleBuildPrompt} className="w-full bg-zinc-800 hover:bg-zinc-700 border border-red-500/50 text-white font-bold py-3 px-4 rounded-lg transition-colors uppercase tracking-wider mb-4">
                               Build Prompt
                           </button>
                           <textarea readOnly value={generationPrompt} placeholder="Your generated prompt will appear here..." rows={6} className="w-full bg-zinc-900/70 border border-red-500/50 rounded-lg p-3 text-white placeholder-red-200/40"/>
                       </div>

                        <button onClick={handleGenerate} disabled={isLoading || !imageFile || !generationPrompt} className="w-full bg-red-700 hover:bg-red-600 disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors uppercase tracking-wider">
                            Generate Video
                        </button>
                        {error && <p className="text-red-300 text-center mt-2 bg-black/50 p-2 rounded">{error}</p>}
                    </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
      <video ref={videoRef} style={{ display: 'none' }}></video>
      <canvas ref={canvasRef} style={{ display: 'none' }}></video>
    </div>
  );
};

export default VideoStudioTab;