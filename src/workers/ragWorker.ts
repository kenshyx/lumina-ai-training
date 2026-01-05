import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { pipeline, env, TextStreamer, TextGenerationPipeline, ProgressCallback } from '@huggingface/transformers';
import * as duckdb from '@duckdb/duckdb-wasm';

env.allowLocalModels = false;
env.useBrowserCache = true;
env.allowRemoteModels = true;

/**
 * Worker request message types for communication between main thread and worker.
 */
type WorkerRequest = 
    | { type: 'INIT' }
    | { type: 'LOAD_MODEL' }
    | { type: 'INDEX_DOCUMENTS'; payload: { files: Array<{ name: string; content: string }>; chunkSize?: number; chunkOverlap?: number } }
    | { type: 'QUERY'; payload: { query: string; chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }> } }
    | { type: 'CLEAR_MEMORY' }
    | { type: 'GET_STATS' }
    | { type: 'CLEAR_DATABASE' }
    | { type: 'GENERATE_SYNTHETIC'; payload: { topic: string } };

/**
 * DuckDB query result row type.
 */
interface DuckDBRow {
    id?: number;
    vector?: number[] | string;
    text?: string;
    metadata?: string;
    total_chunks?: number | string;
    avg_length?: number | string;
    count?: number | string;
}

/**
 * IndexedDB vector item type.
 */
interface IndexedDBVectorItem {
    id: number;
    vector: number[];
    text: string;
    metadata: string;
}

/**
 * Similarity search result item.
 */
interface SimilarityResult {
    text: string;
    metadata: string;
    similarity: number;
}


/**
 * DuckDB connection interface based on actual usage.
 * The connection object has a query method that accepts SQL strings.
 */
interface DuckDBConnection {
    query: (sql: string) => Promise<duckdb.ResultSet>;
}

// Module-level singleton - ONE database instance for entire worker
let globalDuckDB: duckdb.AsyncDuckDB | null = null;
let globalDuckDBConnection: DuckDBConnection | null = null;
let globalDuckDBInitialized = false;
let globalDuckDBInitializing = false; // Prevent concurrent initialization

/**
 * DuckDB-based vector store for storing and searching document embeddings.
 * 
 * This class manages a DuckDB database instance with a singleton pattern to ensure
 * only one database connection exists per worker. It handles document indexing,
 * similarity search, and persistence to IndexedDB.
 * 
 * @example
 * ```typescript
 * const embeddings = new HuggingFaceTransformersEmbeddings({ model: 'Xenova/all-MiniLM-L6-v2' });
 * const vectorStore = new DuckDBVectorStore(embeddings);
 * await vectorStore.initialize();
 * await vectorStore.addDocuments(documents);
 * const results = await vectorStore.similaritySearch('query', 5);
 * ```
 */
class DuckDBVectorStore {
    private embeddings: HuggingFaceTransformersEmbeddings;
    private tableName: string;

    /**
     * Creates a new DuckDBVectorStore instance.
     * 
     * @param embeddings - The embeddings model to use for generating vectors
     * @param tableName - The name of the table to store vectors in (default: 'vectors')
     */
    constructor(embeddings: HuggingFaceTransformersEmbeddings, tableName: string = 'vectors') {
        this.embeddings = embeddings;
        this.tableName = tableName;
    }

