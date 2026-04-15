import { Link } from "react-router-dom";
import { API_CONTRACT_VERSION } from "@storywall/shared";
import { useAuth } from "../auth/AuthProvider";

export function HomePage() {
  const { token, creator } = useAuth();

  return (
    <div className="page narrow">
      <h1 className="page-title">Storywall</h1>
      <p className="page-lead">
        Mobile-first non-fiction story workspace. Contract baseline: <code className="inline-code">{API_CONTRACT_VERSION}</code>
      </p>
      {token ? (
        <div className="card" style={{ marginTop: "1.25rem" }}>
          <p>
            Signed in as <strong>{creator?.email}</strong>
          </p>
          <p style={{ marginTop: "0.75rem" }}>
            <Link to="/creator/stories/new" className="btn primary inline">
              New Storywall (brief intake)
            </Link>
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginTop: "1.25rem" }}>
          <p>
            <Link to="/login" className="btn primary inline">
              Sign in
            </Link>{" "}
            or{" "}
            <Link to="/register" className="btn ghost inline">
              Register
            </Link>{" "}
            to open the creator brief workspace.
          </p>
        </div>
      )}
    </div>
  );
}
