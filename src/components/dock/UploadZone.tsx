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
  className?: string;
}

export function UploadZone({ onFiles, uploading, progress, disabled, className }: Props) {
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
        "relative flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed p-12 text-center transition-all duration-300",
        "border-primary/30 bg-sky-soft/50 hover:bg-sky-soft/80",
        isDragging && "border-primary bg-sky-soft scale-[0.99]",
        disabled && "opacity-60 cursor-not-allowed",
        className
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

      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-card shadow-sm border border-primary/10">
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <CloudUpload className="h-8 w-8 text-primary" />
        )}
      </div>

      <h3 className="text-xl font-bold text-foreground">
        {uploading ? "Uploading items..." : "Drag & drop files here"}
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        or click to browse from your computer
      </p>

      {uploading ? (
        <div className="mt-6 w-full max-w-xs">
          <Progress value={progress} className="h-1.5" />
          <p className="mt-2 text-xs font-semibold text-primary">{Math.round(progress)}%</p>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="mt-8 rounded-lg bg-primary px-8 py-6 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
        >
          Browse Files
        </Button>
      )}
    </div>
  );
}
