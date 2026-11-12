// Полный сброс базы к демо-данным: npm run seed
import { openDb } from "./db.ts";
import { resetDb } from "./seed.ts";

const db = openDb();
resetDb(db);
db.close();
console.log("База сброшена к демо-данным");
