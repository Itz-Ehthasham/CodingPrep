import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_ROOT = path.join(__dirname, "..");
const BACKEND_TMP = path.join(BACKEND_ROOT, "tmp");

const EXEC_OPTS = { maxBuffer: 10 * 1024 * 1024 };

function makeWorkDir() {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const workDir = path.join(BACKEND_TMP, id);
  fs.mkdirSync(workDir, { recursive: true });
  return workDir;
}

function cleanupWorkDir(workDir) {
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch (e) {
    console.error("submitRunner cleanup:", e);
  }
}

function pythonCommand() {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  return process.platform === "win32" ? "python" : "python3";
}

function execP(command, cwd) {
  return new Promise((resolve, reject) => {
    exec(
      command,
      { cwd, shell: true, ...EXEC_OPTS },
      (err, stdout, stderr) => {
        if (err) {
          reject(
            new Error(
              (stderr || stdout || err.message || String(err)).toString().trim()
            )
          );
        } else {
          resolve((stdout ?? "").toString());
        }
      }
    );
  });
}

/**
 * @param {string} code
 * @param {string} language - java | python | javascript
 * @param {{ input?: string, output?: string }[]} testCases
 * @returns {Promise<{ passed: boolean, output: string, expectedOutput: string }[]>}
 */
export async function gradeSubmission(code, language, testCases) {
  const lang = String(language || "java").toLowerCase();
  const allowed = ["java", "python", "javascript"];
  if (!allowed.includes(lang)) {
    throw new Error(`Unsupported language. Use: ${allowed.join(", ")}`);
  }
  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error("testCases array required");
  }

  const workDir = makeWorkDir();

  try {
    if (lang === "java") {
      fs.writeFileSync(path.join(workDir, "Main.java"), code);
      await execP("javac Main.java", workDir);
    } else if (lang === "python") {
      fs.writeFileSync(path.join(workDir, "main.py"), code);
    } else {
      fs.writeFileSync(path.join(workDir, "main.js"), code);
    }

    const results = [];
    const py = pythonCommand();

    for (const tc of testCases) {
      const stdin = tc.input ?? "";
      fs.writeFileSync(path.join(workDir, "stdin.txt"), stdin);

      let out;
      if (lang === "java") {
        out = await execP("java Main < stdin.txt", workDir);
      } else if (lang === "python") {
        out = await execP(`${py} main.py < stdin.txt`, workDir);
      } else {
        out = await execP("node main.js < stdin.txt", workDir);
      }

      const trimmed = out.trim();
      const exp = String(tc.output ?? "").trim();
      results.push({
        passed: trimmed === exp,
        output: trimmed,
        expectedOutput: exp,
      });
    }

    return results;
  } finally {
    cleanupWorkDir(workDir);
  }
}
