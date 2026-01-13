import { useState, useEffect, useCallback } from 'react';
import { AtpAgent } from '@atproto/api';
import { BrowserOAuthClient } from '@atproto/oauth-client-browser';

import { ATProtoSession } from '../types';
import { ATPROTO_CLIENT_ID, ATPROTO_CLIENT_URI } from '../constants';

/**
 * Checks if we're in local development.
 */
const isLocalDevelopment = (): boolean => {
    if (typeof window === 'undefined') {
        return true;
    }
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.startsWith('172.');
};

/**
 * Gets the current origin for redirect URIs (can use actual protocol and hostname).
 * Redirect URIs can use localhost/IP addresses per RFC 8252.
 */
const getRedirectOrigin = (): string => {
    if (typeof window === 'undefined') {
        return 'http://127.0.0.1:5173';
    }
    const hostname = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${window.location.protocol}//${hostname}${port}`;
};

const ATPROTO_OAUTH_CONFIG = {
    /** OAuth client ID - from environment variable or default */
    clientId: ATPROTO_CLIENT_ID,
    /** Inline client metadata for development (used if clientId URL fails) */
    inlineClientMetadata: {
        client_id: ATPROTO_CLIENT_ID,
        client_name: 'Lumina RAG',
        client_uri: ATPROTO_CLIENT_URI,
        redirect_uris: [
            typeof window !== 'undefined' 
                ? `${getRedirectOrigin()}${window.location.pathname}`
                : 'http://127.0.0.1:5173'
        ] as [string, ...string[]],
        scope: 'atproto',
        grant_types: ['authorization_code', 'refresh_token'] as ['authorization_code', 'refresh_token'],
        response_types: ['code'] as ['code'],
        token_endpoint_auth_method: 'none' as const,
        application_type: 'web' as const,
        dpop_bound_access_tokens: true,
    },
};

/**
 * Storage key for persisting authentication session.
 */
const SESSION_STORAGE_KEY = 'lumina_atproto_session';

/**
 * Default service URL for AT Protocol (Bluesky).
 */
const DEFAULT_SERVICE_URL = 'https://bsky.social';

/**
 * Return type for the useATProtoAuth hook.
 */
interface UseATProtoAuthReturn {
    /** Whether the user is currently authenticated */
    isAuthenticated: boolean;
    /** Current session information (null if not authenticated) */
    session: ATProtoSession | null;
    /** Whether authentication is in progress */
    isAuthenticating: boolean;
    /** Whether OAuth client is currently initializing */
    isOAuthInitializing: boolean;
    /** Error message from authentication (null if no error) */
    error: string | null;
    /** Function to sign in with handle/identifier and password */
    signIn: (identifier: string, password: string) => Promise<void>;
    /** Function to sign in with OAuth */
    signInWithOAuth: () => Promise<void>;
    /** Function to sign out */
    signOut: () => Promise<void>;
    /** Function to refresh the session */
    refreshSession: () => Promise<void>;
    /** ATProto agent instance (null if not authenticated) */
    agent: AtpAgent | null;
    /** OAuth client instance */
    oauthClient: BrowserOAuthClient | null;
}

/**
 * Custom hook for managing AT Protocol (ATProto) authentication.
 * 
 * This hook provides functionality to:
 * - Sign in with handle/identifier and password
 * - Sign in with OAuth flow
 * - Sign out and clear session
 * - Persist session in localStorage
 * - Restore session on mount
 * - Refresh expired sessions
 * - Handle OAuth callback
 * 
 * @param serviceUrl - Optional custom service URL (defaults to Bluesky)
 * @returns Object containing authentication state and functions
 * 
 * @example
 * ```tsx
 * const { isAuthenticated, session, signIn, signInWithOAuth, signOut } = useATProtoAuth();
 * 
 * // Password-based sign in
 * await signIn('username.bsky.social', 'password');
 * 
 * // OAuth sign in
 * await signInWithOAuth();
 * ```
 */
