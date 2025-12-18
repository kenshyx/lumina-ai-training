import { useState, FormEvent } from 'react';
import { ChatMessage } from '../types';
import { callGemini } from '../utils/gemini';

export const useRAG = (ragStatus: string) => {
    const [chatInput, setChatInput] = useState<string>("");
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isQuerying, setIsQuerying] = useState<boolean>(false);

    const addMessage = (role: 'user' | 'assistant', content: string) => {
        setChatHistory(prev => [...prev, { role, content }]);
    };

    const queryRAG = async (e: FormEvent) => {
        e.preventDefault();
        
        if (!chatInput || isQuerying || ragStatus !== "Knowledge Base Ready") {
            return;
        }

        const userMessage = chatInput;
        setChatInput("");
        addMessage('user', userMessage);
        setIsQuerying(true);

        try {
            const response = await callGemini(
                `Query context. User asks: ${userMessage}`,
                "RAG assistant."
            );
            addMessage('assistant', response);
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
        clearChat
    };
};

