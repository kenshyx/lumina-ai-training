// Polyfill for node:module createRequire
// This is a minimal implementation for browser environments
export function createRequire(from) {
  // Return a function that throws an error for unsupported operations
  // or provides a minimal require-like interface
  const requireFn = function require(id) {
    // In browser, we can't actually require CommonJS modules
    // This is a stub that will throw if actually called
    throw new Error(`require() is not available in browser environment. Attempted to require: ${id}`);
  };
  
  // Add some properties that might be expected
  requireFn.resolve = function(id) {
    throw new Error(`require.resolve() is not available in browser environment. Attempted to resolve: ${id}`);
  };
  
  requireFn.cache = {};
  requireFn.extensions = {};
  requireFn.main = undefined;
  
  return requireFn;
}

export default { createRequire };

