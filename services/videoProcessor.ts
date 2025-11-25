import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: any = null;

export const loadFFmpeg = async () => {
  if (ffmpeg) return ffmpeg;

  // URLs for FFmpeg 0.12.10 and Core 0.12.6 via jsdelivr
  const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm';
  const coreBaseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
  
  const originalWorker = (window as any).Worker;

  try {
    // 1. Fetch the worker script text content manually
    // We need to do this to circumvent the browser's Cross-Origin restriction on Worker scripts.
    const workerURL = `${baseURL}/worker.js`;
    const response = await fetch(workerURL);
    let workerScript = await response.text();

    // 2. Fix relative imports within the worker script
    // Because we will load this script from a Blob URL (blob:...), any relative imports (like import "./814.ffmpeg.js")
    // will fail because they would try to load from the blob's path.
    // We replace them with absolute URLs pointing back to the CDN.
    workerScript = workerScript.replace(/from\s+['"]\.\/(.*?)['"]/g, `from '${baseURL}/$1'`);
    workerScript = workerScript.replace(/import\s+['"]\.\/(.*?)['"]/g, `import '${baseURL}/$1'`);

    // 3. Create a Blob URL for the patched worker script
    const workerBlob = new Blob([workerScript], { type: 'text/javascript' });
    const workerBlobURL = URL.createObjectURL(workerBlob);

    // 4. Proxy window.Worker to intercept the FFmpeg worker creation
    (window as any).Worker = class extends originalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
          const urlStr = url.toString();
          // Check if the requested URL matches the ffmpeg worker we expect
          if (urlStr.includes(baseURL) || urlStr.includes('worker.js')) {
              // Pass the local Blob URL instead of the remote CDN URL
              super(workerBlobURL, options);
          } else {
              super(url, options);
          }
      }
    } as any;

    // 5. Dynamically import the FFmpeg class
    // @ts-ignore
    const { FFmpeg } = await import(`${baseURL}/index.js`);
    
    ffmpeg = new FFmpeg();

    // 6. Load FFmpeg with core and wasm Blob URLs
    // We also use Blob URLs for the core and wasm files to ensure they load reliably
    // and to avoid potential path resolution issues within the worker.
    await ffmpeg.load({
      coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  } catch (error) {
    console.error("Failed to load FFmpeg:", error);
    // Restore original worker to avoid side effects if loading fails
    (window as any).Worker = originalWorker;
    throw new Error(`FFmpeg initialization failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return ffmpeg;
};

export const mergeVideoAndAudio = async (videoFile: File, audioBlob: Blob): Promise<Blob> => {
  try {
    const ffmpegInstance = await loadFFmpeg();

    const videoName = 'input.mp4';
    const audioName = 'input.wav';
    const outputName = 'output.mp4';

    // Write files to FFmpeg virtual filesystem
    await ffmpegInstance.writeFile(videoName, await fetchFile(videoFile));
    await ffmpegInstance.writeFile(audioName, await fetchFile(audioBlob));

    // Run FFmpeg command
    // -i video -i audio
    // -c:v copy (copy video stream directly, no re-encoding)
    // -c:a aac (encode audio to aac for mp4 compatibility)
    // -map 0:v:0 (use video from first input)
    // -map 1:a:0 (use audio from second input)
    // -shortest (trim to the shortest stream duration)
    // -y (overwrite output)
    await ffmpegInstance.exec([
      '-i', videoName,
      '-i', audioName,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-shortest',
      '-y',
      outputName
    ]);

    // Read the result
    const data = await ffmpegInstance.readFile(outputName);
    
    // Cleanup
    try {
      await ffmpegInstance.deleteFile(videoName);
      await ffmpegInstance.deleteFile(audioName);
      await ffmpegInstance.deleteFile(outputName);
    } catch (e) {
      console.warn("Cleanup warning:", e);
    }

    return new Blob([data], { type: 'video/mp4' });
  } catch (error) {
    console.error("Merge error:", error);
    throw new Error("Failed to merge video and audio. Please check console for details.");
  }
};
