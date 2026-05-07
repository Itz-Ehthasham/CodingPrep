import "dotenv/config";
import cors from "cors";
import express from "express";
import assistRouter from "../routes/AssistRoute.js";
import compileRouter from "../routes/CompileRoute.js";
import submitRouter from "../routes/SubmitRoute.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const frontendOrigin =
  process.env.FRONTEND_ORIGIN?.trim() || "http://localhost:5173";

app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/compile", compileRouter);
app.use("/api/submit", submitRouter);
app.use("/api/assist", assistRouter);

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
