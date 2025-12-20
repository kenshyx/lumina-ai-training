import { useState, FormEvent, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, FileItem } from '../types';

type WorkerMessage = 
    | { type: 'READY' }
    | { type: 'INIT_SUCCESS' }
    | { type: 'MODEL_LOADED' }
    | { type: 'MODEL_PROGRESS'; payload: { progress: number } }
    | { type: 'INDEX_COMPLETE' }
    | { type: 'INDEX_PROGRESS'; payload: { fileName: string; chunkCount: number } }
    | { type: 'QUERY_RESULT'; payload: { response: string; isFallback: boolean } }
    | { type: 'QUERY_CHUNK'; payload: { chunk: string } }
    | { type: 'MEMORY_CLEARED' }
    | { type: 'ERROR'; payload: { error: string; errorType?: string } };

export const useRAG = (ragStatus: string, files?: FileItem[]) => {
    const [chatInput, setChatInput] = useState<string>("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isQuerying, setIsQuerying] = useState<boolean>(false);
    const [modelLoadingProgress, setModelLoadingProgress] = useState<number>(0);
    const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
    const [modelLoadError, setModelLoadError] = useState<string | null>(null);
    
    const workerRef = useRef<Worker | null>(null);
    const isInitializedRef = useRef<boolean>(false);
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
                    if (workerRef.current && !isInitializedRef.current) {
                        workerRef.current.postMessage({ type: 'INIT' });
                    }
                    return;
                }

                switch (message.type) {
                case 'INIT_SUCCESS':
                    isInitializedRef.current = true;
                    console.log('RAG worker initialized');
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
                    break;

                case 'INDEX_PROGRESS':
                    console.log(`Indexed ${message.payload.chunkCount} chunks from ${message.payload.fileName}`);
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
            setTimeout(() => {
                if (!isInitializedRef.current && workerRef.current) {
                    console.log('[useRAG] Worker ready timeout, sending INIT anyway');
                    workerRef.current.postMessage({ type: 'INIT' });
                }
            }, 500);
        } catch (err) {
            console.error('[useRAG] Failed to create worker:', err);
            setModelLoadError('Failed to create worker');
        }

        // Cleanup
        return () => {
            if (worker) {
                console.log('[useRAG] Terminating worker');
                worker.terminate();
                workerRef.current = null;
            }
        };

        // Cleanup
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);

    const addMessage = (role: 'user' | 'assistant', content: string) => {
        setChatHistory(prev => [...prev, { role, content }]);
    };

    const indexDocuments = useCallback(async (filesToIndex: FileItem[]): Promise<void> => {
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
                payload: { files: filesToIndex }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (workerRef.current) {
                    workerRef.current.removeEventListener('message', messageHandler);
                }
                reject(new Error('Indexing timeout'));
            }, 30000);
        });
    }, []);

    const queryRAG = async (e: FormEvent) => {
        e.preventDefault();
        
        if (!chatInput || isQuerying || ragStatus !== "Knowledge Base Ready") {
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
                setIsModelLoading(false);
                setModelLoadError('Failed to start model loading');
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

    const clearChat = () => {
        setChatHistory([]);
        setChatInput("");
        streamingResponseRef.current = '';
        
        // Clear memory in worker
        if (workerRef.current) {
            workerRef.current.postMessage({ type: 'CLEAR_MEMORY' });
        }
    };

    return {
        chatInput,
        setChatInput,
        chatHistory,
        isQuerying,
        queryRAG,
        clearChat,
        indexDocuments,
        modelLoadingProgress,
        isModelLoading
    };
};
