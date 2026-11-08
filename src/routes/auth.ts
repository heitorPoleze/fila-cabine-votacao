import { Router } from "express";
import { authService, tokenDaRequisicao } from "../services/AuthService";

const auth = Router();

auth.post("/login", async (req, res) => {
  const sessao = await authService.login(req.body?.nome, req.body?.senha);
  if (!sessao) {
    res.status(401).json({ error: "Nome ou senha incorretos" });
    return;
  }
  res.json(sessao);
});

/** Confere se o token salvo no navegador ainda vale (usado ao recarregar a página). */
auth.get("/me", (req, res) => {
  const admin = authService.verificar(tokenDaRequisicao(req));
  if (!admin) {
    res.status(401).json({ error: "Sessão expirada" });
    return;
  }
  res.json({ nome: admin.nome, expiraEm: new Date(admin.exp).toISOString() });
});

export default auth;
