import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { CreatorWorkspaceLayout } from "./components/CreatorWorkspaceLayout";
import { DraftReadyPage } from "./pages/DraftReadyPage";
import { EditBriefPage } from "./pages/EditBriefPage";
import { FramingChoosePage } from "./pages/FramingChoosePage";
import { HomePage } from "./pages/HomePage";
import { PublicStoryPage } from "./pages/PublicStoryPage";
import { PublicStoryReferencesPage } from "./pages/PublicStoryReferencesPage";
import { PublicSourcingFaqPage } from "./pages/PublicSourcingFaqPage";
import { JobStatusPage } from "./pages/JobStatusPage";
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
        <Route path="/about/sourcing" element={<PublicSourcingFaqPage />} />
        <Route path="/stories/:slug/references" element={<PublicStoryReferencesPage />} />
        <Route path="/stories/:slug" element={<PublicStoryPage />} />
        <Route
          path="/creator/stories/new"
          element={
            <Protected>
              <NewStoryBriefPage />
            </Protected>
          }
        />
        <Route
          path="/creator/stories/:storyId"
          element={
            <Protected>
              <CreatorWorkspaceLayout />
            </Protected>
          }
        >
          <Route path="brief" element={<EditBriefPage />} />
          <Route path="framing" element={<FramingChoosePage />} />
          <Route path="jobs/:jobId" element={<JobStatusPage />} />
          <Route path="draft" element={<DraftReadyPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
