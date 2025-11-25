import React from 'react';
import DubbingStudio from './components/DubbingStudio';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 text-white selection:bg-cyan-500 selection:text-white">
       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500"></div>
       <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
         <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-bold text-white">
               G
             </div>
             <span className="font-bold text-lg tracking-tight">Gemini<span className="text-cyan-400">Dub</span></span>
           </div>
           <div className="text-sm text-gray-500">
             Powered by Google Gemini 2.5
           </div>
         </div>
       </header>

       <main>
         <DubbingStudio />
       </main>

       <footer className="py-8 text-center text-gray-600 text-sm">
         <p>Warning: Uploads are processed directly by Gemini API. Ensure file size is under 20MB.</p>
       </footer>
    </div>
  );
};

export default App;