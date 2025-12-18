import { useState } from 'react';
import { AnalysisResult } from '../types';
import { callGemini } from '../utils/gemini';

export const useTrainingAnalysis = () => {
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
            console.error('Failed to analyze loss:', err);
            setAnalysisResult({
                type: 'loss',
                text: "Failed to analyze loss trend."
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

