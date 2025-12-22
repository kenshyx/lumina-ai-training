import { useState } from 'react';

import { Header, Navigation, Dashboard, DataTab, RAGTab, SettingsTab } from './components';
import { useTraining, useDataManagement, useModelOptimization, useRAG, useTrainingAnalysis } from './hooks';
import { TabType } from './types';

export default function App() {
    const [activeTab, setActiveTab] = useState<TabType>('dashboard');
    const [chunkSize, setChunkSize] = useState<number>(500);
    const [chunkOverlap, setChunkOverlap] = useState<number>(50);

    // Training state and logic
    const training = useTraining();
    
    // Data management (files, indexing)
    const dataManagement = useDataManagement();
    
    // Model optimization
    const modelOptimization = useModelOptimization();
    
    // RAG functionality
    const rag = useRAG(dataManagement.ragStatus, dataManagement.files, chunkSize, chunkOverlap);
    
    // Training analysis
    const trainingAnalysis = useTrainingAnalysis();

    // Handlers that coordinate between hooks
    const handleOptimizeHyperparameters = () => {
        modelOptimization.optimizeHyperparameters(
            training.modelConfig,
            training.setModelConfig
        );
    };

    const handleSetTraining = (value: boolean) => {
        if (value && dataManagement.files.length === 0) return;
        if (value) {
            training.startTraining();
        } else {
            training.pauseTraining();
        }
    };

    return (
      <div className="min-h-screen w-full text-white font-sans bg-[#020617] overflow-x-hidden selection:bg-blue-500/30">
          <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
      `}</style>

          {/* Background elements */}
          <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
              <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[140px] animate-pulse" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[140px] animate-pulse delay-1000" />
          </div>

          {/* Navigation */}
          <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* Header */}
          <Header isTraining={training.isTraining} />

          {/* Main Content */}
          <main className="px-6 pb-32 max-w-4xl mx-auto space-y-6">
              {activeTab === 'dashboard' && (
                <Dashboard
                  documentStats={rag.documentStats}
                  ragStatus={dataManagement.ragStatus}
                  onRefreshStats={rag.getStats}
                />
              )}

              {activeTab === 'data' && (
                <DataTab
                  files={dataManagement.files}
                  setFiles={dataManagement.setFiles}
                  isGeneratingData={dataManagement.isGeneratingData}
                  isIndexing={dataManagement.isIndexing}
                  ragStatus={dataManagement.ragStatus}
                  onGenerateSyntheticData={async () => {
                    const topic = prompt("What topic should the synthetic data cover?");
                    if (!topic) return;
                    
                    dataManagement.setIsGeneratingData(true);
                    try {
                        const content = await rag.generateSyntheticData(topic);
                        dataManagement.addFile({
                            name: `synthetic_${topic.replace(/\s+/g, '_')}.txt`,
                            id: Math.random(),
                            content
                        });
                    } catch (err) {
                        const error = err instanceof Error ? err : new Error(String(err));
                        console.error('Failed to generate synthetic data:', error);
                        alert(`Failed to generate synthetic data: ${error.message}. Make sure the model is loaded.`);
                    } finally {
                        dataManagement.setIsGeneratingData(false);
                    }
                  }}
                  onIndexDocuments={() => dataManagement.indexDocuments(rag.indexDocuments)}
                />
              )}

              {activeTab === 'rag' && (
                <RAGTab
                  ragStatus={dataManagement.ragStatus}
                  chatInput={rag.chatInput}
                  setChatInput={rag.setChatInput}
                  chatHistory={rag.chatHistory}
                  isQuerying={rag.isQuerying}
                  onRagQuery={rag.queryRAG}
                  modelLoadingProgress={rag.modelLoadingProgress}
                  isModelLoading={rag.isModelLoading}
                  canSearch={rag.canSearch}
                  documentCount={rag.documentStats.totalDocuments}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsTab
                  chunkSize={chunkSize}
                  setChunkSize={setChunkSize}
                  chunkOverlap={chunkOverlap}
                  setChunkOverlap={setChunkOverlap}
                  onClearDatabase={async () => {
                    await rag.clearDatabase();
                    dataManagement.setRagStatus('Idle');
                  }}
                  onClearFiles={() => {
                    dataManagement.setFiles([]);
                  }}
                  documentCount={rag.documentStats.totalDocuments}
                  fileCount={dataManagement.files.length}
                />
              )}
          </main>
      </div>
    );
}
