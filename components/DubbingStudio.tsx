
import React, { useState, useCallback } from 'react';
import DropZone from './DropZone';
import JobCard from './JobCard';
import { VideoJob, JobStatus, VoiceProfile } from '../types';
import { analyzeVideoContent, generateChineseSpeech, pcmToWav } from '../services/geminiService';
import { mergeVideoAndAudio } from '../services/videoProcessor';

const DubbingStudio: React.FC = () => {
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addFiles = useCallback((files: File[]) => {
    const newJobs: VideoJob[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: JobStatus.IDLE,
      progress: 0,
    }));
    setJobs(prev => [...prev, ...newJobs]);
  }, []);

  const removeJob = (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const processJob = async (job: VideoJob) => {
    if (job.status === JobStatus.COMPLETED) return;

    const updateJob = (updates: Partial<VideoJob>) => {
      setJobs(current => current.map(j => j.id === job.id ? { ...j, ...updates } : j));
    };

    try {
      // Step 1: Combined Analysis (Tone + Transcription + Translation)
      updateJob({ status: JobStatus.ANALYZING_CONTENT, progress: 10 });
      
      const analysis = await analyzeVideoContent(job.file);
      updateJob({ progress: 40 });
      
      // Determine Voice
      let recommendedVoice = 'Puck';
      if (analysis.gender === 'FEMALE') {
        recommendedVoice = analysis.tone === 'ENERGETIC' ? 'Zephyr' : 'Kore';
      } else {
        recommendedVoice = analysis.tone === 'DEEP' || analysis.tone === 'CALM' ? 'Charon' : 'Fenrir';
      }

      const voiceProfile: VoiceProfile = { 
        gender: analysis.gender,
        tone: analysis.tone,
        recommendedVoice 
      };

      updateJob({
        voiceProfile,
        originalText: analysis.englishScript,
        translatedText: analysis.chineseScript,
        progress: 60
      });

      // Step 2: Generate Speech (TTS)
      updateJob({ status: JobStatus.GENERATING_SPEECH, progress: 70 });
      const rawPcmBlob = await generateChineseSpeech(analysis.chineseScript, recommendedVoice);
      
      // Convert raw PCM blob to WAV
      const arrayBuffer = await rawPcmBlob.arrayBuffer();
      const pcmData = new Uint8Array(arrayBuffer);
      const wavBlob = pcmToWav(pcmData);
      const audioUrl = URL.createObjectURL(wavBlob);
      
      updateJob({ generatedAudioUrl: audioUrl, progress: 85 });

      // Step 3: Merge Audio & Video
      updateJob({ status: JobStatus.MERGING_VIDEO, progress: 90 });
      const finalVideoBlob = await mergeVideoAndAudio(job.file, wavBlob);
      const finalVideoUrl = URL.createObjectURL(finalVideoBlob);

      updateJob({
        status: JobStatus.COMPLETED,
        progress: 100,
        finalVideoUrl: finalVideoUrl
      });

    } catch (error: any) {
      console.error("Processing error", error);
      updateJob({
        status: JobStatus.ERROR,
        error: error.message || "Unknown error",
        progress: 0
      });
    }
  };

  const startBatch = async () => {
    setIsProcessing(true);
    const idleJobs = jobs.filter(j => j.status === JobStatus.IDLE);
    // Run sequentially to avoid hitting rate limits or browser memory limits with FFmpeg/Uploads
    for (const job of idleJobs) {
        await processJob(job);
    }
    setIsProcessing(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 mb-2">
          Gemini Video Dubber
        </h1>
        <p className="text-gray-400">
          Translate English videos to Chinese while maintaining voice gender and tone.
        </p>
      </div>

      <div className="space-y-6">
        <DropZone onFilesDropped={addFiles} />

        {jobs.length > 0 && (
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Queue ({jobs.length})</h2>
            <button
              onClick={startBatch}
              disabled={isProcessing || jobs.every(j => j.status === JobStatus.COMPLETED)}
              className={`px-6 py-2 rounded-lg font-bold shadow-lg transition-all ${
                isProcessing || jobs.every(j => j.status === JobStatus.COMPLETED)
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white transform hover:-translate-y-0.5'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Start Batch Dubbing'}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {jobs.map(job => (
            <JobCard key={job.id} job={job} onRemove={removeJob} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DubbingStudio;
