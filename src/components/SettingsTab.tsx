import React from 'react';
import { Loader2, MessageSquareQuote } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { AnalysisResult, ModelConfig } from '../types';

interface SettingsTabProps {
    objective: string;
    setObjective: (value: string) => void;
    modelConfig: ModelConfig;
    setModelConfig: (value: ModelConfig | ((prev: ModelConfig) => ModelConfig)) => void;
    isOptimizing: boolean;
    analysisResult: AnalysisResult | null;
    onOptimizeHyperparameters: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
    objective,
    setObjective,
    modelConfig,
    setModelConfig,
    isOptimizing,
    analysisResult,
    onOptimizeHyperparameters
}) => (
  <GlassCard className="p-6 space-y-8">
      <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold tracking-tight">Hyperparameter Console</h3>
          <button
            onClick={onOptimizeHyperparameters}
            disabled={isOptimizing}
            className="text-[10px] text-blue-400 font-bold tracking-widest uppercase bg-blue-500/10 px-5 py-2.5 rounded-xl hover:bg-blue-500/20 cursor-pointer active:scale-95 transition-all border border-blue-500/20"
          >
              {isOptimizing ? <Loader2 size={12} className="animate-spin mr-2 inline" /> : '✨ AI Suggestion'}
          </button>
      </div>

      <div className="space-y-8">
          <div className="space-y-3">
              <label className="text-[10px] text-white/30 uppercase font-bold tracking-[0.2em]">Learning Objective</label>
              <input
                value={objective}
                onChange={e => setObjective(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-xs outline-none focus:border-blue-500/40 transition-all"
              />
          </div>

          <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                  <label className="text-[10px] text-white/30 uppercase font-bold tracking-[0.2em]">Learning Rate</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={modelConfig.learningRate}
                    onChange={e => setModelConfig({...modelConfig, learningRate: parseFloat(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-xs font-mono text-blue-400 outline-none"
                  />
              </div>
              <div className="space-y-3">
                  <label className="text-[10px] text-white/30 uppercase font-bold tracking-[0.2em]">Batch Size</label>
                  <input
                    type="number"
                    value={modelConfig.batchSize}
                    onChange={e => setModelConfig({...modelConfig, batchSize: parseInt(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 p-5 rounded-3xl text-xs font-mono outline-none"
                  />
              </div>
          </div>

          <div className="space-y-3">
              <label className="text-[10px] text-white/30 uppercase font-bold tracking-[0.2em]">RAG Context Limit</label>
              <div className="grid grid-cols-4 gap-2">
                  {[256, 512, 1024, 2048].map(size => (
                    <button
                      key={size}
                      onClick={() => setModelConfig({...modelConfig, contextWindow: size})}
                      className={`py-4 rounded-2xl text-[10px] font-mono border transition-all cursor-pointer active:scale-95 ${
                        modelConfig.contextWindow === size
                          ? 'bg-blue-600 border-blue-400 text-white shadow-xl shadow-blue-900/30'
                          : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                        {size}
                    </button>
                  ))}
              </div>
          </div>
      </div>

      {analysisResult?.type === 'optimization' && (
        <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-[2rem] flex gap-4 backdrop-blur-md">
            <MessageSquareQuote size={24} className="text-blue-400 shrink-0" />
            <p className="text-[11px] text-blue-100/70 leading-relaxed italic font-medium">"{analysisResult.text}"</p>
        </div>
      )}
  </GlassCard>
);

