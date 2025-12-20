# Lumina Trainer

A modern, browser-based RAG (Retrieval-Augmented Generation) application for building and querying knowledge bases with AI-powered chat capabilities. Built with React, TypeScript, and cutting-edge AI libraries running entirely in the browser.

## 🚀 Features

### 📚 RAG Knowledge Base
- **Document Indexing**: Upload and index text documents into a vector store
- **Semantic Search**: Find relevant information using vector similarity search
- **AI-Powered Chat**: Query your knowledge base with natural language questions
- **Conversation Memory**: Maintains context across multiple turns in conversations
- **Streaming Responses**: Real-time streaming of AI-generated responses for better UX

### 🧠 AI Models
- **Embeddings**: Uses `Xenova/all-MiniLM-L6-v2` for generating document embeddings
- **Text Generation**: Uses `HuggingFaceTB/SmolLM2-360M-Instruct` for generating responses
- **Browser-Based**: All models run in the browser using WebAssembly (WASM)
- **Progress Tracking**: Real-time progress bars for model downloads

### ⚡ Performance
- **Web Workers**: Heavy AI operations run in background workers to keep UI responsive
- **Optimized Batching**: Smart chunking and batching for efficient document processing
- **Lazy Loading**: Models load on-demand when first needed

### 🎨 User Interface
- **Modern Glassmorphism Design**: Beautiful, modern UI with glass-card effects
- **Real-time Updates**: Live progress tracking and streaming responses
- **Multi-tab Interface**: Organized into Dashboard, Data, RAG, and Settings tabs

## 🛠️ Tech Stack

### Core
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling

### AI & ML
- **@huggingface/transformers** - Text generation models
- **@langchain/community** - LangChain integrations for embeddings and vector stores
- **@langchain/textsplitters** - Document chunking
- **voy-search** - Vector search engine

### Build Tools
- **vite-plugin-wasm** - WebAssembly support
- **vite-plugin-top-level-await** - Top-level await support
- **vite-plugin-node-polyfills** - Node.js polyfills for browser

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd lumina-trainer
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
- Click **Index Documents** to process and index them

### 2. Query Your Knowledge Base
- Navigate to the **RAG** tab
- Wait for the model to load (first time only)
- Ask questions about your indexed documents
- The AI will search your knowledge base and provide answers based on the context

### 3. Conversation Memory
- The system maintains conversation history
- You can ask follow-up questions that reference previous messages
- Memory is automatically managed (last 10 messages)

## 🏗️ Architecture

### Web Worker Implementation
All heavy AI operations run in a dedicated Web Worker (`src/workers/ragWorker.ts`):
- Model loading and initialization
- Document indexing
- Vector similarity search
- Text generation with streaming

This keeps the main thread responsive and provides a smooth user experience.

### RAG Pipeline
1. **Document Processing**: Documents are split into chunks using `RecursiveCharacterTextSplitter`
2. **Embedding Generation**: Each chunk is embedded using HuggingFace transformers
3. **Vector Storage**: Embeddings are stored in Voy vector store
4. **Query Processing**: User queries are embedded and matched against stored vectors
5. **Context Retrieval**: Top-k most relevant chunks are retrieved
6. **Response Generation**: LLM generates response using retrieved context and conversation history

### Memory Management
- Conversation history is maintained in the worker
- Last 10 messages are kept in memory
- Last 6 messages are included in each prompt for context
- Memory can be cleared via the clear chat function

## 🔧 Configuration

### Model Settings
- **Embedding Model**: `Xenova/all-MiniLM-L6-v2` (quantized, browser-optimized)
- **Generation Model**: `HuggingFaceTB/SmolLM2-360M-Instruct` (WASM, q8 quantization)
- **Temperature**: 0.1 (low for factual, focused responses)
- **Max Tokens**: 256
- **Chunk Size**: 500 characters with 50 character overlap

### Vite Configuration
The app is configured with:
- WASM support for running models in the browser
- Top-level await support
- Node.js polyfills for compatibility
- Worker support with ES modules
- Optimized dependency handling

## 📝 Project Structure

```
lumina-trainer/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx    # Training dashboard
│   │   ├── DataTab.tsx      # File upload and indexing
│   │   ├── RAGTab.tsx       # Chat interface
│   │   └── ...
│   ├── hooks/               # Custom React hooks
│   │   ├── useRAG.ts        # RAG functionality
│   │   ├── useDataManagement.ts
│   │   └── ...
│   ├── workers/             # Web Workers
│   │   └── ragWorker.ts     # RAG operations worker
│   ├── polyfills/           # Browser polyfills
│   └── types.ts             # TypeScript types
├── vite.config.js           # Vite configuration
└── package.json
```

## 🎨 Features in Detail

### Document Indexing
- Supports text file uploads
- Automatic chunking with overlap for context preservation
- Progress tracking during indexing
- Vector store initialization and management

### Chat Interface
- Real-time streaming responses
- Conversation history display
- Model loading progress indicators
- Error handling and fallback to search-only mode

### Performance Optimizations
- Chunk batching for efficient updates
- Smart buffering (20 chars or 50ms delay)
- Web Worker isolation for non-blocking operations
- Lazy model loading

## 🐛 Troubleshooting

### Model Loading Issues
- Ensure your browser supports WebAssembly
- Check browser console for error messages
- Models are downloaded on first use (may take time)

### Indexing Issues
- Ensure files have text content
- Wait for worker initialization before indexing
- Check that embeddings model has loaded

### Performance Issues
- Large documents may take time to process
- Consider splitting very large files
- Model loading is one-time per session

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- [Hugging Face](https://huggingface.co/) for transformer models
- [LangChain](https://www.langchain.com/) for RAG infrastructure
- [Voy](https://github.com/tantaraio/voy) for vector search
- [Vite](https://vitejs.dev/) for the excellent build tooling