    /**
     * Initializes the DuckDB database connection and creates necessary tables.
     * 
     * This method implements a singleton pattern to ensure only one database instance
     * is created per worker. It handles concurrent initialization attempts and loads
     * persisted data from IndexedDB on first initialization.
     * 
     * @throws {Error} If database initialization fails or connection cannot be established
     * @returns Promise that resolves when initialization is complete
     */
    async initialize(): Promise<void> {
        // Use global singleton - only create once
        if (globalDuckDBInitialized && globalDuckDB && globalDuckDBConnection) {
            console.log('[DuckDB] Using existing global database instance - SKIPPING');
            return;
        }

        // If already initializing, wait for it to complete
        if (globalDuckDBInitializing) {
            console.log('[DuckDB] Already initializing, waiting...');
            // Wait up to 10 seconds for initialization
            const maxWait = 10000;
            const startTime = Date.now();
            while (globalDuckDBInitializing && !globalDuckDBInitialized && (Date.now() - startTime) < maxWait) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            if (globalDuckDBInitialized && globalDuckDB && globalDuckDBConnection) {
                console.log('[DuckDB] Initialization completed by another call');
                return;
            }
        }

        // Prevent concurrent initialization
        if (globalDuckDBInitializing) {
            throw new Error('Database initialization already in progress');
        }

        globalDuckDBInitializing = true;

        try {
            console.log('[DuckDB] ========== CREATING SINGLE DATABASE INSTANCE ==========');
            console.log('[DuckDB] This should ONLY happen ONCE per worker');
            console.log('[DuckDB] Current state:', {
                hasDB: !!globalDuckDB,
                hasConnection: !!globalDuckDBConnection,
                isInitialized: globalDuckDBInitialized,
                isInitializing: globalDuckDBInitializing
            });
            
            // Triple-check after acquiring lock
            if (globalDuckDBInitialized && globalDuckDB && globalDuckDBConnection) {
                console.log('[DuckDB] Database was initialized while waiting, using existing');
                globalDuckDBInitializing = false;
                return;
            }
            
            // Check if db already exists but not marked as initialized
            if (globalDuckDB && globalDuckDBConnection) {
                console.log('[DuckDB] Database already exists, marking as initialized');
                globalDuckDBInitialized = true;
                globalDuckDBInitializing = false;
                return;
            }
            
            // CRITICAL: Only create if absolutely nothing exists
            if (globalDuckDB) {
                console.error('[DuckDB] ERROR: globalDuckDB exists but connection is null!');
                throw new Error('Database exists but connection is missing');
            }
            
            const bundles = duckdb.getJsDelivrBundles();
            const bundle = await duckdb.selectBundle(bundles);
            const logger = new duckdb.ConsoleLogger();
            const worker = await duckdb.createWorker(bundle.mainWorker!);
            
            console.log('[DuckDB] Creating AsyncDuckDB instance...');
            globalDuckDB = new duckdb.AsyncDuckDB(logger, worker);
            await globalDuckDB.instantiate(bundle.mainModule, bundle.pthreadWorker);
            
            // CRITICAL: Check again before opening - NEVER open if connection exists
            if (globalDuckDBConnection) {
                console.error('[DuckDB] ERROR: Connection already exists before opening!');
                console.error('[DuckDB] This means db.open() was called multiple times!');
                throw new Error('Connection already exists - database was created elsewhere');
            }
            
            // Open in-memory database - ONLY ONCE
            console.log('[DuckDB] Opening database (this should happen ONCE)...');
            await globalDuckDB.open({
                query: {
                    castBigIntToDouble: true,
                    castTimestampToDate: true,
                },
            });
            
            console.log('[DuckDB] Connecting to database...');
            globalDuckDBConnection = await globalDuckDB.connect();
            
            if (!globalDuckDBConnection) {
                throw new Error('Failed to create connection');
            }
            
            console.log('[DuckDB] Database opened and connected successfully');
            
            // Create sequence for auto-increment
            try {
                await globalDuckDBConnection.query(`
                    CREATE SEQUENCE IF NOT EXISTS ${this.tableName}_id_seq START 1
                `);
            } catch (err) {
                // Ignore if sequence already exists
            }
            
            // Create table - ALWAYS create table, even if database was reused
            try {
                await globalDuckDBConnection.query(`
                    CREATE TABLE IF NOT EXISTS ${this.tableName} (
                        id INTEGER PRIMARY KEY DEFAULT nextval('${this.tableName}_id_seq'),
                        vector DOUBLE[],
                        text VARCHAR,
                        metadata VARCHAR
                    )
                `);
                console.log('[DuckDB] Table created/verified');
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                console.error('[DuckDB] Error creating table:', error);
                throw error;
            }
            
            // Load from IndexedDB (only on first initialization)
            if (!globalDuckDBInitialized) {
                await this.loadFromIndexedDB();
            }
            
            globalDuckDBInitialized = true;
            console.log('[DuckDB] ========== DATABASE INITIALIZED (SINGLE INSTANCE) ==========');
        } catch (err) {
            globalDuckDBInitializing = false;
            throw err;
        } finally {
            globalDuckDBInitializing = false;
        }
    }

