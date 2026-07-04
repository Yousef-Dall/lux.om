import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  exchangeGoogleOAuthCode,
  getCurrentUser,
  login as loginRequest,
  register as registerRequest,
  updateCurrentUser,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
  type UpdateProfilePayload
} from '../api/auth';

import { getMarketplacePersonaCapabilities } from '../utils/marketplacePersona';

const TOKEN_STORAGE_KEY = 'lux_om_auth_token';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isActivityProvider: boolean;
  isTravelAgency: boolean;
  isCustomer: boolean;
  isDeveloper: boolean;
  isBusinessAccount: boolean;
  isMarketplaceOperator: boolean;
  canManageListings: boolean;
  canManageActivities: boolean;
  canManageTravelPackages: boolean;
  canManageDeveloperProjects: boolean;
  canReviewBookingRequests: boolean;
  canUseMediaQuality: boolean;
  canUseVerification: boolean;
  canUsePerformance: boolean;
  canAccessAdmin: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<AuthUser>;
  refreshUser: () => Promise<AuthUser | null>;
  completeOAuthLogin: (token: string) => Promise<AuthUser>;
  replaceSession: (nextToken: string, nextUser: AuthUser) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

function saveToken(token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

function removeToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  const logout = useCallback(() => {
    removeToken();
    setToken(null);
    setUser(null);
  }, []);

  const replaceSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    saveToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      return null;
    }

    const response = await getCurrentUser(token);
    setUser(response.user);

    return response.user;
  }, [token]);

  useEffect(() => {
    let isMounted = true;

    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await getCurrentUser(token);

        if (!isMounted) return;

        setUser(response.user);
      } catch (error) {
        console.error(error);

        if (!isMounted) return;

        logout();
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [token, logout]);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginRequest(payload);

    saveToken(response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await registerRequest(payload);

    saveToken(response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const completeOAuthLogin = useCallback(async (oauthCode: string) => {
    const response = await exchangeGoogleOAuthCode(oauthCode);

    saveToken(response.token);
    setToken(response.token);
    setUser(response.user);

    return response.user;
  }, []);

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      if (!token) {
        throw new Error('You must be signed in to update your profile.');
      }

      const response = await updateCurrentUser(payload, token);
      setUser(response.user);

      return response.user;
    },
    [token]
  );

  const marketplaceCapabilities = getMarketplacePersonaCapabilities(user?.role);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isAdmin: marketplaceCapabilities.canAccessAdmin,
      isOwner: marketplaceCapabilities.canManageListings,
      isActivityProvider: marketplaceCapabilities.canManageActivities,
      isTravelAgency: marketplaceCapabilities.canManageTravelPackages,
      isCustomer:
        marketplaceCapabilities.canUseCustomerTools &&
        !marketplaceCapabilities.canManageListings &&
        !marketplaceCapabilities.canManageActivities &&
        !marketplaceCapabilities.canManageTravelPackages &&
        !marketplaceCapabilities.canManageDeveloperProjects &&
        !marketplaceCapabilities.canAccessAdmin,
      isDeveloper: marketplaceCapabilities.canManageDeveloperProjects,
      isBusinessAccount:
        marketplaceCapabilities.canManageListings ||
        marketplaceCapabilities.canManageActivities ||
        marketplaceCapabilities.canManageTravelPackages ||
        marketplaceCapabilities.canManageDeveloperProjects ||
        marketplaceCapabilities.canAccessAdmin,
      isMarketplaceOperator:
        marketplaceCapabilities.canManageListings ||
        marketplaceCapabilities.canManageActivities ||
        marketplaceCapabilities.canManageTravelPackages ||
        marketplaceCapabilities.canAccessAdmin,
      canManageListings: marketplaceCapabilities.canManageListings,
      canManageActivities: marketplaceCapabilities.canManageActivities,
      canManageTravelPackages: marketplaceCapabilities.canManageTravelPackages,
      canManageDeveloperProjects: marketplaceCapabilities.canManageDeveloperProjects,
      canReviewBookingRequests: marketplaceCapabilities.canReviewBookingRequests,
      canUseMediaQuality: marketplaceCapabilities.canUseMediaQuality,
      canUseVerification: marketplaceCapabilities.canUseVerification,
      canUsePerformance: marketplaceCapabilities.canUsePerformance,
      canAccessAdmin: marketplaceCapabilities.canAccessAdmin,
      loading,
      login,
      register,
      updateProfile,
      refreshUser,
      completeOAuthLogin,
      replaceSession,
      logout
    }),
    [
      user,
      token,
      loading,
      login,
      register,
      updateProfile,
      refreshUser,
      completeOAuthLogin,
      replaceSession,
      logout
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
