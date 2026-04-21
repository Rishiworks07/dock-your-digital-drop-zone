export interface Item {
  id: string;
  user_id: string;
  type: "note" | "image" | "file" | "link" | "video" | "code";
  title: string | null;
  content: string | null;
  file_url: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number;
  file_type: string | null;
  thumbnail_url: string | null;
  link_url: string | null;
  link_title: string | null;
  link_favicon: string | null;
  link_image: string | null;
  language: string | null;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type FilterType = "all" | "note" | "image" | "file" | "link" | "video" | "pinned";
export type SortType = "recent" | "oldest" | "az" | "size_desc" | "size_asc";