    /**
     * Adds documents to the vector store by generating embeddings and storing them in DuckDB.
     * 
     * @param docs - Array of Document objects to index
     * @throws {Error} If DuckDB is not initialized
     * @returns Promise that resolves when all documents are added and persisted
     */
    async addDocuments(docs: Document[]): Promise<void> {
        if (!globalDuckDBConnection) {
            throw new Error('DuckDB not initialized');
        }

        const texts = docs.map(doc => doc.pageContent);
        const vectors = await this.embeddings.embedDocuments(texts);
        
        for (let i = 0; i < docs.length; i++) {
            const vectorArray = vectors[i];
            const metadataStr = JSON.stringify(docs[i].metadata || {});
            const textContent = docs[i].pageContent.replace(/'/g, "''");
            const metadataEscaped = metadataStr.replace(/'/g, "''");
            const vectorLiteral = `[${vectorArray.join(',')}]`;
            
            await globalDuckDBConnection.query(`
                INSERT INTO ${this.tableName} (vector, text, metadata)
                VALUES (${vectorLiteral}::DOUBLE[], '${textContent}', '${metadataEscaped}')
            `);
        }
        
        // Save to IndexedDB
        await this.saveToIndexedDB();
    }

    /**
     * Performs a similarity search using cosine similarity to find the most relevant documents.
     * 
     * @param query - The search query string
     * @param k - The number of top results to return
     * @throws {Error} If DuckDB is not initialized
     * @returns Promise that resolves to an array of the top-k most similar documents
     */
    async similaritySearch(query: string, k: number): Promise<Document[]> {
        if (!globalDuckDBConnection) {
            throw new Error('DuckDB not initialized');
        }

        const queryVector = await this.embeddings.embedQuery(query);
        
        const result = await globalDuckDBConnection.query(`
            SELECT id, vector, text, metadata
            FROM ${this.tableName}
        `);
        
        const rows = result.toArray() as DuckDBRow[];
        const similarities: SimilarityResult[] = rows.map((row) => {
            const storedVector = Array.isArray(row.vector) 
                ? row.vector as number[]
                : JSON.parse((row.vector as string) || '[]') as number[];
            const similarity = this.cosineSimilarity(queryVector, storedVector);
            return {
                text: row.text || '',
                metadata: row.metadata || '{}',
                similarity,
            };
        });
        
        similarities.sort((a, b) => b.similarity - a.similarity);
        const topK = similarities.slice(0, k);
        
        return topK.map((item) => {
            const metadata = item.metadata ? JSON.parse(item.metadata) : {};
            return new Document({
                pageContent: item.text,
                metadata,
            });
        });
    }

    /**
     * Checks if a file with the given name has already been indexed.
     * 
     * @param fileName - The name of the file to check
     * @returns Promise that resolves to true if the file exists, false otherwise
     */
    async fileExists(fileName: string): Promise<boolean> {
        if (!globalDuckDBConnection) {
            return false;
        }

        try {
            // Get all metadata and check for file name
            const result = await globalDuckDBConnection.query(`
                SELECT metadata
                FROM ${this.tableName}
            `);
            
            const rows = result.toArray();
            for (const row of rows) {
                try {
                    const metadata = JSON.parse(row.metadata || '{}');
                    // Check both metadata.source and metadata.loc.source
                    if (metadata.loc?.source === fileName || metadata.source === fileName) {
                        return true;
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
            return false;
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[DuckDB] Error checking file existence:', error);
            return false;
        }
    }

    /**
     * Retrieves statistics about the indexed documents.
     * 
     * @returns Promise that resolves to an object containing:
     *   - totalDocuments: Number of unique documents indexed
     *   - totalChunks: Total number of document chunks
     *   - averageChunkLength: Average character length of chunks
     */
    async getStats(): Promise<{ totalDocuments: number; totalChunks: number; averageChunkLength: number }> {
        if (!globalDuckDBConnection) {
            return { totalDocuments: 0, totalChunks: 0, averageChunkLength: 0 };
        }

        try {
            const result = await globalDuckDBConnection.query(`
                SELECT 
                    COUNT(*) as total_chunks,
                    AVG(LENGTH(text)) as avg_length
                FROM ${this.tableName}
            `);
            
            const rows = result.toArray() as DuckDBRow[];
            const stats = rows[0] || { total_chunks: 0, avg_length: 0 };
            
            // Get unique file count from metadata
            const allResult = await globalDuckDBConnection.query(`
                SELECT metadata
                FROM ${this.tableName}
            `);
            
            const allRows = allResult.toArray() as DuckDBRow[];
            const uniqueFiles = new Set<string>();
            allRows.forEach((row) => {
                try {
                    const metadata = JSON.parse((row.metadata || '{}') as string) as { loc?: { source?: string }; source?: string };
                    // Check both loc.source and source for file name
                    const fileName = metadata.loc?.source || metadata.source;
                    if (fileName) {
                        uniqueFiles.add(fileName);
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            });
            
            return {
                totalDocuments: uniqueFiles.size || 0,
                totalChunks: Number(stats.total_chunks) || 0,
                averageChunkLength: Math.round(Number(stats.avg_length) || 0),
            };
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[DuckDB] Error getting stats:', error);
            return { totalDocuments: 0, totalChunks: 0, averageChunkLength: 0 };
        }
    }

    /**
     * Clears all indexed documents from DuckDB and deletes the IndexedDB database.
     * 
     * @throws {Error} If clearing fails
     * @returns Promise that resolves when the database is cleared
     */
    async clearDatabase(): Promise<void> {
        if (!globalDuckDBConnection) {
            console.warn('[DuckDB] No connection to clear');
            return;
        }

        try {
            // Clear the table
            await globalDuckDBConnection.query(`DELETE FROM ${this.tableName}`);
            console.log('[DuckDB] Table cleared');
            
            // Reset the sequence
            try {
                await globalDuckDBConnection.query(`ALTER SEQUENCE ${this.tableName}_id_seq RESTART WITH 1`);
            } catch (err) {
                // Ignore if sequence doesn't exist
            }
            
            // Clear IndexedDB
            const request = indexedDB.deleteDatabase('LuminaVectorStore');
            await new Promise<void>((resolve, reject) => {
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    console.log('[IndexedDB] Database deleted');
                    resolve();
                };
                request.onblocked = () => {
                    console.warn('[IndexedDB] Delete blocked, will retry');
                    setTimeout(resolve, 100);
                };
            });
            
            console.log('[DuckDB] Database and IndexedDB cleared successfully');
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[DuckDB] Error clearing database:', error);
            throw error;
        }
    }

    /**
     * Calculates cosine similarity between two vectors.
     * 
     * @param a - First vector
     * @param b - Second vector
     * @returns Cosine similarity value between 0 and 1, or 0 if vectors have different lengths
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Saves all vectors from DuckDB to IndexedDB for persistence.
     * 
     * @returns Promise that resolves when save is complete (or fails silently)
     */
    private async saveToIndexedDB(): Promise<void> {
        if (!globalDuckDBConnection) return;
        
        try {
            const result = await globalDuckDBConnection.query(`
                SELECT id, vector, text, metadata
                FROM ${this.tableName}
            `);
            
            const rows = result.toArray() as DuckDBRow[];
            const data: IndexedDBVectorItem[] = rows.map((row) => ({
                id: (row.id as number) || 0,
                vector: Array.isArray(row.vector) 
                    ? row.vector as number[]
                    : JSON.parse((row.vector as string) || '[]') as number[],
                text: (row.text as string) || '',
                metadata: (row.metadata as string) || '{}',
            }));
            
            const request = indexedDB.open('LuminaVectorStore', 1);
            await new Promise<void>((resolve, reject) => {
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result;
                    const transaction = db.transaction(['vectors'], 'readwrite');
                    const store = transaction.objectStore('vectors');
                    store.clear();
                    data.forEach((item, idx) => {
                        store.put({ ...item, id: idx + 1 });
                    });
                    transaction.oncomplete = () => resolve();
                    transaction.onerror = () => reject(transaction.error);
                };
                request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains('vectors')) {
                        db.createObjectStore('vectors', { keyPath: 'id' });
                    }
                };
            });
        } catch (err) {
            console.warn('[DuckDB] Failed to save to IndexedDB:', err);
        }
    }

    /**
     * Loads persisted vectors from IndexedDB into DuckDB.
     * 
     * @returns Promise that resolves when load is complete (or fails silently)
     */
    private async loadFromIndexedDB(): Promise<void> {
        if (!globalDuckDBConnection) return;
        
        try {
            const request = indexedDB.open('LuminaVectorStore', 1);
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
                request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains('vectors')) {
                        db.createObjectStore('vectors', { keyPath: 'id' });
                    }
                };
            });
            
            const transaction = db.transaction(['vectors'], 'readonly');
            const store = transaction.objectStore('vectors');
            const getAllRequest = store.getAll();
            
            const data = await new Promise<IndexedDBVectorItem[]>((resolve, reject) => {
                getAllRequest.onsuccess = () => resolve((getAllRequest.result || []) as IndexedDBVectorItem[]);
                getAllRequest.onerror = () => reject(getAllRequest.error);
            });
            
            if (data.length > 0) {
                for (const item of data) {
                    const vectorLiteral = `[${item.vector.join(',')}]`;
                    const textContent = (item.text || '').replace(/'/g, "''");
                    const metadataEscaped = (item.metadata || '{}').replace(/'/g, "''");
                    
                    await globalDuckDBConnection.query(`
                        INSERT INTO ${this.tableName} (vector, text, metadata)
                        VALUES (${vectorLiteral}::DOUBLE[], '${textContent}', '${metadataEscaped}')
                    `);
                }
                console.log(`[DuckDB] Loaded ${data.length} vectors from IndexedDB`);
            }
            
            db.close();
        } catch (err) {
            console.warn('[DuckDB] Failed to load from IndexedDB:', err);
        }
    }
}

// Worker state
let embeddings: HuggingFaceTransformersEmbeddings | null = null;
let vectorStore: DuckDBVectorStore | null = null;
let textSplitter: RecursiveCharacterTextSplitter | null = null;
let model: TextGenerationPipeline | null = null;
let isInitialized = false;
let isInitializing = false; // Prevent concurrent INIT messages
let isModelLoading = false; // Track if model is currently loading
let modelLoadPromise: Promise<void> | null = null; // Promise for model loading
let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

console.log('[RAG Worker] Worker script loaded');
self.postMessage({ type: 'READY' });

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const message = event.data;
    const { type } = message;
    const payload = 'payload' in message ? message.payload : undefined;

