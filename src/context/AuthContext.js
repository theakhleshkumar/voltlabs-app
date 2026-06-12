/**
 * Auth Context
 * Global authentication state. RootNavigator reads `isAuthenticated` to decide
 * whether to render the auth flow (Welcome/Login/Otp) or the main app.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import deviceManager from '../utils/deviceManager';

const AuthContext = createContext(null);

// Minimum time to show the splash screen, so it doesn't flash on fast checks
const MIN_SPLASH_MS = 1500;

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // Run once on app start: load stored tokens, or try a trusted-device login
  useEffect(() => {
    let cancelled = false;
    const startTime = Date.now();

    const checkAuth = async () => {
      try {
        await deviceManager.init();
        const authed = await api.init();

        if (authed) {
          if (!cancelled) {
            setUser(api.getUser());
            setIsAuthenticated(true);
          }
        } else {
          const trustedCredentials = deviceManager.getTrustedCredentials();
          let loggedIn = false;

          if (trustedCredentials) {
            console.log('[Auth] Attempting device login (skip OTP)...');
            const result = await api.deviceLogin();
            if (result.success) {
              loggedIn = true;
              if (!cancelled) {
                setUser(api.getUser());
                setIsAuthenticated(true);
              }
            } else {
              console.log('[Auth] Device login failed:', result.reason);
            }
          }

          if (!loggedIn && !cancelled) {
            setIsAuthenticated(false);
          }
        }
      } catch (error) {
        console.error('[Auth] Init error:', error);
        if (!cancelled) {
          setIsAuthenticated(false);
        }
      }

      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_SPLASH_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_SPLASH_MS - elapsed));
      }

      if (!cancelled) {
        setIsLoading(false);
      }
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  // Called after a successful OTP verification
  const login = useCallback((loggedInUser) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
  }, []);

  // User-initiated logout
  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Tokens are no longer valid (refresh failed) - drop back to the auth flow
  const sessionExpired = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  // Let the API layer notify us when a token refresh fails anywhere in the app
  useEffect(() => {
    api.onSessionExpired(sessionExpired);
    return () => api.offSessionExpired(sessionExpired);
  }, [sessionExpired]);

  const value = { isLoading, isAuthenticated, user, login, logout, sessionExpired };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
