import { GoogleGenAI, Modality, Type } from "@google/genai";
import { VideoAnalysisResult } from "../types";

// Helper for exponential backoff retry
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    console.warn(`API call failed, retrying... (${retries} attempts left)`, error);
    await new Promise(r => setTimeout(r, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

// Helper to convert file to base64
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const analyzeVideoContent = async (file: File): Promise<VideoAnalysisResult> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = await fileToGenerativePart(file);
  
  // Ensure we have a valid mimeType, defaulting to mp4 if the file object is missing it
  const mimeType = file.type || 'video/mp4';

  return retry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: `Analyze this video. 
            1. Identify the gender (MALE/FEMALE) and tone (CALM/ENERGETIC/DEEP/NEUTRAL) of the main speaker.
            2. Transcribe the English speech.
            3. Translate the speech into natural Chinese suitable for dubbing (roughly matching the duration).
            Return a single JSON object.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gender: { type: Type.STRING, enum: ['MALE', 'FEMALE'] },
            tone: { type: Type.STRING, enum: ['CALM', 'ENERGETIC', 'DEEP', 'NEUTRAL'] },
            englishScript: { type: Type.STRING },
            chineseScript: { type: Type.STRING }
          },
          required: ['gender', 'tone', 'englishScript', 'chineseScript']
        }
      }
    });

    if (!response.text) throw new Error("Empty response from Gemini API");
    return JSON.parse(response.text) as VideoAnalysisResult;
  });
};

export const generateChineseSpeech = async (text: string, voiceName: string): Promise<Blob> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey });

  return retry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Failed to generate audio.");

    // Fix: Cast window to any to access atob
    const binaryString = (window as any).atob(base64Audio);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Return raw PCM bytes wrapped in a generic blob (will be converted to WAV later)
    return new Blob([bytes], { type: 'application/octet-stream' });
  });
};

export const pcmToWav = (pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Blob => {
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + pcmData.length, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count
  view.setUint16(22, numChannels, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * numChannels * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, pcmData.length, true);

  // write the PCM samples
  const pcmView = new Uint8Array(buffer, 44);
  pcmView.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};