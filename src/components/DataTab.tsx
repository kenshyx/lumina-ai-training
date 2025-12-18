import React from 'react';
import { Upload, Sparkles, Loader2, FileText, X } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { FileItem } from '../types';

interface DataTabProps {
    files: FileItem[];
    setFiles: (value: FileItem[] | ((prev: FileItem[]) => FileItem[])) => void;
    isGeneratingData: boolean;
    isIndexing: boolean;
    ragStatus: string;
    onGenerateSyntheticData: () => void;
    onIndexDocuments: () => void;
}

export const DataTab: React.FC<DataTabProps> = ({
    files,
    setFiles,
    isGeneratingData,
    isIndexing,
    ragStatus,
    onGenerateSyntheticData,
    onIndexDocuments
}) => (
  <div className="space-y-6">
      <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-8">
              <div>
                  <h3 className="text-xl font-bold">Ingestion Hub</h3>
                  <p className="text-xs text-white/40">Manage your local knowledge pipeline</p>
              </div>
              <button
                onClick={onGenerateSyntheticData}
                disabled={isGeneratingData}
                className="px-5 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer active:scale-95 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all"
              >
                  {isGeneratingData ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} className="text-blue-400"/>} Synthetic
              </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => {
                    const el = document.getElementById('file-upload') as HTMLInputElement;
                    el?.click();
                }}
                className="p-10 border-2 border-dashed border-white/5 rounded-[2.5rem] hover:border-blue-500/30 hover:bg-blue-500/5 cursor-pointer active:scale-98 transition-all flex flex-col items-center justify-center gap-3 group"
              >
                  <Upload size={28} className="text-white/20 group-hover:text-blue-400 transition-all group-hover:-translate-y-1" />
                  <span className="text-xs font-bold text-white/40 group-hover:text-white transition-colors">Upload Training Data</span>
                  <input id="file-upload" type="file" className="hidden" multiple onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                          setFiles([...files, { name: e.target.files[0].name, id: Math.random() }]);
                      }
                  }} />
              </button>
              <div className="p-8 bg-blue-500/5 border border-white/5 rounded-[2.5rem] flex flex-col justify-center">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">Voy Vector Engine</h4>
                  <p className="text-[10px] text-white/40 leading-relaxed">
                      Uploaded documents are split using LangChain and indexed into Voy WASM for instant retrieval.
                  </p>
              </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-3 mb-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 ml-1">Staged Files</p>
                {files.map(f => (
                  <div key={f.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex justify-between items-center group hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><FileText size={18}/></div>
                          <span className="text-sm font-medium">{f.name}</span>
                      </div>
                      <button onClick={() => setFiles(files.filter(x => x.id !== f.id))} className="p-2 text-white/10 hover:text-red-400 cursor-pointer active:scale-90 transition-all opacity-0 group-hover:opacity-100"><X size={18}/></button>
                  </div>
                ))}
            </div>
          )}

          <button
            onClick={onIndexDocuments}
            disabled={files.length === 0 || isIndexing}
            className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 cursor-pointer active:scale-[0.98] rounded-3xl font-bold uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-900/20 transition-all disabled:opacity-20"
          >
              {isIndexing ? 'Processing Vectors...' : `Index into Vector Store (${ragStatus})`}
          </button>
      </GlassCard>
  </div>
);

