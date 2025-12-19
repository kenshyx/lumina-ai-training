import { useState, FormEvent, useRef, useEffect } from 'react';
import { ChatMessage, FileItem } from '../types';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';
import { VoyVectorStore } from '@langchain/community/vectorstores/voy';
import { Voy as VoyClient } from 'voy-search';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { pipeline, env, TextStreamer } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.allowRemoteModels = true;

env.backends.onnx.wasm.numThreads = 8

export const useRAG = (ragStatus: string, files?: FileItem[]) => {
    const [chatInput, setChatInput] = useState<string>("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isQuerying, setIsQuerying] = useState<boolean>(false);
    const [modelLoadingProgress, setModelLoadingProgress] = useState<number>(0);
    const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
    const [modelLoadError, setModelLoadError] = useState<string | null>(null);
    
    const embeddingsRef = useRef<HuggingFaceTransformersEmbeddings | null>(null);
    const vectorStoreRef = useRef<VoyVectorStore | null>(null);
    const voyClientRef = useRef<VoyClient | null>(null);
    const textSplitterRef = useRef<RecursiveCharacterTextSplitter | null>(null);
    const modelRef = useRef<any>(null);
    const isInitializedRef = useRef<boolean>(false);

    // Initialize embedding model and vector store
    useEffect(() => {
        const initializeRAG = async () => {
            if (isInitializedRef.current) return;
            
            try {
                // Initialize text splitter
                textSplitterRef.current = new RecursiveCharacterTextSplitter({
                    chunkSize: 500,
                    chunkOverlap: 50,
                });

                // Initialize HuggingFaceTransformersEmbeddings with quantized model
                embeddingsRef.current = new HuggingFaceTransformersEmbeddings({
                    model: 'Xenova/all-MiniLM-L6-v2',
                });

                // Initialize VoyClient
                voyClientRef.current = new VoyClient();

                // Initialize VoyVectorStore with VoyClient and embeddings
                vectorStoreRef.current = new VoyVectorStore(
                    voyClientRef.current,
                    embeddingsRef.current
                );

                // Model will be loaded lazily on first query using WASM (no WebGPU needed)
                console.log('RAG system initialized. Model will be loaded on first use.');

                isInitializedRef.current = true;
            } catch (err) {
                console.error('Failed to initialize RAG components:', err);
            }
        };

        initializeRAG();
    }, []);

    const indexDocuments = async (filesToIndex: FileItem[]): Promise<void> => {
        if (!vectorStoreRef.current || !isInitializedRef.current) {
            throw new Error('Vector store not initialized');
        }

        if (!textSplitterRef.current) {
            throw new Error('Text splitter not initialized');
        }

        try {
            // Process each file and add documents to vector store
            for (const file of filesToIndex) {
                if (!file.content) {
                    console.warn(`Skipping file ${file.name} - no content`);
                    continue;
                }
                
                // Split document into chunks using RecursiveCharacterTextSplitter
                const docs = await textSplitterRef.current.createDocuments([file.content]);
                
                // Add documents directly to vector store
                await vectorStoreRef.current.addDocuments(docs);
                console.log(`Indexed ${docs.length} chunks from ${file.name}`);
            }
            
            console.log('All documents indexed successfully');
        } catch (err) {
            console.error('Failed to index documents:', err);
            throw err;
        }
    };

    const addMessage = (role: 'user' | 'assistant', content: string) => {
        setChatHistory(prev => [...prev, { role, content }]);
    };

    const queryRAG = async (e: FormEvent) => {
        e.preventDefault();
        
        if (!chatInput || isQuerying || ragStatus !== "Knowledge Base Ready") {
            return;
        }

        if (!vectorStoreRef.current || !isInitializedRef.current) {
            addMessage('assistant', "Vector store not initialized. Please wait for initialization to complete.");
            return;
        }

        const userMessage = chatInput;
        setChatInput("");
        addMessage('user', userMessage);
        setIsQuerying(true);

        // Check if model is available, if not, try to initialize it or fall back to vector search
        if (!modelRef.current && !modelLoadError && !isModelLoading) {
            // Try to initialize model on first use (lazy loading)
            try {
                setIsModelLoading(true);
                setModelLoadingProgress(0);
                setModelLoadError(null);
                
                console.log('Initializing text generation model...');
                setModelLoadingProgress(0);
                
                // Progress callback for pipeline loading
                const onProgress = (progress: any) => {
                    // Handle different progress formats
                    let progressValue = 0;
                    if (typeof progress === 'number') {
                        progressValue = progress;
                    } else if (typeof progress === 'string') {
                        // Try to parse string like "63%" or "[55/87]: 63%"
                        const match = progress.match(/(\d+)%/);
                        if (match) {
                            progressValue = parseInt(match[1]) / 100;
                        }
                    } else if (progress && typeof progress === 'object') {
                        // Handle progress object with loaded/total or progress property
                        if (progress.loaded !== undefined && progress.total !== undefined) {
                            progressValue = progress.loaded / progress.total;
                        } else if (progress.progress !== undefined) {
                            progressValue = typeof progress.progress === 'number' 
                                ? progress.progress 
                                : progress.progress / 100;
                        }
                    }
                    
                    // Update progress, ensuring it's between 0 and 1
                    const normalizedProgress = Math.max(0, Math.min(1, progressValue));
                    // Use normalizedProgress directly for the download progress bar
                    setModelLoadingProgress(normalizedProgress);
                    console.log('Model loading progress:', normalizedProgress, 'Raw progress:', progress);
                };
                
                // Initialize the text generation pipeline with WASM
                modelRef.current = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-360M-Instruct', {
                    device: 'wasm',
                    dtype: 'q8',
                    progress_callback: onProgress,
                });
                
                // Set to 100% when complete
                setModelLoadingProgress(1);
                setIsModelLoading(false);
                console.log('Text generation model initialized and ready');
            } catch (modelErr: any) {
                setIsModelLoading(false);
                setModelLoadingProgress(0);
                const errorMsg = modelErr?.message || 'Model loading failed';
                setModelLoadError(errorMsg);
                console.warn('Model initialization failed:', modelErr);
                modelRef.current = null; // Clear the reference on error
            }
        }
        
        // If model is still loading, wait for it
        if (isModelLoading) {
            addMessage('assistant', "Model is still loading. Please wait...");
            setIsQuerying(false);
            return;
        }
        
        // If model still not available after initialization attempt, fall back to vector search only
        if (!modelRef.current) {
            try {
                const results = await vectorStoreRef.current.similaritySearch(userMessage, 3);
                if (results.length > 0) {
                    const response = results
                        .map((doc, idx) => `[${idx + 1}] ${doc.pageContent}`)
                        .join('\n\n');
                    const prefix = modelLoadError 
                        ? `Note: LLM unavailable (${modelLoadError}). Showing search results:\n\n`
                        : 'Showing search results:\n\n';
                    addMessage('assistant', prefix + response);
                } else {
                    addMessage('assistant', "No relevant documents found in the knowledge base.");
                }
            } catch (err) {
                console.error('Failed to query vector store:', err);
                addMessage('assistant', "Error querying knowledge base.");
            } finally {
                setIsQuerying(false);
            }
            return;
        }

        try {
            // Perform similarity search to get context
            const results = await vectorStoreRef.current.similaritySearch(userMessage, 3);
            
            // Build context text from search results
            const contextText = results
                .map((doc) => doc.pageContent)
                .join('\n\n');
                        
            // Get response from text generation pipeline
            if (!modelRef.current) {
                throw new Error('Model not available');
            }

            const chat = [
                { role: 'system', content: 'Answer using only the provided context.' },
                { role: 'user', content: `Context: ${contextText}\nQuestion: ${userMessage}` }
            ];
            
            const prompt = modelRef.current.tokenizer.apply_chat_template(chat, { 
                tokenize: false, 
                add_generation_prompt: true 
            });

            // Accumulate streamed text chunks
            let streamedText = '';
            const streamer = new TextStreamer(modelRef.current.tokenizer, {
                skip_prompt: true,
                callback_function: (text: string) => {
                    streamedText += text;
                }
            });
            
            // Generate response using the pipeline
            const output = await modelRef.current(prompt, {
                max_new_tokens: 128,
                temperature: 0.2,       // Lower is better for factual RAG
                repetition_penalty: 1.2, // Prevents the model from getting stuck in a loop
                streamer,
                stop: ["<|im_end|>", "Question:"] 
            });
            
            // Use streamed text if available, otherwise extract from output
            let responseContent = '';
            if (streamedText) {
                responseContent = streamedText;
            } else {
                // Extract the generated text from the output
                responseContent = Array.isArray(output) && output.length > 0
                    ? output[0].generated_text || output[0].text || JSON.stringify(output[0])
                    : typeof output === 'string'
                    ? output
                    : output?.generated_text || output?.text || String(output);
            }
            
            // Remove the prompt from the response if it's included
            const cleanResponse = responseContent.startsWith(prompt)
                ? responseContent.slice(prompt.length).trim()
                : responseContent.trim();
            
            addMessage('assistant', cleanResponse);
        } catch (err) {
            console.error('Failed to query RAG:', err);
            addMessage('assistant', "Error querying knowledge base.");
        } finally {
            setIsQuerying(false);
        }
    };

    const clearChat = () => {
        setChatHistory([]);
        setChatInput("");
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

