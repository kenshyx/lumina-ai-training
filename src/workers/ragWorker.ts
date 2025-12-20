import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';
import { VoyVectorStore } from '@langchain/community/vectorstores/voy';
import { Voy as VoyClient } from 'voy-search';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { pipeline, env, TextStreamer } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.allowRemoteModels = true;

// Worker message types
type WorkerRequest = 
    | { type: 'INIT' }
    | { type: 'LOAD_MODEL' }
    | { type: 'INDEX_DOCUMENTS'; payload: { files: Array<{ name: string; content: string }> } }
    | { type: 'QUERY'; payload: { query: string; chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }> } }
    | { type: 'CLEAR_MEMORY' };

// Worker state
let embeddings: HuggingFaceTransformersEmbeddings | null = null;
let vectorStore: VoyVectorStore | null = null;
let voyClient: VoyClient | null = null;
let textSplitter: RecursiveCharacterTextSplitter | null = null;
let model: any = null;
let isInitialized = false;
// Conversation memory - stores previous messages for context
let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

// Log that worker is loaded
console.log('[RAG Worker] Worker script loaded');

// Send READY message to main thread
self.postMessage({ type: 'READY' });

// Message handler
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const message = event.data;
    const { type } = message;
    const payload = 'payload' in message ? message.payload : undefined;

    console.log('[RAG Worker] Received message:', type, payload);

    try {
        switch (type) {
            case 'INIT': {
                console.log('[RAG Worker] INIT received, isInitialized:', isInitialized);
                if (isInitialized) {
                    console.log('[RAG Worker] Already initialized, sending INIT_SUCCESS');
                    self.postMessage({ type: 'INIT_SUCCESS' });
                    return;
                }

                try {
                    console.log('[RAG Worker] Starting initialization...');
                    // Initialize text splitter
                    textSplitter = new RecursiveCharacterTextSplitter({
                        chunkSize: 500,
                        chunkOverlap: 50,
                    });
                    console.log('[RAG Worker] Text splitter initialized');

                    // Initialize HuggingFaceTransformersEmbeddings
                    console.log('[RAG Worker] Initializing embeddings...');
                    embeddings = new HuggingFaceTransformersEmbeddings({
                        model: 'Xenova/all-MiniLM-L6-v2',
                    });
                    console.log('[RAG Worker] Embeddings initialized');

                    // Initialize VoyClient
                    console.log('[RAG Worker] Initializing VoyClient...');
                    voyClient = new VoyClient();
                    console.log('[RAG Worker] VoyClient initialized');

                    // Initialize VoyVectorStore
                    console.log('[RAG Worker] Initializing VoyVectorStore...');
                    vectorStore = new VoyVectorStore(voyClient, embeddings);
                    console.log('[RAG Worker] VoyVectorStore initialized');

                    isInitialized = true;
                    console.log('[RAG Worker] Initialization complete, sending INIT_SUCCESS');
                    self.postMessage({ type: 'INIT_SUCCESS' });
                } catch (err: any) {
                    console.error('[RAG Worker] Initialization error:', err);
                    self.postMessage({ 
                        type: 'ERROR', 
                        payload: { 
                            error: err?.message || 'Initialization failed',
                            errorType: 'INIT'
                        } 
                    });
                }
                break;
            }

            case 'LOAD_MODEL': {
                if (model) {
                    self.postMessage({ type: 'MODEL_LOADED' });
                    return;
                }

                // Progress callback for pipeline loading
                const onProgress = (progress: any) => {
                    let progressValue = 0;
                    if (typeof progress === 'number') {
                        progressValue = progress;
                    } else if (typeof progress === 'string') {
                        const match = progress.match(/(\d+)%/);
                        if (match) {
                            progressValue = parseInt(match[1]) / 100;
                        }
                    } else if (progress && typeof progress === 'object') {
                        if (progress.loaded !== undefined && progress.total !== undefined) {
                            progressValue = progress.loaded / progress.total;
                        } else if (progress.progress !== undefined) {
                            progressValue = typeof progress.progress === 'number' 
                                ? progress.progress 
                                : progress.progress / 100;
                        }
                    }
                    
                    const normalizedProgress = Math.max(0, Math.min(1, progressValue));
                    self.postMessage({ 
                        type: 'MODEL_PROGRESS', 
                        payload: { progress: normalizedProgress } 
                    });
                };

                // Initialize the text generation pipeline
                model = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-360M-Instruct', {
                    device: 'wasm',
                    dtype: 'q8',
                    progress_callback: onProgress,
                });

                self.postMessage({ type: 'MODEL_LOADED' });
                break;
            }

            case 'INDEX_DOCUMENTS': {
                if (!vectorStore || !isInitialized || !textSplitter) {
                    self.postMessage({ 
                        type: 'ERROR', 
                        payload: { 
                            error: 'RAG system not initialized',
                            errorType: 'INDEX_DOCUMENTS'
                        } 
                    });
                    return;
                }

                try {
                    if (!payload || !('files' in payload)) {
                        throw new Error('Invalid payload for INDEX_DOCUMENTS');
                    }
                    const { files } = payload;
                    
                    for (const file of files) {
                        if (!file.content) {
                            console.warn(`Skipping file ${file.name} - no content`);
                            continue;
                        }
                        
                        const docs = await textSplitter.createDocuments([file.content]);
                        await vectorStore.addDocuments(docs);
                        
                        self.postMessage({ 
                            type: 'INDEX_PROGRESS', 
                            payload: { 
                                fileName: file.name, 
                                chunkCount: docs.length 
                            } 
                        });
                    }
                    
                    self.postMessage({ type: 'INDEX_COMPLETE' });
                } catch (err: any) {
                    self.postMessage({ 
                        type: 'ERROR', 
                        payload: { 
                            error: err?.message || 'Indexing failed',
                            errorType: 'INDEX_DOCUMENTS'
                        } 
                    });
                }
                break;
            }

            case 'QUERY': {
                if (!vectorStore || !isInitialized) {
                    throw new Error('Vector store not initialized');
                }

                if (!payload || !('query' in payload)) {
                    throw new Error('Invalid payload for QUERY');
                }
                const { query, chatHistory } = payload;

                // If chatHistory is provided, sync it with internal memory (for consistency)
                // Otherwise, use internal memory and add the new user message
                if (chatHistory && chatHistory.length > 0) {
                    conversationHistory = [...chatHistory];
                }
                
                // Add new user message to conversation history
                conversationHistory.push({ role: 'user', content: query });

                // Perform similarity search
                const results = await vectorStore.similaritySearch(query, 3);
                
                // Build context text
                const contextText = results
                    .map((doc) => doc.pageContent)
                    .join('\n\n');

                // If model is not loaded, return search results only
                if (!model) {
                    const response = results.length > 0
                        ? results.map((doc, idx) => `[${idx + 1}] ${doc.pageContent}`).join('\n\n')
                        : "No relevant documents found in the knowledge base.";
                    
                    self.postMessage({ 
                        type: 'QUERY_RESULT', 
                        payload: { 
                            response,
                            isFallback: true 
                        } 
                    });
                    return;
                }

                // Build chat prompt with memory (previous conversation) and current context
                // Use a clear system prompt that establishes roles
                const systemPrompt = `You are a helpful AI assistant. Your role is to answer questions using ONLY the provided context from the knowledge base. 

IMPORTANT RULES:
- You are the ASSISTANT (AI)
- The user asks questions
- Only use information from the provided context
- If the context doesn't contain the answer, say so
- Do not make up information
- You can use emojis if it's relevant to the answer
- You can reference previous conversation if it's relevant
- Be concise and accurate`;

                const chat = [
                    { role: 'system', content: systemPrompt },
                    // Include previous conversation history (last 6 messages to keep context manageable)
                    ...conversationHistory.slice(-6).map(msg => ({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    })),
                    { role: 'user', content: `Context from knowledge base:\n${contextText}\n\nUser question: ${query}\n\nAnswer based on the context above:` }
                ];
                
                const prompt = model.tokenizer.apply_chat_template(chat, { 
                    tokenize: false, 
                    add_generation_prompt: true 
                });

                // Accumulate streamed text chunks
                let streamedText = '';
                let chunkBuffer = '';
                let chunkBufferTimeout: ReturnType<typeof setTimeout> | null = null;
                
                const flushChunkBuffer = () => {
                    if (chunkBuffer.length > 0) {
                        self.postMessage({ 
                            type: 'QUERY_CHUNK', 
                            payload: { chunk: chunkBuffer } 
                        });
                        chunkBuffer = '';
                    }
                    if (chunkBufferTimeout) {
                        clearTimeout(chunkBufferTimeout);
                        chunkBufferTimeout = null;
                    }
                };
                
                const streamer = new TextStreamer(model.tokenizer, {
                    skip_prompt: true,
                    callback_function: (text: string) => {
                        streamedText += text;
                        chunkBuffer += text;
                        
                        // Send chunks more frequently - either when buffer reaches a size or after a short delay
                        // This batches small chunks together for better performance while keeping it responsive
                        if (chunkBuffer.length >= 20) {
                            // Flush immediately if buffer is large enough (more content per update)
                            flushChunkBuffer();
                        } else if (!chunkBufferTimeout) {
                            // Otherwise, flush after a very short delay (batches rapid small chunks)
                            // Lower delay = faster updates, higher = more batching
                            chunkBufferTimeout = setTimeout(flushChunkBuffer, 50);
                        }
                    }
                });
                
                // Generate response with stricter parameters to reduce hallucinations
                const output = await model(prompt, {
                    max_new_tokens: 256, // Increased for more complete answers
                    temperature: 0.1, // Lower temperature = more focused, less creative/hallucinatory
                    repetition_penalty: 1.2,
                    top_p: 0.9, // Nucleus sampling - focus on most likely tokens
                    streamer,
                    stop: ["<|im_end|>", "Question:", "User question:", "Context:"] 
                });
                
                // Flush any remaining buffered chunks
                flushChunkBuffer();
                
                // Use streamed text if available, otherwise extract from output
                let responseContent = '';
                if (streamedText) {
                    responseContent = streamedText;
                } else {
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
                
                // Add assistant response to conversation history
                conversationHistory.push({ role: 'assistant', content: cleanResponse });
                
                // Keep only last 10 messages in memory to prevent it from growing too large
                if (conversationHistory.length > 10) {
                    conversationHistory = conversationHistory.slice(-10);
                }
                
                self.postMessage({ 
                    type: 'QUERY_RESULT', 
                    payload: { 
                        response: cleanResponse,
                        isFallback: false 
                    } 
                });
                break;
            }

            case 'CLEAR_MEMORY': {
                conversationHistory = [];
                self.postMessage({ type: 'MEMORY_CLEARED' });
                break;
            }

            default:
                self.postMessage({ 
                    type: 'ERROR', 
                    payload: { error: `Unknown message type: ${type}` } 
                });
        }
    } catch (error: any) {
        self.postMessage({ 
            type: 'ERROR', 
            payload: { 
                error: error?.message || 'Unknown error',
                errorType: type 
            } 
        });
    }
};

