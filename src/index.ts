import 'dotenv/config';
import express, { Request, Response } from 'express';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {
  AppConfig,
  TeamConfig,
  SUPPORTED_GITHUB_EVENTS,
  WEBHOOK_PATH,
  DEFAULT_PORT,
} from './types/index';
import { ConfigLoader } from './config/configLoader';
import { NotificationDispatcher } from './notification/notificationDispatcher';
import { WebhookReceiver } from './webhook/webhookReceiver';

type DispatchFn = (eventType: string, payload: unknown, teamConfig: TeamConfig) => Promise<void>;

interface AppOptions {
  config: AppConfig;
  dispatchOverride?: DispatchFn;
}

export function createApp({ config, dispatchOverride }: AppOptions): express.Application {
  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? '';
  const loader = new ConfigLoader(config);
  const dispatcher = new NotificationDispatcher(loader);
  const dispatchFn: DispatchFn = dispatchOverride ?? dispatcher.dispatch.bind(dispatcher);

  const app = express();

  app.use(
    express.json({
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post(WEBHOOK_PATH, async (req: Request & { rawBody?: Buffer }, res: Response) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const eventType = req.headers['x-github-event'] as string | undefined;
    const rawBody = req.rawBody;

    // INV-01: verify signature before any business logic
    if (!signature || !rawBody || !WebhookReceiver.verifySignature(rawBody, signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // INV-04: silently drop unsupported event types
    if (!eventType || !(SUPPORTED_GITHUB_EVENTS as readonly string[]).includes(eventType)) {
      return res.status(200).json({ message: 'Event ignored' });
    }

    const payload = req.body as Record<string, unknown>;
    const repoFullName = (payload?.repository as Record<string, unknown> | undefined)?.full_name as string | undefined;

    // INV-04: silently drop events for unconfigured repositories
    const routeResult = loader.findTeamByRepo(repoFullName ?? '');
    if (!routeResult.found || !routeResult.teamConfig) {
      return res.status(200).json({ message: 'Repository not configured' });
    }

    // INV-03: dispatch errors must not affect the 200 response
    try {
      await dispatchFn(eventType, payload, routeResult.teamConfig);
    } catch (err) {
      console.error('[Webhook] Dispatch error:', err);
    }

    return res.status(200).json({ message: 'OK' });
  });

  return app;
}

export function loadConfigFromYaml(configPath: string): AppConfig {
  const raw = fs.readFileSync(configPath, 'utf8');
  return yaml.load(raw) as AppConfig;
}

if (require.main === module) {
  if (!process.env.GITHUB_WEBHOOK_SECRET) {
    console.error('[startup] GITHUB_WEBHOOK_SECRET is required but not set');
    process.exit(1);
  }
  const configPath = process.env.CONFIG_PATH ?? './config.yaml';
  const config = loadConfigFromYaml(configPath);
  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  const app = createApp({ config });
  app.listen(port, () => {
    console.log(`lark-pr-bot listening on port ${port}`);
  });
}
