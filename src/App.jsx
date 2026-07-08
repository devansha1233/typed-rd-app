import { useState, useRef, useEffect } from "react";
import { Send, Plus, Bell, X, Loader2, Menu, Trash2 } from "lucide-react";

// Uses Google's Gemini API — free tier, no credit card required.
// Get a free key at https://aistudio.google.com/apikey
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hey RD! I'm RD, your assistant — I can chat, search the web, and remember things for you. Type a message below to get started.",
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [reminderText, setReminderText] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [memories, setMemories] = useState(["My name is RD"]);

  const scrollRef = useRef(null);
  const timeoutsRef = useRef([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("rd_memories");
      if (stored) setMemories(JSON.parse(stored));
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    return () => timeoutsRef.current.forEach((t) => clearTimeout(t));
  }, []);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  function saveMemories(next) {
    setMemories(next);
    try {
      localStorage.setItem("rd_memories", JSON.stringify(next));
    } catch (e) {}
  }

  function extractMemoryCandidate(userText) {
    const triggers = ["remember that", "remember i", "remember my", "don't forget", "for future reference"];
    const lower = userText.toLowerCase();
    for (const t of triggers) {
      if (lower.includes(t)) return userText;
    }
    return null;
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || thinking) return;

    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setThinking(true);
    requestAnimationFrame(autoResize);

    const memoryNote = extractMemoryCandidate(text);
    if (memoryNote) {
      saveMemories([...memories, memoryNote]);
    }

    try {
      const memoryContext =
        memories.length > 0
          ? `\n\nThings you know about this user from earlier: ${memories.join("; ")}`
          : "";

      if (!GEMINI_API_KEY) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "No API key is set up yet. Add VITE_GEMINI_API_KEY to your hosting environment variables to enable real replies.",
          },
        ]);
        setThinking(false);
        return;
      }

      const contents = nextMessages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [
                {
                  text:
                    "You are RD, a warm, capable personal assistant with memory. If asked your name, say your name is RD. Talk naturally and concretely. You have broad general knowledge — confidently answer questions about history, historical figures (like Chhatrapati Shivaji Maharaj, Mughal emperors, or any other historical topic), geography, science, and culture directly from what you know. If the user asks what you remember about them, answer directly from the list of things you know about this user below." +
                    memoryContext,
                },
              ],
            },
            tools: [{ google_search: {} }],
          }),
        }
      );

      const data = await response.json();
      const combined = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";

      setMessages((prev) => [...prev, { role: "assistant", text: combined || "I didn't catch that — could you try again?" }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Something went wrong reaching the model. Try again in a moment." }]);
    } finally {
      setThinking(false);
    }
  }

  function addReminder() {
    if (!reminderText.trim() || !reminderTime) return;
    const [h, m] = reminderTime.split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const msUntil = target - now;

    const id = Date.now();
    setReminders((prev) => [...prev, { id, text: reminderText.trim(), time: reminderTime }]);

    const timeoutId = setTimeout(() => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Reminder", { body: reminderText.trim() });
      }
      setMessages((prev) => [...prev, { role: "assistant", text: `⏰ Reminder: ${reminderText.trim()}` }]);
    }, msUntil);
    timeoutsRef.current.push(timeoutId);

    setReminderText("");
    setReminderTime("");
  }

  function removeReminder(id) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  function removeMemory(idx) {
    saveMemories(memories.filter((_, i) => i !== idx));
  }

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#FFFFFF",
        color: "#1F1F1F",
        height: "100vh",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />

      <div
        style={{
          width: sidebarOpen ? 270 : 0,
          flexShrink: 0,
          background: "#F7F7F8",
          borderRight: sidebarOpen ? "1px solid #E5E5E5" : "none",
          overflow: "hidden",
          transition: "width 0.2s ease",
        }}
      >
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20, width: 270, overflowY: "auto", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 0" }}>
            <img src="/icon.png" alt="" style={{ width: 28, height: 28, borderRadius: 7 }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>RD</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#555" }}>
              <Bell size={14} /> Reminders
            </div>
            <input
              value={reminderText}
              onChange={(e) => setReminderText(e.target.value)}
              placeholder="Remind me to…"
              style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", color: "#1F1F1F" }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                style={{ flex: 1, background: "#fff", border: "1px solid #E5E5E5", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", color: "#1F1F1F" }}
              />
              <button
                onClick={addReminder}
                style={{ background: "#1FA6D9", border: "none", borderRadius: 8, width: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                aria-label="Add reminder"
              >
                <Plus size={15} color="#fff" />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {reminders.length === 0 && <div style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>Nothing set yet.</div>}
              {reminders.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: "1px solid #E5E5E5", borderRadius: 8, padding: "7px 10px" }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{r.text}</div>
                    <div style={{ fontSize: 11, color: "#1FA6D9" }}>{r.time}</div>
                  </div>
                  <button onClick={() => removeReminder(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999" }} aria-label="Remove reminder">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid #E5E5E5", paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>What I remember</div>
            <div style={{ fontSize: 11, color: "#999", marginTop: -4 }}>
              Say "remember that…" and I'll save it here, on this device.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {memories.length === 0 && <div style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>Nothing saved yet.</div>}
              {memories.map((mem, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, background: "#fff", border: "1px solid #E5E5E5", borderRadius: 8, padding: "7px 10px" }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>{mem}</div>
                  <button onClick={() => removeMemory(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#999", flexShrink: 0 }} aria-label="Forget this">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid #ECECEC", flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: 4 }} aria-label="Toggle menu">
            <Menu size={19} />
          </button>
          <div style={{ fontWeight: 600, fontSize: 15 }}>RD</div>
          {thinking && (
            <div style={{ fontSize: 12, color: "#999", display: "flex", alignItems: "center", gap: 5 }}>
              <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
              thinking
            </div>
          )}
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 0" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: 4 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "14px 4px", alignItems: "flex-start" }}>
                {m.role === "user" ? (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      flexShrink: 0,
                      background: "#DCE7FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#3559C7",
                    }}
                  >
                    Y
                  </div>
                ) : (
                  <img src="/icon.png" alt="" style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0 }} />
                )}
                <div style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap", paddingTop: 3 }}>{m.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 20px 20px", flexShrink: 0 }}>
          <div
            style={{
              maxWidth: 720,
              margin: "0 auto",
              display: "flex",
              alignItems: "flex-end",
              gap: 6,
              background: "#fff",
              border: "1px solid #D9D9E3",
              borderRadius: 16,
              padding: "10px 10px 10px 16px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message RD…"
              rows={1}
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: 15,
                fontFamily: "inherit",
                lineHeight: 1.5,
                maxHeight: 160,
                color: "#1F1F1F",
                background: "transparent",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={thinking || !input.trim()}
              style={{
                background: input.trim() ? "#1FA6D9" : "#E5E5E5",
                border: "none",
                borderRadius: 10,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: input.trim() && !thinking ? "pointer" : "default",
                flexShrink: 0,
              }}
              aria-label="Send message"
            >
              <Send size={14} color={input.trim() ? "#fff" : "#999"} />
            </button>
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#B3B3B3", marginTop: 8 }}>
            Chats, remembers, searches the web. For voice, use your keyboard's mic key.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        textarea::placeholder { color: #A0A0A0; }
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-thumb { background: #D9D9D9; border-radius: 4px; }
      `}</style>
    </div>
  );
  }
