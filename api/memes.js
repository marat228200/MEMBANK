import { getSupabase } from "./_supabase.js";
import { moderateImage } from "./_moderate.js";

const BUCKET = "meme-images";

export default async function handler(req, res) {
  const supabase = getSupabase();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("memes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({
      memes: data.map((m) => ({
        id: m.id,
        imageUrl: m.image_url,
        caption: m.caption,
        author: m.author,
        authorId: m.author_id,
        likes: m.likes,
        timestamp: new Date(m.created_at).getTime(),
      })),
    });
  }

  if (req.method === "POST") {
    try {
      const { imageData, caption, author, visitorId } = req.body || {};
      if (!imageData || !visitorId) {
        return res.status(400).json({ error: "missing_fields" });
      }
      if (typeof imageData !== "string" || imageData.length > 8_000_000) {
        return res.status(400).json({ error: "image_too_large" });
      }

      const { data: blockedRow } = await supabase
        .from("blocked_authors")
        .select("author_id")
        .eq("author_id", visitorId)
        .maybeSingle();
      if (blockedRow) {
        return res.status(403).json({ error: "blocked" });
      }

      const check = await moderateImage(imageData);
      if (check.flagged) {
        return res.status(422).json({ error: "flagged", reason: check.reason });
      }

      let imageUrl = imageData;
      if (imageData.startsWith("data:")) {
        const match = imageData.match(/^data:(.*?);base64,(.*)$/);
        if (!match) return res.status(400).json({ error: "bad_image_data" });
        const mimeType = match[1];
        const ext = mimeType.split("/")[1] || "jpg";
        const buffer = Buffer.from(match[2], "base64");
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, buffer, { contentType: mimeType, upsert: false });
        if (uploadError) {
          return res.status(500).json({ error: "upload_failed", detail: uploadError.message });
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
      if (insertError) return res.status(500).json({ error: insertError.message });

      return res.status(201).json({
        meme: {
          id: inserted.id,
          imageUrl: inserted.image_url,
          caption: inserted.caption,
          author: inserted.author,
          authorId: inserted.author_id,
          likes: inserted.likes,
          timestamp: new Date(inserted.created_at).getTime(),
        },
      });
    } catch (err) {
      return res.status(500).json({ error: "server_error", detail: err.message });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).end("Method not allowed");
}
