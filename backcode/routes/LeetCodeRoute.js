/**
 * LeetCode unofficial GraphQL proxy (resume / portfolio use).
 * Proxies to https://leetcode.com/graphql with short TTL caching.
 */

const LEETCODE_GRAPHQL =
  process.env.LEETCODE_GRAPHQL_URL?.trim() || "https://leetcode.com/graphql";
const CACHE_MS = Math.min(
  Math.max(Number(process.env.LEETCODE_CACHE_MS) || 600_000, 10_000),
  3_600_000,
);

const cache = new Map();

/** @param {string} key */
function getCached(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) {
    cache.delete(key);
    return null;
  }
  return e.data;
}

/** @param {string} key @param {unknown} data */
function setCached(key, data) {
  cache.set(key, { data, expires: Date.now() + CACHE_MS });
}

async function leetcodeGraphQL(query, variables) {
  const r = await fetch(LEETCODE_GRAPHQL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent":
        "CodingPrep/1.0 (educational portfolio; respects leetcode.com)",
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await r.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`LeetCode returned non-JSON (${r.status}). Try again later.`);
  }

  if (!r.ok) {
    throw new Error(
      json?.errors?.[0]?.message ||
        `LeetCode request failed (${r.status})`,
    );
  }

  if (json.errors?.length) {
    throw new Error(String(json.errors[0]?.message || "LeetCode GraphQL error"));
  }

  return json;
}

function monoLangFromSnippetSlug(langSlug) {
  const s = String(langSlug || "").toLowerCase();
  const map = {
    javascript: "javascript",
    typescript: "typescript",
    python3: "python",
    python: "python",
    java: "java",
    cpp: "cpp",
    csharp: "csharp",
    golang: "go",
    kotlin: "kotlin",
    swift: "swift",
    rust: "rust",
  };
  return map[s] ?? "javascript";
}

function stripOuterTags(html, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  let out = String(html || "");
  let m = re.exec(out);
  while (m !== null) {
    out = out.slice(0, m.index) + m[1] + out.slice(m.index + m[0].length);
    re.lastIndex = 0;
    m = re.exec(out);
  }
  return out;
}

function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<sup>(\d+)<\/sup>/gi, (_, n) => `^${n}`)
    .replace(/<[^>]*>/g, "");
}

function descriptionHeadHtml(html) {
  const raw = String(html || "").replace(/<!--[\s\S]*?-->/g, "").trim();
  const splitRe =
    /<p>\s*<strong[^>]*class="example"[^>]*>|<strong[^>]*class="example"[^>]*>/i;
  const idx = raw.search(splitRe);
  if (idx === -1) return raw;
  let head = raw.slice(0, idx);
  head = head.replace(/<strong>Follow-up:[\s\S]*$/i, "").trim();
  return head.trim();
}

function htmlToMarkdownish(html) {
  let s = stripOuterTags(String(html || ""), "code");
  s = decodeHtmlEntities(
    s
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, ""),
  );
  s = s.replace(/<\s*p[^>]*>/gi, "").replace(/<\/\s*p>/gi, "\n\n");
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = decodeHtmlEntities(s.replace(/<[^>]+>/g, ""))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  return s;
}

/**
 * Parse classic LeetCode <pre> example blocks into { input, output, explanation }
 * @param {string} html
 */
function parseExamples(html) {
  const examples = [];
  const pres = [...String(html || "").matchAll(/<pre>([\s\S]*?)<\/pre>/gi)];
  for (const m of pres) {
    let block = m[1]
      .replace(/<strong[^>]*>/gi, "")
      .replace(/<\/strong>/gi, "")
      .replace(/<[^>]+>/g, "");
    block = decodeHtmlEntities(block.replace(/\t/g, " ")).trim();
    if (!/^Input\s*:/im.test(block)) continue;

    const ir = /\bInput\s*:\s*([\s\S]*?)\s*Output\s*:/ims.exec(block);
    const rest = /\bOutput\s*:\s*([\s\S]*)$/ims.exec(block)?.[1];
    if (!ir?.[1].trim()) continue;

    let outputRaw = "";
    let explanation;
    const outPart = typeof rest === "string" ? rest.trim() : "";
    const ex = /^([\s\S]*?)\s*Explanation\s*:\s*([\s\S]+)$/ims.exec(outPart);
    if (ex) {
      outputRaw = ex[1].trim().replace(/\s+/g, " ");
      explanation = decodeHtmlEntities(ex[2].trim().replace(/\s+/g, " "));
    } else {
      outputRaw = outPart.replace(/\s+/g, " ");
    }

    examples.push({
      input: decodeHtmlEntities(ir[1].trim().replace(/\s+/g, " ")),
      output: decodeHtmlEntities(outputRaw),
      explanation,
    });
  }
  return examples.filter((x) => x.input || x.output);
}

