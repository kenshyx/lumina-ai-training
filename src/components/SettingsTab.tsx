import { useState } from 'react';
import { Trash2, Database, FileX, RotateCcw, AlertTriangle, Scissors } from 'lucide-react';

import { GlassCard } from './GlassCard';

/**
 * Props for the SettingsTab component.
 */
interface SettingsTabProps {
    /** Current chunk size setting */
    chunkSize: number;
    /** Function to update chunk size */
    setChunkSize: (value: number) => void;
    /** Current chunk overlap setting */
    chunkOverlap: number;
    /** Function to update chunk overlap */
    setChunkOverlap: (value: number) => void;
    /** Callback function to clear the database */
    onClearDatabase: () => void;
    /** Callback function to clear uploaded files */
    onClearFiles: () => void;
    /** Number of indexed documents */
    documentCount: number;
    /** Number of staged files */
    fileCount: number;
}

/**
 * SettingsTab component for configuration and data management.
 * 
 * This component provides:
 * - Chunking configuration (chunk size and overlap)
 * - Data management controls (clear database, clear files, full reset)
 * - Confirmation dialogs for destructive actions
 * 
 * @param props - Component props
 * @returns The rendered SettingsTab component
 * 
 * @example
 * ```tsx
 * <SettingsTab
 *   chunkSize={500}
 *   setChunkSize={setChunkSize}
 *   chunkOverlap={50}
 *   setChunkOverlap={setChunkOverlap}
 *   onClearDatabase={handleClearDB}
 *   onClearFiles={handleClearFiles}
 *   documentCount={10}
 *   fileCount={5}
 * />
 * ```
 */
