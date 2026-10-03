import { getSupabase } from "./utils/supabase.js";

const HIDE_THRESHOLD = 3;

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }
  const { id } = JSON.parse(event.body || "{}");
  if (!id) return { statusCode: 400, body: JSON.stringify({ error: "missing_id" }) };

  const supabase = getSupabase();
  const { data: current, error: fetchError } = await supabase
    .from("memes")
    .select("reports")
    .eq("id", id)
    .maybeSingle();
  if (fetchError || !current) return { statusCode: 404, body: JSON.stringify({ error: "not_found" }) };

  const newReports = (current.reports || 0) + 1;
  const { error: updateError } = await supabase
    .from("memes")
    .update({ reports: newReports })
    .eq("id", id);
  if (updateError) return { statusCode: 500, body: JSON.stringify({ error: updateError.message }) };

  return {
    statusCode: 200,
    body: JSON.stringify({ reports: newReports, hidden: newReports >= HIDE_THRESHOLD }),
  };
};
