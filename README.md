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

### 📱 Progressive Web App (PWA)
- **Installable**: Install Lumina RAG as a standalone app on your device
- **Offline Support**: Cached assets work offline (models require initial download)
- **App-like Experience**: Runs in standalone mode without browser UI
- **Install Button**: One-click install prompt in the header when available
- **Service Worker**: Automatic caching of static assets for faster loads
- **Share Target**: Accept files shared from other apps (mobile)

### 🔐 AT Protocol Authentication
- **OAuth Sign-In**: Sign in with your Bluesky account using OAuth 2.0
- **Password Sign-In**: Alternative password-based authentication
- **Session Persistence**: Automatically restores your session on page reload
- **Profile Display**: Shows your username and avatar when signed in
- **Secure Token Management**: OAuth tokens are securely managed by the browser

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

3. **Configure environment variables (optional)**
   
   Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```
   
   For OAuth authentication, set the following variables:
   ```env
   # AT Protocol OAuth Configuration
   # These values must be HTTPS URLs with domain names (not IP addresses or loopback hosts)
   
   # OAuth client_id - URL pointing to your client metadata JSON
   # Must be HTTPS with a domain name (e.g., https://yourdomain.com/client-metadata.json)
   VITE_ATPROTO_CLIENT_ID=https://lumina-rag.app/client-metadata.json
   
   # OAuth client_uri - Your application's URI
   # Must be HTTPS with a domain name (e.g., https://yourdomain.com)
   VITE_ATPROTO_CLIENT_URI=https://lumina-rag.app
   ```
   
   **Note for Local Development**: OAuth requires HTTPS URLs with domain names. For local development, you'll need to proxy your app through a service like [ngrok](https://ngrok.com/) or [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) to get an HTTPS URL. See the [OAuth Local Development](#oauth-local-development) section below.

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
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

### 7. Sign In with AT Protocol (Optional)
- Click the **Sign In** button in the header
- Choose **OAuth** (recommended) or **Password** authentication
- For OAuth: Enter your Bluesky handle and authorize the app
- For Password: Enter your Bluesky handle/email and password (or app password)
- Your session persists across page reloads
- Your username and avatar are displayed when signed in

### 8. Install as PWA (Optional)
- Look for the **Install App** button in the header (when available)
- Click to install Lumina RAG as a standalone app
- Works on desktop and mobile devices
- Provides app-like experience with offline support

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

### OAuth Configuration
- **Client ID**: Must be an HTTPS URL pointing to your client metadata JSON file
- **Client URI**: Must be an HTTPS URL with a domain name (not IP or localhost)
- **Redirect URIs**: Can use HTTP with loopback IPs (e.g., `http://127.0.0.1:5173`) per RFC 8252
- **Service URL**: Defaults to `https://bsky.social` (Bluesky)

### OAuth Local Development

OAuth requires HTTPS URLs with domain names (not `localhost` or IP addresses). For local development, you need to proxy your app through a tunneling service:

#### Using ngrok

1. **Install ngrok**
   ```bash
   # macOS
   brew install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Start your development server**
   ```bash
   npm run dev
   ```

3. **Start ngrok tunnel**
   ```bash
   ngrok http 5173
   ```

4. **Update your `.env` file** with the ngrok HTTPS URL:
   ```env
   VITE_ATPROTO_CLIENT_ID=https://your-ngrok-url.ngrok.io/client-metadata.json
   VITE_ATPROTO_CLIENT_URI=https://your-ngrok-url.ngrok.io
   ```

5. **Restart your development server** to load the new environment variables

6. **Access your app** through the ngrok URL (e.g., `https://your-ngrok-url.ngrok.io`)

#### Using cloudflared

1. **Install cloudflared**
   ```bash
   # macOS
   brew install cloudflare/cloudflare/cloudflared
   
   # Or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
   ```

2. **Start your development server**
   ```bash
   npm run dev
   ```

3. **Start cloudflared tunnel**
   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```

4. **Update your `.env` file** with the cloudflared HTTPS URL:
   ```env
   VITE_ATPROTO_CLIENT_ID=https://your-cloudflared-url.trycloudflare.com/client-metadata.json
   VITE_ATPROTO_CLIENT_URI=https://your-cloudflared-url.trycloudflare.com
   ```

5. **Restart your development server** to load the new environment variables

6. **Access your app** through the cloudflared URL

**Important Notes:**
- The tunneling service URL changes each time you restart it (unless using a paid plan)
- You'll need to update your `.env` file and restart the dev server each time
- For production, use a stable domain name with proper SSL certificates
- Password-based authentication works without OAuth configuration

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
│   │   ├── gemini.ts        # Gemini API client (for training analysis)
│   │   └── serviceWorker.ts # Service worker registration utilities
│   ├── polyfills/           # Browser polyfills
│   ├── types.ts             # TypeScript type definitions
│   └── constants.ts         # Application constants
├── public/                  # Static assets
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service worker
│   └── lumina.svg           # App icon
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

### Progressive Web App
- Service worker for offline asset caching
- Install prompt detection and handling
- Standalone app mode support
- Share target API for file sharing (mobile)
- Automatic cache management and updates

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

### PWA Installation Issues
- Install button only appears when browser supports PWA installation
- Some browsers require HTTPS for PWA installation (localhost works in development)
- Service worker only registers in production builds
- Clear browser cache if service worker updates don't apply
- Icon files (icon-192.png, icon-512.png) are optional but recommended for better PWA experience

### OAuth Authentication Issues
- **OAuth not working locally**: OAuth requires HTTPS with a domain name. Use ngrok or cloudflared to proxy your local server (see [OAuth Local Development](#oauth-local-development))
- **"OAuth client not initialized"**: Wait a moment for the OAuth client to initialize, or check browser console for errors
- **Callback not captured**: Ensure your redirect URI matches exactly what's configured in your OAuth client metadata
- **Session not persisting**: Check browser localStorage permissions and ensure cookies are enabled
- **Password authentication works**: If OAuth fails, you can always use password-based sign-in as a fallback

## 📄 License

See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- [Hugging Face](https://huggingface.co/) for transformer models
- [LangChain](https://www.langchain.com/) for RAG infrastructure
- [DuckDB](https://duckdb.org/) for vector storage and search
- [Vite](https://vitejs.dev/) for the excellent build tooling
