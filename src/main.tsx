import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import App from "./app/App.tsx";
import AdminApp from "./features/admin/AdminApp.tsx";
import { ResetPasswordView } from "./features/auth/ResetPasswordView.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import "./styles/index.css";
import { useSettingsStore, applyTheme } from "./features/auth/settings-store.ts";
import { useAuthStore } from "./features/auth/auth-store.ts";
import { useAdminAuthStore } from "./features/admin/admin-store.ts";

// Apply persisted theme before first paint to avoid flash
const savedTheme = useSettingsStore.getState().theme;
applyTheme(savedTheme);

// Re-sync with the real Supabase sessions on every load — these are two
// independent sessions (see lib/supabase.ts), so both need restoring.
useAuthStore.getState().restoreSession();
useAdminAuthStore.getState().restoreSession();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        {/* Admin portal — completely separate login/signup + dashboard */}
        <Route path="/admin/*" element={<AdminApp />} />
        {/* Password reset landing page (linked from the reset email) */}
        <Route path="/reset-password" element={<ResetPasswordView />} />
        {/* Customer-facing app (everything it already did) */}
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
);
