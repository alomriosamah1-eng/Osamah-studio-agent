import { DatabaseSync } from "node:sqlite";

const database = new DatabaseSync(":memory:");
try {
  database.exec("CREATE VIRTUAL TABLE memory_search_probe USING fts5(title, content, tokenize='unicode61 remove_diacritics 2');");
  database.prepare("INSERT INTO memory_search_probe(title, content) VALUES (?, ?)").run("قرار عربي", "محتوى محلي bounded");
  const result = database.prepare("SELECT title FROM memory_search_probe WHERE memory_search_probe MATCH ?").all("عربي");
  console.log(`FTS5_AVAILABLE=${result.length === 1}`);
} finally {
  database.close();
}
