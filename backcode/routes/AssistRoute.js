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

function getGroqApiKey() {
  return process.env.GROQ_API_KEY?.trim();
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
  if (/\bretry in [\d.]+s/i.test(String(errText))) return true;
  return false;
}

function jsonErrMessage(data, status, fallbackPrefix) {
  const errMsg =
    data?.error?.message ||
    (typeof data?.error === "string" ? data.error : "") ||
    `Upstream request failed (${status})`;
  return String(errMsg);
}

/** --- Client SSE (NDJSON-ish over SSE frames) ---------------------------- */

function initSseResponse(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
}

function createClientSseSink(res) {
  let opened = false;
  /** @type {{ emittedDelta: boolean }} */
  const state = { emittedDelta: false };
  function open() {
    if (opened) return;
    opened = true;
    initSseResponse(res);
  }
  return {
    state,
    isOpen: () => opened,
    delta(text) {
      if (!text) return;
      open();
      state.emittedDelta = true;
      res.write(
        `data: ${JSON.stringify({ type: "delta", text: String(text) })}\n\n`
      );
    },
    error(message) {
      open();
      res.write(
        `data: ${JSON.stringify({ type: "error", message: String(message) })}\n\n`
      );
    },
    done() {
      open();
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    },
  };
}

async function readOpenAiStyleSseStream(body, sink, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let leftover = "";

  for (;;) {
    if (signal?.aborted) {
      reader.cancel().catch(() => {});
      throw new Error("Client disconnected.");
    }

    const { done, value } = await reader.read();
    leftover += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = leftover.split("\n");
    leftover = lines.pop() ?? "";

    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trimStart();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const piece = json?.choices?.[0]?.delta?.content;
        if (typeof piece === "string" && piece) sink(piece);
      } catch {
        /* ignore malformed frame */
      }
    }

    if (done) {
      const tail = leftover.trim();
      if (tail.startsWith("data:")) {
        const payload = tail.slice(5).trimStart();
        if (payload && payload !== "[DONE]") {
          try {
            const json = JSON.parse(payload);
            const piece = json?.choices?.[0]?.delta?.content;
            if (typeof piece === "string" && piece) sink(piece);
          } catch {
            /* ignore */
          }
        }
      }
      return;
    }
  }
}

function extractGeminiChunkText(parsed) {
  const parts =
    parsed?.candidates?.[0]?.content?.parts ||
    parsed?.response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => (typeof p?.text === "string" ? p.text : "")).join("");
}

async function readGeminiSseStream(body, sink, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let leftover = "";
  /** full response text so far when API sends cumulative segments */
  let full = "";

  for (;;) {
    if (signal?.aborted) {
      reader.cancel().catch(() => {});
      throw new Error("Client disconnected.");
    }

    const { done, value } = await reader.read();
    leftover += decoder.decode(value || new Uint8Array(), { stream: !done });

    /** Split SSE events crudely; Gemini may use \r\n\r\n */
    while (true) {
      let sepIdx = leftover.indexOf("\n\n");
      let sepLen = 2;
      if (sepIdx === -1) {
        sepIdx = leftover.indexOf("\r\n\r\n");
        sepLen = 4;
      }
      if (sepIdx === -1) break;

      const evt = leftover.slice(0, sepIdx);
      leftover = leftover.slice(sepIdx + sepLen);

      const dataLines = evt
        .split(/\r?\n/)
        .filter((ln) => ln.startsWith("data:"))
        .map((ln) => ln.slice(5).trimStart());

      let jsonStr = "";
      for (const d of dataLines) {
        jsonStr += d;
      }

      if (jsonStr && jsonStr.trim() !== "[DONE]") {
        try {
          const parsed = JSON.parse(jsonStr);
          const chunkText = extractGeminiChunkText(parsed);
          if (chunkText) {
            let out = "";
            if (chunkText.startsWith(full)) {
              out = chunkText.slice(full.length);
              full = chunkText;
            } else if (full.length === 0) {
              full = chunkText;
              out = chunkText;
            } else {
              full += chunkText;
              out = chunkText;
            }
            if (out) sink(out);
          }
        } catch {
          /* incomplete JSON waiting for next event — uncommon with full events */
        }
      }
    }

    if (done) break;
  }
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
    throw new Error(jsonErrMessage(data, r.status));
  }

  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) {
    throw new Error(
      "Empty response from the model. Try again or check OPENAI_MODEL."
    );
  }

  return text;
}

async function fetchOpenAiStyleStream(apiKey, base, model, systemContent, filtered, signal) {
  const url = `${base}/chat/completions`;
  const msgs = [
    { role: "system", content: systemContent },
    ...filtered.map((m) => ({ role: m.role, content: m.content })),
  ];
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model,
      messages: msgs,
      temperature: 0.6,
      max_tokens: 2048,
      stream: true,
    }),
    signal,
  });

  const errTextPromise = async () => {
    const data = await r.json().catch(() => ({}));
    return jsonErrMessage(data, r.status);
  };

  if (!r.ok) {
    throw new Error(await errTextPromise());
  }

  const body = r.body;
  if (!body) {
    throw new Error("No response body from provider.");
  }
  return body;
}

