# Lumina RAG

A modern, browser-based RAG (Retrieval-Augmented Generation) application for building and querying knowledge bases with AI-powered chat capabilities. Built with React, TypeScript, and cutting-edge AI libraries running entirely in the browser.

## 🚀 Features

### 📚 RAG Knowledge Base
- **Document Indexing**: Upload and index text documents into a vector store
- **Semantic Search**: Find relevant information using vector similarity search
- **AI-Powered Chat**: Query your knowledge base with natural language questions
- **Conversation Memory**: Maintains context across multiple turns in conversations
- **Streaming Responses**: Real-time streaming of AI-generated responses for better UX
- **Persistent Storage**: All indexed documents persist to IndexedDB for offline access

### 🧠 AI Models
- **Embeddings**: Uses `Xenova/all-MiniLM-L6-v2` for generating document embeddings
- **Text Generation**: Uses `HuggingFaceTB/SmolLM2-360M-Instruct` for generating responses
- **Synthetic Data Generation**: Generate training data using the local text generation model
- **Browser-Based**: All models run in the browser using WebAssembly (WASM)
- **Progress Tracking**: Real-time progress bars for model downloads

### ⚡ Performance
- **Web Workers**: Heavy AI operations run in background workers to keep UI responsive
- **Optimized Batching**: Smart chunking and batching for efficient document processing
- **Lazy Loading**: Models load on-demand when first needed
- **Singleton Database**: Single DuckDB instance ensures efficient memory usage

### 🎨 User Interface
- **Modern Glassmorphism Design**: Beautiful, modern UI with glass-card effects
- **Real-time Updates**: Live progress tracking and streaming responses
- **Multi-tab Interface**: Organized into Dashboard, Data, RAG, and Settings tabs
- **Document Statistics**: View indexed documents, chunks, and storage information

### ⚙️ Configuration
- **Customizable Chunking**: Configure chunk size and overlap in Settings
- **Data Management**: Clear indexed documents, uploaded files, or reset everything
- **Search Availability**: Automatically detects persisted documents for immediate searching

## 🛠️ Tech Stack

### Core
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling

### AI & ML
- **@huggingface/transformers** - Text generation models
- **@langchain/community** - LangChain integrations for embeddings
- **@langchain/textsplitters** - Document chunking
- **@duckdb/duckdb-wasm** - Vector storage and search engine
- **@xenova/transformers** - Embedding model runtime

### Build Tools
- **vite-plugin-wasm** - WebAssembly support
- **vite-plugin-top-level-await** - Top-level await support
- **vite-plugin-node-polyfills** - Node.js polyfills for browser

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lumina-rag
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## 🎯 Usage

### 1. Upload Documents
- Navigate to the **Data** tab
- Upload text files containing your knowledge base content
- Optionally generate synthetic data using the **Synthetic** button
- Click **Index Documents** to process and index them

### 2. Configure Chunking (Optional)
- Navigate to the **Settings** tab
- Adjust **Chunk Size** (100-2000 characters, default: 500)
- Adjust **Chunk Overlap** (0-50% of chunk size, default: 50)
- Settings apply to newly indexed documents

### 3. Query Your Knowledge Base
- Navigate to the **RAG** tab
- Wait for the model to load (first time only)
- Ask questions about your indexed documents
- The AI will search your knowledge base and provide answers based on the context

### 4. View Statistics
- Navigate to the **Dashboard** tab
- View total documents, chunks, and average chunk length
- See storage information and configuration details

### 5. Manage Data
- Navigate to the **Settings** tab
- Clear indexed documents from DuckDB and IndexedDB
- Clear uploaded files from the staging area
- Reset everything with a single click

### 6. Conversation Memory
- The system maintains conversation history
- You can ask follow-up questions that reference previous messages
- Memory is automatically managed (last 10 messages)

## 🏗️ Architecture

### Web Worker Implementation
All heavy AI operations run in a dedicated Web Worker (`src/workers/ragWorker.ts`):
- Model loading and initialization
- Document indexing with configurable chunking
- Vector similarity search
- Text generation with streaming
- Synthetic data generation

This keeps the main thread responsive and provides a smooth user experience.

### RAG Pipeline
1. **Document Processing**: Documents are split into chunks using `RecursiveCharacterTextSplitter` (configurable size and overlap)
2. **Embedding Generation**: Each chunk is embedded using HuggingFace transformers (`Xenova/all-MiniLM-L6-v2`)
3. **Vector Storage**: Embeddings are stored in DuckDB-WASM with IndexedDB persistence
4. **Query Processing**: User queries are embedded and matched against stored vectors using cosine similarity
5. **Context Retrieval**: Top-k most relevant chunks are retrieved from DuckDB
6. **Response Generation**: LLM generates response using retrieved context and conversation history