function parseConstraints(html) {
  const htmlStr = String(html || "");
  const marker =
    /<strong[^>]*>\s*Constraints\s*:?\s*<\/strong>/im.exec(htmlStr);
  if (!marker || marker.index === undefined) return [];

  let tail = htmlStr.slice(marker.index + marker[0].length);
  const ulIdx = tail.search(/<ul\b/im);
  if (ulIdx === -1) return [];
  tail = tail.slice(ulIdx);
  const ulClose = tail.search(/<\/ul>/im);
  if (ulClose === -1) return [];
  const ulFrag = tail.slice(0, ulClose + "</ul>".length);
  const ulMatch = ulFrag.match(/<ul[^>]*>([\s\S]*?)<\/ul>/im);
  const ulInner = ulMatch ? ulMatch[1] : ulFrag;
  const items = [...ulInner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
  return items
    .map((row) =>
      decodeHtmlEntities(row[1].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function pickStarterCode(preferredLang, snippets) {
  const list = Array.isArray(snippets) ? snippets : [];
  const pref = String(preferredLang || "javascript").toLowerCase();
  const order =
    pref === "python"
      ? ["python", "python3", "javascript", "java"]
      : [pref, "javascript", "python3", "python", "java", "cpp"];

  for (const slug of order) {
    const hit = list.find(
      (s) => String(s.langSlug || "").toLowerCase() === slug,
    );
    if (hit?.code) return { code: hit.code, langSlug: hit.langSlug };
  }
  const first = list.find((s) => s.code);
  if (first) return { code: first.code, langSlug: first.langSlug };
  return {
    code: "// No starter template from LeetCode.\n",
    langSlug: "javascript",
  };
}

const LIST_QUERY = `
query ProblemList($skip: Int!, $limit: Int!) {
  problemsetQuestionList: questionList(
    categorySlug: ""
    skip: $skip
    limit: $limit
    filters: {}
  ) {
    total: totalNum
    questions: data {
      difficulty
      titleSlug
      title
      questionFrontendId
      isPaidOnly
    }
  }
}
`;

const DETAIL_QUERY = `
query Question($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    title
    titleSlug
    content
    difficulty
    codeSnippets {
      lang
      langSlug
      code
    }
  }
}
`;

/**
 * Express router factory — call as `leetcodeRouter(express)` because this file
 * is plain ESM and avoids circular import quirks.
 */
export default function createLeetCodeRouter(express) {
  const router = express.Router();

  router.get("/question-list", async (req, res) => {
    try {
      const skip = Math.max(0, Number(req.query.skip) || 0);
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
      const cacheKey = `list:${skip}:${limit}`;
      const hit = getCached(cacheKey);
      if (hit) return res.json(hit);

      const json = await leetcodeGraphQL(LIST_QUERY, { skip, limit });
      const block = json?.data?.problemsetQuestionList;
      if (!block) {
        return res.status(502).json({ error: "Unexpected LeetCode response." });
      }

      const payload = {
        total: block.total ?? 0,
        skip,
        limit,
        questions: (block.questions || []).map((q) => ({
          title: q.title,
          titleSlug: q.titleSlug,
          difficulty: q.difficulty,
          frontendId: q.questionFrontendId,
          paidOnly: Boolean(q.isPaidOnly),
        })),
      };
      setCached(cacheKey, payload);
      return res.json(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("LeetCode list error:", e);
      return res.status(502).json({ error: msg });
    }
  });

  router.get("/problems/:slug", async (req, res) => {
    try {
      const slug = String(req.params.slug || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "");
      if (!slug) return res.status(400).json({ error: "Invalid slug." });

      /** Optional ?lang=python|javascript|java to pick starter snippet */
      const prefLang =
        typeof req.query.lang === "string" ? req.query.lang : "javascript";

      const cacheKey = `detail:${slug}:${prefLang}`;
      const hit = getCached(cacheKey);
      if (hit) return res.json(hit);

      const json = await leetcodeGraphQL(DETAIL_QUERY, { titleSlug: slug });
      const q = json?.data?.question;
      if (!q) {
        return res.status(404).json({ error: "Problem not found." });
      }

      const content = String(q.content || "");
      let examples = parseExamples(content);
      const constraints = parseConstraints(content);
      const description =
        htmlToMarkdownish(descriptionHeadHtml(content)) ||
        "Problem text could not be parsed; open on LeetCode for the full HTML.";

      if (examples.length === 0) {
        examples = [
          {
            input: "See Examples on leetcode.com for this slug.",
            output: "—",
          },
        ];
      }

      const { code: starterCode, langSlug } = pickStarterCode(
        prefLang,
        q.codeSnippets,
      );

      let difficulty = "Medium";
      const d = String(q.difficulty || "");
      if (d === "Easy" || d === "Hard" || d === "Medium") difficulty = d;

      const problem = {
        id: slug,
        title: String(q.title || slug),
        difficulty,
        description,
        examples,
        constraints:
          constraints.length > 0
            ? constraints
            : [
                "Full constraints appear in the parsed statement above or on LeetCode.",
              ],
        starterCode,
        editorLang: monoLangFromSnippetSlug(langSlug),
        frontendId: String(q.questionFrontendId ?? ""),
        source: "leetcode",
        titleSlug: slug,
      };

      const payload = { problem };
      setCached(cacheKey, payload);
      return res.json(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("LeetCode detail error:", e);
      return res.status(502).json({ error: msg });
    }
  });

  return router;
}
