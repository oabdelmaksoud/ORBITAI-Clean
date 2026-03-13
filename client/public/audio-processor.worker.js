/**
 * Web Worker for audio processing
 * Handles audio preprocessing in background thread to avoid blocking UI
 */

// Audio processing functions
function preprocessAudioBuffer(audioData, sampleRate, targetSampleRate = 16000) {
  // Simple resampling: linear interpolation
  const ratio = targetSampleRate / sampleRate;
  const newLength = Math.floor(audioData.length * ratio);
  const processed = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i / ratio;
    const index = Math.floor(srcIndex);
    const fraction = srcIndex - index;
    
    if (index + 1 < audioData.length) {
      processed[i] = audioData[index] * (1 - fraction) + audioData[index + 1] * fraction;
    } else {
      processed[i] = audioData[index] || 0;
    }
  }
  
  // Apply high-pass filter (remove low-frequency noise)
  const cutoff = 80; // Hz
  const rc = 1.0 / (cutoff * 2 * Math.PI);
  const dt = 1.0 / targetSampleRate;
  const alpha = rc / (rc + dt);
  
  let prevInput = 0;
  let prevOutput = 0;
  
  for (let i = 0; i < processed.length; i++) {
    const input = processed[i];
    const output = alpha * (prevOutput + input - prevInput);
    processed[i] = output;
    prevInput = input;
    prevOutput = output;
  }
  
  // Normalize audio
  let max = 0;
  for (let i = 0; i < processed.length; i++) {
    const abs = Math.abs(processed[i]);
    if (abs > max) max = abs;
  }
  
  if (max > 0) {
    const normalizationFactor = Math.min(0.95 / max, 2.0); // Max 2x gain
    for (let i = 0; i < processed.length; i++) {
      processed[i] *= normalizationFactor;
    }
  }
  
  return processed;
}

// Convert Float32Array to WAV
function float32ToWav(audioData, sampleRate) {
  const length = audioData.length;
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * 2, true);
  
  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return buffer;
}

// Listen for messages from main thread
self.onmessage = function(e) {
  const { audioData, sampleRate, targetSampleRate, id } = e.data;
  
  try {
    // Process audio in background
    const processed = preprocessAudioBuffer(audioData, sampleRate, targetSampleRate);
    
    // Convert to WAV
    const wavBuffer = float32ToWav(processed, targetSampleRate);
    
    // Send result back
    self.postMessage({
      id,
      success: true,
      wavBuffer: wavBuffer,
      processedLength: processed.length
    }, [wavBuffer]);
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message
    });
  }
};



