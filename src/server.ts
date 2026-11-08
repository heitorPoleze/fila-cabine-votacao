import { createServer } from "node:http";
import app from "./app";
import { testConnection } from "./config/database";
import { env } from "./config/env";
import { attachFilaSocket } from "./controllers/filaSocket";
import { aplicarSchema } from "./database/schema";
import { authService } from "./services/AuthService";
import { filaService } from "./services/FilaService";

async function bootstrap(): Promise<void> {
  try {
    await aplicarSchema();
    await testConnection();
    console.log("Conectado ao MySQL");
  } catch (err) {
    const { code, message } = err as NodeJS.ErrnoException;
    console.error("Falha ao preparar o MySQL:", code ?? "", message);
    process.exit(1);
  }

  if (await authService.garantirAdminPadrao()) {
    console.log(`Admin padrão criado: login "${env.ADMIN_USER}"`);
  }

  const server = createServer(app);
  attachFilaSocket(server);
  await new Promise<void>((resolve) => {
    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          [
            "",
            `A porta ${env.PORT} já está em uso: já existe um back rodando (outro terminal ou nodemon).`,
            "Feche o outro servidor ou mude PORT no .env e rode de novo.",
            "",
          ].join("\n"),
        );
      } else {
        console.error("Falha no servidor HTTP:", err.message);
      }
      process.exit(1);
    });
    server.listen(env.PORT, resolve);
  });

  await filaService.carregar();
  if (env.SEED_MOCK && filaService.totalAguardandoMock === 0) {
    const mocks = await filaService.popularMock();
    console.log(`${mocks.length} pessoas de demonstração colocadas na fila Mock (isolada da fila real)`);
  }

  console.log(`Servidor rodando na porta ${env.PORT}`);
  console.log(`WebSocket em ws://localhost:${env.PORT}/ws`);
  console.log(
    env.CHAMADA_AUTOMATICA
      ? "Chamada automática: o próximo entra na cabine assim que ela fica livre"
      : "Chamada manual: o administrador chama cada pessoa para a cabine",
  );
}

bootstrap().catch((err) => {
  console.error("Falha ao iniciar o servidor:", err);
  process.exit(1);
});
