import { useState } from 'react';
import { FileItem } from '../types';
import { callGemini } from '../utils/gemini';

export const useDataManagement = () => {
    const [files, setFilesState] = useState<FileItem[]>([]);
    const [isGeneratingData, setIsGeneratingData] = useState<boolean>(false);
    const [isIndexing, setIsIndexing] = useState<boolean>(false);
    const [ragStatus, setRagStatus] = useState<string>("Idle");

    const addFile = (file: FileItem) => {
        setFilesState(prev => [...prev, file]);
    };

    const removeFile = (id: number) => {
        setFilesState(prev => prev.filter(f => f.id !== id));
    };

    const handleFileUpload = (file: File) => {
        addFile({ name: file.name, id: Math.random() });
    };

    const generateSyntheticData = async () => {
        const topic = prompt("What topic should the synthetic data cover?");
        if (!topic) return;

        setIsGeneratingData(true);
        try {
            const result = await callGemini(
                `Generate 5 training examples for: ${topic} in JSON format [{instruction, response}].`,
                "Synthetic data engine."
            );
            addFile({
                name: `synthetic_${topic.replace(/\s+/g, '_')}.json`,
                id: Math.random(),
                content: result
            });
        } catch (err) {
            console.error('Failed to generate synthetic data:', err);
        } finally {
            setIsGeneratingData(false);
        }
    };

    const indexDocuments = async () => {
        if (files.length === 0) return;
        
        setIsIndexing(true);
        setRagStatus("Indexing...");
        
        // Simulate indexing delay
        setTimeout(() => {
            setRagStatus("Knowledge Base Ready");
            setIsIndexing(false);
        }, 1500);
    };

    const setFiles = (value: FileItem[] | ((prev: FileItem[]) => FileItem[])) => {
        if (typeof value === 'function') {
            setFilesState(prev => value(prev));
        } else {
            setFilesState(value);
        }
    };

    return {
        files,
        setFiles,
        isGeneratingData,
        isIndexing,
        ragStatus,
        addFile,
        removeFile,
        handleFileUpload,
        generateSyntheticData,
        indexDocuments
    };
};

