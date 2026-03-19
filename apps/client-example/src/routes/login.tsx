import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "../api/client.ts";
import { useAuth } from "../hooks/auth.tsx";
import { Spinner } from "../components/spinner.tsx";
import { cn, buttonVariant, btn, inputClass, card } from "../styles.ts";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res =
      mode === "login" ? await api.login(email, password) : await api.signup(name, email, password);

    if (res.ok) {
      login(res.data.token, res.data.user);
      void navigate({ to: "/" });
    } else {
      setError(
        typeof res.error.error === "string" ? res.error.error : JSON.stringify(res.error.error),
      );
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 font-sans antialiased">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-600 shadow-md shadow-blue-600/25">
          <svg
            className="size-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Bookmarks</h1>
        <p className="text-sm text-zinc-400">
          {mode === "login" ? "Sign in to your account" : "Create a new account"}
        </p>
      </div>

      <div className={cn(card, "w-full")}>
        {error && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === "signup" && (
            <input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputClass}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={mode === "signup" ? 6 : undefined}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading}
            className={cn(btn, buttonVariant("primary"), "w-full py-2.5")}
          >
            {loading ? <Spinner /> : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-zinc-400">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="font-medium text-blue-600 hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Have an account?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="font-medium text-blue-600 hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>

      <p className="mt-6 text-center text-[0.7rem] leading-relaxed text-zinc-300">
        Demo: alice@example.com / admin123 (token: demo-token)
        <br />
        or bob@example.com / user123 (token: user-token)
      </p>
    </div>
  );
}
