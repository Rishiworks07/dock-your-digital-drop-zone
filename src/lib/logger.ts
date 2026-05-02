import { supabase } from "@/integrations/supabase/client";

export type LogAction = 
  | "login" 
  | "signup" 
  | "upload" 
  | "delete" 
  | "vault_move" 
  | "shared_space_create" 
  | "shared_space_join"
  | "invite_send";

export const logActivity = async (
  userId: string | null,
  action: LogAction,
  metadata: Record<string, any> = {}
) => {
  try {
    const { error } = await (supabase as any).from("activity_logs").insert({
      user_id: userId,
      action,
      metadata,
      user_agent: typeof window !== "undefined" ? window.navigator.userAgent : "Server",
    });

    if (error) {
      console.error("Failed to log activity:", error);
    }
  } catch (err) {
    console.error("Error in logActivity:", err);
  }
};
