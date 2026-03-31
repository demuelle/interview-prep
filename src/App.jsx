import { useState, useRef, useEffect } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "c1prep_history_v1";

const CATEGORIES = [
  {
    id: "system-design",
    label: "System Design",
    icon: "⬡",
    color: "#00d4ff",
    description: "Distributed systems, scalability, financial-grade reliability",
    timerSeconds: 45 * 60,
  },
  {
    id: "behavioral",
    label: "Behavioral / Leadership",
    icon: "◈",
    color: "#a78bfa",
    description: "Influence, ambiguity, technical direction, mentorship",
    timerSeconds: 3 * 60,
  },
  {
    id: "coding",
    label: "Coding / DSA",
    icon: "▸",
    color: "#34d399",
    description: "Graphs, DP, concurrency, clean OOP design",
    timerSeconds: 20 * 60,
  },
];

const SYSTEM_PROMPT = `You are a Senior Engineering Interviewer at Capital One conducting a mock interview for a Senior Lead Software Engineer position. Capital One is a major financial technology company that processes billions of transactions and values cloud-native, distributed systems expertise.

Your role depends on the phase:

QUESTION phase: Ask exactly ONE focused interview question appropriate for the category. Make it realistic, Capital One-flavored (think: payment systems, fraud detection, data pipelines, cloud infrastructure, team leadership at scale). Do not explain or elaborate — just ask the question directly and concisely.

FOLLOWUP phase: You have already asked a question and heard their answer. Ask ONE sharp follow-up question that probes deeper — an edge case they missed, a tradeoff they glossed over, or a detail that needs clarifying. Be brief. Just the follow-up question, no preamble.

FEEDBACK phase: The candidate has answered the question and possibly a follow-up. Give structured feedback with these exact sections:
**STRENGTHS** – What they did well (2-3 points)
**GAPS** – What was missing or could be deeper (2-3 points)
**SCORE** – A rating from 1–10 with one sentence justification
**MODEL ANSWER HINT** – 2-3 sentences on what a great answer would cover

Be honest, direct, and specific. This is a Senior Lead role — hold the bar high.`;

// ─── API ─────────────────────────────────────────────────────────────────────