    try {
        switch (type) {
            case 'INIT': {
                // If already initialized, return immediately
                if (isInitialized) {
                    console.log('[RAG Worker] Already initialized, sending INIT_SUCCESS');
                    self.postMessage({ type: 'INIT_SUCCESS' });
                    return;
                }

                // If already initializing, wait for it to complete
                if (isInitializing) {
                    console.log('[RAG Worker] Already initializing, waiting for completion...');
                    // Wait up to 10 seconds for initialization
                    const maxWait = 10000;
                    const startTime = Date.now();
                    while (isInitializing && !isInitialized && (Date.now() - startTime) < maxWait) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    if (isInitialized) {
                        console.log('[RAG Worker] Initialization completed by another INIT call');
                        self.postMessage({ type: 'INIT_SUCCESS' });
                    } else {
                        self.postMessage({ 
                            type: 'ERROR', 
                            payload: { 
                                error: 'Initialization timeout',
                                errorType: 'INIT'
                            } 
                        });
                    }
                    return;
                }

                // Mark as initializing to prevent concurrent calls
                isInitializing = true;

                try {
                    console.log('[RAG Worker] Starting initialization (this should happen ONCE)...');
                    
                    textSplitter = new RecursiveCharacterTextSplitter({
                        chunkSize: 500,
                        chunkOverlap: 50,
                    });

                    embeddings = new HuggingFaceTransformersEmbeddings({
                        model: 'Xenova/all-MiniLM-L6-v2',
                    });

                    // Only create vector store if it doesn't exist
                    // CRITICAL: Don't check vectorStore existence here - always initialize
                    // The DuckDBVectorStore.initialize() has its own guards
                    if (!vectorStore) {
                        vectorStore = new DuckDBVectorStore(embeddings);
                    }
                    // Always call initialize - it has guards to prevent multiple database creation
                    await vectorStore.initialize();

                    isInitialized = true;
                    console.log('[RAG Worker] Initialization complete, sending INIT_SUCCESS');
                    
                    // Fetch and send initial stats
                    const stats = await vectorStore.getStats();
                    self.postMessage({ type: 'INIT_SUCCESS' });
                    self.postMessage({ 
                        type: 'STATS_RESULT', 
                        payload: stats 
                    });
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    console.error('[RAG Worker] Initialization error:', error);
                    self.postMessage({ 
                        type: 'ERROR', 
                        payload: { 
                            error: error.message || 'Initialization failed',
                            errorType: 'INIT'
                        } 
                    });
                } finally {
                    isInitializing = false;
                }
                break;
            }

            case 'LOAD_MODEL': {
                if (model) {
                    self.postMessage({ type: 'MODEL_LOADED' });
                    return;
                }

                // If already loading, return the existing promise
                if (isModelLoading && modelLoadPromise) {
                    await modelLoadPromise;
                    self.postMessage({ type: 'MODEL_LOADED' });
                    return;
                }

                // Mark as loading and create loading promise
                isModelLoading = true;
                modelLoadPromise = (async () => {
                    try {
                        const onProgress: ProgressCallback = (progress) => {
                            let progressValue = 0;
                            if (typeof progress === 'number') {
                                progressValue = progress;
                            } else if (typeof progress === 'string') {
                                const match = progress.match(/(\d+)%/);
                                if (match) {
                                    progressValue = parseInt(match[1], 10) / 100;
                                }
                            } else if (progress && typeof progress === 'object') {
                                // Type assertion needed due to library ProgressInfo type complexity
                                const progressObj = progress as { loaded?: number; total?: number; progress?: number | string };
                                if (progressObj.loaded !== undefined && progressObj.total !== undefined) {
                                    progressValue = progressObj.loaded / progressObj.total;
                                } else if (progressObj.progress !== undefined) {
                                    progressValue = typeof progressObj.progress === 'number' 
                                        ? progressObj.progress 
                                        : Number(progressObj.progress) / 100;
                                }
                            }
                            
                            const normalizedProgress = Math.max(0, Math.min(1, progressValue));
                            self.postMessage({ 
                                type: 'MODEL_PROGRESS', 
                                payload: { progress: normalizedProgress } 
                            });
                        };

                        model = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-360M-Instruct', {
                            device: 'wasm',
                            dtype: 'q8',
                            progress_callback: onProgress,
                        });
                    } finally {
                        isModelLoading = false;
                        modelLoadPromise = null;
                    }
                })();

                await modelLoadPromise;
                self.postMessage({ type: 'MODEL_LOADED' });
                break;
            }

