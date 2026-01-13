/**
 * Google Gemini API key for making API requests.
 * 
 * Set this value to your actual API key. Leave empty to disable Gemini API features.
 */
export const apiKey: string = "";

/**
 * The Gemini model identifier to use for API requests.
 * 
 * Default: "gemini-2.5-flash-preview-09-2025"
 */
export const GEMINI_MODEL: string = "gemini-2.5-flash-preview-09-2025";

/**
 * OAuth client_id URL from environment variable.
 * 
 * Must be an HTTPS URL with a domain name (not IP or loopback).
 * Set VITE_ATPROTO_CLIENT_ID in your .env file.
 * 
 * Default: "https://lumina-rag.app/client-metadata.json"
 */
export const ATPROTO_CLIENT_ID: string = 
    import.meta.env.VITE_ATPROTO_CLIENT_ID || 
    'https://lumina-rag.app/client-metadata.json';

/**
 * OAuth client_uri from environment variable.
 * 
 * Must be an HTTPS URL with a domain name (not IP or loopback).
 * Set VITE_ATPROTO_CLIENT_URI in your .env file.
 * 
 * Default: "https://lumina-rag.app"
 */
export const ATPROTO_CLIENT_URI: string = 
    import.meta.env.VITE_ATPROTO_CLIENT_URI || 
    'https://lumina-rag.app';

/**
 * AT Protocol OAuth configuration.
 * 
 * For production, register your app at https://bsky.app/settings/app-passwords
 * and set these values. For development, you can use a placeholder client ID.
 */
export const ATPROTO_OAUTH_CONFIG = {
    /** Service URI for AT Protocol (defaults to Bluesky) */
    serviceUri: 'https://bsky.social',
    /** OAuth client ID - register your app to get a real client ID */
    clientId: typeof window !== 'undefined' 
        ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'lumina-rag-dev' // Development client ID
            : `lumina-rag-${window.location.hostname.replace(/\./g, '-')}`) // Production client ID based on hostname
        : 'lumina-rag',
    /** OAuth redirect URI - must match registered redirect URI */
    redirectUri: typeof window !== 'undefined' 
        ? `${window.location.origin}${window.location.pathname}`
        : 'http://localhost:5173',
    /** OAuth scope - basic access */
    scope: 'com.atproto.oauth.basic',
};
