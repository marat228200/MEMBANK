import { getSupabase } from "./utils/supabase.js";
import { moderateImage } from "./utils/moderate.js";

const BUCKET = "meme-images";

export const handler = async (event) => {
  const supabase = getSupabase();

  if (event.httpMethod === "GET") {
    const { data, error } = await supabase
      .from("memes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        memes: data.map((m) => ({
          id: m.id,
          imageUrl: m.image_url,
          caption: m.caption,
          author: m.author,
          authorId: m.author_id,
          likes: m.likes,
          reports: m.reports || 0,
          timestamp: new Date(m.created_at).getTime(),
        })),
      }),
    };
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body || "{}");
      const { imageData, caption, author, visitorId } = body;
      if (!imageData || !visitorId) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing_fields" }) };
      }
      if (typeof imageData !== "string" || imageData.length > 8_000_000) {
        return { statusCode: 400, body: JSON.stringify({ error: "image_too_large" }) };
      }

      const { data: blockedRow } = await supabase
        .from("blocked_authors")
        .select("author_id")
        .eq("author_id", visitorId)
        .maybeSingle();
      if (blockedRow) {
        return { statusCode: 403, body: JSON.stringify({ error: "blocked" }) };
      }

      let check = { flagged: false, reason: "" };
      try {
        check = await moderateImage(imageData);
      } catch (e) {
        check = { flagged: false, reason: "" };
      }
      if (check.flagged) {
        return { statusCode: 422, body: JSON.stringify({ error: "flagged", reason: check.reason }) };
      }

      let imageUrl = imageData;
      if (imageData.startsWith("data:")) {
        const match = imageData.match(/^data:(.*?);base64,(.*)$/);
        if (!match) return { statusCode: 400, body: JSON.stringify({ error: "bad_image_data" }) };
        const mimeType = match[1];
        const ext = mimeType.split("/")[1] || "jpg";
        const buffer = Buffer.from(match[2], "base64");
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, buffer, { contentType: mimeType, upsert: false });
        if (uploadError) {
          return {
            statusCode: 500,
            body: JSON.stringify({ error: "upload_failed", detail: uploadError.message }),
          };
        }
        const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        imageUrl = publicUrlData.publicUrl;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("memes")
        .insert({
          image_url: imageUrl,
          caption: (caption || "").slice(0, 140),
          author: (author || "").slice(0, 40),
          author_id: visitorId,
          likes: 0,
        })
        .select()
        .single();
      if (insertError) return { statusCode: 500, body: JSON.stringify({ error: insertError.message }) };

      return {
        statusCode: 201,
        body: JSON.stringify({
          meme: {
            id: inserted.id,
            imageUrl: inserted.image_url,
            caption: inserted.caption,
            author: inserted.author,
            authorId: inserted.author_id,
            likes: inserted.likes,
            reports: 0,
            timestamp: new Date(inserted.created_at).getTime(),
          },
        }),
      };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: "server_error", detail: err.message }) };
    }
  }

  return { statusCode: 405, body: "Method not allowed" };
};
