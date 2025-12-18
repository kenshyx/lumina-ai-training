import { useState } from 'react';
import { ModelConfig, AnalysisResult } from '../types';
import { callGemini } from '../utils/gemini';

export const useModelOptimization = (initialObjective: string = "General Purpose Assistant") => {
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
            console.error('Failed to optimize hyperparameters:', err);
            setAnalysisResult({
                type: 'optimization',
                text: "Failed to optimize. Please check your configuration."
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

