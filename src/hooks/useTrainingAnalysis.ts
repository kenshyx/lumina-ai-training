import { useState } from 'react';

import { AnalysisResult } from '../types';
import { callGemini } from '../utils/gemini';

/**
 * Return type for the useTrainingAnalysis hook.
 */
interface UseTrainingAnalysisReturn {
    /** Whether loss analysis is currently in progress */
    isAnalyzing: boolean;
    /** The current analysis result, or null if no analysis has been performed */
    analysisResult: AnalysisResult | null;
    /** Function to analyze training loss trends */
    analyzeLoss: (loss: number[]) => Promise<void>;
    /** Function to clear the current analysis result */
    clearAnalysis: () => void;
}

/**
 * Custom hook for analyzing training loss trends using AI.
 * 
 * This hook provides functionality to analyze training loss data and generate
 * insights using the Gemini API. It maintains state for analysis progress and results.
 * 
 * @returns Object containing analysis state and functions
 * 
 * @example
 * ```tsx
 * const { isAnalyzing, analysisResult, analyzeLoss, clearAnalysis } = useTrainingAnalysis();
 * 
 * await analyzeLoss([0.5, 0.4, 0.3, 0.2]);
 * ```
 */
export const useTrainingAnalysis = (): UseTrainingAnalysisReturn => {
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    const analyzeLoss = async (loss: number[]) => {
        if (loss.length === 0) return;

        setIsAnalyzing(true);
        try {
            const result = await callGemini(
                `Analyze loss trend: ${loss.slice(-10).join(', ')}`,
                "Metrics analyst."
            );
            setAnalysisResult({ type: 'loss', text: result });
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Failed to analyze loss:', error);
            setAnalysisResult({
                type: 'loss',
                text: `Failed to analyze loss trend: ${error.message}.`
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    const clearAnalysis = () => {
        setAnalysisResult(null);
    };

    return {
        isAnalyzing,
        analysisResult,
        analyzeLoss,
        clearAnalysis
    };
};

