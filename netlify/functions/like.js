import { getSupabase } from "./utils/supabase.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  const { id } = JSON.parse(event.body || "{}");
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: "missing_id" }) };

  const supabase = getSupabase();
  const { data: current, error: fetchError } = await supabase
    .from("memes")
    .select("likes")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !current) return { statusCode: 404, body: JSON.stringify({ error: "not_found" }) };

  const { data: updated, error: updateError } = await supabase
    .from("memes")
    .update({ likes: (current.likes || 0) + 1 })
    .eq("id", id)
    .select("likes")
    .single();
  if (updateError) return { statusCode: 500, body: JSON.stringify({ error: updateError.message }) };

  return { statusCode: 200, body: JSON.stringify({ likes: updated.likes }) };
};