async function streamOpenAISse(apiKey, systemContent, filtered, sink, signal) {
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const base =
    process.env.OPENAI_BASE_URL?.replace(/\/$/, "") ||
    "https://api.openai.com/v1";
  const body = await fetchOpenAiStyleStream(apiKey, base, model, systemContent, filtered, signal);

  /** @type {boolean} */
  let any = false;
  await readOpenAiStyleSseStream(
    body,
    (chunk) => {
      any = true;
      sink(chunk);
    },
    signal
  );
  if (!any) throw new Error("Empty stream from OpenAI.");
}

async function streamGroqSse(apiKey, systemContent, filtered, sink, signal) {
  const model =
    process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
  const base =
    process.env.GROQ_BASE_URL?.replace(/\/$/, "") ||
    "https://api.groq.com/openai/v1";
  const body = await fetchOpenAiStyleStream(apiKey, base, model, systemContent, filtered, signal);

  let any = false;
  await readOpenAiStyleSseStream(
    body,
    (chunk) => {
      any = true;
      sink(chunk);
    },
    signal
  );
  if (!any) throw new Error("Empty stream from Groq.");
}

async function fetchGeminiStreamBody(apiKey, systemContent, filtered, signal, attempt = 0) {
  const model =
    process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const base = (
    process.env.GEMINI_API_BASE?.replace(/\/$/, "") ||
    "https://generativelanguage.googleapis.com/v1beta/models"
  ).replace(/\/$/, "");

  const url =
    `${base}/${model}:streamGenerateContent?` +
    new URLSearchParams({
      key: apiKey,
      alt: "sse",
    });

  const mapped = filtered.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

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
    signal,
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

  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    const errString = String(
      data?.error?.message ||
        data?.error?.status ||
        `Gemini stream request failed (${r.status})`
    );

    if (
      attempt < 1 &&
      shouldRetryGeminiOnce(r.status, errString)
    ) {
      const waitMs = retryDelayMs(r, errString);
      if (waitMs != null && waitMs > 0) {
        const capped = Math.min(waitMs + 250, 60_000);
        console.warn(
          `Assist: Gemini stream rate/quota; retrying once after ${Math.round(capped / 1000)}s`
        );
        await sleep(capped);
        return fetchGeminiStreamBody(apiKey, systemContent, filtered, signal, attempt + 1);
      }
    }

    throw new Error(errString);
  }

  const outBody = r.body;
  if (!outBody) throw new Error("No Gemini stream body.");
  return outBody;
}

async function streamGeminiSse(apiKey, systemContent, filtered, sink, signal) {
  const body = await fetchGeminiStreamBody(apiKey, systemContent, filtered, signal);

  let any = false;
  await readGeminiSseStream(
    body,
    (chunk) => {
      any = true;
      sink(chunk);
    },
    signal
  );
  if (!any) throw new Error("Empty stream from Gemini.");
}

/**
 * Groq uses an OpenAI-compatible chat completions API.
 */
async function callGroq(apiKey, systemContent, filtered) {
  const model =
    process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
  const base =
    process.env.GROQ_BASE_URL?.replace(/\/$/, "") ||
    "https://api.groq.com/openai/v1";
  const url = `${base}/chat/completions`;

  const groqMessages = [
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
      messages: groqMessages,
      temperature: 0.6,
      max_tokens: 2048,
    }),
  });

  const data = await r.json().catch(() => ({}));

  if (!r.ok) {
    throw new Error(String(data?.error?.message || data?.error || String(data)));
  }

  const text = data?.choices?.[0]?.message?.content?.trim() || "";
  if (!text) {
    throw new Error(
      "Empty response from Groq. Try again or check GROQ_MODEL (see console.groq.com/docs/models)."
    );
  }

  return text;
}

