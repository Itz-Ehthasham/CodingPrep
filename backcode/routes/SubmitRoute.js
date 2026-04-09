import express from "express";
import { gradeSubmission } from "../lib/submitRunner.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const code = req.body.code;
  const testCases = req.body.testCases;
  const language = req.body.language || req.query?.lang || "java";

  if (code === undefined || code === null) {
    return res.status(400).json({ error: "Missing code" });
  }

  try {
    const results = await gradeSubmission(code, language, testCases);
    return res.json({ results });
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
});

export default router;
