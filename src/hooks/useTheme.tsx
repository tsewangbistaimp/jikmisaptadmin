import * as React from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

// The app now ships a single light theme (matching the Travelgo-style
// redesign). Dark mode support is intentionally disabled — this provider is
// kept around so components that call useTheme() don't need to change, but
// it always resolves to "light" and never touches the `dark` class.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    document.documentElement.classList.remove("dark");
    window.localStorage.removeItem("jikmis-theme");
  }, []);

  const toggleTheme = React.useCallback(() => {
    // no-op: dark mode is disabled
  }, []);

  return <ThemeContext.Provider value={{ theme: "light", toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