export const SettingsTab: React.FC<SettingsTabProps> = ({
    chunkSize,
    setChunkSize,
    chunkOverlap,
    setChunkOverlap,
    onClearDatabase,
    onClearFiles,
    documentCount,
    fileCount
}) => {
    const [showClearConfirm, setShowClearConfirm] = useState<'database' | 'files' | 'all' | null>(null);
    const [isClearing, setIsClearing] = useState(false);

    const handleClearDatabase = async () => {
        setIsClearing(true);
        try {
            await onClearDatabase();
            setShowClearConfirm(null);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Failed to clear database:', error);
            // Show error to user - could be enhanced with a toast notification
            alert(`Failed to clear database: ${error.message}`);
        } finally {
            setIsClearing(false);
        }
    };

    const handleClearFiles = () => {
        onClearFiles();
        setShowClearConfirm(null);
    };

    const handleClearAll = async () => {
        setIsClearing(true);
        try {
            await onClearDatabase();
            onClearFiles();
            setShowClearConfirm(null);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Failed to clear all:', error);
            // Show error to user - could be enhanced with a toast notification
            alert(`Failed to reset: ${error.message}`);
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <div className="space-y-6">
            <GlassCard className="p-6 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                    <Scissors size={18} className="text-blue-400" />
                    <h3 className="text-lg font-bold">Chunking Configuration</h3>
                </div>

                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] text-white/30 uppercase font-bold tracking-[0.2em]">Chunk Size</label>
                        <div className="space-y-2">
                            <input
                                type="number"
                                min="100"
                                max="2000"
                                step="50"
                                value={chunkSize}
                                onChange={e => setChunkSize(Math.max(100, Math.min(2000, parseInt(e.target.value) || 500)))}
                                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-xs font-mono text-blue-400 outline-none focus:border-blue-500/40 transition-all"
                            />
                            <p className="text-xs text-white/40">Number of characters per chunk (100-2000)</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] text-white/30 uppercase font-bold tracking-[0.2em]">Chunk Overlap</label>
                        <div className="space-y-2">
                            <input
                                type="number"
                                min="0"
                                max={Math.floor(chunkSize * 0.5)}
                                step="10"
                                value={chunkOverlap}
                                onChange={e => {
                                    const maxOverlap = Math.floor(chunkSize * 0.5);
                                    const value = Math.max(0, Math.min(maxOverlap, parseInt(e.target.value) || 50));
                                    setChunkOverlap(value);
                                }}
                                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-xs font-mono text-purple-400 outline-none focus:border-purple-500/40 transition-all"
                            />
                            <p className="text-xs text-white/40">Number of overlapping characters between chunks (0-{Math.floor(chunkSize * 0.5)})</p>
                        </div>
                    </div>

                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-2xl">
                        <p className="text-xs text-white/30 uppercase tracking-widest mb-2">Current Settings</p>
                        <p className="text-sm text-white/70">
                            Chunks: <span className="font-mono text-blue-400">{chunkSize}</span> chars
                        </p>
                        <p className="text-sm text-white/70 mt-1">
                            Overlap: <span className="font-mono text-purple-400">{chunkOverlap}</span> chars
                        </p>
                        <p className="text-xs text-white/40 mt-2 italic">
                            These settings will be applied when indexing new documents.
                        </p>
                    </div>
                </div>
            </GlassCard>

            <GlassCard className="p-6 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                    <Trash2 size={18} className="text-red-400" />
                    <h3 className="text-lg font-bold">Data Management</h3>
                </div>

                <div className="space-y-4">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <Database size={18} className="text-blue-400" />
                                <div>
                                    <p className="text-sm font-semibold">Indexed Documents</p>
                                    <p className="text-xs text-white/40">{documentCount} document{documentCount !== 1 ? 's' : ''} indexed</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowClearConfirm('database')}
                                disabled={documentCount === 0 || isClearing}
                                className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 cursor-pointer active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Trash2 size={14} />
                                Clear
                            </button>
                        </div>
                    </div>

                    <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <FileX size={18} className="text-purple-400" />
                                <div>
                                    <p className="text-sm font-semibold">Uploaded Files</p>
                                    <p className="text-xs text-white/40">{fileCount} file{fileCount !== 1 ? 's' : ''} staged</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowClearConfirm('files')}
                                disabled={fileCount === 0 || isClearing}
                                className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-purple-500/20 cursor-pointer active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Trash2 size={14} />
                                Clear
                            </button>
                        </div>
                    </div>

                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <RotateCcw size={18} className="text-red-400" />
                                <div>
                                    <p className="text-sm font-semibold text-red-300">Full Reset</p>
                                    <p className="text-xs text-white/40">Clear everything</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowClearConfirm('all')}
                                disabled={isClearing}
                                className="px-4 py-2 bg-red-600/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-600/30 cursor-pointer active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <RotateCcw size={14} />
                                Reset All
                            </button>
                        </div>
                    </div>
                </div>

                {showClearConfirm && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle size={18} className="text-yellow-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-yellow-300 mb-1">
                                    {showClearConfirm === 'database' && 'Clear Indexed Documents?'}
                                    {showClearConfirm === 'files' && 'Clear Uploaded Files?'}
                                    {showClearConfirm === 'all' && 'Reset Everything?'}
                                </p>
                                <p className="text-xs text-white/60">
                                    {showClearConfirm === 'database' && 'This will delete all indexed documents from DuckDB and IndexedDB. This action cannot be undone.'}
                                    {showClearConfirm === 'files' && 'This will remove all staged files. You can re-upload them later.'}
                                    {showClearConfirm === 'all' && 'This will clear all indexed documents and remove all staged files. This action cannot be undone.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    if (showClearConfirm === 'database') {
                                        handleClearDatabase();
                                    } else if (showClearConfirm === 'files') {
                                        handleClearFiles();
                                    } else {
                                        handleClearAll();
                                    }
                                }}
                                disabled={isClearing}
                                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isClearing ? (
                                    <>
                                        <span className="animate-spin">⏳</span>
                                        Clearing...
                                    </>
                                ) : (
                                    'Confirm'
                                )}
                            </button>
                            <button
                                onClick={() => setShowClearConfirm(null)}
                                disabled={isClearing}
                                className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </GlassCard>
        </div>
    );
};
