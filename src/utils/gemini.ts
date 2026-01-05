import { GEMINI_MODEL, apiKey } from '../constants';

/**
 * Calls the Gemini API to generate content based on a prompt and optional system instruction.
 * 
 * Implements retry logic with exponential backoff (up to 5 attempts) to handle transient failures.
 * 
 * @param prompt - The user prompt to send to the Gemini API
 * @param systemInstruction - Optional system instruction to guide the model's behavior (default: empty string)
 * @returns Promise that resolves to the generated text content
 * @throws {Error} If all retry attempts fail or the API returns an error
 * 
 * @example
 * ```typescript
 * const response = await callGemini("What is TypeScript?", "You are a helpful coding assistant.");
 * console.log(response);
 * ```
 */
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
            const err = error instanceof Error ? error : new Error(String(error));
            if (i === 4) throw err;
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
    return "API unavailable. Check connection or key.";
};

