import { Router } from "express";

export const agentRouter = Router();

agentRouter.post("/query", (req, res) => {
  const { prompt } = req.body;
  res.json({
    status: "success",
    message: "NPS-Core Agent Received Prompt: " + prompt,
    data: {
      action: "think",
      params: { 
        thought: "Analyse -> Planification -> Exécution -> Vérification" 
      }
    }
  });
});
