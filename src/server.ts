import app from "./app";
import { env } from "./config/env";
import { testConnection } from "./config/database";

async function bootstrap(): Promise<void> {
  try {
    await testConnection();
    console.log("Conectado ao MySQL");
  } catch (err) {
    const { code, message } = err as NodeJS.ErrnoException;
    console.error("Falha ao conectar ao MySQL:", code ?? "", message);
    process.exit(1);
  }

  app.listen(env.PORT, () => {
    console.log(`Servidor rodando na porta ${env.PORT}`);
  });
}

bootstrap();
