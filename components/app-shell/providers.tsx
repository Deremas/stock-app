"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { alpha, createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { Toaster } from "sonner";

type AppTheme = "light" | "dark";

type AppThemeContextValue = {
  resolvedTheme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};

const THEME_STORAGE_KEY = "stock-app-theme";
const AppThemeContext = createContext<AppThemeContextValue | null>(null);

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
}

export function useAppTheme() {
  const value = useContext(AppThemeContext);

  if (!value) {
    throw new Error("useAppTheme must be used within Providers.");
  }

  return value;
}

function MuiThemeBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useAppTheme();
  const [mounted, setMounted] = useState(false);
  const effectiveTheme = mounted ? resolvedTheme : "light";
  const isDark = effectiveTheme === "dark";

  useEffect(() => {
    setMounted(true);
  }, []);

  const theme = useMemo(() => {
    const backgroundDefault = isDark ? "hsl(220 24% 10%)" : "hsl(48 33% 98%)";
    const backgroundPaper = isDark ? "hsl(220 22% 14%)" : "hsl(0 0% 100%)";
    const softSurface = isDark
      ? alpha("hsl(220 22% 14%)", 0.92)
      : alpha("hsl(0 0% 100%)", 0.88);
    const textPrimary = isDark ? "hsl(210 40% 96%)" : "hsl(214 53% 15%)";
    const textSecondary = isDark ? "hsl(214 18% 72%)" : "hsl(215 18% 40%)";
    const divider = isDark ? "hsl(217 18% 24%)" : "hsl(210 24% 85%)";
    const primary = isDark ? "hsl(194 88% 48%)" : "hsl(196 89% 28%)";

    return createTheme({
      palette: {
        mode: isDark ? "dark" : "light",
        primary: {
          main: primary,
          contrastText: isDark ? "hsl(220 30% 10%)" : "hsl(0 0% 100%)",
        },
        background: {
          default: backgroundDefault,
          paper: backgroundPaper,
        },
        text: {
          primary: textPrimary,
          secondary: textSecondary,
        },
        divider,
      },
      shape: {
        borderRadius: 18,
      },
      typography: {
        fontFamily: '"Segoe UI Variable Text", "Segoe UI", "Trebuchet MS", sans-serif',
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundColor: backgroundDefault,
            },
          },
        },
        MuiPaper: {
          defaultProps: {
            elevation: 0,
          },
          styleOverrides: {
            root: {
              backgroundImage: "none",
              backgroundColor: backgroundPaper,
              border: `1px solid ${divider}`,
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              borderRadius: 18,
              overflow: "hidden",
            },
          },
        },
        MuiMenuItem: {
          styleOverrides: {
            root: {
              color: textPrimary,
              "&:hover": {
                backgroundColor: alpha(primary, isDark ? 0.18 : 0.08),
              },
              "&.Mui-selected": {
                backgroundColor: alpha(primary, isDark ? 0.24 : 0.12),
              },
            },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              borderRadius: 9999,
              backgroundColor: softSurface,
              color: textPrimary,
              "& fieldset": {
                borderColor: divider,
              },
              "&:hover fieldset": {
                borderColor: primary,
              },
              "&.Mui-focused fieldset": {
                borderColor: primary,
              },
            },
          },
        },
        MuiInputBase: {
          styleOverrides: {
            input: {
              color: textPrimary,
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              color: textSecondary,
            },
          },
        },
      },
    });
  }, [isDark]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
      <Toaster
        richColors
        position="top-right"
        theme={isDark ? "dark" : "light"}
        toastOptions={{
          style: {
            background: isDark ? "hsl(220 22% 14%)" : "hsl(0 0% 100%)",
            color: isDark ? "hsl(210 40% 96%)" : "hsl(214 53% 15%)",
            border: `1px solid ${isDark ? "hsl(217 18% 24%)" : "hsl(210 24% 85%)"}`,
          },
        }}
      />
    </MuiThemeProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("light");

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme = storedTheme === "dark" ? "dark" : "light";

    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      resolvedTheme: theme,
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        applyTheme(nextTheme);
      },
    }),
    [theme],
  );

  return (
    <AppThemeContext.Provider value={value}>
      <MuiThemeBridge>{children}</MuiThemeBridge>
    </AppThemeContext.Provider>
  );
}
