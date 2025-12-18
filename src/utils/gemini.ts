import { GEMINI_MODEL, apiKey } from '../constants';

export const callGemini = async (prompt: string, systemInstruction: string = ""): Promise<string> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined
    };

    let delay = 1000;
    for (let i = 0; i < 5; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return typeof text === 'string' ? text : JSON.stringify(text);
        } catch (error) {
            if (i === 4) throw error;
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
    return "API unavailable. Check connection or key.";
};

