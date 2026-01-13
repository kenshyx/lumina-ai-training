import { LucideIcon } from 'lucide-react';

export type TabType = 'dashboard' | 'data' | 'rag' | 'settings';

export interface FileItem {
    name: string;
    size?: string;
    id: number;
    content?: string;
}

export interface ModelConfig {
    learningRate: number;
    batchSize: number;
    epochs: number;
    contextWindow: number;
    engine: string;
}

export interface AnalysisResult {
    type: 'optimization' | 'loss' | 'rag';
    text: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
}

export interface ProgressBarProps {
    progress: number;
    color?: string;
}

export interface NavItemProps {
    id: TabType;
    icon: LucideIcon;
    label: string;
    activeTab: TabType;
    setActiveTab: (id: TabType) => void;
}

/**
 * AT Protocol authentication session information.
 */
export interface ATProtoSession {
    /** User's DID (Decentralized Identifier) */
    did: string;
    /** User's handle (e.g., username.bsky.social) */
    handle: string;
    /** Access JWT token */
    accessJwt: string;
    /** Refresh JWT token */
    refreshJwt: string;
    /** Email address (if available) */
    email?: string;
    /** Display name (if available) */
    displayName?: string;
    /** Avatar URL (if available) */
    avatar?: string;
}
