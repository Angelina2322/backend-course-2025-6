// index.js
import { Command } from "commander";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

const program = new Command();

program
  .requiredOption("-h, --host <host>", "server host")
  .requiredOption("-p, --port <port>", "server port")
  .requiredOption("-c, --cache <path>", "path to cache directory");

program.parse(process.argv);
const options = program.opts();

// ✅ Перевіряємо директорію кешу
if (!fs.existsSync(options.cache)) {
  console.log(`Cache directory not found. Creating: ${options.cache}`);
  fs.mkdirSync(options.cache, { recursive: true });
}

// ===================== EXPRESS SERVER =====================
const app = express();

// Для обробки JSON у PUT/POST
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===================== MULTER =====================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, options.cache);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ===================== БАЗА ДАНИХ В ПАМ'ЯТІ =====================
let inventory = []; // Зберігаємо об'єкти {id, inventory_name, description, photo}

// ===================== ЕНДПОІНТИ =====================

// POST /register — реєстрація нового пристрою
app.post("/register", upload.single("photo"), (req, res) => {
  const { inventory_name, description } = req.body;
  if (!inventory_name) {
    return res.status(400).json({ error: "inventory_name is required" });
  }

  const newItem = {
    id: inventory.length + 1,
    inventory_name,
    description: description || "",
    photo: req.file ? req.file.filename : null
  };

  inventory.push(newItem);
  res.status(201).json(newItem);
});

// GET /inventory — список всіх речей
app.get("/inventory", (req, res) => {
  res.json(inventory);
});

// GET /inventory/:id — інформація про конкретну річ
app.get("/inventory/:id", (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

// PUT /inventory/:id — оновлення імені або опису
app.put("/inventory/:id", (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Not found" });

  const { inventory_name, description } = req.body;
  if (inventory_name) item.inventory_name = inventory_name;
  if (description) item.description = description;

  res.json(item);
});

// GET /inventory/:id/photo — отримання фото
app.get("/inventory/:id/photo", (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item || !item.photo) return res.status(404).json({ error: "Not found" });

  const photoPath = path.join(options.cache, item.photo);
  if (!fs.existsSync(photoPath)) return res.status(404).json({ error: "Not found" });

  res.sendFile(photoPath, { headers: { "Content-Type": "image/jpeg" } });
});

// PUT /inventory/:id/photo — оновлення фото
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  item.photo = req.file.filename;
  res.json(item);
});

// DELETE /inventory/:id — видалення
app.delete("/inventory/:id", (req, res) => {
  const index = inventory.findIndex(i => i.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Not found" });

  const deleted = inventory.splice(index, 1);
  res.json(deleted[0]);
});

// ===================== 405 для всіх інших методів =====================
app.all("*", (req, res) => {
  res.status(405).json({ error: "Method not allowed" });
});

// ===================== ЗАПУСК СЕРВЕРА =====================
app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});
