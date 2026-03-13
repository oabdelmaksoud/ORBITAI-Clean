import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  inputAnalyser: AnalyserNode | null;
  outputAnalyser: AnalyserNode | null;
  isMicOn: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ inputAnalyser, outputAnalyser, isMicOn }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const inputData = new Uint8Array(inputAnalyser?.frequencyBinCount || 128);
    const outputData = new Uint8Array(outputAnalyser?.frequencyBinCount || 128);

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Get Data
      if (inputAnalyser) inputAnalyser.getByteFrequencyData(inputData);
      else inputData.fill(0);
      
      if (outputAnalyser) outputAnalyser.getByteFrequencyData(outputData);
      else outputData.fill(0);

      // Helper to calculate average volume
      const getAvg = (arr: Uint8Array) => arr.reduce((a, b) => a + b, 0) / arr.length;
      
      const inputVol = getAvg(inputData) / 255;
      const outputVol = getAvg(outputData) / 255;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Draw AI Circle (Outer, reactive to output)
      const maxRadius = Math.min(rect.width, rect.height) * 0.4;
      const minRadius = maxRadius * 0.8;
      const aiRadius = minRadius + (maxRadius - minRadius) * outputVol;
      
      const gradient = ctx.createRadialGradient(centerX, centerY, minRadius * 0.5, centerX, centerY, aiRadius);
      gradient.addColorStop(0, 'rgba(99, 102, 241, 0.1)'); // Indigo
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0.4)'); // Purple

      ctx.beginPath();
      ctx.arc(centerX, centerY, aiRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Draw User Circle (Inner, reactive to input) - Only if mic is on
      if (isMicOn) {
          const userBaseRadius = minRadius * 0.4;
          const userRadius = userBaseRadius + (minRadius * 0.3) * inputVol;

          ctx.beginPath();
          ctx.arc(centerX, centerY, userRadius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.8)'; // Sky Blue
          ctx.fill();
      } else {
         // Muted indicator
          ctx.beginPath();
          ctx.arc(centerX, centerY, minRadius * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.3)'; // Slate
          ctx.fill();
      }

      // Draw Orbiting Particles for AI activity
      if (outputVol > 0.01) {
          const time = Date.now() / 1000;
          const particleCount = 8;
          for(let i=0; i<particleCount; i++) {
              const angle = (Math.PI * 2 / particleCount) * i + time;
              const orbitRadius = aiRadius + 10;
              const px = centerX + Math.cos(angle) * orbitRadius;
              const py = centerY + Math.sin(angle) * orbitRadius;
              
              ctx.beginPath();
              ctx.arc(px, py, 3, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(168, 85, 247, ${0.5 + outputVol * 0.5})`;
              ctx.fill();
          }
      }

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [inputAnalyser, outputAnalyser, isMicOn]);

  return (
    <canvas 
        ref={canvasRef} 
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
    />
  );
};

export default AudioVisualizer;


