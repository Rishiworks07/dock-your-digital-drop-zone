import { useCallback, useRef, useState, type DragEvent } from "react";
import { CloudUpload, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Props {
  onFiles: (files: File[]) => Promise<void>;
  uploading: boolean;
  progress: number;
  disabled?: boolean;
}

export function UploadZone({ onFiles, uploading, progress, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length) await onFiles(files);
  }, [onFiles, disabled]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
      onDrop={handleDrop}
      className={cn(
        "relative rounded-2xl border-2 border-dashed p-10 md:p-14 text-center transition-base",
        "border-primary/40 bg-gradient-to-b from-sky-soft to-card",
        isDragging && "border-primary bg-accent animate-pulse-ring",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) await onFiles(files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-gradient shadow-lift">
        {uploading ? <Loader2 className="h-8 w-8 animate-spin text-white" /> : <CloudUpload className="h-8 w-8 text-white" />}
      </div>
      <h3 className="mt-4 text-xl font-semibold text-foreground">
        {uploading ? "Uploading…" : "Drag & drop files here"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        or paste anything (Ctrl+V)
      </p>

      {uploading ? (
        <div className="mx-auto mt-4 max-w-xs">
          <Progress value={progress} />
          <p className="mt-1 text-xs text-muted-foreground">{Math.round(progress)}%</p>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="mt-4 rounded-lg border-primary/30 bg-card text-primary hover:bg-accent"
        >
          <FolderOpen className="h-4 w-4" />
          Browse Files
        </Button>
      )}
    </div>
  );
}
