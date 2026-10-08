import path from "node:path";
import dotenv from "dotenv";

// Local dev loads .env from the project root; in SPCS the env is injected and
// the file is simply absent (dotenv ignores a missing path).
dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

import express from "express";
import cors from "cors";
import apiRouter from "./routes/api.js";
import opsRouter from "./routes/ops.js";

const app = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);

app.use(cors());
app.use(express.json());

// Liveness/readiness probe for SPCS.
app.get("/healthcheck", (_req, res) => res.status(200).send("ok"));

app.use(apiRouter);
app.use(opsRouter);

// Serve the built React client when packaged in the container.
// CLIENT_DIST is set in the Dockerfile to the client/dist output directory.
const clientDist = process.env.CLIENT_DIST;
if (clientDist) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET returns index.html.
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT} (spcs=${!!process.env.SNOWFLAKE_HOST})`);
  // Startup self-check: confirm the app-view data path resolves (SPCS only).
  if (process.env.SNOWFLAKE_HOST) {
    import("./services/snowflake.js")
      .then(async ({ runQuery }) => {
        const ctx = await runQuery(
          "SELECT CURRENT_DATABASE() AS db, CURRENT_SCHEMA() AS sch, CURRENT_ROLE() AS role, CURRENT_WAREHOUSE() AS wh"
        );
        console.log("SELFCHECK ctx: " + JSON.stringify(ctx[0]));
        const dbs = await runQuery("SHOW DATABASES");
        console.log("SELFCHECK dbs: " + JSON.stringify(dbs.map((r) => r["name"])));
        const cnt = await runQuery("SELECT COUNT(*) AS n FROM APP_DATA.DT_MANUFACTURING_KPI");
        console.log(`SELFCHECK ok: DT_MANUFACTURING_KPI rows=${cnt[0]?.n}`);
      })
      .catch((e) => console.error("SELFCHECK failed:", String(e)));
  }
});
