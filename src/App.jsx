import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart,
  Upload,
  Link2,
  X,
  ImagePlus,
  Loader2,
  Sparkles,
  RefreshCw,
  Shield,
  Trash2,
  Lock,
  LogOut,
  Ban,
} from "lucide-react";

const DISPLAY_FONT =
  "Impact, Haettenschweiler, 'Arial Narrow Bold', 'Franklin Gothic Bold', sans-serif";
const BODY_FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";
const MONO_FONT = "'Courier New', Courier, monospace";

const PAPER = "#F3EFE4";
const INK = "#1C1B18";
const YELLOW = "#FFC93C";
const RED = "#E8432B";
const TAPE = "#D8CDBB";

const ROTATIONS = [-4, -2, -1, 1, 2, 3, -3, 4];

function rotationFor(id) {
  let hash = 0;
  const s = String(id);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 1000;
  return ROTATIONS[hash % ROTATIONS.length];
}

function generateVisitorId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let letterPart = "";
  for (let i = 0; i < 5; i++) letterPart += letters[Math.floor(Math.random() * letters.length)];
  const numberPart = Math.floor(10000 + Math.random() * 90000);
  return `${letterPart}-${numberPart}`;
}

function getOrCreateVisitorId() {
  const existing = localStorage.getItem("visitor_id");
  if (existing) return existing;
  const id = generateVisitorId();
  localStorage.setItem("visitor_id", id);
  return id;
}

function resizeImage(file, maxWidth = 720, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Не удалось загрузить изображение"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function TapeStrip({ rotate }) {
  return (
    <div
      style={{
        position: "absolute",
        top: -14,
        left: "50%",
        transform: `translateX(-50%) rotate(${rotate}deg)`,
        width: 90,
        height: 26,
        background: TAPE,
        opacity: 0.85,
        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
      }}
    />
  );
}

