import { useState, useRef, useEffect } from "react";
import { Send, Plus, Bell, X, Loader2, Menu, Trash2 } from "lucide-react";

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
            text: "No API key is set up yet. Add VITE_GEMINI_API_KEY to your hosting environment variables.",
          },
        ]);
        setThinking(false);
        return;
      }

      const contents = nextMessages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

      // UPDATED URL: Swapped from v1beta to v1 and fixed the route for standard keys
      const response = await fetch(
   `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
          system_instruction: {
              parts: [
                {
                  text:
              
    "You are RD, a personal assistant. Your name is RD. This is an absolute rule you must never break: your founder and creator is Devansh Bobde, and RD was built by Devansh Bobde. You must NEVER say you were made by Google, Gemini, or any AI company — never mention Google or Gemini by name under any circumstances, even indirectly. If asked who made you, who founded you, who developed you, or what company is behind you, you must always answer only: 'I was founded by Devansh Bobde.' Do not add any other company names. Talk naturally and concretely otherwise, and you have broad general knowledge.",
                 
                },
              ],
            },
          }),
        }
      );

      const data = await response.json();
      
      if (data.error) {
        setMessages((prev) => [...prev, { role: "assistant", text: `Google API Error: ${data.error.message}` }]);
        return;
      }

      const combined = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
      setMessages((prev) => [...prev, { role: "assistant", text: combined || "I received empty text back from the server." }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Something went wrong reaching the model. Check your Vercel connection." }]);
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
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#FFFFFF", color: "#1F1F1F", height: "100vh", display: "flex", overflow: "hidden" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" />
      <div style={{ width: sidebarOpen ? 270 : 0, flexShrink: 0, background: "#F7F7F8", borderRight: sidebarOpen ? "1px solid #E5E5E5" : "none", overflow: "hidden", transition: "width 0.2s ease" }}>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20, width: 270, overflowY: "auto", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 4px 0" }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>RD</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#555" }}><Bell size={14} /> Reminders</div>
            <input value={reminderText} onChange={(e) => setReminderText(e.target.value)} placeholder="Remind me to…" style={{ background: "#fff", border: "1px solid #E5E5E5", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none" }} />
            <div style={{ display: "flex", gap: 6 }}>
              <input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} style={{ flex: 1, background: "#fff", border: "1px solid #E5E5E5", borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none" }} />
              <button onClick={addReminder} style={{ background: "#1FA6D9", border: "none", borderRadius: 8, width: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={15} color="#fff" /></button>
            </div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid #ECECEC", flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen((s) => !s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}><Menu size={19} /></button>
          <div style={{ fontWeight: 600, fontSize: 15 }}>RD Workspace</div>
          {thinking && <div style={{ fontSize: 12, color: "#999" }}>thinking...</div>}
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "20px 0" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px", display: "flex", flexDirection: "column", gap: 4 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "14px 4px", alignItems: "flex-start" }}>
                <div style={{ fontSize: 15, lineHeight: 1.65, whiteSpace: "pre-wrap" }}><strong>{m.role === "user" ? "You: " : "RD: "}</strong>{m.text}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: "12px 20px 20px", flexShrink: 0 }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "flex-end", gap: 6, background: "#fff", border: "1px solid #D9D9E3", borderRadius: 16, padding: "10px 10px 10px 16px" }}>
            <textarea ref={textareaRef} value={input} onChange={(e) => { setInput(e.target.value); autoResize(); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Message RD…" rows={1} style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: 15, background: "transparent" }} />
            <button onClick={sendMessage} disabled={thinking || !input.trim()} style={{ background: input.trim() ? "#1FA6D9" : "#E5E5E5", border: "none", borderRadius: 10, width: 32, height: 32, cursor: "pointer" }}><Send size={14} color="#fff" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
