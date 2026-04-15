import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { EditBriefPage } from "./pages/EditBriefPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NewStoryBriefPage } from "./pages/NewStoryBriefPage";
import { RegisterPage } from "./pages/RegisterPage";

function Protected({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/creator/stories/new"
          element={
            <Protected>
              <NewStoryBriefPage />
            </Protected>
          }
        />
        <Route
          path="/creator/stories/:storyId/brief"
          element={
            <Protected>
              <EditBriefPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
