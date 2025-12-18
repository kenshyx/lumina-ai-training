import React from 'react';
import { Cpu, BarChart3, Sparkles, Loader2, Zap } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { ProgressBar } from './ProgressBar';
import { AnalysisResult, FileItem, ModelConfig } from '../types';

interface DashboardProps {
    isTraining: boolean;
    setIsTraining: (value: boolean) => void;
    trainingProgress: number;
    currentEpoch: number;
    loss: number[];
    modelConfig: ModelConfig;
    files: FileItem[];
    isAnalyzingLoss: boolean;
    analysisResult: AnalysisResult | null;
    onAnalyzeLoss: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
    isTraining,
    setIsTraining,
    trainingProgress,
    currentEpoch,
    loss,
    modelConfig,
    files,
    isAnalyzingLoss,
    analysisResult,
    onAnalyzeLoss
}) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 transition-all ${isTraining && 'scale-110 shadow-[0_0_20px_rgba(59,130,246,0.2)]'}`}>
                      <Cpu size={24} />
                  </div>
                  <div>
                      <h3 className="text-lg font-semibold">{isTraining ? 'Engine Cycles Running' : 'Compute Idle'}</h3>
                      <p className="text-xs text-white/40">ml5.js v1.0 Backend</p>
                  </div>
              </div>
              <button
                onClick={() => {
                    if(files.length === 0) return;
                    setIsTraining(!isTraining);
                }}
                disabled={files.length === 0}
                className="group px-8 py-3 rounded-2xl font-bold bg-blue-600 hover:bg-blue-500 cursor-pointer active:scale-95 disabled:opacity-20 transition-all flex items-center gap-2 shadow-xl shadow-blue-900/20"
              >
                  <Zap size={18} fill="currentColor" className="group-hover:animate-bounce" />
                  {isTraining ? 'Pause' : 'Start'}
              </button>
          </div>

          <div className="space-y-6">
              <div className="space-y-2">
                  <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">
                      <span>Gradient Convergence</span>
                      <span className="text-blue-400">{trainingProgress.toFixed(1)}%</span>
                  </div>
                  <ProgressBar progress={trainingProgress} color="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-colors">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Epochs</p>
                      <p className="text-2xl font-mono tracking-tighter">{currentEpoch} <span className="text-xs text-white/10">/ {modelConfig.epochs}</span></p>
                  </div>
                  <div className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-colors">
                      <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">ml5 Loss</p>
                      <p className="text-2xl font-mono text-blue-400 tracking-tighter">{loss.length > 0 ? loss[loss.length - 1].toFixed(5) : '0.00000'}</p>
                  </div>
              </div>
          </div>
      </GlassCard>

      <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-blue-400" />
                  <h3 className="font-medium text-sm">Compute Metrics</h3>
              </div>
              {!isTraining && loss.length > 0 && (
                <button
                  onClick={onAnalyzeLoss}
                  className="text-[10px] uppercase tracking-widest font-bold px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 cursor-pointer active:scale-95 transition-all flex items-center gap-2"
                >
                  {isAnalyzingLoss ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  ✨ AI Analysis
                </button>
              )}
          </div>
          <div className="h-28 flex items-end gap-1.5 px-2">
              {loss.length === 0 ? <div className="w-full text-center text-white/10 italic text-xs py-8">Waiting for training cycle...</div> :
                loss.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-blue-600/10 to-blue-400/50 rounded-t-lg transition-all duration-700 hover:from-blue-400 hover:to-blue-300"
                    style={{ height: `${Math.min(100, (v / 2.5) * 100)}%` }}
                  />
                ))
              }
          </div>
          {analysisResult?.type === 'loss' && (
            <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-[11px] leading-relaxed italic text-purple-100/70">
                "{analysisResult.text}"
            </div>
          )}
      </GlassCard>
  </div>
);