function MemeCard({ meme, onLike, liking, isAdmin, onDelete, onBlockAuthor, blocked }) {
  const rot = rotationFor(meme.id);
  return (
    <div
      style={{
        transform: `rotate(${rot}deg)`,
        background: "#fff",
        border: `3px solid ${INK}`,
        boxShadow: "5px 5px 0px rgba(28,27,24,0.9)",
        position: "relative",
      }}
      className="p-3 pb-4 mb-6 break-inside-avoid"
    >
      <TapeStrip rotate={rot > 0 ? -8 : 8} />
      {isAdmin && (
        <div className="flex items-center gap-1 mb-2 justify-end">
          <button
            type="button"
            onClick={() => onBlockAuthor(meme.authorId)}
            disabled={blocked}
            title={blocked ? "Автор уже заблокирован" : "Заблокировать автора"}
            style={{
              fontFamily: MONO_FONT,
              fontSize: 10,
              border: `1px solid ${INK}`,
              background: blocked ? "#ddd" : "#fff",
              color: INK,
            }}
            className="px-2 py-1 flex items-center gap-1 disabled:opacity-50"
          >
            <Ban size={11} /> {blocked ? "заблокирован" : "блок автора"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(meme.id)}
            title="Удалить мем"
            style={{
              fontFamily: MONO_FONT,
              fontSize: 10,
              border: `1px solid ${INK}`,
              background: RED,
              color: "#fff",
            }}
            className="px-2 py-1 flex items-center gap-1"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
      <div style={{ border: `2px solid ${INK}`, overflow: "hidden", background: "#eee" }}>
        <img
          src={meme.imageUrl}
          alt={meme.caption || "мем"}
          style={{ width: "100%", display: "block", objectFit: "cover" }}
          loading="lazy"
        />
      </div>
      {meme.caption ? (
        <p
          style={{
            fontFamily: MONO_FONT,
            fontWeight: 700,
            fontSize: 14,
            marginTop: 10,
            color: INK,
            lineHeight: 1.3,
          }}
        >
          {meme.caption}
        </p>
      ) : null}
      <div className="flex items-center justify-between mt-2">
        <span style={{ fontFamily: MONO_FONT, fontSize: 11, color: "#8a8477" }}>
          {meme.author ? `от ${meme.author}` : "аноним"}
        </span>
        <button
          onClick={() => onLike(meme.id)}
          disabled={liking === meme.id}
          style={{
            fontFamily: MONO_FONT,
            fontWeight: 700,
            fontSize: 13,
            color: INK,
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <Heart size={16} fill={meme.likes > 0 ? RED : "none"} color={meme.likes > 0 ? RED : INK} />
          {meme.likes || 0}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("new");
  const [formOpen, setFormOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [author, setAuthor] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [filePreview, setFilePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [likingId, setLikingId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [visitorId] = useState(() => getOrCreateVisitorId());
  const [blockedIds, setBlockedIds] = useState([]);
  const [adminIds, setAdminIds] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminError, setAdminError] = useState(null);
  const [promoteIdInput, setPromoteIdInput] = useState("");
  const fileInputRef = useRef(null);

  const loadMemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memes");
      const data = await res.json();
      setMemes(Array.isArray(data.memes) ? data.memes : []);
    } catch (e) {
      setMemes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadModerationState = useCallback(async () => {
    const { ok, data } = await api("/api/admin", { action: "list", visitorId });
    if (ok) {
      setBlockedIds(data.blockedIds || []);
      setAdminIds(data.adminIds || []);
    }
  }, [visitorId]);

  useEffect(() => {
    loadMemes();
    api("/api/admin", { action: "check-admin", visitorId }).then(({ data }) => {
      if (data?.isAdmin) {
        setIsAdmin(true);
        loadModerationState();
      }
    });
  }, [loadMemes, loadModerationState, visitorId]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      setFilePreview(dataUrl);
      setUrlInput("");
    } catch (err) {
      setFormError("Не получилось обработать картинку. Попробуй другой файл.");
    }
  };

  const resetForm = () => {
    setCaption("");
    setAuthor("");
    setUrlInput("");
    setFilePreview(null);
    setFormError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const imageData = filePreview || urlInput.trim();
    if (!imageData) {
      setFormError("Добавь картинку — файлом или ссылкой.");
      return;
    }
    setSubmitting(true);
    setModerating(true);
    const { ok, status, data } = await api("/api/memes", {
      imageData,
      caption,
      author,
      visitorId,
    });
    setModerating(false);
    setSubmitting(false);

    if (!ok) {
      if (status === 403) {
        setFormError("Ты заблокирован модератором и не можешь публиковать мемы.");
      } else if (status === 422) {
        setFormError(
          `Публикация отклонена: обнаружен запрещённый контент${data.reason ? ` (${data.reason})` : ""}.`
        );
      } else {
        setFormError("Не получилось сохранить мем. Попробуй ещё раз.");
      }
      return;
    }

    setMemes((prev) => [data.meme, ...prev]);
    resetForm();
    setFormOpen(false);
  };

  const handleLike = async (id) => {
    setLikingId(id);
    const prev = memes;
    setMemes((cur) => cur.map((m) => (m.id === id ? { ...m, likes: (m.likes || 0) + 1 } : m)));
    const { ok, data } = await api("/api/like", { id });
    if (!ok) {
      setMemes(prev);
    } else {
      setMemes((cur) => cur.map((m) => (m.id === id ? { ...m, likes: data.likes } : m)));
    }
    setLikingId(null);
  };

  const handleDeleteMeme = async (id) => {
    const prev = memes;
    setMemes((cur) => cur.filter((m) => m.id !== id));
    const { ok } = await api("/api/admin", { action: "delete-meme", visitorId, memeId: id });
    if (!ok) setMemes(prev);
  };

  const handleBlockAuthor = async (authorId) => {
    if (!authorId || blockedIds.includes(authorId)) return;
    const prev = blockedIds;
    setBlockedIds((cur) => [...cur, authorId]);
    const { ok } = await api("/api/admin", { action: "block-author", visitorId, authorId });
    if (!ok) setBlockedIds(prev);
  };

  const handleUnblock = async (authorId) => {
    const prev = blockedIds;
    setBlockedIds((cur) => cur.filter((id) => id !== authorId));
    const { ok } = await api("/api/admin", { action: "unblock-author", visitorId, authorId });
    if (!ok) setBlockedIds(prev);
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    const { ok } = await api("/api/admin", {
      action: "login",
      visitorId,
      password: adminPasswordInput,
    });
    if (ok) {
      setIsAdmin(true);
      setAdminError(null);
      setAdminPasswordInput("");
      loadModerationState();
    } else {
      setAdminError("Неверный пароль");
    }
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminOpen(false);
  };

  const handlePromoteAdmin = async () => {
    const id = promoteIdInput.trim().toUpperCase();
    if (!id || adminIds.includes(id)) return;
    const prev = adminIds;
    setAdminIds((cur) => [...cur, id]);
    setPromoteIdInput("");
    const { ok } = await api("/api/admin", { action: "promote-admin", visitorId, targetId: id });
    if (!ok) setAdminIds(prev);
  };

  const handleRevokeAdmin = async (id) => {
    const prev = adminIds;
    setAdminIds((cur) => cur.filter((a) => a !== id));
    const { ok } = await api("/api/admin", { action: "revoke-admin", visitorId, targetId: id });
    if (!ok) setAdminIds(prev);
  };

  const sorted = [...memes].sort((a, b) =>
    sort === "top" ? (b.likes || 0) - (a.likes || 0) : b.timestamp - a.timestamp
  );

  return (
    <div style={{ background: PAPER, minHeight: "100vh", fontFamily: BODY_FONT }}>
      <style>{`
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
        .meme-columns { columns: 1; }
        @media (min-width: 640px) { .meme-columns { columns: 2; } }
        @media (min-width: 1024px) { .meme-columns { columns: 3; } }
      `}</style>

      <header
        style={{ borderBottom: `4px solid ${INK}`, background: PAPER, position: "sticky", top: 0, zIndex: 20 }}
        className="px-4 sm:px-8 py-4"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              style={{
                background: RED,
                color: "#fff",
                border: `3px solid ${INK}`,
                transform: "rotate(-4deg)",
                boxShadow: "3px 3px 0px rgba(28,27,24,0.9)",
              }}
              className="px-3 py-1"
            >
              <span style={{ fontFamily: DISPLAY_FONT, fontSize: 22, letterSpacing: 1 }}>МЕМБАНК</span>
            </div>
            <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: "#8a8477" }} className="hidden sm:inline">
              общая коллекция · {memes.length} шт.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAdminOpen((v) => !v)}
              title="Модерация"
              style={{
                border: `3px solid ${INK}`,
                background: isAdmin ? INK : "#fff",
                color: isAdmin ? YELLOW : INK,
                boxShadow: "3px 3px 0px rgba(28,27,24,0.9)",
              }}
              className="p-2 flex items-center justify-center"
            >
              <Shield size={16} />
            </button>
            <button
              onClick={() => setFormOpen((v) => !v)}
              style={{
                fontFamily: MONO_FONT,
                fontWeight: 700,
                background: formOpen ? INK : YELLOW,
                color: formOpen ? "#fff" : INK,
                border: `3px solid ${INK}`,
                boxShadow: "3px 3px 0px rgba(28,27,24,0.9)",
              }}
              className="px-4 py-2 flex items-center gap-2 active:translate-x-0.5 active:translate-y-0.5"
            >
              {formOpen ? <X size={16} /> : <ImagePlus size={16} />}
              {formOpen ? "Закрыть" : "Добавить мем"}
            </button>
          </div>
        </div>
      </header>

      {adminOpen && (
        <div style={{ borderBottom: `3px solid ${INK}`, background: isAdmin ? "#fff" : "#fdf8ec" }} className="px-4 sm:px-8 py-4">
          <div className="max-w-5xl mx-auto">
            {!isAdmin ? (
              <div>
                <form onSubmit={handleAdminLogin} className="flex items-center gap-2 flex-wrap">
                  <Lock size={14} style={{ color: "#8a8477" }} />
                  <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: "#8a8477" }}>Вход для модератора:</span>
                  <input
                    type="password"
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="пароль"
                    style={{ border: `2px solid ${INK}`, fontFamily: MONO_FONT, fontSize: 13 }}
                    className="py-1 px-2 outline-none"
                  />
                  <button
                    type="submit"
                    style={{ fontFamily: MONO_FONT, fontWeight: 700, fontSize: 12, border: `2px solid ${INK}`, background: INK, color: "#fff" }}
                    className="px-3 py-1.5"
                  >
                    Войти
                  </button>
                  {adminError && <span style={{ fontFamily: MONO_FONT, fontSize: 12, color: RED }}>{adminError}</span>}
                </form>
                <p style={{ fontFamily: MONO_FONT, fontSize: 11, color: "#8a8477" }} className="mt-3">
                  Твой ID посетителя: <span style={{ fontWeight: 700, color: INK }}>{visitorId}</span> — дай его
                  админу сайта, чтобы он выдал тебе права модератора без пароля.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span style={{ fontFamily: MONO_FONT, fontWeight: 700, fontSize: 13, color: INK }} className="flex items-center gap-2">
                    <Shield size={14} /> Режим модератора включён — кнопки удаления и блокировки на карточках ниже.
                  </span>
                  <button onClick={handleAdminLogout} style={{ fontFamily: MONO_FONT, fontSize: 12, color: "#8a8477" }} className="flex items-center gap-1">
                    <LogOut size={13} /> выйти
                  </button>
                </div>

                <div className="mb-4">
                  <p style={{ fontFamily: MONO_FONT, fontSize: 12, color: "#8a8477" }} className="mb-2">
                    Выдать права модератора по ID:
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="text"
                      value={promoteIdInput}
                      onChange={(e) => setPromoteIdInput(e.target.value.toUpperCase())}
                      placeholder="HDRTU-81037"
                      style={{ border: `2px solid ${INK}`, fontFamily: MONO_FONT, fontSize: 13 }}
                      className="py-1 px-2 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handlePromoteAdmin}
                      style={{ fontFamily: MONO_FONT, fontWeight: 700, fontSize: 12, border: `2px solid ${INK}`, background: YELLOW, color: INK }}
                      className="px-3 py-1.5"
                    >
                      Выдать права
                    </button>
                  </div>
                  {adminIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {adminIds.map((id) => (
                        <button
                          key={id}
                          onClick={() => handleRevokeAdmin(id)}
                          title="Забрать права"
                          style={{ fontFamily: MONO_FONT, fontSize: 11, border: `1px solid ${INK}`, background: "#fff" }}
                          className="px-2 py-1 flex items-center gap-1"
                        >
                          <Shield size={10} /> {id} <X size={10} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {blockedIds.length > 0 && (
                  <div>
                    <p style={{ fontFamily: MONO_FONT, fontSize: 12, color: "#8a8477" }} className="mb-2">
                      Заблокировано авторов: {blockedIds.length}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {blockedIds.map((id) => (
                        <button
                          key={id}
                          onClick={() => handleUnblock(id)}
                          title="Разблокировать"
                          style={{ fontFamily: MONO_FONT, fontSize: 11, border: `1px solid ${INK}`, background: "#fff" }}
                          className="px-2 py-1 flex items-center gap-1"
                        >
                          {id} <X size={10} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-8">
        {formOpen && (
          <form
            onSubmit={handleSubmit}
            style={{ border: `3px solid ${INK}`, background: "#fff", boxShadow: "6px 6px 0px rgba(28,27,24,0.9)" }}
            className="p-5 mb-10"
          >
            <p style={{ fontFamily: MONO_FONT, fontSize: 12, color: "#8a8477" }} className="mb-1">
              Мем увидят все — коллекция общая для всех посетителей сайта.
            </p>
            <p style={{ fontFamily: MONO_FONT, fontSize: 12, color: "#8a8477" }} className="mb-4">
              Каждое изображение автоматически проверяется на нацистскую/экстремистскую символику и разжигание ненависти перед публикацией.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label style={{ fontFamily: MONO_FONT, fontWeight: 700, fontSize: 12 }} className="block mb-2">
                  Загрузить файл
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `2px dashed ${INK}`, color: INK }}
                  className="w-full py-3 flex items-center justify-center gap-2 text-sm"
                >
                  <Upload size={16} /> Выбрать картинку
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
                {filePreview && (
                  <img src={filePreview} alt="превью" style={{ border: `2px solid ${INK}` }} className="mt-3 max-h-32 object-cover" />
                )}
              </div>

              <div>
                <label style={{ fontFamily: MONO_FONT, fontWeight: 700, fontSize: 12 }} className="block mb-2">
                  Или вставить ссылку на картинку
                </label>
                <div className="flex items-center gap-2" style={{ border: `2px solid ${INK}` }}>
                  <Link2 size={16} className="ml-2" style={{ color: "#8a8477" }} />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value);
                      setFilePreview(null);
                    }}
                    placeholder="https://..."
                    style={{ fontFamily: BODY_FONT, fontSize: 14 }}
                    className="w-full py-2 pr-2 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label style={{ fontFamily: MONO_FONT, fontWeight: 700, fontSize: 12 }} className="block mb-2">
                  Подпись
                </label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={140}
                  placeholder="когда дедлайн завтра"
                  style={{ border: `2px solid ${INK}`, fontFamily: BODY_FONT, fontSize: 14 }}
                  className="w-full py-2 px-3 outline-none"
                />
              </div>
              <div>
                <label style={{ fontFamily: MONO_FONT, fontWeight: 700, fontSize: 12 }} className="block mb-2">
                  Автор (необязательно)
                </label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  maxLength={40}
                  placeholder="аноним"
                  style={{ border: `2px solid ${INK}`, fontFamily: BODY_FONT, fontSize: 14 }}
                  className="w-full py-2 px-3 outline-none"
                />
              </div>
            </div>

            {formError && (
              <p style={{ fontFamily: MONO_FONT, fontSize: 12, color: RED }} className="mt-3">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{ fontFamily: MONO_FONT, fontWeight: 700, background: RED, color: "#fff", border: `3px solid ${INK}`, boxShadow: "3px 3px 0px rgba(28,27,24,0.9)" }}
              className="mt-5 px-5 py-2 flex items-center gap-2 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {moderating ? "Проверяем изображение..." : submitting ? "Публикуем..." : "Опубликовать мем"}
            </button>
          </form>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {[
              { key: "new", label: "новые" },
              { key: "top", label: "топ" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                style={{
                  fontFamily: MONO_FONT,
                  fontWeight: 700,
                  fontSize: 12,
                  border: `2px solid ${INK}`,
                  background: sort === opt.key ? INK : "transparent",
                  color: sort === opt.key ? "#fff" : INK,
                }}
                className="px-3 py-1.5"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={loadMemes} style={{ fontFamily: MONO_FONT, fontSize: 12, color: "#8a8477" }} className="flex items-center gap-1">
            <RefreshCw size={13} /> обновить
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-20 justify-center" style={{ color: "#8a8477" }}>
            <Loader2 className="animate-spin" size={18} />
            <span style={{ fontFamily: MONO_FONT, fontSize: 13 }}>грузим мемы...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div style={{ border: `3px dashed ${INK}`, color: "#8a8477" }} className="py-20 text-center">
            <p style={{ fontFamily: DISPLAY_FONT, fontSize: 28, color: INK }}>ПУСТО</p>
            <p style={{ fontFamily: MONO_FONT, fontSize: 13 }} className="mt-2">
              Пока ни одного мема. Нажми «Добавить мем» и стань первым.
            </p>
          </div>
        ) : (
          <div className="meme-columns" style={{ columnGap: 24 }}>
            {sorted.map((meme) => (
              <MemeCard
                key={meme.id}
                meme={meme}
                onLike={handleLike}
                liking={likingId}
                isAdmin={isAdmin}
                onDelete={handleDeleteMeme}
                onBlockAuthor={handleBlockAuthor}
                blocked={meme.authorId ? blockedIds.includes(meme.authorId) : false}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
                                         }
