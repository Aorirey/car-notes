import express from "express";
import { PATCH_COLUMN_MAP, rowToCar } from "../row-map.mjs";
import { authenticateJwt } from "../middleware/auth.mjs";
import { logger } from "../logger.mjs";

const ALLOWED_STATUS = new Set([
  "found",
  "negotiating",
  "bought",
  "repair",
  "for_sale",
  "sold",
  "archive",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** @param {string} input */
function sanitizePrice(input) {
  const value = String(input ?? "")
    .replace(/[^\d.,]/g, "")
    .replace(/\s+/g, "")
    .trim();
  if (!value) return "";
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ru-RU");
}

/**
 * @param {import("pg").Pool} pool
 */
export function createCarsRouter(pool) {
  const router = express.Router();

  router.get("/compare", async (req, res) => {
    try {
      const idsRaw = req.query.ids;
      const idRaw = req.query.id;
      const fromIds = Array.isArray(idsRaw)
        ? idsRaw
        : typeof idsRaw === "string"
          ? idsRaw.split(",")
          : [];
      const fromId = Array.isArray(idRaw)
        ? idRaw
        : typeof idRaw === "string"
          ? idRaw.split(",")
          : [];
      const ids = [...fromIds, ...fromId]
        .map((id) => String(id).trim())
        .filter(Boolean);
      if (!ids.length) {
        res.json([]);
        return;
      }
      if (ids.length > 4) {
        res.status(400).json({ error: "Можно сравнить максимум 4 авто" });
        return;
      }
      const validIds = ids.filter((id) => UUID_RE.test(id));
      if (!validIds.length) {
        res.json([]);
        return;
      }

      const { rows } = await pool.query(`SELECT * FROM garage_cars WHERE id = ANY($1::uuid[])`, [
        validIds,
      ]);
      const byId = new Map(rows.map((row) => [String(row.id), row]));
      const ordered = validIds.map((id) => byId.get(id)).filter(Boolean).map(rowToCar);
      res.json(ordered);
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Ошибка загрузки данных сравнения" });
    }
  });

  router.get("/", async (req, res) => {
    try {
      const conditions = [];
      const values = [];
      let i = 1;

      const status = String(req.query.status ?? "").trim();
      if (status) {
        conditions.push(`status = $${i++}`);
        values.push(status);
      }

      const assignedTo = String(req.query.assigned_to ?? "").trim();
      if (assignedTo) {
        conditions.push(`assigned_to = $${i++}`);
        values.push(assignedTo);
      }

      const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const sql = `SELECT * FROM garage_cars ${whereSql} ORDER BY created_at ASC`;
      const { rows } = await pool.query(sql, values);
      res.json(rows.map(rowToCar));
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Не удалось загрузить список" });
    }
  });

  router.get("/:id", async (req, res) => {
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
      logger.error(e);
      res.status(500).json({ error: "Ошибка запроса" });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const title = String(req.body?.title ?? "").trim();
      if (!title) {
        res.status(400).json({ error: "Нужно поле title" });
        return;
      }
      const linkUrl = String(req.body?.linkUrl ?? "").trim();
      const purchasePrice = sanitizePrice(String(req.body?.purchasePrice ?? ""));
      const mileageRaw = req.body?.mileage;
      const mileage =
        mileageRaw === null || mileageRaw === undefined || mileageRaw === ""
          ? null
          : Number.parseInt(String(mileageRaw), 10);
      const { rows } = await pool.query(
        `INSERT INTO garage_cars (title, link_url, purchase_price, mileage)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [title, linkUrl, purchasePrice, Number.isNaN(mileage) ? null : mileage],
      );
      res.status(201).json(rowToCar(rows[0]));
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Не удалось создать запись" });
    }
  });

  router.patch("/:id", async (req, res) => {
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
        if (camel === "mileage") {
          v = v === "" ? null : Number.parseInt(String(v), 10);
          if (v !== null && Number.isNaN(v)) continue;
        } else if (camel === "purchasePrice" || camel === "salePrice" || camel === "investedAmount") {
          v = sanitizePrice(v);
        } else if (camel === "photos") {
          v = JSON.stringify(Array.isArray(v) ? v : []);
          sets.push(`${col} = $${i++}::jsonb`);
          values.push(v);
          continue;
        } else if (camel === "assignedTo") {
          v = String(v).trim() || null;
        } else {
          v = String(v);
        }
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
      logger.error(e);
      res.status(500).json({ error: "Не удалось обновить" });
    }
  });

  router.patch("/:id/status", authenticateJwt, async (req, res) => {
    try {
      const id = req.params.id;
      const status = String(req.body?.status ?? "").trim();
      if (!ALLOWED_STATUS.has(status)) {
        res.status(400).json({ error: "Некорректный статус" });
        return;
      }

      const { rows: foundRows } = await pool.query(
        `SELECT id, assigned_to FROM garage_cars WHERE id = $1`,
        [id],
      );
      if (!foundRows.length) {
        res.status(404).json({ error: "Не найдено" });
        return;
      }

      const car = foundRows[0];
      const isAdmin = req.user?.role === "admin";
      const isAssigned = car.assigned_to && String(car.assigned_to) === String(req.user?.id ?? "");
      if (!isAdmin && !isAssigned) {
        res.status(403).json({ error: "Недостаточно прав" });
        return;
      }

      const { rows } = await pool.query(
        `UPDATE garage_cars
         SET status = $1
         WHERE id = $2
         RETURNING *`,
        [status, id],
      );
      res.json(rowToCar(rows[0]));
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Не удалось обновить статус" });
    }
  });

  router.post("/:id/photos", authenticateJwt, async (req, res) => {
    try {
      const id = req.params.id;
      const rawPhoto = req.body?.photo ?? req.body?.url;
      const photo =
        typeof rawPhoto === "string"
          ? rawPhoto.trim()
          : rawPhoto && typeof rawPhoto === "object"
            ? rawPhoto
            : "";
      if (!photo) {
        res.status(400).json({ error: "Нужно поле photo или url" });
        return;
      }

      const payload = JSON.stringify([photo]);
      const { rows } = await pool.query(
        `UPDATE garage_cars
         SET photos = COALESCE(photos, '[]'::jsonb) || $1::jsonb
         WHERE id = $2
         RETURNING *`,
        [payload, id],
      );
      if (!rows.length) {
        res.status(404).json({ error: "Не найдено" });
        return;
      }
      res.status(201).json(rowToCar(rows[0]));
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Не удалось добавить фото" });
    }
  });

  router.delete("/:id", async (req, res) => {
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
      logger.error(e);
      res.status(500).json({ error: "Не удалось удалить" });
    }
  });

  return router;
}
