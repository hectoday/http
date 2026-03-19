import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth.tsx";
import { meOptions } from "../api/queries.ts";

export function useSession() {
  const { token, user, logout, setUser } = useAuth();
  const navigate = useNavigate();

  const meQuery = useQuery({
    ...meOptions(token!),
    enabled: !!token && !user,
  });

  useEffect(() => {
    if (meQuery.data && !user) setUser(meQuery.data);
  }, [meQuery.data, user, setUser]);

  useEffect(() => {
    if (meQuery.error) {
      logout();
      void navigate({ to: "/login" });
    }
  }, [meQuery.error, logout, navigate]);

  return { token, user, logout, isLoading: meQuery.isLoading && !user };
}
