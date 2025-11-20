import { Command } from "commander";
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

const program = new Command();

program
  .requiredOption("-h, --host <host>", "server host")
  .requiredOption("-p, --port <port>", "server port")
  .requiredOption("-c, --cache <path>", "path to cache directory");

program.parse(process.argv);
const options = program.opts();

// Перевіряємо директорію кешу
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

// ===================== SWAGGER =====================
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Inventory API',
      version: '1.0.0',
      description: 'API для реєстрації та пошуку пристроїв',
    },
    servers: [
      { url: `http://${options.host}:${options.port}` }
    ],
  },
  apis: ['./index.js'],
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===================== ЕНДПОІНТИ =====================

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Реєстрація нового пристрою
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Пристрій успішно створено
 *       400:
 *         description: Не передано inventory_name
 */
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

/**
 * @swagger
 * /inventory:
 *   get:
 *     summary: Отримати всі пристрої
 *     responses:
 *       200:
 *         description: Список пристроїв
 */
app.get("/inventory", (req, res) => {
  res.json(inventory);
});

/**
 * @swagger
 * /inventory/{id}:
 *   get:
 *     summary: Отримати інформацію про конкретний пристрій
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Інформація про пристрій
 *       404:
 *         description: Пристрій не знайдено
 */
app.get("/inventory/:id", (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

/**
 * @swagger
 * /inventory/{id}:
 *   put:
 *     summary: Оновлення даних пристрою
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inventory_name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Дані оновлено
 *       404:
 *         description: Пристрій не знайдено
 */
app.put("/inventory/:id", (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Not found" });

  const { inventory_name, description } = req.body;
  if (inventory_name) item.inventory_name = inventory_name;
  if (description) item.description = description;

  res.json(item);
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   get:
 *     summary: Отримати фото пристрою
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Фото пристрою
 *       404:
 *         description: Фото не знайдено
 */
app.get("/inventory/:id/photo", (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item || !item.photo) return res.status(404).json({ error: "Not found" });

  const photoPath = path.join(options.cache, item.photo);
  if (!fs.existsSync(photoPath)) return res.status(404).json({ error: "Not found" });

  res.sendFile(photoPath, { headers: { "Content-Type": "image/jpeg" } });
});

/**
 * @swagger
 * /inventory/{id}/photo:
 *   put:
 *     summary: Оновлення фото пристрою
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               photo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Фото оновлено
 *       404:
 *         description: Пристрій не знайдено
 */
app.put("/inventory/:id/photo", upload.single("photo"), (req, res) => {
  const item = inventory.find(i => i.id === parseInt(req.params.id));
  if (!item) return res.status(404).json({ error: "Not found" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  item.photo = req.file.filename;
  res.json(item);
});

/**
 * @swagger
 * /inventory/{id}:
 *   delete:
 *     summary: Видалення пристрою
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: Пристрій видалено
 *       404:
 *         description: Пристрій не знайдено
 */
app.delete("/inventory/:id", (req, res) => {
  const index = inventory.findIndex(i => i.id === parseInt(req.params.id));
  if (index === -1) return res.status(404).json({ error: "Not found" });

  const deleted = inventory.splice(index, 1);
  res.json(deleted[0]);
});

/**
 * @swagger
 * /RegisterForm.html:
 *   get:
 *     summary: Форма для реєстрації пристрою
 *     responses:
 *       200:
 *         description: HTML сторінка
 */
app.get("/RegisterForm.html", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "RegisterForm.html"));
});

/**
 * @swagger
 * /SearchForm.html:
 *   get:
 *     summary: Форма для пошуку пристрою
 *     responses:
 *       200:
 *         description: HTML сторінка
 */
app.get("/SearchForm.html", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "SearchForm.html"));
});

/**
 * @swagger
 * /search:
 *   post:
 *     summary: Пошук пристрою за ID
 *     requestBody:
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               has_photo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Пристрій знайдено
 *       404:
 *         description: Пристрій не знайдено
 */
app.post("/search", (req, res) => {
  const { id, has_photo } = req.body;
  const item = inventory.find(i => i.id === parseInt(id));
  if (!item) return res.status(404).json({ error: "Not found" });

  const result = { ...item };
  if (!has_photo) delete result.photo;
  res.json(result);
});

// ===================== 405 для всіх інших методів =====================
app.use((req, res, next) => {
  res.status(405).json({ error: "Method not allowed" });
});

// ===================== ЗАПУСК СЕРВЕРА =====================
app.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});