/**
 * Default: gemini-2.5-flash (stable in API v1beta).
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

async function runAssistFallbackChain(steps) {
  let lastErr;
  for (const { name, run } of steps) {
    try {
      return await run();
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      console.warn(
        `Assist: ${name} failed (${lastErr.message}); continuing to fallback if configured.`
      );
    }
  }
  throw lastErr || new Error("No backend provider succeeded.");
}

router.post("/", async (req, res) => {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = getGeminiApiKey();
  const groqKey = getGroqApiKey();
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
        "ASSIST_PROVIDER=openai but OPENAI_API_KEY is not set. Add it to .env or use ASSIST_PROVIDER=gemini|groq|auto.",
    });
  }
  if (provider === "groq" && !groqKey) {
    return res.status(503).json({
      error:
        "ASSIST_PROVIDER=groq but GROQ_API_KEY is not set. Add it to .env or use ASSIST_PROVIDER=auto.",
    });
  }
  if (provider === "auto" && !openaiKey && !geminiKey && !groqKey) {
    return res.status(503).json({
      error:
        "AI assistance is not configured. Set OPENAI_API_KEY, GEMINI_API_KEY, and/or GROQ_API_KEY in the API .env file and restart the server.",
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
    } else if (provider === "groq") {
      text = await callGroq(groqKey, systemContent, filtered);
    } else {
      const chain = [];
      if (openaiKey) {
        chain.push({
          name: "OpenAI",
          run: () => callOpenAI(openaiKey, systemContent, filtered),
        });
      }
      if (geminiKey) {
        chain.push({
          name: "Gemini",
          run: () => callGemini(geminiKey, systemContent, filtered),
        });
      }
      if (groqKey) {
        chain.push({
          name: "Groq",
          run: () => callGroq(groqKey, systemContent, filtered),
        });
      }
      text = await runAssistFallbackChain(chain);
    }

    return res.json({ message: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Assist route error:", e);
    return res.status(502).json({ error: msg });
  }
});

router.post("/stream", async (req, res) => {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = getGeminiApiKey();
  const groqKey = getGroqApiKey();
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
        "ASSIST_PROVIDER=openai but OPENAI_API_KEY is not set. Add it to .env or use ASSIST_PROVIDER=gemini|groq|auto.",
    });
  }
  if (provider === "groq" && !groqKey) {
    return res.status(503).json({
      error:
        "ASSIST_PROVIDER=groq but GROQ_API_KEY is not set. Add it to .env or use ASSIST_PROVIDER=auto.",
    });
  }
  if (provider === "auto" && !openaiKey && !geminiKey && !groqKey) {
    return res.status(503).json({
      error:
        "AI assistance is not configured. Set OPENAI_API_KEY, GEMINI_API_KEY, and/or GROQ_API_KEY in the API .env file and restart the server.",
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
  const ac = new AbortController();
  /** @type {(() => void) | null} */
  let onReqClose = null;
  onReqClose = () => ac.abort();
  req.on("close", onReqClose);

  const sse = createClientSseSink(res);
  let lastErr = null;

  try {
    const streamChain =
      provider === "gemini"
        ? [
            {
              name: "Gemini",
              run: async () =>
                streamGeminiSse(geminiKey, systemContent, filtered, sse.delta, ac.signal),
            },
          ]
        : provider === "openai"
          ? [
              {
                name: "OpenAI",
                run: async () =>
                  streamOpenAISse(
                    openaiKey,
                    systemContent,
                    filtered,
                    sse.delta,
                    ac.signal
                  ),
              },
            ]
          : provider === "groq"
            ? [
                {
                  name: "Groq",
                  run: async () =>
                    streamGroqSse(
                      groqKey,
                      systemContent,
                      filtered,
                      sse.delta,
                      ac.signal
                    ),
                },
              ]
            : [
                ...(openaiKey
                  ? [
                      {
                        name: "OpenAI",
                        run: async () =>
                          streamOpenAISse(
                            openaiKey,
                            systemContent,
                            filtered,
                            sse.delta,
                            ac.signal
                          ),
                      },
                    ]
                  : []),
                ...(geminiKey
                  ? [
                      {
                        name: "Gemini",
                        run: async () =>
                          streamGeminiSse(
                            geminiKey,
                            systemContent,
                            filtered,
                            sse.delta,
                            ac.signal
                          ),
                      },
                    ]
                  : []),
                ...(groqKey
                  ? [
                      {
                        name: "Groq",
                        run: async () =>
                          streamGroqSse(
                            groqKey,
                            systemContent,
                            filtered,
                            sse.delta,
                            ac.signal
                          ),
                      },
                    ]
                  : []),
              ];

    let committed = false;
    for (const step of streamChain) {
      try {
        await step.run();
        lastErr = null;
        committed = true;
        sse.done();
        break;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        console.warn(
          `Assist stream: ${step.name} failed (${lastErr.message}); attempting next provider when available.`
        );
        const stepIndex = streamChain.indexOf(step);
        const canRetryLater = stepIndex >= 0 && stepIndex < streamChain.length - 1;
        if (sse.state.emittedDelta || !canRetryLater) {
          sse.error(lastErr.message);
          sse.done();
          committed = true;
          break;
        }
      }
    }

    const msg = e instanceof Error ? e.message : String(e);
    console.error("Assist stream route error:", e);
    if (!sse.isOpen()) {
      return res.status(502).json({ error: msg });
    }
    sse.error(msg);
    sse.done();
  } finally {
    if (onReqClose) req.off("close", onReqClose);
    if (!res.writableEnded) res.end();
  }
});

export default router;
