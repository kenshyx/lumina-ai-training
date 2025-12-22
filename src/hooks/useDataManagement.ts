import { useState } from 'react';

import { FileItem } from '../types';

/**
 * Return type for the useDataManagement hook.
 */
interface UseDataManagementReturn {
    /** Array of uploaded files */
    files: FileItem[];
    /** Function to set files (supports function or array) */
    setFiles: (value: FileItem[] | ((prev: FileItem[]) => FileItem[])) => void;
    /** Whether synthetic data is currently being generated */
    isGeneratingData: boolean;
    /** Function to set synthetic data generation state */
    setIsGeneratingData: (value: boolean) => void;
    /** Whether documents are currently being indexed */
    isIndexing: boolean;
    /** Current RAG system status */
    ragStatus: string;
    /** Function to set RAG status */
    setRagStatus: (status: string) => void;
    /** Function to add a file to the list */
    addFile: (file: FileItem) => void;
    /** Function to remove a file by ID */
    removeFile: (id: number) => void;
    /** Function to handle file upload from input */
    handleFileUpload: (file: File) => Promise<void>;
    /** Function to index documents into the vector store */
    indexDocuments: (ragIndexFunction?: (files: FileItem[]) => Promise<void>) => Promise<void>;
}

/**
 * Custom hook for managing file uploads, indexing, and RAG system status.
 * 
 * This hook provides functionality for:
 * - Managing uploaded files
 * - Handling file uploads from the browser
 * - Coordinating document indexing
 * - Tracking RAG system status
 * 
 * @returns Object containing file management state and functions
 * 
 * @example
 * ```tsx
 * const dataManagement = useDataManagement();
 * await dataManagement.handleFileUpload(file);
 * await dataManagement.indexDocuments(ragIndexFunction);
 * ```
 */
export const useDataManagement = (): UseDataManagementReturn => {
    const [files, setFilesState] = useState<FileItem[]>([]);
    const [isGeneratingData, setIsGeneratingData] = useState<boolean>(false);
    const [isIndexing, setIsIndexing] = useState<boolean>(false);
    const [ragStatus, setRagStatus] = useState<string>("Idle");

    /**
     * Adds a file to the files list.
     * 
     * @param file - The file item to add
     */
    const addFile = (file: FileItem) => {
        setFilesState(prev => [...prev, file]);
    };

    /**
     * Removes a file from the files list by ID.
     * 
     * @param id - The ID of the file to remove
     */
    const removeFile = (id: number) => {
        setFilesState(prev => prev.filter(f => f.id !== id));
    };

    /**
     * Handles file upload from a File object, reading its content.
     * 
     * @param file - The File object to upload
     */
    const handleFileUpload = async (file: File) => {
        const fileId = Math.random();
        try {
            const content = await file.text();
            addFile({ name: file.name, id: fileId, content });
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Failed to read file:', error);
            // Add file without content if reading fails
            addFile({ name: file.name, id: fileId });
        }
    };


    /**
     * Indexes documents into the vector store.
     * 
     * @param ragIndexFunction - Optional function to perform the actual indexing
     * @returns Promise that resolves when indexing is complete
     */
    const indexDocuments = async (ragIndexFunction?: (files: FileItem[]) => Promise<void>) => {
        if (files.length === 0) return;
        
        setIsIndexing(true);
        setRagStatus("Indexing...");
        
        try {
            if (ragIndexFunction) {
                await ragIndexFunction(files);
                setRagStatus("Knowledge Base Ready");
            } else {
                // Fallback: simulate indexing delay if RAG not available
                await new Promise(resolve => setTimeout(resolve, 1500));
                setRagStatus("Knowledge Base Ready");
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Indexing failed:', error);
            setRagStatus(`Indexing Failed: ${error.message}`);
        } finally {
            setIsIndexing(false);
        }
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
        setIsGeneratingData,
        isIndexing,
        ragStatus,
        setRagStatus,
        addFile,
        removeFile,
        handleFileUpload,
        indexDocuments
    };
};

