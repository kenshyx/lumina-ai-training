import { useEffect } from 'react';
import { Database, FileText, Layers, BarChart3 } from 'lucide-react';

import { GlassCard } from './GlassCard';

/**
 * Props for the Dashboard component.
 */
interface DashboardProps {
    /** Document statistics from the vector store */
    documentStats: {
        /** Total number of unique documents indexed */
        totalDocuments: number;
        /** Total number of document chunks */
        totalChunks: number;
        /** Average character length of chunks */
        averageChunkLength: number;
    };
    /** Current status of the RAG system */
    ragStatus: string;
    /** Callback function to refresh statistics */
    onRefreshStats: () => void;
}

/**
 * Dashboard component displaying RAG knowledge base statistics and storage information.
 * 
 * This component shows:
 * - Total documents, chunks, and average chunk length
 * - Current RAG system status
 * - Storage information (vector store, embedding model, chunking strategy)
 * 
 * Statistics are automatically refreshed every 5 seconds.
 * 
 * @param props - Component props
 * @returns The rendered Dashboard component
 * 
 * @example
 * ```tsx
 * <Dashboard
 *   documentStats={{ totalDocuments: 10, totalChunks: 150, averageChunkLength: 450 }}
 *   ragStatus="Knowledge Base Ready"
 *   onRefreshStats={handleRefresh}
 * />
 * ```
 */
export const Dashboard: React.FC<DashboardProps> = ({
    documentStats,
    ragStatus,
    onRefreshStats,
}) => {
    // Refresh stats on mount
    useEffect(() => {
        onRefreshStats();
        // Refresh every 5 seconds
        const interval = setInterval(() => {
            onRefreshStats();
        }, 5000);
        return () => clearInterval(interval);
    }, [onRefreshStats]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <GlassCard className="p-6">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Database size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">Knowledge Base</h3>
                            <p className="text-xs text-white/40">DuckDB-WASM Vector Store</p>
                        </div>
                    </div>
                    <div className={`px-4 py-2 rounded-xl text-xs font-semibold ${
                        ragStatus === 'Knowledge Base Ready' 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    }`}>
                        {ragStatus}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <FileText size={18} className="text-blue-400" />
                            <p className="text-[10px] text-white/30 uppercase tracking-widest">Documents</p>
                        </div>
                        <p className="text-3xl font-mono tracking-tighter">{documentStats.totalDocuments}</p>
                        <p className="text-xs text-white/20 mt-1">Indexed files</p>
                    </div>

                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <Layers size={18} className="text-purple-400" />
                            <p className="text-[10px] text-white/30 uppercase tracking-widest">Chunks</p>
                        </div>
                        <p className="text-3xl font-mono tracking-tighter text-purple-400">{documentStats.totalChunks}</p>
                        <p className="text-xs text-white/20 mt-1">Text segments</p>
                    </div>

                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3 mb-2">
                            <BarChart3 size={18} className="text-indigo-400" />
                            <p className="text-[10px] text-white/30 uppercase tracking-widest">Avg Length</p>
                        </div>
                        <p className="text-3xl font-mono tracking-tighter text-indigo-400">{documentStats.averageChunkLength}</p>
                        <p className="text-xs text-white/20 mt-1">Characters</p>
                    </div>
                </div>
            </GlassCard>

            <GlassCard className="p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Database size={18} className="text-blue-400" />
                    <h3 className="font-medium text-sm">Storage Information</h3>
                </div>
                <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Vector Store</p>
                        <p className="text-sm text-white/70">DuckDB-WASM (In-Memory)</p>
                        <p className="text-xs text-white/40 mt-1">Data persisted to IndexedDB</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Embedding Model</p>
                        <p className="text-sm text-white/70">Xenova/all-MiniLM-L6-v2</p>
                        <p className="text-xs text-white/40 mt-1">384-dimensional vectors</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Chunking Strategy</p>
                        <p className="text-sm text-white/70">RecursiveCharacterTextSplitter</p>
                        <p className="text-xs text-white/40 mt-1">500 chars per chunk, 50 overlap</p>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
};
