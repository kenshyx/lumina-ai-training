import { usePWAInstall } from '../hooks';
import { LuminaLogo } from './LuminaLogo';
import { AuthButton } from './AuthButton';

interface HeaderProps {
    isTraining: boolean;
}

/**
 * Header component with logo, title, and status indicators.
 * 
 * Includes PWA install button when installation is available.
 * 
 * @param props - Component props
 * @returns The rendered Header component
 */
export const Header: React.FC<HeaderProps> = ({ isTraining }) => {
    const { canInstall, isInstalled, promptInstall, isPrompting } = usePWAInstall();

    return (
        <header className="px-6 pt-12 pb-6 max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4 group cursor-default">
                <LuminaLogo className="w-12 h-12 drop-shadow-lg group-hover:rotate-[15deg] transition-transform duration-500" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tighter transition-all group-hover:tracking-normal">
                        Lumina <span className="text-blue-400 font-light italic">RAG</span>
                    </h1>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1">LangChain × DuckDB-WASM × Transformers</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <AuthButton />
                {canInstall && !isInstalled && (
                    <button
                        onClick={promptInstall}
                        disabled={isPrompting}
                        className="px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-md hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-blue-300"
                        title="Install Lumina RAG as a Progressive Web App"
                    >
                        {isPrompting ? 'Installing...' : 'Install App'}
                    </button>
                )}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                    <div className={`w-2 h-2 rounded-full transition-colors duration-500 ${isTraining ? 'bg-blue-400 animate-pulse' : 'bg-green-500'}`} />
                    <span className="text-[10px] font-mono text-white/60">Local Runtime</span>
                </div>
            </div>
        </header>
    );
};

