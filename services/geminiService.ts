// Fix: Use GenerateContentParameters instead of deprecated GenerateContentRequest.
import { GoogleGenAI, GenerateContentParameters, GenerateVideosOperation, Modality } from "@google/genai";

// Initialize the Google GenAI client
// Per guidelines, API key must be from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const GENERATION_SYSTEM_INSTRUCTION = `SYSTEM RULES (MANDATORY — NON-NEGOTIABLE):
You must generate a strictly photorealistic image based on the reference photo. Do NOT retouch or alter the face. Do NOT smooth skin, fix asymmetry, remove wrinkles, or beautify. Preserve identity at 100% fidelity: bone structure, jawline, pores, nasolabial folds, scars, spots, eye bags, hairline, and natural age.  

NO AUTOMATIC IMPROVEMENTS. Do NOT idealize or correct anything (symmetry, weight, teeth, proportions, etc).

DEVICE BAN:
You must NOT generate any visible “phone,” “smartphone,” “device,” “screen,” “HUD,” “UI layer,” “frame interface,” or “camera reflection.”  
The word “phone” is banned.  
Use only: “front-facing handheld camera.” The camera is invisible and out of frame.

---

SCENE & POSE:
Setting: inside a modern car, driver’s seat (left-hand drive).  
Pose: shoulders almost square to the seat (0–5° torso rotation). Right hand rests on the steering wheel (partly visible in lower-right corner). Left forearm extends slightly toward the camera (as if holding a handheld camera at arm’s length, 45–60 cm).  
The camera itself is NOT visible.

Head is centered. Upper torso in frame. Dashboard, left A-pillar, side mirror base, and part of roof console visible. 

Camera angle control (horizontal):
- Use numeric input: 1 to 9  
  1 = strong left camera offset (–35°), 5 = centered (0°), 9 = strong right offset (+35°)  
  Default if unset = 5

Camera angle control (vertical):
- Use numeric input: 1 to 9  
  1 = strong low angle (–15°), 5 = selfie-level low angle (–5°), 9 = high angle (+10°)  
  Default if unset = 5

Default camera setting:
- Horizontal = 5 (center), Vertical = 5 (slightly below eye level, –5°)
- Distance = 45–60 cm from subject
- Focal length equivalent: 26–30 mm
- Slight upward lens tilt toward face for natural selfie framing

---

BACKGROUND & LIGHTING:
Background visible through windows: underground parking lot (grey concrete pillars with red/white markings, parked cars, cool white overhead strip lights).  
Interior lighting: soft cabin roof light + ambient spill from parking garage.  
Balanced exposure. Realistic contrast. Natural skin shadows under eyes and chin. No glow, no bloom, no bokeh unless physically accurate.

---

CLOTHING:
Casual modern wear: dark navy, lightweight quilted puffer jacket (zipped to mid-chest), with a dark crew-neck T-shirt underneath. Jeans.  
Clothing fabric must look real: correct stitching, texture, fold physics. No huge logos or fantasy cloth unless user adds them.

---

IMAGE STYLE:
High-quality photorealistic photograph (not CGI, not painting). True-to-life color reproduction. Natural contrast. No beautification or skin smoothing. Accurate autofocus. Real-world shot from handheld front-facing camera.

PRIORITY STACK:
1. Face identity accuracy  
2. Handheld camera geometry  
3. Pose consistency  
4. Lighting and background realism  
5. Clothing  
6. Environment realism

