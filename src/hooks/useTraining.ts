import { useState, useEffect } from 'react';
import { ModelConfig } from '../types';

const DEFAULT_MODEL_CONFIG: ModelConfig = {
    learningRate: 0.001,
    batchSize: 32,
    epochs: 10,
    contextWindow: 512,
    engine: 'ml5.js (CharRNN)'
};

export const useTraining = (initialConfig?: ModelConfig) => {
    const [isTraining, setIsTraining] = useState<boolean>(false);
    const [trainingProgress, setTrainingProgress] = useState<number>(0);
    const [currentEpoch, setCurrentEpoch] = useState<number>(0);
    const [loss, setLoss] = useState<number[]>([]);
    const [modelConfig, setModelConfig] = useState<ModelConfig>(initialConfig || DEFAULT_MODEL_CONFIG);

    useEffect(() => {
        let interval: number | undefined;
        if (isTraining && trainingProgress < 100) {
            interval = window.setInterval(() => {
                setTrainingProgress(prev => {
                    const next = prev + 1.2;
                    if (next >= 100) {
                        setIsTraining(false);
                        return 100;
                    }
                    return next;
                });
                const l = Math.max(0.01, 2 * Math.exp(-trainingProgress / 20) + (Math.random() * 0.05));
                setLoss(prev => [...prev.slice(-24), l]);
                setCurrentEpoch(Math.floor((trainingProgress / 100) * modelConfig.epochs));
            }, 400);
        }
        return () => clearInterval(interval);
    }, [isTraining, trainingProgress, modelConfig.epochs]);

    const startTraining = () => setIsTraining(true);
    const pauseTraining = () => setIsTraining(false);
    const toggleTraining = () => setIsTraining(prev => !prev);
    const resetTraining = () => {
        setIsTraining(false);
        setTrainingProgress(0);
        setCurrentEpoch(0);
        setLoss([]);
    };

    return {
        isTraining,
        trainingProgress,
        currentEpoch,
        loss,
        modelConfig,
        setModelConfig,
        startTraining,
        pauseTraining,
        toggleTraining,
        resetTraining
    };
};
