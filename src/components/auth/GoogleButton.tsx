export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <div className="relative w-full">
      <div
        className="w-full h-12 rounded-2xl bg-card border border-primary/10 font-semibold text-sm text-muted-foreground/50 flex items-center justify-center gap-3 opacity-50 cursor-not-allowed select-none"
        aria-disabled="true"
      >
        <svg className="h-5 w-5 opacity-50" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.28-4.74 3.28-8.07z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.12c-.22-.66-.35-1.36-.35-2.12s.13-1.46.35-2.12V7.04H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.96l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
        </svg>
        {label}
      </div>
      <span className="absolute -top-2 right-3 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70 border border-border/50">
        Coming soon
      </span>
    </div>
  );
}
