import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiRequestError, loginCreator } from "../api/creatorClient";
import { useAuth } from "../auth/AuthProvider";

export function LoginPage() {
  const { token, setSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/creator/stories/new";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (token) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await loginCreator({ email: email.trim(), password });
      setSession(data.access_token, data.creator);
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? typeof err.body === "object" && err.body && "message" in err.body
            ? String((err.body as { message?: string }).message)
            : err.message
          : "Sign-in failed.";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page narrow">
      <h1 className="page-title">Sign in</h1>
      <p className="page-lead">Use your Storywall creator account.</p>
      <form className="card form-card" onSubmit={onSubmit}>
        {error ? <div className="banner error">{error}</div> : null}
        <label className="field">
          <span className="label">Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: "1rem" }}>
        No account? <Link to="/register">Create one</Link>
      </p>
    </div>
  );
}
