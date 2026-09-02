import { getSupabase } from "./_supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method not allowed");
  }
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "missing_id" });

  const supabase = getSupabase();
  const { data: current, error: fetchError } = await supabase
    .from("memes")
    .select("likes")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !current) return res.status(404).json({ error: "not_found" });

  const { data: updated, error: updateError } = await supabase
    .from("memes")
    .update({ likes: (current.likes || 0) + 1 })
    .eq("id", id)
    .select("likes")
    .single();
  if (updateError) return res.status(500).json({ error: updateError.message });

  return res.status(200).json({ likes: updated.likes });
}
