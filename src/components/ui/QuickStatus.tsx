import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";

type StatusType = "success" | "error" | "loading" | null;

interface StatusContextType {
  showStatus: (message: string, type: StatusType, duration?: number) => void;
  hideStatus: () => void;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<StatusType>(null);
  const [visible, setVisible] = useState(false);

  const hideStatus = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setMessage(null);
      setType(null);
    }, 300);
  }, []);

  const showStatus = useCallback((msg: string, t: StatusType, duration = 2000) => {
    setMessage(msg);
    setType(t);
    setVisible(true);

    if (t !== "loading") {
      const timer = setTimeout(() => {
        hideStatus();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [hideStatus]);

  return (
    <StatusContext.Provider value={{ showStatus, hideStatus }}>
      {children}
      {message && (
        <div className={cn(
          "fixed top-6 left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 transform",
          visible ? "translate-y-0 opacity-100 scale-100" : "-translate-y-8 opacity-0 scale-95 pointer-events-none"
        )}>
          <div className={cn(
            "flex items-center gap-2.5 px-4 py-2 rounded-full border shadow-2xl backdrop-blur-md",
            type === "success" && "bg-emerald-500/90 border-emerald-400 text-white shadow-emerald-500/20",
            type === "error" && "bg-destructive/90 border-destructive/50 text-white shadow-destructive/20",
            type === "loading" && "bg-background/90 border-border text-foreground shadow-black/5"
          )}>
            {type === "success" && <CheckCircle2 className="h-4 w-4" />}
            {type === "error" && <AlertCircle className="h-4 w-4" />}
            {type === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
            
            <span className="text-xs font-bold tracking-tight whitespace-nowrap">{message}</span>
            
            {type !== "loading" && (
              <button onClick={hideStatus} className="ml-1 hover:opacity-70 transition-opacity">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </StatusContext.Provider>
  );
}

export function useStatus() {
  const context = useContext(StatusContext);
  if (!context) throw new Error("useStatus must be used within StatusProvider");
  return context;
}
