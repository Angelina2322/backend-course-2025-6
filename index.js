// index.js
import { Command } from "commander";
import http from "http";
import fs from "fs";
import path from "path";

const program = new Command();

program
  .requiredOption("-h, --host <host>", "server host")
  .requiredOption("-p, --port <port>", "server port")
  .requiredOption("-c, --cache <path>", "path to cache directory");

program.parse(process.argv);

const options = program.opts();

// ✅ Перевіряємо, чи існує директорія кешу
if (!fs.existsSync(options.cache)) {
  console.log(`Cache directory not found. Creating: ${options.cache}`);
  fs.mkdirSync(options.cache, { recursive: true });
}

// ✅ Створюємо веб-сервер
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Server is running successfully!");
});

// ✅ Запускаємо сервер
server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}/`);
});
