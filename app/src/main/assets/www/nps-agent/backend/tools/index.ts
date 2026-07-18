import { Router } from "express";

export const toolsRouter = Router();

toolsRouter.post("/execute", (req, res) => {
  const { tool, params } = req.body;
  res.json({
    status: "success",
    tool,
    result: `Tool ${tool} executed successfully.`
  });
});
