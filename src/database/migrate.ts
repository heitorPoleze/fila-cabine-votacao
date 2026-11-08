import { env } from "../config/env";
import { aplicarSchema } from "./schema";

aplicarSchema()
  .then(() => console.log(`Tabelas criadas no banco "${env.DB_NAME}"`))
  .catch((err) => {
    console.error("Falha ao criar as tabelas:", err);
    process.exit(1);
  });
