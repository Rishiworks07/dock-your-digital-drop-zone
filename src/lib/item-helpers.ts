export type ItemType = "note" | "image" | "file" | "link" | "video" | "code";

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
export const STORAGE_LIMIT = 5 * 1024 * 1024 * 1024; // 5 GB

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} d ago`;
  return d.toLocaleDateString();
}

export function detectFileType(file: File): ItemType {
  const t = file.type;
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  const codeExt = /\.(js|jsx|ts|tsx|py|html|css|json|md|java|c|cpp|go|rb|rs|sh|yml|yaml)$/i;
  if (codeExt.test(file.name)) return "code";
  return "file";
}

export function detectLanguage(filename: string): string {
  const m = filename.match(/\.([a-z0-9]+)$/i);
  if (!m) return "txt";
  const ext = m[1].toLowerCase();
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    c: "c", cpp: "cpp", html: "html", css: "css", json: "json", md: "markdown",
    sh: "bash", yml: "yaml", yaml: "yaml",
  };
  return map[ext] || ext;
}

export function isUrl(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.includes("\n") || trimmed.length > 2000) return false;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getFaviconUrl(url: string): string {
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

export function fileExtBadge(filename: string | null | undefined): string {
  if (!filename) return "FILE";
  const m = filename.match(/\.([a-z0-9]+)$/i);
  return (m ? m[1] : "file").toUpperCase().slice(0, 4);
}

export function fileTypeColor(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "pdf") return "bg-red-500";
  if (["doc", "docx"].includes(e)) return "bg-blue-500";
  if (["zip", "rar", "7z"].includes(e)) return "bg-purple-500";
  if (["xls", "xlsx", "csv"].includes(e)) return "bg-green-500";
  if (["ppt", "pptx"].includes(e)) return "bg-orange-500";
  return "bg-slate-500";
}

export async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 2 * 1024 * 1024) return file;
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target?.result as string; };
    img.onload = () => {
      const maxDim = 2000;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width *= ratio; height *= ratio;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(file);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
        },
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
