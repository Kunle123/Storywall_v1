import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ApiRequestError, registerCreator } from "../api/creatorClient";
import { useAuth } from "../auth/AuthProvider";

export function RegisterPage() {
  const { token, setSession } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (token) {
    return <Navigate to="/creator/stories/new" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const data = await registerCreator({
        email: email.trim(),
        password,
        displayName: displayName.trim() || undefined,
      });
      setSession(data.access_token, data.creator);
      navigate("/creator/stories/new", { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? JSON.stringify(err.body)
          : "Registration failed.";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page narrow">
      <h1 className="page-title">Create account</h1>
      <p className="page-lead">Register as a Storywall creator.</p>
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
          <span className="label">Password (min 8 characters)</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>
        <label className="field">
          <span className="label">Display name (optional)</span>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="nickname"
          />
        </label>
        <button type="submit" className="btn primary" disabled={pending}>
          {pending ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: "1rem" }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
