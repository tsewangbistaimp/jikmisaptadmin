import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import "./index.css";
import App from "./App.tsx";
import MissingConfig from "./pages/MissingConfig.tsx";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { isSupabaseConfigured } from "@/lib/supabase";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {isSupabaseConfigured ? (
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster position="top-right" richColors closeButton />
          </AuthProvider>
        </BrowserRouter>
      ) : (
        <MissingConfig />
      )}
    </ThemeProvider>
  </StrictMode>
);
