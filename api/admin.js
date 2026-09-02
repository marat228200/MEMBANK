import { getSupabase } from "./_supabase.js";

async function isAdmin(supabase, visitorId) {
  if (!visitorId) return false;
  const { data } = await supabase
    .from("admin_ids")
    .select("visitor_id")
    .eq("visitor_id", visitorId)
    .maybeSingle();
  return !!data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method not allowed");
  }

  const supabase = getSupabase();
  const { action, visitorId } = req.body || {};

  if (action === "login") {
    const { password } = req.body || {};
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "wrong_password" });
    }
    if (!visitorId) return res.status(400).json({ error: "missing_visitor_id" });
    await supabase.from("admin_ids").upsert({ visitor_id: visitorId });
    return res.status(200).json({ success: true });
  }

  if (action === "check-admin") {
    const admin = await isAdmin(supabase, visitorId);
    return res.status(200).json({ isAdmin: admin });
  }

  const admin = await isAdmin(supabase, visitorId);
  if (!admin) return res.status(403).json({ error: "not_admin" });

  if (action === "list") {
    const { data: blocked } = await supabase.from("blocked_authors").select("author_id");
    const { data: admins } = await supabase.from("admin_ids").select("visitor_id");
    return res.status(200).json({
      blockedIds: (blocked || []).map((r) => r.author_id),
      adminIds: (admins || []).map((r) => r.visitor_id),
    });
  }

  if (action === "delete-meme") {
    const { memeId } = req.body || {};
    if (!memeId) return res.status(400).json({ error: "missing_meme_id" });
    const { error } = await supabase.from("memes").delete().eq("id", memeId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === "block-author") {
    const { authorId } = req.body || {};
    if (!authorId) return res.status(400).json({ error: "missing_author_id" });
    const { error } = await supabase.from("blocked_authors").upsert({ author_id: authorId });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === "unblock-author") {
    const { authorId } = req.body || {};
    if (!authorId) return res.status(400).json({ error: "missing_author_id" });
    const { error } = await supabase.from("blocked_authors").delete().eq("author_id", authorId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === "promote-admin") {
    const { targetId } = req.body || {};
    if (!targetId) return res.status(400).json({ error: "missing_target_id" });
    const { error } = await supabase.from("admin_ids").upsert({ visitor_id: targetId });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (action === "revoke-admin") {
    const { targetId } = req.body || {};
    if (!targetId) return res.status(400).json({ error: "missing_target_id" });
    const { error } = await supabase.from("admin_ids").delete().eq("visitor_id", targetId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: "unknown_action" });
}
