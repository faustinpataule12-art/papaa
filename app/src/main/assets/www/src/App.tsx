import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Download, Sliders, Music, Info, FileAudio, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { separate, drawWaveform, encodeWAV, downloadBlob } from './lib/dsp';

type AudioBufferData = {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
};

export default function App() {
  const [step, setStep] = useState<1 | 2>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const [sourceBuffer, setSourceBuffer] = useState<AudioBufferData | null>(null);
  const [vocalBuffer, setVocalBuffer] = useState<AudioBufferData | null>(null);
  const [instruBuffer, setInstruBuffer] = useState<AudioBufferData | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [activeTrack, setActiveTrack] = useState<'source' | 'vocal' | 'instru' | null>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const vocalCanvasRef = useRef<HTMLCanvasElement>(null);
  const instruCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [currentTime, setCurrentTime] = useState(0);

  const getCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSourceBuffer(null);
    setVocalBuffer(null);
    setInstruBuffer(null);
    stopPlayback();

    try {
      const arrayBuf = await file.arrayBuffer();
      const ctx = getCtx();
      const decoded = await ctx.decodeAudioData(arrayBuf);
      
      const left = decoded.getChannelData(0);
      const right = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : decoded.getChannelData(0);
      
      const newSource = {
        left: Float32Array.from(left),
        right: Float32Array.from(right),
        sampleRate: decoded.sampleRate
      };
      
      setSourceBuffer(newSource);
      
      if (sourceCanvasRef.current) {
        drawWaveform(sourceCanvasRef.current, newSource.left, 'rgba(124,108,255,0.8)');
      }
    } catch (err) {
      alert("Impossible de décoder ce fichier audio. Essaie un .mp3 ou .wav.");
    }
  };

  const handleSeparate = async () => {
    if (!sourceBuffer) return;
    
    setIsProcessing(true);
    setProgress(0);
    stopPlayback();

    // Use a small timeout to let React render the loading state
    setTimeout(async () => {
      try {
        const result = await separate(
          sourceBuffer.left, 
          sourceBuffer.right, 
          sourceBuffer.sampleRate, 
          (pct) => setProgress(pct)
        );

        const newVocalBuffer = { left: result.vocalL, right: result.vocalR, sampleRate: sourceBuffer.sampleRate };
        const newInstruBuffer = { left: result.instL, right: result.instR, sampleRate: sourceBuffer.sampleRate };
        
        setVocalBuffer(newVocalBuffer);
        setInstruBuffer(newInstruBuffer);
        
        setIsProcessing(false);
        setStep(2);

        // Draw waveforms after next tick when canvases are rendered
        setTimeout(() => {
          if (vocalCanvasRef.current) drawWaveform(vocalCanvasRef.current, result.vocalL, '#ff2f9e');
          if (instruCanvasRef.current) drawWaveform(instruCanvasRef.current, result.instL, '#00e5ff');
        }, 100);

      } catch (err) {
        console.error(err);
        alert("Une erreur s'est produite lors de la séparation.");
        setIsProcessing(false);
      }
    }, 50);
  };

  const stopPlayback = () => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch (e) {}
      currentSourceRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setActiveTrack(null);
    setCurrentTime(0);
  };

  const playBuffer = (key: 'source' | 'vocal' | 'instru', bufData: AudioBufferData) => {
    if (activeTrack === key) {
      stopPlayback();
      return;
    }

    stopPlayback();
    setActiveTrack(key);

    const ctx = getCtx();
    const buf = ctx.createBuffer(2, bufData.left.length, bufData.sampleRate);
    buf.copyToChannel(bufData.left, 0);
    buf.copyToChannel(bufData.right, 1);

    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.connect(ctx.destination);
    
    const startedAt = ctx.currentTime;
    node.start();
    currentSourceRef.current = node;

    const duration = buf.duration;

    const tick = () => {
      const elapsed = ctx.currentTime - startedAt;
      if (elapsed >= duration) {
        stopPlayback();
        return;
      }
      setCurrentTime(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    node.onended = () => {
      stopPlayback();
    };
  };

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const resetToUpload = () => {
    stopPlayback();
    setStep(1);
    setSourceBuffer(null);
    setVocalBuffer(null);
    setInstruBuffer(null);
    setFileName(null);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 flex flex-col">
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col">
        
        <header className="mb-10 text-center flex-shrink-0">
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-3xl sm:text-4xl font-bold tracking-tight mb-3 bg-gradient-to-r from-indigo-400 via-cyan-400 to-indigo-400 text-transparent bg-clip-text"
          >
            AudioSplitPro
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-zinc-400 text-sm sm:text-base"
          >
            Séparateur spectrale Voix / Instrumental • 100% Local
          </motion.p>
        </header>

        <main className="flex-1 flex flex-col min-h-0 relative">
          <AnimatePresence mode="wait">
            
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col"
              >
                <div className="flex items-center gap-2 mb-6 text-sm font-semibold text-zinc-400 uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Source Audio
                </div>

                {!sourceBuffer ? (
                  <label className="border-2 border-dashed border-zinc-700 hover:border-indigo-500/50 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors bg-zinc-950/50 flex-1 min-h-[200px]">
                    <Upload className="w-10 h-10 text-indigo-400 mb-4" />
                    <p className="text-zinc-300 font-medium mb-2 text-center">Déposez ou sélectionnez un fichier audio</p>
                    <p className="text-zinc-500 text-sm text-center">Traitement 100% privé dans votre navigateur</p>
                    <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                ) : (
                  <div className="space-y-6 flex-1 flex flex-col justify-center">
                    <div className="flex items-center p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                      <FileAudio className="w-8 h-8 text-indigo-400 mr-4 shrink-0" />
                      <div className="truncate flex-1">
                        <p className="text-sm font-medium text-zinc-200 truncate">{fileName}</p>
                        <p className="text-xs text-zinc-500">Prêt à être séparé</p>
                      </div>
                      <label className="text-xs font-medium text-indigo-400 hover:text-indigo-300 cursor-pointer px-3 py-1.5 bg-indigo-500/10 rounded-lg ml-4 shrink-0">
                        Changer
                        <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                      </label>
                    </div>

                    <div className="h-24 bg-zinc-950 rounded-xl border border-zinc-800 p-2">
                      <canvas ref={sourceCanvasRef} className="w-full h-full" />
                    </div>

                    {isProcessing ? (
                      <div className="space-y-3">
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-center text-sm font-medium text-cyan-400 flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Analyse Spectrale FFT... {progress}%
                        </p>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <button
                          onClick={() => playBuffer('source', sourceBuffer)}
                          className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center"
                        >
                          {activeTrack === 'source' ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
                          Original
                        </button>
                        <button
                          onClick={handleSeparate}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center shadow-lg shadow-indigo-500/20"
                        >
                          <Sliders className="w-5 h-5 mr-2" />
                          Séparer (Voix / Instru)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col"
              >
                <div className="flex items-center gap-2 mb-6 text-sm font-semibold text-zinc-400 uppercase tracking-widest">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  Pistes Séparées
                </div>

                <div className="space-y-4 mb-8">
                  {/* Vocal Track */}
                  <div className="bg-zinc-950 border border-pink-500/30 rounded-xl p-4 flex items-center gap-4">
                    <button
                      onClick={() => vocalBuffer && playBuffer('vocal', vocalBuffer)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${activeTrack === 'vocal' ? 'bg-pink-500 text-white' : 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30'}`}
                    >
                      {activeTrack === 'vocal' ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                    </button>
                    
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-bold text-pink-400 tracking-wide uppercase">Voix</span>
                        <span className="text-xs text-zinc-500 font-mono">
                          {activeTrack === 'vocal' ? formatTime(currentTime) : '0:00'}
                        </span>
                      </div>
                      <div className="h-10 w-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
                        <canvas ref={vocalCanvasRef} className="w-full h-full" />
                      </div>
                    </div>
                  </div>

                  {/* Instrumental Track */}
                  <div className="bg-zinc-950 border border-cyan-500/30 rounded-xl p-4 flex items-center gap-4">
                    <button
                      onClick={() => instruBuffer && playBuffer('instru', instruBuffer)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${activeTrack === 'instru' ? 'bg-cyan-500 text-black' : 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30'}`}
                    >
                      {activeTrack === 'instru' ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                    </button>
                    
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-bold text-cyan-400 tracking-wide uppercase">Instrumental</span>
                        <span className="text-xs text-zinc-500 font-mono">
                          {activeTrack === 'instru' ? formatTime(currentTime) : '0:00'}
                        </span>
                      </div>
                      <div className="h-10 w-full bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
                        <canvas ref={instruCanvasRef} className="w-full h-full" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 mt-auto pt-4 border-t border-zinc-800">
                  <button
                    onClick={() => {
                      if(vocalBuffer) {
                        downloadBlob(encodeWAV(vocalBuffer.left, vocalBuffer.right, vocalBuffer.sampleRate), 'voix.wav');
                      }
                    }}
                    className="flex-1 min-w-[140px] bg-zinc-800 hover:bg-zinc-700 text-pink-400 py-3 px-4 rounded-xl font-medium text-sm transition-colors flex items-center justify-center border border-pink-500/20"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Voix (.wav)
                  </button>
                  <button
                    onClick={() => {
                      if(instruBuffer) {
                        downloadBlob(encodeWAV(instruBuffer.left, instruBuffer.right, instruBuffer.sampleRate), 'instrumental.wav');
                      }
                    }}
                    className="flex-1 min-w-[140px] bg-zinc-800 hover:bg-zinc-700 text-cyan-400 py-3 px-4 rounded-xl font-medium text-sm transition-colors flex items-center justify-center border border-cyan-500/20"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Instru (.wav)
                  </button>
                  <button
                    onClick={resetToUpload}
                    className="w-full sm:w-auto bg-transparent hover:bg-zinc-800 text-zinc-400 py-3 px-4 rounded-xl font-medium text-sm transition-colors flex items-center justify-center border border-zinc-700 sm:border-transparent mt-2 sm:mt-0"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Nouveau
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        <footer className="mt-8 text-center text-zinc-600 text-sm flex items-center justify-center gap-2 flex-shrink-0">
          <Info className="w-4 h-4" />
          Traitement DSP Fast Fourier Transform (FFT) côté client.
        </footer>
      </div>
    </div>
  );
}

