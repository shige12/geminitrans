
export enum JobStatus {
  IDLE = 'IDLE',
  ANALYZING_CONTENT = 'ANALYZING_CONTENT',
  GENERATING_SPEECH = 'GENERATING_SPEECH',
  MERGING_VIDEO = 'MERGING_VIDEO',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface VideoJob {
  id: string;
  file: File;
  status: JobStatus;
  progress: number; // 0-100
  thumbnailUrl?: string;
  originalText?: string;
  translatedText?: string;
  generatedAudioUrl?: string; // Blob URL (WAV)
  finalVideoUrl?: string; // Blob URL (MP4)
  voiceProfile?: VoiceProfile;
  error?: string;
}

export interface VoiceProfile {
  gender: 'MALE' | 'FEMALE';
  tone: 'CALM' | 'ENERGETIC' | 'DEEP' | 'NEUTRAL';
  recommendedVoice: string;
}

export const AVAILABLE_VOICES = [
  { name: 'Puck', gender: 'Male', style: 'Energetic' },
  { name: 'Charon', gender: 'Male', style: 'Deep/Calm' },
  { name: 'Kore', gender: 'Female', style: 'Calm' },
  { name: 'Fenrir', gender: 'Male', style: 'Strong' },
  { name: 'Zephyr', gender: 'Female', style: 'Energetic' },
];

export interface VideoAnalysisResult {
  gender: 'MALE' | 'FEMALE';
  tone: 'CALM' | 'ENERGETIC' | 'DEEP' | 'NEUTRAL';
  englishScript: string;
  chineseScript: string;
}