            case 'INDEX_DOCUMENTS': {
                if (!vectorStore || !isInitialized) {
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
                    const { files, chunkSize, chunkOverlap } = payload;
                    
                    // Update text splitter with new chunk settings if provided
                    if (chunkSize !== undefined || chunkOverlap !== undefined) {
                        textSplitter = new RecursiveCharacterTextSplitter({
                            chunkSize: chunkSize ?? 500,
                            chunkOverlap: chunkOverlap ?? 50,
                        });
                    } else if (!textSplitter) {
                        // Create default splitter if it doesn't exist
                        textSplitter = new RecursiveCharacterTextSplitter({
                            chunkSize: 500,
                            chunkOverlap: 50,
                        });
                    }
                    
                    for (const file of files) {
                        if (!file.content) {
                            continue;
                        }
                        
                        // Check if file already exists in database
                        const exists = await vectorStore.fileExists(file.name);
                        if (exists) {
                            console.log(`[RAG Worker] File "${file.name}" already indexed, skipping...`);
                            self.postMessage({ 
                                type: 'INDEX_PROGRESS', 
                                payload: { 
                                    fileName: file.name, 
                                    chunkCount: 0,
                                    skipped: true
                                } 
                            });
                            continue;
                        }
                        
                        // Create documents
                        const docs = await textSplitter.createDocuments([file.content]);
                        
                        // Ensure all chunks have the file name in metadata
                        docs.forEach(doc => {
                            if (!doc.metadata) {
                                doc.metadata = {};
                            }
                            doc.metadata.source = file.name;
                            if (!doc.metadata.loc) {
                                doc.metadata.loc = {};
                            }
                            doc.metadata.loc.source = file.name;
                        });
                        
                        await vectorStore.addDocuments(docs);
                        
                        self.postMessage({ 
                            type: 'INDEX_PROGRESS', 
                            payload: { 
                                fileName: file.name, 
                                chunkCount: docs.length 
                            } 
                        });
                    }
                    
                    // Fetch and send updated stats after indexing
                    const stats = await vectorStore.getStats();
                    self.postMessage({ type: 'INDEX_COMPLETE' });
                    self.postMessage({ 
                        type: 'STATS_RESULT', 
                        payload: stats 
                    });
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    self.postMessage({ 
                        type: 'ERROR', 
                        payload: { 
                            error: error.message || 'Indexing failed',
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

                if (chatHistory && chatHistory.length > 0) {
                    conversationHistory = [...chatHistory];
                }
                
                conversationHistory.push({ role: 'user', content: query });

                // Wait for model to load if it's currently loading
                if (!model && isModelLoading && modelLoadPromise) {
                    console.log('[RAG Worker] Model is loading, waiting for it to finish...');
                    try {
                        await modelLoadPromise;
                        console.log('[RAG Worker] Model finished loading, proceeding with query');
                    } catch (err) {
                        console.error('[RAG Worker] Model loading failed:', err);
                        // Continue to fallback mode
                    }
                }

                // If model still not available after waiting, trigger load if not already loading
                if (!model && !isModelLoading) {
                    console.log('[RAG Worker] Model not loaded, triggering load...');
                    // Send LOAD_MODEL message to self (but we'll handle it inline)
                    // Actually, we should just load it here
                    try {
                        isModelLoading = true;
                        modelLoadPromise = (async () => {
                            try {
                                const onProgress: ProgressCallback = (progress) => {
                                    let progressValue = 0;
                                    if (typeof progress === 'number') {
                                        progressValue = progress;
                                    } else if (progress && typeof progress === 'object') {
                                        if (progress.loaded !== undefined && progress.total !== undefined) {
                                            progressValue = progress.loaded / progress.total;
                                        }
                                    }
                                    const normalizedProgress = Math.max(0, Math.min(1, progressValue));
                                    self.postMessage({ 
                                        type: 'MODEL_PROGRESS', 
                                        payload: { progress: normalizedProgress } 
                                    });
                                };

                                model = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-360M-Instruct', {
                                    device: 'wasm',
                                    dtype: 'q8',
                                    progress_callback: onProgress,
                                });
                            } finally {
                                isModelLoading = false;
                                modelLoadPromise = null;
                            }
                        })();
                        
                        // Wait for model to load (with timeout)
                        await Promise.race([
                            modelLoadPromise,
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Model loading timeout')), 60000)
                            )
                        ]);
                        console.log('[RAG Worker] Model loaded successfully');
                    } catch (err) {
                        console.error('[RAG Worker] Failed to load model:', err);
                        isModelLoading = false;
                        modelLoadPromise = null;
                        // Continue to fallback mode
                    }
                }

                const results = await vectorStore.similaritySearch(query, 3);
                const contextText = results
                    .map((doc) => doc.pageContent)
                    .join('\n\n');

                // Only use fallback if model is definitely not available
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
                        
                        if (chunkBuffer.length >= 20) {
                            flushChunkBuffer();
                        } else if (!chunkBufferTimeout) {
                            chunkBufferTimeout = setTimeout(flushChunkBuffer, 50);
                        }
                    }
                });
                
                const output = await model(prompt, {
                    max_new_tokens: 256,
                    temperature: 0.1,
                    repetition_penalty: 1.2,
                    top_p: 0.9,
                    streamer,
                    stop: ["<|im_end|>", "Question:", "User question:", "Context:"] 
                });
                
                flushChunkBuffer();

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
                
                const cleanResponse = responseContent.startsWith(prompt)
                    ? responseContent.slice(prompt.length).trim()
                    : responseContent.trim();
                
                conversationHistory.push({ role: 'assistant', content: cleanResponse });
                
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

            case 'GET_STATS': {
                if (!vectorStore || !isInitialized) {
                    self.postMessage({ 
                        type: 'STATS_RESULT', 
                        payload: { totalDocuments: 0, totalChunks: 0, averageChunkLength: 0 } 
                    });
                    return;
                }

                try {
                    const stats = await vectorStore.getStats();
                    self.postMessage({ 
                        type: 'STATS_RESULT', 
                        payload: stats 
                    });
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    self.postMessage({ 
                        type: 'ERROR', 
                        payload: { 
                            error: error.message || 'Failed to get stats',
                            errorType: 'GET_STATS'
                        } 
                    });
                }
                break;
            }

            case 'CLEAR_DATABASE': {
                if (!vectorStore || !isInitialized) {
                    self.postMessage({ 
                        type: 'ERROR', 
                        payload: { 
                            error: 'Vector store not initialized',
                            errorType: 'CLEAR_DATABASE'
                        } 
                    });
                    return;
                }

                try {
                    await vectorStore.clearDatabase();
                    // Clear conversation history
                    conversationHistory = [];
                    // Refresh stats after clearing
                    const stats = await vectorStore.getStats();
                    self.postMessage({ 
                        type: 'DATABASE_CLEARED',
                        payload: stats
                    });
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    self.postMessage({ 
                        type: 'ERROR', 
                        payload: { 
                            error: error.message || 'Failed to clear database',
                            errorType: 'CLEAR_DATABASE'
                        } 
                    });
                }
                break;
            }

            case 'GENERATE_SYNTHETIC': {
                if (!payload || !('topic' in payload)) {
                    self.postMessage({ 
                        type: 'ERROR', 
                        payload: { 
                            error: 'Invalid payload for GENERATE_SYNTHETIC',
                            errorType: 'GENERATE_SYNTHETIC'
                        } 
                    });
                    return;
                }

                const { topic } = payload;

                try {
                    // Ensure model is loaded
                    if (!model) {
                        // Load model if not already loaded
                        const onProgress: ProgressCallback = (progress) => {
                            let progressValue = 0;
                            if (typeof progress === 'number') {
                                progressValue = progress;
                            } else if (typeof progress === 'string') {
                                const match = progress.match(/(\d+)%/);
                                if (match) {
                                    progressValue = parseInt(match[1], 10) / 100;
                                }
                            } else if (progress && typeof progress === 'object') {
                                // Type assertion needed due to library ProgressInfo type complexity
                                const progressObj = progress as { loaded?: number; total?: number; progress?: number | string };
                                if (progressObj.loaded !== undefined && progressObj.total !== undefined) {
                                    progressValue = progressObj.loaded / progressObj.total;
                                } else if (progressObj.progress !== undefined) {
                                    progressValue = typeof progressObj.progress === 'number' 
                                        ? progressObj.progress 
                                        : Number(progressObj.progress) / 100;
                                }
                            }
                            
                            const normalizedProgress = Math.max(0, Math.min(1, progressValue));
                            self.postMessage({ 
                                type: 'MODEL_PROGRESS', 
                                payload: { progress: normalizedProgress } 
                            });
                        };

                        model = await pipeline('text-generation', 'HuggingFaceTB/SmolLM2-360M-Instruct', {
                            device: 'wasm',
                            dtype: 'q8',
                            progress_callback: onProgress,
                        });
                    }

                    // Generate synthetic data
                    const systemPrompt = `You are a helpful assistant that generates training data. Generate 5 diverse training examples for the given topic in a clear, structured format. Each example should be informative and useful.`;

                    const prompt = `Topic: ${topic}\n\nGenerate 5 training examples covering different aspects of this topic. Format each example clearly with a question or instruction and a detailed response.`;

                    const chat = [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ];
                    
                    const formattedPrompt = model.tokenizer.apply_chat_template(chat, { 
                        tokenize: false, 
                        add_generation_prompt: true 
                    });

                    const output = await model(formattedPrompt, {
                        max_new_tokens: 512,
                        temperature: 0.7,
                        top_p: 0.9,
                        do_sample: true,
                    });

                    let responseContent = '';
                    if (Array.isArray(output) && output.length > 0) {
                        responseContent = output[0].generated_text || output[0].text || JSON.stringify(output[0]);
                    } else if (typeof output === 'string') {
                        responseContent = output;
                    } else {
                        responseContent = output?.generated_text || output?.text || String(output);
                    }

                    // Remove the prompt from the response
                    const cleanResponse = responseContent.startsWith(formattedPrompt)
                        ? responseContent.slice(formattedPrompt.length).trim()
                        : responseContent.trim();

                    self.postMessage({ 
                        type: 'SYNTHETIC_GENERATED', 
                        payload: { 
                            content: cleanResponse,
                            topic
                        } 
                    });
                } catch (err) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    self.postMessage({ 
                        type: 'ERROR', 
                        payload: { 
                            error: error.message || 'Failed to generate synthetic data',
                            errorType: 'GENERATE_SYNTHETIC'
                        } 
                    });
                }
                break;
            }

            default:
                self.postMessage({ 
                    type: 'ERROR', 
                    payload: { error: `Unknown message type: ${type}` } 
                });
        }
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        self.postMessage({ 
            type: 'ERROR', 
            payload: { 
                error: err.message || 'Unknown error',
                errorType: type 
            } 
        });
    }
};
