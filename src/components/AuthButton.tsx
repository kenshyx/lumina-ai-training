import { useState, FormEvent } from 'react';
import { LogIn, LogOut, User, Loader2, AlertCircle } from 'lucide-react';

import { useATProtoAuth } from '../hooks/useATProtoAuth';
import { GlassCard } from './GlassCard';

/**
 * AuthButton component for AT Protocol authentication.
 * 
 * Provides a sign-in/sign-out interface with:
 * - Sign in form (handle/identifier and password)
 * - User profile display when authenticated
 * - Sign out functionality
 * 
 * @returns The rendered AuthButton component
 * 
 * @example
 * ```tsx
 * <AuthButton />
 * ```
 */
export const AuthButton: React.FC = () => {
    const { isAuthenticated, session, isAuthenticating, isOAuthInitializing, error, signIn, signInWithOAuth, signOut } = useATProtoAuth();
    const [showSignIn, setShowSignIn] = useState<boolean>(false);
    const [identifier, setIdentifier] = useState<string>('');
    const [password, setPassword] = useState<string>('');

    /**
     * Handles sign in form submission.
     * 
     * @param e - Form submission event
     */
    const handleSignIn = async (e: FormEvent) => {
        e.preventDefault();
        
        if (!identifier.trim() || !password.trim()) {
            return;
        }

        try {
            await signIn(identifier.trim(), password);
            setShowSignIn(false);
            setIdentifier('');
            setPassword('');
        } catch (err) {
            // Error is handled by the hook
            console.error('Sign in error:', err);
        }
    };

    /**
     * Handles sign out.
     */
    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Sign out error:', error);
        }
    };

    if (isAuthenticated && session) {
        // Extract username from handle (e.g., "username.bsky.social" -> "username")
        const username = session.handle.includes('.') 
            ? session.handle.split('.')[0] 
            : session.handle;
        
        // Display name or username
        const displayText = session.displayName || username;
        
        return (
            <div className="relative">
                <button
                    onClick={() => setShowSignIn(!showSignIn)}
                    className="px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-md hover:bg-blue-500/30 transition-colors text-xs font-medium text-blue-300 flex items-center gap-2"
                    title={`Signed in as ${session.handle}`}
                >
                    {session.avatar ? (
                        <img
                            src={session.avatar}
                            alt={displayText}
                            className="w-5 h-5 rounded-full"
                        />
                    ) : (
                        <User size={14} />
                    )}
                    <span className="max-w-[150px] truncate" title={session.handle}>
                        {displayText}
                    </span>
                </button>

                {showSignIn && (
                    <div className="absolute right-0 top-full mt-2 z-50">
                        <GlassCard className="p-4 w-80 space-y-4">
                            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                                {session.avatar ? (
                                    <img
                                        src={session.avatar}
                                        alt={session.displayName || session.handle}
                                        className="w-10 h-10 rounded-full"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                        <User size={20} className="text-blue-400" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate">
                                        {session.displayName || 'User'}
                                    </p>
                                    <p className="text-xs text-white/60 truncate">
                                        {session.handle}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleSignOut}
                                className="w-full px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <LogOut size={14} />
                                Sign Out
                            </button>
                        </GlassCard>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                onClick={() => setShowSignIn(!showSignIn)}
                disabled={isAuthenticating}
                className="px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 backdrop-blur-md hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-blue-300 flex items-center gap-2"
                title="Sign in with AT Protocol"
            >
                {isAuthenticating ? (
                    <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Signing in...</span>
                    </>
                ) : (
                    <>
                        <LogIn size={14} />
                        <span>Sign In</span>
                    </>
                )}
            </button>

            {showSignIn && (
                <div className="absolute right-0 top-full mt-2 z-50">
                    <GlassCard className="p-4 w-80 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <LogIn size={18} className="text-blue-400" />
                            <h3 className="text-sm font-bold">AT Protocol Sign In</h3>
                        </div>

                        <p className="text-xs text-white/60 mb-4">
                            Sign in with OAuth (recommended) or use your Bluesky handle/email and password.
                        </p>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
                                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-300">{error}</p>
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    await signInWithOAuth();
                                } catch (err) {
                                    // Error is handled by the hook
                                    console.error('OAuth sign in error:', err);
                                }
                            }}
                            disabled={isAuthenticating || isOAuthInitializing}
                            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
                            title={isOAuthInitializing ? 'OAuth client is initializing...' : undefined}
                        >
                            {isAuthenticating || isOAuthInitializing ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    {isOAuthInitializing ? 'Initializing...' : 'Signing in...'}
                                </>
                            ) : (
                                <>
                                    <LogIn size={14} />
                                    Sign in with OAuth
                                </>
                            )}
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-white/10"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="px-2 bg-[#020617] text-white/40">Or</span>
                            </div>
                        </div>

                        <form onSubmit={handleSignIn} className="space-y-3">
                            <div className="space-y-2">
                                <label className="text-[10px] text-white/30 uppercase font-bold tracking-[0.2em]">
                                    Handle or Email
                                </label>
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="username.bsky.social or email"
                                    disabled={isAuthenticating}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs text-white placeholder-white/30 outline-none focus:border-blue-500/40 transition-all disabled:opacity-50"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-white/30 uppercase font-bold tracking-[0.2em]">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Password or app password"
                                    disabled={isAuthenticating}
                                    className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-xs text-white placeholder-white/30 outline-none focus:border-blue-500/40 transition-all disabled:opacity-50"
                                    required
                                />
                                <p className="text-[10px] text-white/40 italic">
                                    Use an app password for better security
                                </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="submit"
                                    disabled={isAuthenticating || !identifier.trim() || !password.trim()}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isAuthenticating ? (
                                        <>
                                            <Loader2 size={14} className="animate-spin" />
                                            Signing in...
                                        </>
                                    ) : (
                                        <>
                                            <LogIn size={14} />
                                            Sign In
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSignIn(false);
                                        setIdentifier('');
                                        setPassword('');
                                    }}
                                    disabled={isAuthenticating}
                                    className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>

                        <div className="pt-3 border-t border-white/10">
                            <p className="text-[10px] text-white/40 text-center">
                                Powered by{' '}
                                <a
                                    href="https://atproto.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 underline"
                                >
                                    AT Protocol
                                </a>
                            </p>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};
