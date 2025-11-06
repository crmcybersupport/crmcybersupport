
import React from 'react';

interface LoaderProps {
  text?: string;
}

const Loader: React.FC<LoaderProps> = ({ text = "Thinking..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="relative h-16 w-16">
        <div className="absolute top-0 left-0 h-full w-full rounded-full border-4 border-t-red-500 border-zinc-800/50 animate-spin"></div>
        <div className="absolute top-0 left-0 h-full w-full rounded-full border-4 border-t-red-700 border-zinc-800/50 animate-spin opacity-75" style={{ animationDelay: '0.1s' }}></div>
      </div>
      <p className="mt-4 text-lg text-red-300/80 font-medium tracking-wide uppercase">{text}</p>
    </div>
  );
};

export default Loader;
