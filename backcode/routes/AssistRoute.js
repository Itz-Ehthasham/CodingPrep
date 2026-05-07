import express from "express";

const router = express.Router();

const MAX_CODE_CHARS = 16_000;

const SYSTEM_PROMPT = `You are a patient coding tutor for Sathcode, an online practice platform.

Guidelines:
- Prefer hints, questions, and step-by-step reasoning over pasting full solutions unless the user explicitly asks for complete code.
- Help them debug, understand concepts, and build problem-solving skills.
- If they share code, reference it briefly; suggest fixes or patterns without doing all their homework when they're learning.
- Keep answers concise but clear. Use markdown code fences only when showing short illustrative snippets.
- If the user seems stuck on an interview-style problem, help them break the problem down (examples, edge cases, complexity).`;

function buildSystemContent(code, language) {
  let extra = "";
  if (code && String(code).trim()) {
    const trimmed =
      String(code).length > MAX_CODE_CHARS
        ? String(code).slice(0, MAX_CODE_CHARS) +
          "\n\n... (truncated for length)"
        : String(code);
    const lang = language ? String(language) : "plaintext";
    extra = `\n\nThe user is working in **${lang}**. Their current editor contents:\n\n\`\`\`${lang}\n${trimmed}\n\`\`\``;
  }
  return SYSTEM_PROMPT + extra;
}

function getGeminiApiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GEMI_API_KEY?.trim()
  );
}

/** True when OpenAI rejected the key (so we can fall back to Gemini in auto mode). */
function isOpenAiAuthFailure(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Incorrect API key") ||
    msg.includes("invalid_api_key") ||
    msg.includes("Invalid API Key")
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parses "Please retry in 11.78s" from Gemini error text, or Retry-After header (seconds).
 */
function retryDelayMs(response, errText) {
  const h = response.headers?.get?.("retry-after");
  if (h != null && /^\d+(\.\d+)?$/.test(h.trim())) {
    const sec = parseFloat(h);
    if (sec > 0 && sec < 300) return sec * 1000;
  }
  const m = String(errText).match(/retry in ([\d.]+)\s*s/i);
  if (m) {
    const sec = parseFloat(m[1]);
    if (sec > 0 && sec < 300) return Math.ceil(sec * 1000);
  }
  return null;
}

function shouldRetryGeminiOnce(status, errText) {
  const t = String(errText).toLowerCase();
  if (status === 429) return true;
  if (t.includes("resource_exhausted")) return true;
  if (t.includes("quota") && t.includes("retry")) return true;
  if (/\bretry in [\d.]+\s*s/i.test(String(errText))) return true;
  return false;
}

async function callOpenAI(apiKey, systemContent, filtered) {
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const base =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") || "https://api.openai.com/v1";
  const url = `${base}/chat/completions`;

  const openaiMessages = [
    { role: "system", content: systemContent },
    ...filtered.map((m) => ({ role: m.role, content: m.content })),
  ];

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: openaiMessages,
      temperature: 0.6,
      max_tokens: 2048,
    }),
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    const errMsg =
      data?.error?.message || data?.error || `Upstream request failed (${r.status})`;
    throw new Error(String(errMsg));
  }

  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) {
    throw new Error("Empty response from the model. Try again or check OPENAI_MODEL.");
  }

  return text;
}

/**
 * Default: gemini-2.5-flash (stable in API v1beta). Gemini 1.x IDs are removed for many keys.
 * Override with GEMINI_MODEL (e.g. gemini-2.5-flash-lite, gemini-3-flash-preview).
 */
async function callGemini(apiKey, systemContent, filtered, attempt = 0) {
  const model =
    process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const base = (
    process.env.GEMINI_API_BASE?.replace(/\/$/, "") ||
    "https://generativelanguage.googleapis.com/v1beta/models"
  ).replace(/\/$/, "");

  const url = `${base}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const mapped = filtered.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  /** Gemini expects the first turn to be from the user when possible. */
  let contents = mapped;
  if (contents.length > 0 && contents[0].role !== "user") {
    contents = [
      { role: "user", parts: [{ text: "Hi." }] },
      ...contents,
    ];
  }

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemContent }],
      },
      contents,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 2048,
      },
    }),
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    const errMsg =
      data?.error?.message ||
      data?.error?.status ||
      `Gemini request failed (${r.status})`;
    const errString = String(errMsg);

    if (
      attempt < 1 &&
      shouldRetryGeminiOnce(r.status, errString)
    ) {
      const waitMs = retryDelayMs(r, errString);
      if (waitMs != null && waitMs > 0) {
        const capped = Math.min(waitMs + 250, 60_000);
        console.warn(
          `Assist: Gemini rate/quota message; retrying once after ${Math.round(capped / 1000)}s`
        );
        await sleep(capped);
        return callGemini(apiKey, systemContent, filtered, attempt + 1);
      }
    }

    throw new Error(errString);
  }

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Blocked: ${blockReason}`);
  }

  const candidate = data?.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish && finish !== "STOP" && finish !== "MAX_TOKENS") {
    console.warn("Gemini finishReason:", finish);
  }

  const text =
    candidate?.content?.parts
      ?.map((p) => p.text || "")
      .join("")
      ?.trim() || "";

  if (!text) {
    throw new Error(
      "Empty response from Gemini. Set GEMINI_MODEL (e.g. gemini-2.5-flash-lite) or check https://aistudio.google.com/ for quota and billing."
    );
  }

  return text;
}

router.post("/", async (req, res) => {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = getGeminiApiKey();
  const provider = (process.env.ASSIST_PROVIDER || "auto")
    .trim()
    .toLowerCase();

  if (provider === "gemini" && !geminiKey) {
    return res.status(503).json({
      error:
        "ASSIST_PROVIDER=gemini but GEMINI_API_KEY is not set. Add it to .env or use ASSIST_PROVIDER=auto.",
    });
  }
  if (provider === "openai" && !openaiKey) {
    return res.status(503).json({
      error:
        "ASSIST_PROVIDER=openai but OPENAI_API_KEY is not set. Add it to .env or use ASSIST_PROVIDER=gemini.",
    });
  }
  if (provider === "auto" && !openaiKey && !geminiKey) {
    return res.status(503).json({
      error:
        "AI assistance is not configured. Set OPENAI_API_KEY or GEMINI_API_KEY in the API .env file and restart the server.",
    });
  }

  const { messages, code, language } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const filtered = messages.filter(
    (m) =>
      m &&
      typeof m === "object" &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
  );
  if (filtered.length === 0) {
    return res.status(400).json({
      error: "Each message must have role user|assistant and string content",
    });
  }

  const systemContent = buildSystemContent(code, language);

  try {
    let text;

    if (provider === "gemini") {
      text = await callGemini(geminiKey, systemContent, filtered);
    } else if (provider === "openai") {
      text = await callOpenAI(openaiKey, systemContent, filtered);
    } else {
      // auto: prefer OpenAI when key is present, fall back to Gemini on bad OpenAI key
      if (openaiKey) {
        try {
          text = await callOpenAI(openaiKey, systemContent, filtered);
        } catch (e) {
          if (geminiKey && isOpenAiAuthFailure(e)) {
            console.warn(
              "Assist: OpenAI key rejected; falling back to Gemini."
            );
            text = await callGemini(geminiKey, systemContent, filtered);
          } else {
            throw e;
          }
        }
      } else {
        text = await callGemini(geminiKey, systemContent, filtered);
      }
    }

    return res.json({ message: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Assist route error:", e);
    return res.status(502).json({ error: msg });
  }
});

export default router;