async function callClaude(messages) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "API error");
  return data.content.map((b) => b.text || "").join("");
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function extractScore(text) {
  const match = text.match(/\*\*SCORE\*\*[^\d]*(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// ─── Timer ───────────────────────────────────────────────────────────────────

function Timer({ totalSeconds, running, onExpire }) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const intervalRef = useRef(null);

  useEffect(() => { setRemaining(totalSeconds); }, [totalSeconds]);

  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { clearInterval(intervalRef.current); onExpire?.(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const pct = remaining / totalSeconds;
  const urgent = remaining < totalSeconds * 0.2;
  const color = urgent ? "#f87171" : remaining < totalSeconds * 0.5 ? "#fbbf24" : "#34d399";

  return (
    <div className={`timer${urgent ? " timer-urgent" : ""}`}>
      <div className="timer-ring-wrap">
        <svg viewBox="0 0 36 36" className="timer-svg">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1a2535" strokeWidth="2.5" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={color} strokeWidth="2.5"
            strokeDasharray={`${pct * 100} 100`}
            strokeLinecap="round"
            transform="rotate(-90 18 18)"
            style={{ transition: "stroke-dasharray 1s linear, stroke 0.5s" }}
          />
        </svg>
        <span className="timer-digits" style={{ color }}>{formatTime(remaining)}</span>
      </div>
      {urgent && <span className="timer-warn">time running low</span>}
    </div>
  );
}

// ─── Typewriter ───────────────────────────────────────────────────────────────

function TypewriterText({ text, speed = 16, onDone }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    setDisplayed(""); setDone(false); idx.current = 0;
    if (!text) return;
    const iv = setInterval(() => {
      idx.current++;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) { clearInterval(iv); setDone(true); onDone?.(); }
    }, speed);
    return () => clearInterval(iv);
  }, [text]);

  return <span>{displayed}{!done && <span className="cursor">▌</span>}</span>;
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  if (score === null) return null;
  const color = score >= 8 ? "#34d399" : score >= 5 ? "#fbbf24" : "#f87171";
  return (
    <div className="score-bar-wrap">
      <div className="score-label">SCORE</div>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${score * 10}%`, background: color }} />
      </div>
      <div className="score-num" style={{ color }}>{score}/10</div>
    </div>
  );
}

// ─── Feedback Block ───────────────────────────────────────────────────────────

function FeedbackBlock({ text }) {
  const sections = ["STRENGTHS", "GAPS", "SCORE", "MODEL ANSWER HINT"];
  const parts = [];
  sections.forEach((section, i) => {
    const marker = `**${section}**`;
    const next = sections[i + 1] ? `**${sections[i + 1]}**` : null;
    const start = text.indexOf(marker);
    if (start === -1) return;
    const end = next ? text.indexOf(next) : text.length;
    parts.push({ section, content: text.slice(start + marker.length, end < 0 ? undefined : end).trim() });
  });
  if (parts.length === 0) return <p className="feedback-raw">{text}</p>;
  const score = extractScore(text);
  return (
    <div className="feedback-sections">
      <ScoreBar score={score} />
      {parts.filter((p) => p.section !== "SCORE").map(({ section, content }) => (
        <div key={section} className="feedback-section">
          <div className="feedback-section-title">{section}</div>
          <div className="feedback-section-body">{content}</div>
        </div>
      ))}
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────

function HistoryPanel({ history, onClear }) {
  const [expanded, setExpanded] = useState(null);
  if (history.length === 0) return null;

  const scored = history.filter((e) => e.score !== null);
  const avgScore = scored.length
    ? (scored.reduce((s, e) => s + e.score, 0) / scored.length).toFixed(1)
    : null;

  return (
    <div className="history-panel">
      <div className="history-title-row">
        <span className="history-title">HISTORY</span>
        <span className="history-count">{history.length} completed</span>
        {avgScore && <span className="history-avg">avg <strong>{avgScore}</strong>/10</span>}
        <button className="clear-btn" onClick={onClear}>clear all</button>
      </div>
      <div className="history-list">
        {[...history].reverse().map((entry, i) => {
          const realIdx = history.length - 1 - i;
          const cat = CATEGORIES.find((c) => c.id === entry.categoryId);
          const sc = entry.score;
          const scColor = sc >= 8 ? "#34d399" : sc >= 5 ? "#fbbf24" : "#f87171";
          return (
            <div key={realIdx} className="history-entry" onClick={() => setExpanded(expanded === realIdx ? null : realIdx)}>
              <div className="history-entry-top">
                <span className="history-entry-num">#{history.length - i}</span>
                <span className="history-entry-cat" style={{ color: cat?.color }}>{cat?.icon} {entry.categoryLabel}</span>
                <span className="history-entry-date">{entry.date}</span>
                {sc !== null && <span className="history-entry-score" style={{ color: scColor }}>{sc}/10</span>}
                <span className="history-chevron">{expanded === realIdx ? "▴" : "▾"}</span>
              </div>
              <div className="history-entry-q">{entry.question}</div>
              {expanded === realIdx && (
                <div className="history-entry-detail">
                  <div>
                    <div className="history-detail-label">YOUR ANSWER</div>
                    <div className="history-detail-text">{entry.answer}</div>
                  </div>
                  {entry.followUp && (
                    <div className="history-followup-block">
                      <div className="history-detail-label">FOLLOW-UP ASKED</div>
                      <div className="history-detail-text">{entry.followUp}</div>
                      {entry.followUpAnswer && <>
                        <div className="history-detail-label" style={{ marginTop: 10 }}>YOUR FOLLOW-UP ANSWER</div>
                        <div className="history-detail-text">{entry.followUpAnswer}</div>
                      </>}
                    </div>
                  )}
                  {entry.feedback && (
                    <div className="history-feedback-wrap">
                      <FeedbackBlock text={entry.feedback} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // phases: home | question | answering | followup | followup-answering | feedback
  const [phase, setPhase] = useState("home");
  const [category, setCategory] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [questionDone, setQuestionDone] = useState(false);
  const [followUpDone, setFollowUpDone] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [history, setHistory] = useState(loadHistory);
  const answerRef = useRef(null);
  const followUpRef = useRef(null);

  useEffect(() => { saveHistory(history); }, [history]);
  useEffect(() => { if (phase === "answering") answerRef.current?.focus(); }, [phase]);
  useEffect(() => { if (phase === "followup-answering") followUpRef.current?.focus(); }, [phase]);

  function buildMessages(forPhase) {
    const base = [
      { role: "user", content: `Category: ${category.label}. Ask me one interview question.` },
      { role: "assistant", content: question },
      { role: "user", content: `My answer: ${answer}` },
    ];
    if (forPhase === "followup") return [...base, { role: "user", content: "Now ask me one sharp follow-up question." }];
    if (forPhase === "feedback-with-followup") return [
      ...base,
      { role: "user", content: "Now ask me one sharp follow-up question." },
      { role: "assistant", content: followUp },
      { role: "user", content: `My follow-up answer: ${followUpAnswer}\n\nNow give me structured feedback on my full answers.` },
    ];
    return [...base, { role: "user", content: "Now give me structured feedback." }];
  }

  async function startQuestion(cat) {
    setCategory(cat);
    setPhase("question");
    setQuestion(""); setAnswer(""); setFollowUp(""); setFollowUpAnswer(""); setFeedback("");
    setQuestionDone(false); setFollowUpDone(false);
    setTimerRunning(false); setTimerKey((k) => k + 1);
    setError(""); setLoading(true); setLoadingMsg("Generating question...");
    try {
      const q = await callClaude([{ role: "user", content: `Category: ${cat.label}. Ask me one interview question.` }]);
      setQuestion(q.trim());
    } catch (e) { setError(e.message); setPhase("home"); }
    finally { setLoading(false); }
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    setTimerRunning(false);
    setPhase("followup"); setFollowUp(""); setFollowUpDone(false);
    setLoading(true); setLoadingMsg("Generating follow-up..."); setError("");
    try {
      const fu = await callClaude(buildMessages("followup"));
      setFollowUp(fu.trim());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function getFeedback(withFollowUp) {
    setPhase("feedback"); setFeedback("");
    setLoading(true); setLoadingMsg("Evaluating your answers..."); setError("");
    try {
      const fb = await callClaude(buildMessages(withFollowUp ? "feedback-with-followup" : "feedback-no-followup"));
      const trimmed = fb.trim();
      setFeedback(trimmed);
      const score = extractScore(trimmed);
      const entry = {
        categoryId: category.id, categoryLabel: category.label, question, answer,
        followUp: withFollowUp ? followUp : null,
        followUpAnswer: withFollowUp ? followUpAnswer : null,
        feedback: trimmed, score,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      };
      setHistory((prev) => { const next = [...prev, entry]; saveHistory(next); return next; });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const accent = category?.color || "#00d4ff";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080c10; color: #c8d8e8; font-family: 'Syne', sans-serif; min-height: 100vh; }

        .app { min-height: 100vh; max-width: 860px; margin: 0 auto; padding: 0 24px 100px; display: flex; flex-direction: column; }

        .header { padding: 36px 0 28px; border-bottom: 1px solid #1a2535; margin-bottom: 48px; display: flex; align-items: baseline; gap: 20px; flex-wrap: wrap; }
        .header-logo { font-family: 'Space Mono', monospace; font-size: 11px; color: #00d4ff; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.8; }
        .header-title { font-size: 22px; font-weight: 800; color: #eef4ff; letter-spacing: -0.02em; }
        .header-badge { margin-left: auto; font-family: 'Space Mono', monospace; font-size: 10px; color: #4a6080; letter-spacing: 0.12em; }

        .phase-wrap { animation: fadeUp 0.28s ease both; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* Home */
        .home-intro { margin-bottom: 40px; }
        .home-intro h2 { font-size: 32px; font-weight: 800; color: #eef4ff; letter-spacing: -0.03em; line-height: 1.15; margin-bottom: 12px; }
        .home-intro p { font-size: 15px; color: #5a7090; line-height: 1.6; max-width: 540px; }
        .category-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 40px; }
        .category-card { background: #0d1520; border: 1px solid #1a2535; border-radius: 8px; padding: 24px 22px; cursor: pointer; position: relative; overflow: hidden; transition: border-color 0.18s, transform 0.18s, background 0.18s; }
        .category-card::before { content: ''; position: absolute; top: 0; left: 0; width: 3px; height: 100%; background: var(--accent); opacity: 0; transition: opacity 0.18s; }
        .category-card:hover { border-color: var(--accent); background: #111c2a; transform: translateY(-2px); }
        .category-card:hover::before { opacity: 1; }
        .cat-icon { font-size: 22px; margin-bottom: 14px; display: block; color: var(--accent); }
        .cat-label { font-size: 16px; font-weight: 700; color: #dde8f5; margin-bottom: 4px; }
        .cat-timer-hint { font-family: 'Space Mono', monospace; font-size: 9px; color: var(--accent); opacity: 0.55; margin-bottom: 9px; letter-spacing: 0.1em; }
        .cat-desc { font-size: 12px; color: #3d5570; line-height: 1.5; font-family: 'Space Mono', monospace; }

        /* Phase tag */
        .phase-tag { font-family: 'Space Mono', monospace; font-size: 10px; letter-spacing: 0.15em; color: var(--accent); text-transform: uppercase; margin-bottom: 24px; display: flex; align-items: center; gap: 10px; }
        .phase-tag::after { content: ''; flex: 1; height: 1px; background: #1a2535; }

        /* Question boxes */
        .question-box { background: #0d1520; border: 1px solid #1a2535; border-radius: 8px; padding: 32px; margin-bottom: 28px; font-size: 19px; font-weight: 600; color: #eef4ff; line-height: 1.5; letter-spacing: -0.01em; min-height: 90px; }
        .question-box.dimmed { font-size: 15px; color: #3a5068; }
        .followup-box { background: #0f1b2a; border: 1px solid #1e3045; border-left: 3px solid var(--accent); border-radius: 8px; padding: 24px 28px; margin-bottom: 24px; }
        .followup-label { font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.18em; color: #2a5070; text-transform: uppercase; margin-bottom: 10px; }
        .followup-text { font-size: 17px; font-weight: 600; color: #c0d8f0; line-height: 1.5; }

        /* Timer */
        .timer-wrap { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
        .timer { display: flex; align-items: center; gap: 12px; }
        .timer-ring-wrap { position: relative; width: 54px; height: 54px; }
        .timer-svg { width: 54px; height: 54px; }
        .timer-digits { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'Space Mono', monospace; font-size: 10px; font-weight: 700; }
        .timer-warn { font-family: 'Space Mono', monospace; font-size: 10px; color: #f87171; letter-spacing: 0.08em; animation: pulse 1s ease-in-out infinite; }
        .timer-urgent .timer-ring-wrap { filter: drop-shadow(0 0 6px rgba(248,113,113,0.35)); }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }

        .cursor { animation: blink 1s step-end infinite; color: #00d4ff; }
        @keyframes blink { 50%{opacity:0} }

        /* Buttons */
        .btn-primary { background: var(--accent, #00d4ff); color: #080c10; border: none; border-radius: 6px; padding: 14px 28px; font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; letter-spacing: 0.02em; transition: opacity 0.15s, transform 0.15s; }
        .btn-primary:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.3; cursor: not-allowed; }
        .btn-secondary { background: transparent; color: #4a6080; border: 1px solid #1a2535; border-radius: 6px; padding: 13px 22px; font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
        .btn-secondary:hover { border-color: #2a3d55; color: #7090b0; }
        .btn-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .action-hint { font-family: 'Space Mono', monospace; font-size: 11px; color: #3d5570; margin-bottom: 20px; }

        /* Answer */
        .answer-area { width: 100%; background: #0d1520; border: 1px solid #1a2535; border-radius: 8px; padding: 22px; color: #c8d8e8; font-family: 'Space Mono', monospace; font-size: 13px; line-height: 1.8; resize: vertical; min-height: 200px; margin-bottom: 20px; outline: none; transition: border-color 0.18s; }
        .answer-area:focus { border-color: #2a4060; }
        .answer-area::placeholder { color: #1e2e3e; }
        .answer-area.short { min-height: 130px; }
        .char-count { margin-left: auto; font-family: 'Space Mono', monospace; font-size: 10px; color: #2a3a4a; }

        /* Feedback */
        .feedback-box { background: #0d1520; border: 1px solid #1a2535; border-radius: 8px; padding: 30px; margin-bottom: 28px; }
        .feedback-raw { font-size: 14px; color: #8aabb0; line-height: 1.7; font-family: 'Space Mono', monospace; }
        .feedback-sections { display: flex; flex-direction: column; gap: 22px; }
        .feedback-section-title { font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.2em; color: #3d5570; text-transform: uppercase; margin-bottom: 8px; }
        .feedback-section-body { font-size: 14px; color: #9ab4cc; line-height: 1.7; }
        .score-bar-wrap { display: flex; align-items: center; gap: 14px; padding-bottom: 20px; border-bottom: 1px solid #1a2535; }
        .score-label { font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.2em; color: #3d5570; text-transform: uppercase; width: 48px; flex-shrink: 0; }
        .score-track { flex: 1; height: 4px; background: #1a2535; border-radius: 2px; overflow: hidden; }
        .score-fill { height: 100%; border-radius: 2px; transition: width 1s cubic-bezier(0.22,1,0.36,1); }
        .score-num { font-family: 'Space Mono', monospace; font-size: 14px; font-weight: 700; width: 36px; text-align: right; flex-shrink: 0; }

        /* History */
        .history-panel { margin-top: 56px; border-top: 1px solid #1a2535; padding-top: 32px; }
        .history-title-row { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; flex-wrap: wrap; }
        .history-title { font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.22em; color: #2a3a4a; text-transform: uppercase; }
        .history-count { font-family: 'Space Mono', monospace; font-size: 10px; color: #3a5060; }
        .history-avg { font-family: 'Space Mono', monospace; font-size: 10px; color: #3a5060; }
        .history-avg strong { color: #7aaa88; }
        .clear-btn { margin-left: auto; background: none; border: 1px solid #1a2535; border-radius: 4px; color: #2a3a4a; font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.1em; padding: 5px 10px; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
        .clear-btn:hover { border-color: #3d1515; color: #f87171; }
        .history-list { display: flex; flex-direction: column; gap: 3px; }
        .history-entry { background: #0a1018; border: 1px solid #12202e; border-radius: 6px; padding: 14px 18px; cursor: pointer; transition: border-color 0.15s; }
        .history-entry:hover { border-color: #1e3045; }
        .history-entry-top { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
        .history-entry-num { font-family: 'Space Mono', monospace; font-size: 9px; color: #2a3a4a; }
        .history-entry-cat { font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; }
        .history-entry-date { font-family: 'Space Mono', monospace; font-size: 9px; color: #2a3a4a; margin-left: auto; }
        .history-entry-score { font-family: 'Space Mono', monospace; font-size: 11px; font-weight: 700; }
        .history-chevron { font-size: 10px; color: #2a3a4a; }
        .history-entry-q { font-size: 13px; color: #3d5570; line-height: 1.4; }
        .history-entry-detail { margin-top: 16px; border-top: 1px solid #12202e; padding-top: 16px; display: flex; flex-direction: column; gap: 14px; }
        .history-followup-block { background: #0d1d2a; border-radius: 4px; padding: 12px 16px; }
        .history-detail-label { font-family: 'Space Mono', monospace; font-size: 9px; letter-spacing: 0.16em; color: #2a3a4a; text-transform: uppercase; margin-bottom: 6px; }
        .history-detail-text { font-size: 13px; color: #4a6578; line-height: 1.6; font-family: 'Space Mono', monospace; }
        .history-feedback-wrap { border-top: 1px solid #12202e; padding-top: 16px; }

        /* Misc */
        .loading-wrap { display: flex; align-items: center; gap: 14px; padding: 32px; color: #3d5570; font-family: 'Space Mono', monospace; font-size: 12px; }
        .spinner { width: 18px; height: 18px; border: 2px solid #1a2535; border-top-color: #00d4ff; border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .error-msg { background: #1a0d0d; border: 1px solid #3d1515; border-radius: 6px; padding: 16px 20px; color: #f87171; font-family: 'Space Mono', monospace; font-size: 12px; margin-bottom: 20px; }
        .back-btn { background: none; border: none; color: #3d5570; font-family: 'Space Mono', monospace; font-size: 11px; cursor: pointer; padding: 0; margin-bottom: 32px; display: flex; align-items: center; gap: 8px; transition: color 0.15s; }
        .back-btn:hover { color: #7090b0; }
      `}</style>

      <div className="app">
        <header className="header">
          <span className="header-logo">C1 Prep</span>
          <span className="header-title">Mock Interviewer</span>
          <span className="header-badge">Senior Lead SWE · Capital One</span>
        </header>

        {/* ── HOME ── */}
        {phase === "home" && (
          <div className="phase-wrap">
            <div className="home-intro">
              <h2>Ready to practice?<br />Pick a category.</h2>
              <p>
                The AI asks a question, then follows up based on your answer — just like a real interview.
                Each category has a timer calibrated to real interview pacing.
                Your sessions are saved across visits.
              </p>
            </div>
            <div className="category-grid">
              {CATEGORIES.map((cat) => (
                <div key={cat.id} className="category-card" style={{ "--accent": cat.color }} onClick={() => startQuestion(cat)}>
                  <span className="cat-icon">{cat.icon}</span>
                  <div className="cat-label">{cat.label}</div>
                  <div className="cat-timer-hint">⏱ {formatTime(cat.timerSeconds)}</div>
                  <div className="cat-desc">{cat.description}</div>
                </div>
              ))}
            </div>
            {error && <div className="error-msg">Error: {error}</div>}
            <HistoryPanel history={history} onClear={() => { setHistory([]); localStorage.removeItem(STORAGE_KEY); }} />
          </div>
        )}

        {/* ── QUESTION ── */}
        {phase === "question" && category && (
          <div className="phase-wrap" style={{ "--accent": accent }}>
            <button className="back-btn" onClick={() => { setTimerRunning(false); setPhase("home"); }}>← back</button>
            <div className="phase-tag">{category.icon} {category.label}</div>
            {loading ? (
              <div className="loading-wrap"><div className="spinner" />{loadingMsg}</div>
            ) : (
              <>
                <div className="question-box">
                  {question && <TypewriterText text={question} onDone={() => setQuestionDone(true)} />}
                </div>
                {questionDone && (
                  <>
                    <p className="action-hint">// Think it through. Start the timer when you're ready to answer.</p>
                    <button className="btn-primary" onClick={() => { setPhase("answering"); setTimerRunning(true); }}>
                      Start answering →
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ANSWERING ── */}
        {phase === "answering" && category && (
          <div className="phase-wrap" style={{ "--accent": accent }}>
            <button className="back-btn" onClick={() => { setTimerRunning(false); setPhase("question"); }}>← re-read question</button>
            <div className="phase-tag">{category.icon} {category.label}</div>
            <div className="question-box dimmed">{question}</div>
            <div className="timer-wrap">
              <Timer key={timerKey} totalSeconds={category.timerSeconds} running={timerRunning} onExpire={() => setTimerRunning(false)} />
            </div>
            <textarea
              ref={answerRef}
              className="answer-area"
              placeholder="Type your answer here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <div className="btn-row">
              <button className="btn-primary" onClick={submitAnswer} disabled={!answer.trim()}>
                Submit → get follow-up
              </button>
              <span className="char-count">{answer.length} chars</span>
            </div>
          </div>
        )}

        {/* ── FOLLOW-UP ── */}
        {phase === "followup" && category && (
          <div className="phase-wrap" style={{ "--accent": accent }}>
            <div className="phase-tag">{category.icon} Follow-up · {category.label}</div>
            <div className="question-box dimmed">{question}</div>
            {loading ? (
              <div className="loading-wrap"><div className="spinner" />{loadingMsg}</div>
            ) : (
              <>
                <div className="followup-box">
                  <div className="followup-label">Interviewer follow-up</div>
                  <div className="followup-text">
                    {followUp && <TypewriterText text={followUp} onDone={() => setFollowUpDone(true)} />}
                  </div>
                </div>
                {followUpDone && (
                  <div className="btn-row">
                    <button className="btn-primary" onClick={() => { setPhase("followup-answering"); setTimerKey((k) => k + 1); setTimerRunning(true); }}>
                      Answer follow-up →
                    </button>
                    <button className="btn-secondary" onClick={() => getFeedback(false)}>
                      Skip → get feedback
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── FOLLOW-UP ANSWERING ── */}
        {phase === "followup-answering" && category && (
          <div className="phase-wrap" style={{ "--accent": accent }}>
            <div className="phase-tag">{category.icon} Follow-up · {category.label}</div>
            <div className="followup-box">
              <div className="followup-label">Interviewer follow-up</div>
              <div className="followup-text">{followUp}</div>
            </div>
            <div className="timer-wrap">
              <Timer key={timerKey} totalSeconds={Math.min(5 * 60, category.timerSeconds)} running={timerRunning} onExpire={() => setTimerRunning(false)} />
            </div>
            <textarea
              ref={followUpRef}
              className="answer-area short"
              placeholder="Answer the follow-up..."
              value={followUpAnswer}
              onChange={(e) => setFollowUpAnswer(e.target.value)}
            />
            <div className="btn-row">
              <button className="btn-primary" onClick={() => { setTimerRunning(false); getFeedback(true); }} disabled={!followUpAnswer.trim()}>
                Get feedback →
              </button>
              <span className="char-count">{followUpAnswer.length} chars</span>
            </div>
          </div>
        )}

        {/* ── FEEDBACK ── */}
        {phase === "feedback" && category && (
          <div className="phase-wrap" style={{ "--accent": accent }}>
            <div className="phase-tag">{category.icon} Feedback · {category.label}</div>
            <div className="question-box dimmed">{question}</div>
            {error && <div className="error-msg">Error: {error}</div>}
            {loading ? (
              <div className="loading-wrap"><div className="spinner" />{loadingMsg}</div>
            ) : (
              <>
                <div className="feedback-box">
                  {feedback && <FeedbackBlock text={feedback} />}
                </div>
                <div className="btn-row">
                  <button className="btn-primary" onClick={() => startQuestion(category)}>Next question →</button>
                  <button className="btn-secondary" onClick={() => setPhase("home")}>Switch category</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
