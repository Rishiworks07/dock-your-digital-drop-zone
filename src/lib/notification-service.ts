import { supabase } from "@/integrations/supabase/client";

export async function notifySharedSpaceActivity(userId: string, spaceId: string, action: string, itemTitle: string) {
  try {
    // 1. Get all members of the space (excluding the actor)
    const { data: members, error: membersError } = await supabase
      .from("shared_space_members")
      .select("user_id")
      .eq("space_id", spaceId)
      .neq("user_id", userId);

    if (membersError || !members) return;

    // 2. Get the actor's profile for the title
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("user_id", userId)
      .maybeSingle();

    const actorName = profile?.username ? `@${profile.username}` : "Someone";
    const { data: space } = await supabase
      .from("shared_spaces")
      .select("name")
      .eq("id", spaceId)
      .maybeSingle();

    // 3. Create notifications for each member
    const notifications = members.map(m => ({
      user_id: m.user_id,
      type: "file_shared",
      title: `${actorName} shared a new ${action} in "${space?.name ?? "Shared Space"}"`,
      body: itemTitle,
      metadata: { space_id: spaceId, item_title: itemTitle },
      expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
    }));

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }
  } catch (error) {
    console.error("Failed to send shared space notifications:", error);
  }
}

export async function checkExpiringItems(userId: string) {
  try {
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // 1. Find items in the dock (no space_id, not vaulted) that expire in < 1 hour
    // Wait, the items table doesn't have an "expires_at" column, but it has "created_at"
    // and items in the dock auto-delete after 24h.
    // So created_at + 23h < now
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: items } = await supabase
      .from("items")
      .select("id, title, file_name, created_at")
      .eq("user_id", userId)
      .is("space_id", null)
      .eq("is_vaulted", false)
      .lt("created_at", twentyThreeHoursAgo)
      .gt("created_at", twentyFourHoursAgo);

    if (!items || items.length === 0) return;

    for (const item of items) {
      // 2. Check if we already sent an "expiring_soon" notification for this item
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "expiring_soon")
        .eq("metadata->>item_id", item.id);

      if (count === 0) {
        // 3. Create the notification
        await supabase.from("notifications").insert({
          user_id: userId,
          type: "expiring_soon",
          title: "Item expiring soon!",
          body: `"${item.title || item.file_name}" will be deleted in less than an hour. Move it to the Vault to keep it permanently.`,
          metadata: { item_id: item.id },
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
      }
    }
  } catch (error) {
    console.error("Failed to check expiring items:", error);
  }
}
