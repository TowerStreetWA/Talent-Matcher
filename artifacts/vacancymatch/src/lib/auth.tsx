import React, { createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe,
  useLogout,
  getGetMeQueryKey,
  type AuthUser,
} from "@workspace/api-client-react";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => void;
  isLoggingOut: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: 60_000,
    },
  });

  const logoutMutation = useLogout({
    mutation: {
      onSettled: () => {
        queryClient.clear();
      },
    },
  });

  const value: AuthContextValue = {
    user: !isError && data ? data : null,
    isLoading,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useInvalidateMe(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };
}
