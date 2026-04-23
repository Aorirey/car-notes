/**
 * HTTP API + раздача статики для Render Web Service.
 * Переменная окружения DATABASE_URL задаётся при подключении PostgreSQL на Render.
 */

import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { ensureSchema } from "./schema.mjs";
import { PATCH_COLUMN_MAP, rowToCar } from "./row-map.mjs";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const distDir = path.join(rootDir, "dist");

dotenv.config({ path: path.join(rootDir, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
const PORT = Number(process.env.PORT, 10) || 8787;

if (!DATABASE_URL) {
  console.error("FATAL: задайте DATABASE_URL (PostgreSQL на Render или локально).");
  process.exit(1);
}

function poolSsl(url) {
  const u = url.toLowerCase();
  if (process.env.DATABASE_SSL === "0") return false;
  if (u.includes("localhost") || u.includes("127.0.0.1")) return false;
  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: poolSsl(DATABASE_URL),
});

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "512kb" }));

app.get("/health", (_req, res) => {
  res.status(200).type("text/plain").send("ok");
});

app.get("/api/cars", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM garage_cars ORDER BY created_at ASC`,
    );
    res.json(rows.map(rowToCar));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Не удалось загрузить список" });
  }
});

app.get("/api/cars/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM garage_cars WHERE id = $1`, [
      req.params.id,
    ]);
    if (!rows.length) {
      res.status(404).json({ error: "Не найдено" });
      return;
    }
    res.json(rowToCar(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Ошибка запроса" });
  }
});

app.post("/api/cars", async (req, res) => {
  try {
    const title = String(req.body?.title ?? "").trim();
    if (!title) {
      res.status(400).json({ error: "Нужно поле title" });
      return;
    }
    const linkUrl = String(req.body?.linkUrl ?? "").trim();
    const { rows } = await pool.query(
      `INSERT INTO garage_cars (title, link_url)
       VALUES ($1, $2)
       RETURNING *`,
      [title, linkUrl],
    );
    res.status(201).json(rowToCar(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Не удалось создать запись" });
  }
});

app.patch("/api/cars/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const sets = [];
    const values = [];
    let i = 1;
    for (const [camel, col] of Object.entries(PATCH_COLUMN_MAP)) {
      if (!Object.prototype.hasOwnProperty.call(body, camel)) continue;
      let v = body[camel];
      if (v === null || v === undefined) v = "";
      v = String(v);
      sets.push(`${col} = $${i++}`);
      values.push(v);
    }
    if (!sets.length) {
      res.status(400).json({ error: "Нет полей для обновления" });
      return;
    }
    values.push(id);
    const sql = `UPDATE garage_cars SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`;
    const { rows } = await pool.query(sql, values);
    if (!rows.length) {
      res.status(404).json({ error: "Не найдено" });
      return;
    }
    res.json(rowToCar(rows[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Не удалось обновить" });
  }
});

app.delete("/api/cars/:id", async (req, res) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM garage_cars WHERE id = $1`, [
      req.params.id,
    ]);
    if (!rowCount) {
      res.status(404).json({ error: "Не найдено" });
      return;
    }
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Не удалось удалить" });
  }
});

/** На Render выставляется RENDER=true; NODE_ENV может отличаться у провайдера. */
const serveStatic =
  process.env.NODE_ENV === "production" || process.env.RENDER === "true";

if (serveStatic) {
  app.use(
    express.static(distDir, {
      index: false,
      maxAge: "1h",
    }),
  );
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path === "/health") return next();
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    res.sendFile(path.join(distDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

async function main() {
  await ensureSchema(pool);
  app.listen(PORT, () => {
    console.log(`car-notes server http://localhost:${PORT}`);
    if (serveStatic) {
      console.log(`static: ${distDir}`);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