export const useATProtoAuth = (serviceUrl: string = DEFAULT_SERVICE_URL): UseATProtoAuthReturn => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [session, setSession] = useState<ATProtoSession | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [agent, setAgent] = useState<AtpAgent | null>(null);
    const [oauthClient, setOauthClient] = useState<BrowserOAuthClient | null>(null);
    const [isOAuthInitializing, setIsOAuthInitializing] = useState<boolean>(true);

    /**
     * Saves session to localStorage.
     * 
     * @param sessionData - Session data to save
     */
    const saveSession = useCallback((sessionData: ATProtoSession) => {
        try {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[ATProto Auth] Failed to save session:', error);
        }
    }, []);

    /**
     * Handles an established OAuth session.
     * 
     * @param oauthSession - The OAuth session
     * @param state - Optional state parameter from OAuth callback
     */
    const handleOAuthSession = useCallback(async (oauthSession: any, state?: string | null): Promise<void> => {
        const did = oauthSession.did;
        
        console.log('[ATProto Auth] Processing OAuth session:', {
            did,
            state: state || 'none',
        });

        // Create agent with OAuth tokens
        const newAgent = new AtpAgent({ service: serviceUrl });
        
        try {
            // Fetch profile to get handle and other info
            let handle = '';
            let displayName: string | undefined;
            let avatar: string | undefined;

            try {
                // Use OAuth session's fetchHandler to make authenticated requests
                const profileResponse = await oauthSession.fetchHandler('/xrpc/com.atproto.actor.getProfile', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                
                if (profileResponse.ok) {
                    const profileData = await profileResponse.json();
                    handle = profileData.handle || '';
                    displayName = profileData.displayName;
                    avatar = profileData.avatar;
                }
            } catch (err) {
                console.warn('[ATProto Auth] Failed to fetch profile with OAuth session:', err);
            }

            // Get token info for storing (OAuth tokens are managed by the session)
            const tokenInfo = await oauthSession.getTokenInfo();
            
            // Create session data
            const sessionData: ATProtoSession = {
                did,
                handle,
                accessJwt: 'oauth-managed', // OAuth tokens are managed by OAuthSession
                refreshJwt: 'oauth-managed',
                email: undefined,
                displayName,
                avatar,
            };

            saveSession(sessionData);
            setSession(sessionData);
            setAgent(newAgent);
            setIsAuthenticated(true);

            // Clean up URL (both query string and hash fragment)
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            throw error;
        }
    }, [serviceUrl, saveSession]);

    /**
     * Initializes the OAuth client and processes OAuth callbacks.
     * This runs on mount and handles OAuth callbacks even on full page refresh.
     */
    useEffect(() => {
        const initOAuthClient = async () => {
            setIsOAuthInitializing(true);
            
            // Check for OAuth callback params immediately (even before client is ready)
            // OAuth callbacks can be in query string (?code=...) or hash fragment (#code=...)
            const queryParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.substring(1)); // Remove the '#' prefix
            const hasCallbackInQuery = queryParams.get('code') || queryParams.get('error');
            const hasCallbackInHash = hashParams.get('code') || hashParams.get('error');
            const hasCallbackParams = hasCallbackInQuery || hasCallbackInHash;
            
            if (hasCallbackParams) {
                console.log('[ATProto Auth] OAuth callback detected in URL on mount:', {
                    inQuery: hasCallbackInQuery,
                    inHash: hasCallbackInHash,
                    code: queryParams.get('code') || hashParams.get('code') ? 'present' : 'missing',
                    error: queryParams.get('error') || hashParams.get('error'),
                    state: queryParams.get('state') || hashParams.get('state'),
                    iss: queryParams.get('iss') || hashParams.get('iss'),
                });
            }

            try {
                let client: BrowserOAuthClient;

                // For local development, use inline metadata directly (skip URL loading)
                // For production, try to load from URL first
                if (isLocalDevelopment()) {
                    // Use inline metadata directly for local development
                    client = new BrowserOAuthClient({
                        clientMetadata: ATPROTO_OAUTH_CONFIG.inlineClientMetadata,
                        allowHttp: window.location.protocol === 'http:',
                        // Required: handleResolver for resolving Bluesky handles
                        handleResolver: serviceUrl,
                    });
                } else {
                    // For production, try to load client metadata from URL first
                    try {
                        client = await BrowserOAuthClient.load({
                            clientId: ATPROTO_OAUTH_CONFIG.clientId,
                            allowHttp: window.location.protocol === 'http:',
                            // Required: handleResolver for resolving Bluesky handles
                            handleResolver: serviceUrl,
                        });
                    } catch (loadError) {
                        console.warn('[ATProto Auth] Failed to load client metadata from URL, using inline metadata:', loadError);
                        // Fallback to inline client metadata if URL loading fails
                        client = new BrowserOAuthClient({
                            clientMetadata: ATPROTO_OAUTH_CONFIG.inlineClientMetadata,
                            allowHttp: window.location.protocol === 'http:',
                            // Required: handleResolver for resolving Bluesky handles
                            handleResolver: serviceUrl,
                        });
                    }
                }

                setOauthClient(client);

                // Process OAuth callback if present (takes priority over session restore)
                if (hasCallbackParams) {
                    console.log('[ATProto Auth] Processing OAuth callback from URL (query string or hash fragment)...');
                    try {
                        // readCallbackParams() should handle both query string and hash fragment
                        const callbackParams = client.readCallbackParams();
                        
                        if (callbackParams) {
                            console.log('[ATProto Auth] Callback params read successfully, initializing callback...');
                            
                            // Check for OAuth errors first
                            const error = callbackParams.get('error');
                            if (error) {
                                const errorDescription = callbackParams.get('error_description') || error;
                                setError(`OAuth error: ${errorDescription}`);
                                setIsOAuthInitializing(false);
                                // Clean up URL (both query string and hash)
                                window.history.replaceState({}, document.title, window.location.pathname);
                                return;
                            }

                            // Process the callback
                            const result = await client.initCallback(callbackParams);
                            
                            if (result?.session) {
                                console.log('[ATProto Auth] OAuth callback successful, establishing session...');
                                // Session established, handle it
                                await handleOAuthSession(result.session, result.state);
                                setIsOAuthInitializing(false);
                                return; // Don't try to restore session if we just processed a callback
                            } else {
                                console.warn('[ATProto Auth] initCallback did not return a session');
                                setError('Failed to establish OAuth session from callback.');
                            }
                        } else {
                            console.warn('[ATProto Auth] Could not read callback params from URL');
                            // Try manual fallback: parse hash fragment directly
                            if (window.location.hash) {
                                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                                const code = hashParams.get('code');
                                const state = hashParams.get('state');
                                const error = hashParams.get('error');
                                
                                if (code || error) {
                                    console.log('[ATProto Auth] Found callback params in hash fragment, creating URLSearchParams manually...');
                                    // Create a URLSearchParams from hash fragment
                                    const manualParams = new URLSearchParams();
                                    if (code) manualParams.set('code', code);
                                    if (state) manualParams.set('state', state);
                                    if (error) manualParams.set('error', error);
                                    if (hashParams.get('error_description')) {
                                        manualParams.set('error_description', hashParams.get('error_description')!);
                                    }
                                    
                                    try {
                                        const result = await client.initCallback(manualParams);
                                        if (result?.session) {
                                            console.log('[ATProto Auth] OAuth callback successful (manual hash parsing), establishing session...');
                                            await handleOAuthSession(result.session, result.state);
                                            setIsOAuthInitializing(false);
                                            return;
                                        }
                                    } catch (manualError) {
                                        console.error('[ATProto Auth] Manual hash parsing failed:', manualError);
                                    }
                                }
                            }
                            setError('Invalid OAuth callback parameters.');
                        }
                    } catch (callbackError) {
                        const error = callbackError instanceof Error ? callbackError : new Error(String(callbackError));
                        console.error('[ATProto Auth] OAuth callback processing failed:', error);
                        setError(error.message || 'Failed to process OAuth callback.');
                        // Clean up URL on error (both query string and hash)
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                } else {
                    // No callback params, try to restore existing OAuth session
                    console.log('[ATProto Auth] No OAuth callback params, attempting to restore session...');
                    try {
                        const restoreResult = await client.initRestore();
                        if (restoreResult?.session) {
                            console.log('[ATProto Auth] OAuth session restored successfully');
                            await handleOAuthSession(restoreResult.session);
                        } else {
                            console.log('[ATProto Auth] No existing OAuth session to restore');
                        }
                    } catch (restoreError) {
                        // Restore failed, that's okay - user needs to sign in
                        console.log('[ATProto Auth] OAuth session restore failed (this is normal if no session exists)');
                    }
                }
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                console.error('[ATProto Auth] Failed to initialize OAuth client:', error);
                setError(`OAuth initialization failed: ${error.message}. Password-based sign-in is still available.`);
                // OAuth client initialization failure is not critical - password auth still works
            } finally {
                setIsOAuthInitializing(false);
            }
        };

        initOAuthClient();
    }, [serviceUrl, handleOAuthSession]);

    /**
     * Handles OAuth callback and initializes OAuth client session.
     * Captures session info from query parameters when redirected.
     */
    const handleOAuthCallback = useCallback(async (): Promise<void> => {
        if (!oauthClient) {
            console.warn('[ATProto Auth] OAuth client not ready for callback');
            return;
        }

        try {
            setIsAuthenticating(true);
            setError(null);

            // Read callback parameters from URL (handles both query string and hash fragment)
            const callbackParams = oauthClient.readCallbackParams();
            const queryParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            
            console.log('[ATProto Auth] Checking for OAuth callback:', {
                hasCallbackParams: !!callbackParams,
                queryHasCode: !!queryParams.get('code'),
                hashHasCode: !!hashParams.get('code'),
                queryHasError: !!queryParams.get('error'),
                hashHasError: !!hashParams.get('error'),
                hashFragment: window.location.hash ? window.location.hash.substring(0, 100) : 'none',
            });
            
            if (callbackParams) {
                // Log captured query parameters for debugging
                console.log('[ATProto Auth] OAuth callback parameters:', {
                    code: callbackParams.get('code') ? 'present' : 'missing',
                    state: callbackParams.get('state'),
                    error: callbackParams.get('error'),
                    error_description: callbackParams.get('error_description'),
                });

                // Check for OAuth errors in query params
                const error = callbackParams.get('error');
                if (error) {
                    const errorDescription = callbackParams.get('error_description') || error;
                    setError(`OAuth error: ${errorDescription}`);
                    setIsAuthenticating(false);
                    // Clean up URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                    return;
                }
            }

            // Process callback with the parameters
            if (callbackParams) {
                const result = await oauthClient.initCallback(callbackParams);
                if (result?.session) {
                    await handleOAuthSession(result.session, result.state);
                } else {
                    console.warn('[ATProto Auth] initCallback did not return a session');
                    setError('Failed to establish OAuth session from callback.');
                }
            } else {
                // Try init() as fallback
                const result = await oauthClient.init();
                if (result?.session) {
                    await handleOAuthSession(result.session, result.state);
                } else {
                    console.warn('[ATProto Auth] init() did not return a session');
                }
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[ATProto Auth] OAuth callback failed:', error);
            setError(error.message || 'Failed to complete OAuth sign in.');
            setIsAuthenticated(false);
        } finally {
            setIsAuthenticating(false);
        }
    }, [oauthClient, handleOAuthSession]);

    /**
     * Checks for OAuth callback as a fallback.
     * This runs if the callback wasn't processed during client initialization.
     */
    useEffect(() => {
        if (oauthClient && !isAuthenticated && !isOAuthInitializing) {
            // Check if URL contains OAuth callback parameters (query string or hash fragment)
            const queryParams = new URLSearchParams(window.location.search);
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const hasCallback = queryParams.get('code') || queryParams.get('error') || 
                                hashParams.get('code') || hashParams.get('error');
            
            if (hasCallback) {
                console.log('[ATProto Auth] OAuth callback detected (fallback handler), processing...');
                handleOAuthCallback();
            }
        }
    }, [oauthClient, isAuthenticated, isOAuthInitializing, handleOAuthCallback]);

    /**
     * Loads session from localStorage and restores authentication state.
     */
    const loadSession = useCallback(async () => {
        try {
            const stored = localStorage.getItem(SESSION_STORAGE_KEY);
            if (!stored) {
                return;
            }

            const parsedSession: ATProtoSession = JSON.parse(stored);
            
            // Create agent and set session
            const newAgent = new AtpAgent({ service: serviceUrl });
            await newAgent.resumeSession({
                accessJwt: parsedSession.accessJwt,
                refreshJwt: parsedSession.refreshJwt,
                did: parsedSession.did,
                handle: parsedSession.handle,
                email: parsedSession.email,
                active: true,
            });

            // Verify session is still valid by fetching profile
            try {
                const profile = await newAgent.getProfile({ actor: parsedSession.did });
                
                setSession({
                    ...parsedSession,
                    displayName: profile.data.displayName,
                    avatar: profile.data.avatar,
                });
                setAgent(newAgent);
                setIsAuthenticated(true);
                setError(null);
            } catch (err) {
                // Session expired or invalid, clear it
                localStorage.removeItem(SESSION_STORAGE_KEY);
                setSession(null);
                setAgent(null);
                setIsAuthenticated(false);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[ATProto Auth] Failed to load session:', error);
            localStorage.removeItem(SESSION_STORAGE_KEY);
            setSession(null);
            setAgent(null);
            setIsAuthenticated(false);
        }
    }, [serviceUrl]);

    /**
     * Clears session from localStorage and state.
     */
    const clearSession = useCallback(() => {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setSession(null);
        setAgent(null);
        setIsAuthenticated(false);
        setError(null);
    }, []);

    /**
     * Loads password-based session on mount.
     * Only runs if there are no OAuth callback params and OAuth client is not initializing.
     */
    useEffect(() => {
        // Wait for OAuth client to finish initializing before loading password-based session
        // This ensures OAuth callbacks are processed first
        if (isOAuthInitializing) {
            return;
        }

        // Only load password-based session if not handling OAuth callback
        // Check both query string and hash fragment for OAuth callback params
        const queryParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const hasOAuthCallback = queryParams.get('code') || queryParams.get('error') || 
                                 hashParams.get('code') || hashParams.get('error');
        
        // Also don't load if already authenticated (OAuth might have just authenticated)
        if (!hasOAuthCallback && !isAuthenticated) {
            console.log('[ATProto Auth] Loading password-based session from localStorage...');
            loadSession();
        }
    }, [loadSession, isOAuthInitializing, isAuthenticated]);

    /**
     * Signs in with identifier (handle or email) and password.
     * 
     * @param identifier - User handle (e.g., username.bsky.social) or email
     * @param password - User password or app password
     * @throws {Error} If authentication fails
     * @returns Promise that resolves when sign in is complete
     */
    const signIn = useCallback(async (identifier: string, password: string): Promise<void> => {
        setIsAuthenticating(true);
        setError(null);

        try {
            const newAgent = new AtpAgent({ service: serviceUrl });
            const response = await newAgent.login({
                identifier,
                password,
            });

            // Fetch user profile for additional info
            let displayName: string | undefined;
            let avatar: string | undefined;
            
            try {
                const profile = await newAgent.getProfile({ actor: response.data.did });
                displayName = profile.data.displayName;
                avatar = profile.data.avatar;
            } catch (err) {
                // Profile fetch failed, but login succeeded - continue
                console.warn('[ATProto Auth] Failed to fetch profile:', err);
            }

            const sessionData: ATProtoSession = {
                did: response.data.did,
                handle: response.data.handle,
                accessJwt: response.data.accessJwt,
                refreshJwt: response.data.refreshJwt,
                email: response.data.email,
                displayName,
                avatar,
            };

            saveSession(sessionData);
            setSession(sessionData);
            setAgent(newAgent);
            setIsAuthenticated(true);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[ATProto Auth] Sign in failed:', error);
            setError(error.message || 'Failed to sign in. Please check your credentials.');
            setIsAuthenticated(false);
            throw error;
        } finally {
            setIsAuthenticating(false);
        }
    }, [serviceUrl, saveSession]);

    /**
     * Signs in using OAuth flow.
     * 
     * This will redirect the user to the OAuth provider's authorization page.
     * After authorization, the user will be redirected back to the app.
     * 
     * @throws {Error} If OAuth client is not initialized or flow fails
     * @returns Promise that resolves when OAuth flow is initiated
     */
    const signInWithOAuth = useCallback(async (): Promise<void> => {
        if (isOAuthInitializing) {
            const error = new Error('OAuth client is still initializing. Please wait a moment and try again.');
            setError(error.message);
            throw error;
        }

        if (!oauthClient) {
            const error = new Error('OAuth client failed to initialize. Please use password-based sign-in or refresh the page.');
            setError(error.message);
            throw error;
        }

        setIsAuthenticating(true);
        setError(null);

        try {
            // Get the user's handle/identifier - for now, we'll use a prompt
            // In a real app, you'd have an input field
            const identifier = prompt('Enter your Bluesky handle (e.g., username.bsky.social):');
            if (!identifier) {
                setIsAuthenticating(false);
                return;
            }

            // Initiate OAuth flow with redirect
            await oauthClient.signInRedirect(identifier.trim());
            // This will redirect, so we won't reach here
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[ATProto Auth] OAuth sign in failed:', error);
            setError(error.message || 'Failed to initiate OAuth sign in.');
            setIsAuthenticating(false);
            throw error;
        }
    }, [oauthClient, isOAuthInitializing]);

    /**
     * Signs out and clears the session.
     * 
     * @returns Promise that resolves when sign out is complete
     */
    const signOut = useCallback(async (): Promise<void> => {
        try {
            if (oauthClient && session) {
                // Revoke OAuth session if it exists
                try {
                    await oauthClient.revoke(session.did);
                } catch (err) {
                    // Ignore revocation errors
                    console.warn('[ATProto Auth] Failed to revoke OAuth session:', err);
                }
            }
            if (agent) {
                // Optionally call logout endpoint if available
                // Most ATProto implementations don't require server-side logout
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.warn('[ATProto Auth] Error during sign out:', error);
        } finally {
            clearSession();
        }
    }, [agent, oauthClient, session, clearSession]);

    /**
     * Refreshes the current session using the refresh token.
     * 
     * @returns Promise that resolves when refresh is complete
     */
    const refreshSession = useCallback(async (): Promise<void> => {
        if (!agent || !session) {
            return;
        }

        try {
            // The agent should handle token refresh automatically
            // But we can manually refresh if needed
            const profile = await agent.getProfile({ actor: session.did });
            
            // Update session with latest profile info
            const updatedSession: ATProtoSession = {
                ...session,
                displayName: profile.data.displayName,
                avatar: profile.data.avatar,
            };

            saveSession(updatedSession);
            setSession(updatedSession);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[ATProto Auth] Failed to refresh session:', error);
            // If refresh fails, clear session
            clearSession();
        }
    }, [agent, session, saveSession, clearSession]);

    return {
        isAuthenticated,
        session,
        isAuthenticating,
        isOAuthInitializing,
        error,
        signIn,
        signInWithOAuth,
        signOut,
        refreshSession,
        agent,
        oauthClient,
    };
};
