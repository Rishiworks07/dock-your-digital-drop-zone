import { supabase } from "@/integrations/supabase/client";
import {
  compressImageIfNeeded,
  detectFileType,
  detectLanguage,
  getDomain,
  getFaviconUrl,
  MAX_FILE_SIZE,
  type ItemType,
} from "./item-helpers";
import { logActivity } from "./logger";
import { notifySharedSpaceActivity } from "./notification-service";

interface UploadOptions {
  userId: string;
  usedBytes: number;
  limitBytes: number;
  spaceId?: string | null;
  isVaulted?: boolean;
}

export class UploadError extends Error {
  constructor(message: string, public code: "quota" | "size" | "type" | "network" | "unknown" = "unknown") {
    super(message);
  }
}

export async function uploadFileItem(file: File, opts: UploadOptions) {
  if (file.size > MAX_FILE_SIZE) {
    throw new UploadError("File exceeds 100 MB per-file limit");
  }
  let processed = await compressImageIfNeeded(file);
  if (opts.usedBytes + processed.size > opts.limitBytes) {
    throw new UploadError("Storage limit reached. Delete some items to free up space.", "quota");
  }
  const type: ItemType = detectFileType(processed);
  const path = `${opts.userId}/${Date.now()}_${processed.name.replace(/[^\w.\-]/g, "_")}`;
  const { error: upErr } = await supabase.storage
    .from("user-files")
    .upload(path, processed, { contentType: processed.type, upsert: false });
  if (upErr) throw new UploadError(upErr.message, "network");

  const { data: urlData } = await supabase.storage.from("user-files").createSignedUrl(path, 60 * 60 * 24 * 365);
  const file_url = urlData?.signedUrl ?? null;

  let content: string | null = null;
  let language: string | null = null;
  if (type === "code") {
    try {
      content = await processed.text();
      language = detectLanguage(processed.name);
    } catch {}
  }

  const insert = {
    user_id: opts.userId,
    space_id: opts.spaceId || null,
    is_vaulted: opts.isVaulted || false,
    type,
    title: processed.name,
    file_url,
    file_path: path,
    file_name: processed.name,
    file_size: processed.size,
    file_type: processed.type,
    thumbnail_url: type === "image" ? file_url : null,
    content,
    language,
  };
  const { data, error } = await supabase.from("items").insert(insert).select().single();
  if (error) {
    await supabase.storage.from("user-files").remove([path]);
    throw new UploadError(error.message);
  }
  
  await logActivity(opts.userId, "upload", { type, name: processed.name, size: processed.size });
  if (opts.spaceId) {
    await notifySharedSpaceActivity(opts.userId, opts.spaceId, type, processed.name);
  }
  return data;
}

export async function createNote(userId: string, title: string, content: string, tags: string[] = [], spaceId?: string | null, isVaulted?: boolean) {
  const { data, error } = await supabase
    .from("items")
    .insert({
      user_id: userId,
      space_id: spaceId || null,
      is_vaulted: isVaulted || false,
      type: "note",
      title: title || content.split("\n")[0].slice(0, 80) || "Untitled note",
      content,
      tags,
      file_size: new Blob([content]).size,
    })
    .select()
    .single();
  if (error) throw new UploadError(error.message);
  
  await logActivity(userId, "upload", { type: "note", title: data.title });
  if (spaceId) {
    await notifySharedSpaceActivity(userId, spaceId, "note", data.title);
  }
  return data;
}

export async function createLink(userId: string, url: string, spaceId?: string | null, isVaulted?: boolean) {
  const domain = getDomain(url);
  const { data, error } = await supabase
    .from("items")
    .insert({
      user_id: userId,
      space_id: spaceId || null,
      is_vaulted: isVaulted || false,
      type: "link",
      title: domain,
      link_url: url,
      link_title: domain,
      link_favicon: getFaviconUrl(url),
      file_size: 0,
    })
    .select()
    .single();
  if (error) throw new UploadError(error.message);
  
  await logActivity(userId, "upload", { type: "link", url });
  if (spaceId) {
    await notifySharedSpaceActivity(userId, spaceId, "link", url);
  }
  return data;
}


export async function deleteItem(userId: string, item: { id: string; file_path: string | null; type?: string | null; title?: string | null }) {
  if (item.file_path) {
    await supabase.storage.from("user-files").remove([item.file_path]);
  }
  const { error } = await supabase.from("items").delete().eq("id", item.id);
  if (error) throw new UploadError(error.message);
  
  await logActivity(userId, "delete", { type: item.type, title: item.title });
}
