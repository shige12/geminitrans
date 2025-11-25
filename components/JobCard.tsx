import React, { useRef, useEffect, useState } from 'react';
import { VideoJob, JobStatus, VoiceProfile } from '../types';

interface JobCardProps {
  job: VideoJob;
  onRemove: (id: string) => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onRemove }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Logic: If we have a final video, use it as source. Otherwise use original file.
  useEffect(() => {
    if (job.finalVideoUrl) {
      setPreviewUrl(job.finalVideoUrl);
    } else if (job.file) {
      const url = URL.createObjectURL(job.file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [job.file, job.finalVideoUrl]);

  const togglePlay = () => {
    // Fix: Cast to any to avoid missing property errors (play/pause)
    const videoEl = videoRef.current as any;
    const audioEl = audioRef.current as any;

    if (!videoEl) return;

    if (isPlaying) {
      videoEl.pause();
      // Only pause external audio if we are NOT watching the final video (which has its own audio)
      if (!job.finalVideoUrl && audioEl) {
        audioEl.pause();
      }
    } else {
      // If separate audio exists and we don't have a final video yet, sync them
      if (!job.finalVideoUrl && audioEl) {
        audioEl.currentTime = videoEl.currentTime;
        audioEl.play();
      }
      videoEl.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    // Fix: Cast to any to avoid missing property errors (currentTime)
    const videoEl = videoRef.current as any;
    const audioEl = audioRef.current as any;
    
    if(videoEl) videoEl.currentTime = 0;
    if(audioEl) audioEl.currentTime = 0;
  };

  const statusColors = {
    [JobStatus.IDLE]: 'bg-gray-600',
    [JobStatus.ANALYZING_CONTENT]: 'bg-purple-600',
    [JobStatus.GENERATING_SPEECH]: 'bg-orange-600',
    [JobStatus.MERGING_VIDEO]: 'bg-pink-600',
    [JobStatus.COMPLETED]: 'bg-green-600',
    [JobStatus.ERROR]: 'bg-red-600',
  };

  const statusText = {
    [JobStatus.IDLE]: 'Waiting...',
    [JobStatus.ANALYZING_CONTENT]: 'Analyzing & Translating...',
    [JobStatus.GENERATING_SPEECH]: 'Cloning Voice (TTS)...',
    [JobStatus.MERGING_VIDEO]: 'Merging Audio & Video...',
    [JobStatus.COMPLETED]: 'Done',
    [JobStatus.ERROR]: 'Failed',
  };

  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700 animate-fadeIn">
      <div className="p-4 flex gap-4">
        {/* Video Preview */}
        <div className="relative w-48 h-32 bg-black rounded-lg overflow-hidden shrink-0 group">
          <video
            ref={videoRef}
            src={previewUrl}
            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
            // Mute if we are playing original video + generated audio separate file
            // Unmute if we are playing final merged video
            muted={!!job.generatedAudioUrl && !job.finalVideoUrl}
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          
          {/* Helper audio for intermediate state (TTS done, but not merged) */}
          {job.generatedAudioUrl && !job.finalVideoUrl && (
            <audio ref={audioRef} src={job.generatedAudioUrl} />
          )}

          {job.status === JobStatus.COMPLETED && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/10 transition-colors"
            >
              {isPlaying ? (
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
          )}
        </div>

        {/* Info & Status */}
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-lg truncate max-w-[250px]">{job.file.name}</h3>
              <button onClick={() => onRemove(job.id)} className="text-gray-400 hover:text-red-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {(job.file.size / (1024 * 1024)).toFixed(2)} MB
            </div>
          </div>

          <div className="space-y-2">
            {job.voiceProfile && (
              <div className="flex items-center gap-2 text-xs bg-gray-700/50 p-2 rounded border border-gray-600 w-fit">
                <span className="text-gray-300">Detected:</span>
                <span className="font-mono text-cyan-300">{job.voiceProfile.gender} / {job.voiceProfile.tone}</span>
                <span className="text-gray-500">→</span>
                <span className="text-green-300">Using {job.voiceProfile.recommendedVoice}</span>
              </div>
            )}

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className={`${job.status === JobStatus.ERROR ? 'text-red-400' : 'text-cyan-400'}`}>
                   {job.error ? job.error : statusText[job.status]}
                </span>
                <span>{Math.round(job.progress)}%</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${statusColors[job.status]}`}
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Result Actions */}
      {job.status === JobStatus.COMPLETED && job.finalVideoUrl && (
        <div className="bg-gray-750 px-4 py-3 border-t border-gray-700 flex justify-between items-center bg-gray-800/50">
           <div className="text-xs text-gray-400 truncate max-w-[50%] italic">
             "{job.translatedText}"
           </div>
           <div className="flex gap-2">
             <a
               href={job.generatedAudioUrl}
               download={`audio_${job.file.name.replace(/\.[^/.]+$/, "")}.wav`}
               className="px-3 py-1.5 border border-gray-600 hover:bg-gray-700 text-xs rounded text-gray-300 flex items-center gap-1 transition-colors"
             >
               Audio Only
             </a>
             <a
               href={job.finalVideoUrl}
               download={`dubbed_${job.file.name.replace(/\.[^/.]+$/, "")}.mp4`}
               className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-xs rounded text-white flex items-center gap-1 transition-colors shadow-lg shadow-cyan-900/20"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               Download Video
             </a>
           </div>
        </div>
      )}
    </div>
  );
};

export default JobCard;