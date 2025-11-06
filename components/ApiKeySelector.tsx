
import React, { useState } from 'react';

interface ApiKeySelectorProps {
  onKeySelected: () => void;
}

const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onKeySelected }) => {
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectKey = async () => {
    setIsSelecting(true);
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // Assume success and notify parent. This handles the race condition.
      onKeySelected();
    } catch (error) {
      console.error("Error opening API key selector:", error);
    } finally {
      setIsSelecting(false);
    }
  };

  return (
    <div className="bg-zinc-900/50 p-6 rounded-lg border-2 border-red-500/50 text-center">
      <h3 className="text-xl font-semibold text-red-400 mb-2 font-black-ops tracking-wider">ACTION REQUIRED</h3>
      <p className="text-gray-300 mb-4">
        Video generation with Veo requires you to select your own API key. This ensures you are aware of potential billing implications.
      </p>
      <p className="text-xs text-zinc-400 mb-6">
        For more information, please see the{" "}
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline hover:text-red-300">
          billing documentation
        </a>.
      </p>
      <button
        onClick={handleSelectKey}
        disabled={isSelecting}
        className="bg-red-600 hover:bg-red-700 border border-red-500 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-300 disabled:bg-red-800 disabled:cursor-not-allowed uppercase"
      >
        {isSelecting ? 'Opening...' : 'Select Your API Key'}
      </button>
    </div>
  );
};

export default ApiKeySelector;
