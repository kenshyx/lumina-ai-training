import { useState } from 'react';

import { ModelConfig, AnalysisResult } from '../types';
import { callGemini } from '../utils/gemini';

/**
 * Return type for the useModelOptimization hook.
 */
interface UseModelOptimizationReturn {
    /** The current optimization objective */
    objective: string;
    /** Function to update the optimization objective */
    setObjective: (objective: string) => void;
    /** Whether hyperparameter optimization is currently in progress */
    isOptimizing: boolean;
    /** The current optimization analysis result, or null if no optimization has been performed */
    analysisResult: AnalysisResult | null;
    /** Function to optimize hyperparameters based on the current objective */
    optimizeHyperparameters: (currentConfig: ModelConfig, updateConfig: (config: ModelConfig) => void) => Promise<void>;
    /** Function to clear the current optimization result */
    clearAnalysis: () => void;
}

/**
 * Custom hook for optimizing model hyperparameters using AI.
 * 
 * This hook provides functionality to optimize model hyperparameters (learning rate,
 * batch size, context window) based on a specified objective using the Gemini API.
 * It maintains state for optimization progress and results.
 * 
 * @param initialObjective - The initial optimization objective (default: "General Purpose Assistant")
 * @returns Object containing optimization state and functions
 * 
 * @example
 * ```tsx
 * const { objective, setObjective, optimizeHyperparameters } = useModelOptimization("Fast inference");
 * 
 * await optimizeHyperparameters(currentConfig, updateConfig);
 * ```
 */
export const useModelOptimization = (initialObjective: string = "General Purpose Assistant"): UseModelOptimizationReturn => {
    const [objective, setObjective] = useState<string>(initialObjective);
    const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

    const optimizeHyperparameters = async (currentConfig: ModelConfig, updateConfig: (config: ModelConfig) => void) => {
        setIsOptimizing(true);
        try {
            const res = await callGemini(
                `Target: ${objective}. Suggest optimal parameters in JSON.`,
                "ML expert."
            );
            
            const cleanedResponse = res.replace(/```json|```/g, '').trim();
            const suggestion = JSON.parse(cleanedResponse);
            
            updateConfig({
                ...currentConfig,
                learningRate: suggestion.learningRate || currentConfig.learningRate,
                batchSize: suggestion.batchSize || currentConfig.batchSize,
                contextWindow: suggestion.contextWindow || currentConfig.contextWindow
            });
            
            setAnalysisResult({
                type: 'optimization',
                text: suggestion.explanation || "Optimized settings based on objective."
            });
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Failed to optimize hyperparameters:', error);
            setAnalysisResult({
                type: 'optimization',
                text: `Failed to optimize: ${error.message}. Please check your configuration.`
            });
        } finally {
            setIsOptimizing(false);
        }
    };

    const clearAnalysis = () => {
        setAnalysisResult(null);
    };

    return {
        objective,
        setObjective,
        isOptimizing,
        analysisResult,
        optimizeHyperparameters,
        clearAnalysis
    };
};