If any conflict arises, identity + camera geometry ALWAYS take priority.`;

/**
 * Generates text content based on a prompt, with optional configurations.
 */
export const generateText = async (
  prompt: string,
  image: { base64: string; mimeType: string } | null,
  useThinkingMode: boolean,
  useMaps: boolean,
  location: { latitude: number; longitude: number } | null
) => {
  // Model selection based on task
  const modelName = useThinkingMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

  // Fix: Use GenerateContentParameters instead of deprecated GenerateContentRequest.
  const request: GenerateContentParameters = {
    model: modelName,
    contents: prompt,
    config: {},
  };
  
  if (image) {
    const imagePart = {
      inlineData: { data: image.base64, mimeType: image.mimeType },
    };
    const textPart = { 
      text: prompt || 'Analyze this image and generate a detailed prompt to recreate it realistically. Describe camera angle, lighting, and composition. For clothing, suggest simple, plain attire.' 
    };
    request.contents = { parts: [imagePart, textPart] };
    request.config.systemInstruction = `You are an expert photo analyst. Your task is to analyze the user-provided image and generate a detailed, descriptive prompt for an AI image generator to recreate a similar scene. Focus on camera angle, composition, lighting, subject's pose, and environment. If clothing is not specified by the user, describe it as simple, plain clothing (e.g., 'a plain white t-shirt and blue jeans'). The generated prompt should be in a realistic, photorealistic style.`;
  } else {
    request.contents = prompt;
    // Apply grounding tools only if no image is provided
    if (useMaps && location) {
      request.config.tools = [{ googleMaps: {} }];
      request.config.toolConfig = {
          retrievalConfig: {
              latLng: {
                  latitude: location.latitude,
                  longitude: location.longitude
              }
          }
      }
    }
  }

  // Apply thinking config if enabled
  if (useThinkingMode) {
      // FIX: Use max thinking budget for gemini-2.5-pro for complex tasks.
      request.config.thinkingConfig = { thinkingBudget: 32768 };
  }

  // Generate content
  const response = await ai.models.generateContent(request);

  const text = response.text;
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

  return { text, groundingChunks };
};

/**
 * Analyzes a video by sampling frames and sending a multimodal prompt.
 */
export const analyzeVideo = async (prompt: string, frames: string[]) => {
    const modelName = 'gemini-2.5-pro'; // Good for complex reasoning

    const imageParts = frames.map(frame => ({
        inlineData: {
            mimeType: 'image/jpeg',
            data: frame,
        },
    }));

    const textPart = { text: prompt };
    
    const contents = { parts: [textPart, ...imageParts] };

    const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
    });
    
    return response.text;
};

/**
 * Generates a video using the Veo model.
 */
export const generateVideo = async (
    prompt: string,
    imageBase64: string,
    mimeType: string,
    aspectRatio: '16:9' | '9:16'
): Promise<GenerateVideosOperation> => {
    // FIX: Create a new AI instance right before the call to ensure the latest API key is used for video generation.
    const videoAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Prepend the detailed system instruction to the user's prompt.
    const fullPrompt = `${GENERATION_SYSTEM_INSTRUCTION}\n\n---\n\nUser Prompt:\n${prompt}`;

    let operation = await videoAI.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: fullPrompt,
        image: {
            imageBytes: imageBase64,
            mimeType: mimeType,
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: aspectRatio
        }
    });

    return operation;
};

/**
 * Polls for the status of a video generation operation.
 */
export const getVideosOperation = async (operation: GenerateVideosOperation): Promise<GenerateVideosOperation> => {
    // FIX: Create a new AI instance right before the call to ensure the latest API key is used for video generation.
    const videoAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return await videoAI.operations.getVideosOperation({ operation: operation });
};


/**
 * Generates an image using the Imagen model.
 */
export const generateImage = async (prompt: string, aspectRatio: string, numberOfImages: number = 1): Promise<string[]> => {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
            numberOfImages: numberOfImages,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        },
    });

    return response.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);
};

/**
 * Edits an image using Gemini Flash Image model.
 */
export const editImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    const imagePart = {
        inlineData: {
            data: imageBase64,
            mimeType: mimeType,
        },
    };
    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
            systemInstruction: GENERATION_SYSTEM_INSTRUCTION,
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:image/png;base64,${base64ImageBytes}`;
        }
    }
    
    throw new Error("No image was generated by the model.");
};

/**
 * Combines multiple images with a text prompt.
 */
export const combineImages = async (prompt: string, images: { base64: string; mimeType: string }[]): Promise<string> => {
    const textPart = { text: prompt };
    const imageParts = images.map(image => ({
        inlineData: {
            data: image.base64,
            mimeType: image.mimeType,
        },
    }));

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [textPart, ...imageParts] },
        config: {
            responseModalities: [Modality.IMAGE],
            systemInstruction: GENERATION_SYSTEM_INSTRUCTION,
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            return `data:image/png;base64,${base64ImageBytes}`;
        }
    }
    
    throw new Error("No image was generated by the model.");
};