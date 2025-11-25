import React, { useCallback } from 'react';

interface DropZoneProps {
  onFilesDropped: (files: File[]) => void;
}

const DropZone: React.FC<DropZoneProps> = ({ onFilesDropped }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      // Fix: Cast to any to bypass strict type checks for DataTransfer.files and iterate manually
      const fileList = (e.dataTransfer as any).files;
      const files: File[] = [];
      if (fileList) {
        for (let i = 0; i < fileList.length; i++) {
          files.push(fileList[i]);
        }
      }
      // Fix: Cast to any to access 'type' property safely
      const validFiles = files.filter((f: any) => f.type && f.type.startsWith('video/'));
      if (validFiles.length > 0) onFilesDropped(validFiles);
    },
    [onFilesDropped]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Fix: Cast to any to bypass strict type checks for target.files
    const target = e.target as any;
    if (target.files) {
      const fileList = target.files;
      const files: File[] = [];
      for (let i = 0; i < fileList.length; i++) {
        files.push(fileList[i]);
      }
      // Fix: Cast to any to access 'type'
      const validFiles = files.filter((f: any) => f.type && f.type.startsWith('video/'));
      if (validFiles.length > 0) onFilesDropped(validFiles);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="border-2 border-dashed border-gray-600 rounded-2xl p-12 text-center hover:border-cyan-500 hover:bg-gray-800/50 transition-all cursor-pointer group"
    >
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="p-4 bg-gray-800 rounded-full group-hover:scale-110 transition-transform">
          <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <p className="text-xl font-medium text-white">Drop English videos here</p>
          <p className="text-sm text-gray-400 mt-1">MP4, WEBM, MOV (Max 15MB for demo)</p>
        </div>
        <label className="mt-4 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition-colors cursor-pointer">
          Select Files
          <input type="file" className="hidden" multiple accept="video/*" onChange={handleFileInput} />
        </label>
      </div>
    </div>
  );
};

export default DropZone;