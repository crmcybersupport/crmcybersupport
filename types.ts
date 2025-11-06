// Store image file data for serialization
export interface StoredImage {
    dataUrl: string;
    name: string;
    type: string;
}

export interface ImageHistoryEntry {
    dataUrl: string;
    mimeType: string;
}

export interface StoredVideo {
    dataUrl: string;
    name: string;
    type: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: StoredImage;
  groundingChunks?: GroundingChunk[];
}

export interface GroundingChunk {
  web?: {
    // Fix: Made uri and title optional to match SDK type.
    uri?: string;
    title?: string;
  };
  maps?: {
    // Fix: Made uri and title optional to match SDK type.
    uri?: string;
    title?: string;
    // FIX: Corrected `placeAnswerSources` to be an object instead of an array of objects to match the SDK type.
    placeAnswerSources?: {
        // FIX: Update reviewSnippets to fully match the SDK type.
        reviewSnippets?: {
            uri?: string;
            title?: string;
            snippet?: string;
            author?: string;
        }[];
    }
  };
}

export interface CustomClothing {
  id: string;
  name: string;
  prompt: string;
}

export interface CustomLocation {
  id: string;
  category: string;
  detail: string;
  prompt: string;
}