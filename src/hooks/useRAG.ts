import { useState, FormEvent, useRef, useEffect, useCallback } from 'react';

import { ChatMessage, FileItem } from '../types';

/**
 * Message types sent from the RAG worker to the main thread.
 */
type WorkerMessage = 
    | { type: 'READY' }
    | { type: 'INIT_SUCCESS' }
    | { type: 'MODEL_LOADED' }
    | { type: 'MODEL_PROGRESS'; payload: { progress: number } }
    | { type: 'INDEX_COMPLETE' }
    | { type: 'INDEX_PROGRESS'; payload: { fileName: string; chunkCount: number; skipped?: boolean } }
    | { type: 'QUERY_RESULT'; payload: { response: string; isFallback: boolean } }
    | { type: 'QUERY_CHUNK'; payload: { chunk: string } }
    | { type: 'MEMORY_CLEARED' }
    | { type: 'STATS_RESULT'; payload: { totalDocuments: number; totalChunks: number; averageChunkLength: number } }
    | { type: 'DATABASE_CLEARED'; payload: { totalDocuments: number; totalChunks: number; averageChunkLength: number } }
    | { type: 'SYNTHETIC_GENERATED'; payload: { content: string; topic: string } }
    | { type: 'ERROR'; payload: { error: string; errorType?: string } };

/**
 * Return type for the useRAG hook.
 */
interface UseRAGReturn {
    /** Current chat input value */
    chatInput: string;
    /** Function to update chat input */
    setChatInput: (value: string) => void;
    /** Array of chat messages */
    chatHistory: ChatMessage[];
    /** Whether a query is currently in progress */
    isQuerying: boolean;
    /** Function to index documents into the vector store */
    indexDocuments: (filesToIndex: FileItem[]) => Promise<void>;
    /** Model loading progress (0-1) */
    modelLoadingProgress: number;
    /** Whether the model is currently loading */
    isModelLoading: boolean;
    /** Document statistics from the vector store */
    documentStats: { totalDocuments: number; totalChunks: number; averageChunkLength: number };
    /** Function to refresh document statistics */
    getStats: () => void;
    /** Whether search is available (has documents or status is ready) */
    canSearch: boolean;
    /** Function to clear the database */
    clearDatabase: () => Promise<void>;
    /** Function to generate synthetic data */
    generateSyntheticData: (topic: string) => Promise<string>;
}

/**
 * Custom hook for managing RAG (Retrieval-Augmented Generation) functionality.
 * 
 * This hook manages the RAG worker, handles document indexing, query processing,
 * and provides chat functionality with streaming responses. It maintains state
 * for chat history, model loading, and document statistics.
 * 
 * @param ragStatus - Current status of the RAG system (e.g., "Idle", "Indexing...", "Knowledge Base Ready")
 * @param files - Optional array of files to be indexed
 * @param chunkSize - Size of text chunks for document splitting (default: 500)
 * @param chunkOverlap - Overlap between chunks in characters (default: 50)
 * @returns Object containing RAG state and functions
 * 
 * @example
 * ```tsx
 * const rag = useRAG("Knowledge Base Ready", files, 500, 50);
 * await rag.indexDocuments(filesToIndex);
 * rag.queryRAG(event);
 * ```
 */
