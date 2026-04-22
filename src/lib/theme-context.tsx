import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";

type Theme = "light" | "dark";

interface ThemeContextValue {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>("light");
    const location = useLocation();

    const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

    useEffect(() => {
        if (isAuthPage) {
            document.documentElement.classList.remove("dark");
            return;
        }

        const saved = localStorage.getItem("theme") as Theme;
        if (saved) {
            setTheme(saved);
            document.documentElement.classList.toggle("dark", saved === "dark");
        } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            setTheme("dark");
            document.documentElement.classList.add("dark");
        }
    }, [isAuthPage]);

    const toggleTheme = () => {
        if (isAuthPage) return; // Prevent toggling on auth pages
        const newTheme = theme === "light" ? "dark" : "light";
        setTheme(newTheme);
        localStorage.setItem("theme", newTheme);
        document.documentElement.classList.toggle("dark", newTheme === "dark");
    };


    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
}