### Memory Management
- Conversation history is maintained in the worker
- Last 10 messages are kept in memory
- Last 6 messages are included in each prompt for context
- Memory can be cleared via the clear chat function

### Database Persistence
- DuckDB runs in-memory for fast operations
- All data is persisted to IndexedDB (`LuminaVectorStore`)
- Data automatically loads on initialization
- Supports clearing and resetting the database

## 🔧 Configuration

### Model Settings
- **Embedding Model**: `Xenova/all-MiniLM-L6-v2` (quantized, browser-optimized)
- **Generation Model**: `HuggingFaceTB/SmolLM2-360M-Instruct` (WASM, q8 quantization)
- **Temperature**: 0.1 (low for factual, focused responses)
- **Max Tokens**: 256 (for queries), 512 (for synthetic generation)
- **Chunk Size**: Configurable (default: 500 characters)
- **Chunk Overlap**: Configurable (default: 50 characters)

### Vite Configuration
The app is configured with:
- WASM support for running models in the browser
- Top-level await support
- Node.js polyfills for compatibility
- Worker support with ES modules
- Optimized dependency handling
- Cross-origin isolation headers for SharedArrayBuffer support

## 📝 Project Structure

```
lumina-rag/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx    # Document statistics and storage info
│   │   ├── DataTab.tsx      # File upload, synthetic generation, and indexing
│   │   ├── RAGTab.tsx       # Chat interface for querying knowledge base
│   │   ├── SettingsTab.tsx   # Chunking configuration and data management
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   │   ├── useRAG.ts        # RAG functionality and worker management
│   │   ├── useDataManagement.ts  # File and indexing state management
│   │   └── ...
│   ├── workers/             # Web Workers
│   │   └── ragWorker.ts     # RAG operations worker (indexing, querying, generation)
│   ├── utils/               # Utility functions
│   │   └── gemini.ts        # Gemini API client (for training analysis)
│   ├── polyfills/           # Browser polyfills
│   ├── types.ts             # TypeScript type definitions
│   └── constants.ts         # Application constants
├── .editorconfig            # Editor configuration
├── .prettierrc.json         # Prettier configuration
├── vite.config.js           # Vite configuration
└── package.json
```

## 🎨 Features in Detail

### Document Indexing
- Supports text file uploads
- Configurable chunking with overlap for context preservation
- Progress tracking during indexing
- Vector store initialization and management
- Automatic persistence to IndexedDB

### Synthetic Data Generation
- Generate training data using the local text generation model
- No external API required
- Topic-based generation
- Automatically added to file staging area

### Chat Interface
- Real-time streaming responses
- Conversation history display
- Model loading progress indicators
- Error handling and fallback to search-only mode
- Automatic detection of available documents

### Dashboard
- Real-time document statistics
- Storage information display
- Auto-refreshing stats every 5 seconds
- Visual indicators for knowledge base status

### Settings & Data Management
- Configure chunk size and overlap
- Clear indexed documents
- Clear uploaded files
- Full reset functionality
- Confirmation dialogs for destructive actions

### Performance Optimizations
- Chunk batching for efficient updates
- Smart buffering (20 chars or 50ms delay)
- Web Worker isolation for non-blocking operations
- Lazy model loading
- Singleton database pattern

## 🐛 Troubleshooting

### Model Loading Issues
- Ensure your browser supports WebAssembly
- Check browser console for error messages
- Models are downloaded on first use (may take time)
- Ensure cross-origin isolation headers are set (handled by Vite config)

### Indexing Issues
- Ensure files have text content
- Wait for worker initialization before indexing
- Check that embeddings model has loaded
- Verify chunk size and overlap settings are valid

### Search Issues
- Ensure documents have been indexed
- Check Dashboard for document count
- Persisted documents are automatically available on reload
- Clear and re-index if search returns no results

### Performance Issues
- Large documents may take time to process
- Consider splitting very large files
- Model loading is one-time per session
- Adjust chunk size for better performance vs. context

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- [Hugging Face](https://huggingface.co/) for transformer models
- [LangChain](https://www.langchain.com/) for RAG infrastructure
- [DuckDB](https://duckdb.org/) for vector storage and search
- [Vite](https://vitejs.dev/) for the excellent build tooling
