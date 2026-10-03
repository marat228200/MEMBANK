import { getSupabase } from "./utils/supabase.js";

async function isAdmin(supabase, visitorId) {
  if (!visitorId) return false;
  const { data } = await supabase
    .from("admin_ids")
    .select("visitor_id")
    .eq("visitor_id", visitorId)
    .maybeSingle();
  return !!data;
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const supabase = getSupabase();
  const body = JSON.parse(event.body || "{}");
  const { action, visitorId } = body;

  if (action === "login") {
    const { password } = body;
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: "wrong_password" }) };
    }
    if (!visitorId) return { statusCode: 400, body: JSON.stringify({ error: "missing_visitor_id" }) };
    await supabase.from("admin_ids").upsert({ visitor_id: visitorId });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (action === "check-admin") {
    const admin = await isAdmin(supabase, visitorId);
    return { statusCode: 200, body: JSON.stringify({ isAdmin: admin }) };
  }

  const admin = await isAdmin(supabase, visitorId);
  if (!admin) return { statusCode: 403, body: JSON.stringify({ error: "not_admin" }) };

  if (action === "list") {
    const { data: blocked } = await supabase.from("blocked_authors").select("author_id");
    const { data: admins } = await supabase.from("admin_ids").select("visitor_id");
    return {
      statusCode: 200,
      body: JSON.stringify({
        blockedIds: (blocked || []).map((r) => r.author_id),
        adminIds: (admins || []).map((r) => r.visitor_id),
      }),
    };
  }

  if (action === "delete-meme") {
    const { memeId } = body;
    if (!memeId) return { statusCode: 400, body: JSON.stringify({ error: "missing_meme_id" }) };
    const { error } = await supabase.from("memes").delete().eq("id", memeId);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (action === "block-author") {
    const { authorId } = body;
    if (!authorId) return { statusCode: 400, body: JSON.stringify({ error: "missing_author_id" }) };
    const { error } = await supabase.from("blocked_authors").upsert({ author_id: authorId });
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (action === "unblock-author") {
    const { authorId } = body;
    if (!authorId) return { statusCode: 400, body: JSON.stringify({ error: "missing_author_id" }) };
    const { error } = await supabase.from("blocked_authors").delete().eq("author_id", authorId);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (action === "promote-admin") {
    const { targetId } = body;
    if (!targetId) return { statusCode: 400, body: JSON.stringify({ error: "missing_target_id" }) };
    const { error } = await supabase.from("admin_ids").upsert({ visitor_id: targetId });
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (action === "revoke-admin") {
    const { targetId } = body;
    if (!targetId) return { statusCode: 400, body: JSON.stringify({ error: "missing_target_id" }) };
    const { error } = await supabase.from("admin_ids").delete().eq("visitor_id", targetId);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  if (action === "reset-reports") {
    const { memeId } = body;
    if (!memeId) return { statusCode: 400, body: JSON.stringify({ error: "missing_meme_id" }) };
    const { error } = await supabase.from("memes").update({ reports: 0 }).eq("id", memeId);
    if (error) return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  }

  return { statusCode: 400, body: JSON.stringify({ error: "unknown_action" }) };
};