export const useRAG = (ragStatus: string, files?: FileItem[], chunkSize: number = 500, chunkOverlap: number = 50): UseRAGReturn => {
    const [chatInput, setChatInput] = useState<string>("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isQuerying, setIsQuerying] = useState<boolean>(false);
    const [modelLoadingProgress, setModelLoadingProgress] = useState<number>(0);
    const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
    const [modelLoadError, setModelLoadError] = useState<string | null>(null);
    const [documentStats, setDocumentStats] = useState<{ totalDocuments: number; totalChunks: number; averageChunkLength: number }>({
        totalDocuments: 0,
        totalChunks: 0,
        averageChunkLength: 0,
    });
    
    const workerRef = useRef<Worker | null>(null);
    const isInitializedRef = useRef<boolean>(false);
    const initSentRef = useRef<boolean>(false); // Track if INIT was sent
    const currentQueryRef = useRef<string>('');
    const streamingResponseRef = useRef<string>('');

    // Initialize worker
    useEffect(() => {
        console.log('[useRAG] Creating worker...');
        let worker: Worker | null = null;
        
        try {
            // Create worker
            worker = new Worker(
                new URL('../workers/ragWorker.ts', import.meta.url),
                { type: 'module' }
            );
            workerRef.current = worker;
            console.log('[useRAG] Worker created successfully');

            // Set up message handler
            worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
                console.log('[useRAG] Received message from worker:', event.data.type);
                const message = event.data;

                // Handle READY message - send INIT when worker is ready
                if (message.type === 'READY') {
                    console.log('[useRAG] Worker is ready, sending INIT');
                    if (workerRef.current && !isInitializedRef.current && !initSentRef.current) {
                        initSentRef.current = true;
                        workerRef.current.postMessage({ type: 'INIT' });
                    }
                    return;
                }

                switch (message.type) {
                case 'INIT_SUCCESS':
                    isInitializedRef.current = true;
                    initSentRef.current = false; // Reset for potential re-initialization
                    console.log('RAG worker initialized');
                    // Fetch stats after initialization
                    if (workerRef.current) {
                        workerRef.current.postMessage({ type: 'GET_STATS' });
                    }
                    break;

                case 'MODEL_LOADED':
                    setIsModelLoading(false);
                    setModelLoadingProgress(1);
                    console.log('Text generation model loaded');
                    break;

                case 'MODEL_PROGRESS':
                    setModelLoadingProgress(message.payload.progress);
                    break;

                case 'INDEX_COMPLETE':
                    console.log('All documents indexed successfully');
                    // Refresh stats after indexing
                    if (workerRef.current) {
                        workerRef.current.postMessage({ type: 'GET_STATS' });
                    }
                    break;

                case 'STATS_RESULT':
                    setDocumentStats(message.payload);
                    break;

                case 'DATABASE_CLEARED':
                    setDocumentStats(message.payload);
                    setChatHistory([]);
                    setChatInput("");
                    streamingResponseRef.current = '';
                    console.log('Database cleared successfully');
                    break;

                case 'INDEX_PROGRESS':
                    if (message.payload.skipped) {
                        console.log(`Skipped ${message.payload.fileName} (already indexed)`);
                    } else {
                        console.log(`Indexed ${message.payload.chunkCount} chunks from ${message.payload.fileName}`);
                    }
                    break;

                case 'QUERY_CHUNK':
                    // Handle streaming chunks - accumulate and update UI immediately
                    // The worker already batches chunks, so we can update directly
                    streamingResponseRef.current += message.payload.chunk;
                    
                    // Update the last message in chat history with streaming content
                    setChatHistory(prev => {
                        const updated = [...prev];
                        const lastMessage = updated[updated.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                            lastMessage.content = streamingResponseRef.current;
                        } else {
                            updated.push({ role: 'assistant', content: streamingResponseRef.current });
                        }
                        return updated;
                    });
                    break;

                case 'QUERY_RESULT':
                    setIsQuerying(false);
                    if (message.payload.isFallback) {
                        const prefix = modelLoadError 
                            ? `Note: LLM unavailable (${modelLoadError}). Showing search results:\n\n`
                            : 'Showing search results:\n\n';
                        addMessage('assistant', prefix + message.payload.response);
                    } else {
                        // If we were streaming, replace the streaming content with final response
                        if (streamingResponseRef.current) {
                            setChatHistory(prev => {
                                const updated = [...prev];
                                const lastMessage = updated[updated.length - 1];
                                if (lastMessage && lastMessage.role === 'assistant') {
                                    lastMessage.content = message.payload.response;
                                }
                                return updated;
                            });
                            streamingResponseRef.current = '';
                        } else {
                            addMessage('assistant', message.payload.response);
                        }
                    }
                    break;

                case 'ERROR':
                    console.error('Worker error:', message.payload.error);
                    setIsQuerying(false);
                    setIsModelLoading(false);
                    setModelLoadError(message.payload.error);
                    
                    // If initialization failed, mark as not initialized
                    if (message.payload.errorType === 'INIT') {
                        isInitializedRef.current = false;
                    }
                    
                    if (message.payload.errorType === 'QUERY') {
                        addMessage('assistant', `Error: ${message.payload.error}`);
                    }
                    break;
            }
        };

            worker.onerror = (error) => {
                console.error('[useRAG] Worker error:', error);
                setModelLoadError('Worker initialization failed');
            };

            worker.onmessageerror = (error) => {
                console.error('[useRAG] Worker message error:', error);
            };

            // Fallback: send INIT after delay if READY doesn't come
            const timeoutId = setTimeout(() => {
                if (!isInitializedRef.current && !initSentRef.current && workerRef.current) {
                    console.log('[useRAG] Worker ready timeout, sending INIT anyway');
                    initSentRef.current = true;
                    workerRef.current.postMessage({ type: 'INIT' });
                }
            }, 500);
            
            // Cleanup function
            return () => {
                clearTimeout(timeoutId);
                if (worker) {
                    console.log('[useRAG] Terminating worker');
                    worker.terminate();
                    workerRef.current = null;
                    initSentRef.current = false;
                }
            };
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[useRAG] Failed to create worker:', error);
            setModelLoadError(`Failed to create worker: ${error.message}`);
            return () => {}; // Return empty cleanup
        }
    }, []);

    const addMessage = (role: 'user' | 'assistant', content: string) => {
        setChatHistory(prev => [...prev, { role, content }]);
    };

    const indexDocuments = useCallback(async (filesToIndex: FileItem[]): Promise<void> => {
        // chunkSize and chunkOverlap are captured from closure
        if (!workerRef.current) {
            throw new Error('Worker not created');
        }

        // Wait for initialization if not ready yet
        if (!isInitializedRef.current) {
            // Wait up to 10 seconds for initialization (embeddings model may take time to load)
            const maxWait = 10000;
            const startTime = Date.now();
            const checkInterval = 100;
            
            while (!isInitializedRef.current && (Date.now() - startTime) < maxWait) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
            
            if (!isInitializedRef.current) {
                // Check if there was an error
                if (modelLoadError) {
                    throw new Error(`Worker initialization failed: ${modelLoadError}`);
                }
                throw new Error('Worker initialization timeout. The embeddings model may still be loading. Please try again in a few moments.');
            }
        }

        // Return a promise that resolves when indexing is complete
        return new Promise<void>((resolve, reject) => {
            if (!workerRef.current) {
                reject(new Error('Worker not available'));
                return;
            }

            // Set up a one-time listener for INDEX_COMPLETE or ERROR
            const messageHandler = (event: MessageEvent<WorkerMessage>) => {
                const message = event.data;
                
                if (message.type === 'INDEX_COMPLETE') {
                    if (workerRef.current) {
                        workerRef.current.removeEventListener('message', messageHandler);
                    }
                    resolve();
                } else if (message.type === 'ERROR' && message.payload.errorType === 'INDEX_DOCUMENTS') {
                    if (workerRef.current) {
                        workerRef.current.removeEventListener('message', messageHandler);
                    }
                    reject(new Error(message.payload.error));
                }
            };

            workerRef.current.addEventListener('message', messageHandler);

            // Send the indexing request
            workerRef.current.postMessage({
                type: 'INDEX_DOCUMENTS',
                payload: { 
                    files: filesToIndex.map(f => ({ name: f.name, content: f.content || '' })),
                    chunkSize,
                    chunkOverlap
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (workerRef.current) {
                    workerRef.current.removeEventListener('message', messageHandler);
                }
                reject(new Error('Indexing timeout'));
            }, 30000);
        });
    }, [chunkSize, chunkOverlap]);

    /**
     * Handles RAG query submission from the chat interface.
     * 
     * This function processes user queries, sends them to the worker,
     * and handles streaming responses. It automatically loads the model
     * if needed and manages conversation history.
     * 
     * @param e - Form submission event
     */
    const queryRAG = async (e: FormEvent) => {
        e.preventDefault();
        
        // Allow searching if documents exist (persisted or newly indexed)
        const hasDocuments = documentStats.totalChunks > 0;
        const canSearch = hasDocuments || ragStatus === "Knowledge Base Ready";
        
        if (!chatInput || isQuerying || !canSearch) {
            return;
        }

        if (!workerRef.current || !isInitializedRef.current) {
            addMessage('assistant', "RAG system not initialized. Please wait for initialization to complete.");
            return;
        }

        const userMessage = chatInput;
        setChatInput("");
        addMessage('user', userMessage);
        setIsQuerying(true);
        streamingResponseRef.current = '';
        currentQueryRef.current = userMessage;

        // Check if model needs to be loaded
        if (!isModelLoading && !modelLoadError) {
            try {
                setIsModelLoading(true);
                setModelLoadingProgress(0);
                setModelLoadError(null);
                
                workerRef.current.postMessage({ type: 'LOAD_MODEL' });
                
                // Wait a bit for model to start loading, then proceed with query
                // The query will wait for model if needed
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                setIsModelLoading(false);
                setModelLoadError(`Failed to start model loading: ${error.message}`);
            }
        }

        // If model is loading, wait a bit and check again
        if (isModelLoading) {
            // Query will proceed once model is loaded
            // For now, send query anyway - worker will handle fallback
        }

        // Send query to worker with chat history for memory
        workerRef.current.postMessage({
            type: 'QUERY',
            payload: { 
                query: userMessage,
                chatHistory: chatHistory.slice(0, -1) // Send all but the current user message
            }
        });
    };

    /**
     * Clears the chat history and resets conversation memory in the worker.
     */
    const clearChat = () => {
        setChatHistory([]);
        setChatInput("");
        streamingResponseRef.current = '';
        
        // Clear memory in worker
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'CLEAR_MEMORY' });
        }
    };

    /**
     * Fetches and updates document statistics from the worker.
     */
    const getStats = useCallback(() => {
        if (workerRef.current && isInitializedRef.current) {
            workerRef.current.postMessage({ type: 'GET_STATS' });
        }
    }, []);

    /**
     * Clears all indexed documents from the database.
     * 
     * @returns Promise that resolves when the database is cleared
     */
    const clearDatabase = useCallback(async () => {
        if (!workerRef.current || !isInitializedRef.current) {
            console.warn('Cannot clear database: worker not initialized');
            return;
        }

        try {
            workerRef.current.postMessage({ type: 'CLEAR_DATABASE' });
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Failed to clear database:', error);
            // Error is logged but not thrown to prevent UI disruption
        }
    }, []);

    /**
     * Generates synthetic data using the text generation model.
     * 
     * @param topic - The topic for synthetic data generation
     * @throws {Error} If worker is not available or generation fails
     * @returns Promise that resolves to the generated content
     */
    const generateSyntheticData = useCallback(async (topic: string): Promise<string> => {
        if (!workerRef.current) {
            throw new Error('Worker not created');
        }

        // Wait for initialization if not ready yet
        if (!isInitializedRef.current) {
            const maxWait = 10000;
            const startTime = Date.now();
            const checkInterval = 100;
            
            while (!isInitializedRef.current && (Date.now() - startTime) < maxWait) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
            
            if (!isInitializedRef.current) {
                throw new Error('Worker not initialized');
            }
        }

        return new Promise<string>((resolve, reject) => {
            if (!workerRef.current) {
                reject(new Error('Worker not available'));
                return;
            }

            const messageHandler = (event: MessageEvent<WorkerMessage>) => {
                const message = event.data;
                
                if (message.type === 'SYNTHETIC_GENERATED') {
                    if (workerRef.current) {
                        workerRef.current.removeEventListener('message', messageHandler);
                    }
                    resolve(message.payload.content);
                } else if (message.type === 'ERROR' && message.payload.errorType === 'GENERATE_SYNTHETIC') {
                    if (workerRef.current) {
                        workerRef.current.removeEventListener('message', messageHandler);
                    }
                    reject(new Error(message.payload.error));
                }
            };

            workerRef.current.addEventListener('message', messageHandler);

            workerRef.current.postMessage({
                type: 'GENERATE_SYNTHETIC',
                payload: { topic }
            });

            setTimeout(() => {
                if (workerRef.current) {
                    workerRef.current.removeEventListener('message', messageHandler);
                }
                reject(new Error('Synthetic data generation timeout'));
            }, 60000); // 60 second timeout for generation
        });
    }, []);


    // Check if search is available (has documents or status is ready)
    const canSearch = documentStats.totalChunks > 0 || ragStatus === "Knowledge Base Ready";

    return {
        chatInput,
        setChatInput,
        chatHistory,
        isQuerying,
        queryRAG,
        clearChat,
        indexDocuments,
        modelLoadingProgress,
        isModelLoading,
        documentStats,
        getStats,
        canSearch,
        clearDatabase,
        generateSyntheticData,
    };
};
