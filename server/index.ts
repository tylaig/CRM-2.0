import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import * as os from 'os';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Permitir configuração via variáveis de ambiente
  const port = process.env.PORT ? Number(process.env.PORT) : 5000;
  const host = process.env.HOST || "0.0.0.0";
  
  try {
    const server = app.listen(port, host, () => {
      console.log(`Servidor iniciado em http://${host}:${port}`);
      console.log(`Endereços de rede disponíveis:`);
      const networkInterfaces = os.networkInterfaces();
      Object.keys(networkInterfaces).forEach((interfaceName) => {
        networkInterfaces[interfaceName]?.forEach((details: os.NetworkInterfaceInfo) => {
          if (details.family === 'IPv4' && !details.internal) {
            console.log(`- http://${details.address}:${port}`);
          }
        });
      });
    });

    // Configurar timeout para conexões
    server.setTimeout(120000); // 2 minutos
    server.keepAliveTimeout = 61 * 1000;
    server.headersTimeout = 65 * 1000;
  } catch (error) {
    console.error('Erro ao iniciar o servidor:', error);
    process.exit(1);
  }

  // Adicionar tratamento de erro para o evento 'error'
  server.on('error', (error: any) => {
    console.error('Erro no servidor:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Porta ${port} já está em uso. Tente outra porta.`);
    } else if (error.code === 'ENOTSUP') {
      console.error('Erro: Não foi possível iniciar o servidor. Verifique as configurações de rede e permissões.');
    }
    process.exit(1);
  });
})();
