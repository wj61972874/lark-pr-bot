// trace: docs/traces/FEAT-3c25-lark-pr-bot.md
// spec:  docs/specs/FEAT-3c25-lark-pr-bot.spec.md

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import {
  AppConfig,
  TeamConfig,
  ConfigValidationError,
  LarkCardColor,
  NotificationType,
  BODY_TRUNCATE_LENGTH,
} from '../src/types/index';
import { ConfigLoader } from '../src/config/configLoader';
import { NotificationDispatcher } from '../src/notification/notificationDispatcher';
import { WebhookReceiver } from '../src/webhook/webhookReceiver';
import { createApp } from '../src/index';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'test-secret-123';

const TEAM_FRONTEND: TeamConfig = {
  name: 'frontend',
  lark_webhook: 'https://open.feishu.cn/open-apis/bot/v2/hook/frontend-xxx',
  repositories: ['org/frontend-app', 'org/design-system'],
  user_mappings: {
    alice: 'lark_alice_001',
    bob: 'lark_bob_002',
    carol: 'lark_carol_003',
  },
};

const TEAM_BACKEND: TeamConfig = {
  name: 'backend',
  lark_webhook: 'https://open.feishu.cn/open-apis/bot/v2/hook/backend-yyy',
  repositories: ['org/backend-api'],
  user_mappings: {
    dave: 'lark_dave_004',
  },
};

const APP_CONFIG: AppConfig = {
  teams: [TEAM_FRONTEND, TEAM_BACKEND],
};

const makePROpenedPayload = (overrides: Partial<{
  repo: string;
  prNumber: number;
  creator: string;
  reviewers: string[];
  title: string;
  body: string;
}> = {}) => ({
  action: 'opened',
  pull_request: {
    number: overrides.prNumber ?? 42,
    title: overrides.title ?? 'feat: add new dashboard',
    body: overrides.body ?? 'This PR adds a new dashboard component.',
    html_url: 'https://github.com/org/frontend-app/pull/42',
    user: { login: overrides.creator ?? 'alice', avatar_url: '', html_url: '' },
    requested_reviewers: (overrides.reviewers ?? ['bob', 'carol']).map(login => ({
      login, avatar_url: '', html_url: '',
    })),
    merged: false,
    state: 'open',
  },
  repository: {
    full_name: overrides.repo ?? 'org/frontend-app',
    html_url: 'https://github.com/org/frontend-app',
  },
  sender: { login: overrides.creator ?? 'alice', avatar_url: '', html_url: '' },
});

const makePRClosedPayload = (merged: boolean, repo = 'org/frontend-app') => ({
  action: 'closed',
  pull_request: {
    number: 42,
    title: 'feat: add new dashboard',
    body: 'desc',
    html_url: 'https://github.com/org/frontend-app/pull/42',
    user: { login: 'alice', avatar_url: '', html_url: '' },
    requested_reviewers: [],
    merged,
    state: 'closed',
  },
  repository: { full_name: repo, html_url: 'https://github.com/org/frontend-app' },
  sender: { login: merged ? 'bob' : 'alice', avatar_url: '', html_url: '' },
});

const makeReviewSubmittedPayload = (state: 'approved' | 'changes_requested' | 'commented') => ({
  action: 'submitted',
  review: {
    state,
    body: 'LGTM! Nice work.',
    html_url: 'https://github.com/org/frontend-app/pull/42#pullrequestreview-1',
    user: { login: 'bob', avatar_url: '', html_url: '' },
  },
  pull_request: {
    number: 42,
    title: 'feat: add new dashboard',
    body: 'desc',
    html_url: 'https://github.com/org/frontend-app/pull/42',
    user: { login: 'alice', avatar_url: '', html_url: '' },
    requested_reviewers: [],
    merged: false,
    state: 'open',
  },
  repository: { full_name: 'org/frontend-app', html_url: 'https://github.com/org/frontend-app' },
  sender: { login: 'bob', avatar_url: '', html_url: '' },
});

const signPayload = (body: string, secret: string): string => {
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${sig}`;
};

// ─── ConfigLoader ─────────────────────────────────────────────────────────────

describe('ConfigLoader', () => {
  it('loads valid config with multiple teams', () => {
    const loader = new ConfigLoader(APP_CONFIG);
    const config = loader.getConfig();
    expect(config.teams).toHaveLength(2);
    expect(config.teams[0].name).toBe('frontend');
  });

  it('throws ConfigValidationError when a repository appears in multiple teams (INV-02)', () => {
    const duplicateConfig: AppConfig = {
      teams: [
        { ...TEAM_FRONTEND, repositories: ['org/shared-repo'] },
        { ...TEAM_BACKEND, repositories: ['org/shared-repo'] },
      ],
    };
    expect(() => new ConfigLoader(duplicateConfig)).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError with a message identifying the duplicate repo (INV-02)', () => {
    const duplicateConfig: AppConfig = {
      teams: [
        { ...TEAM_FRONTEND, repositories: ['org/conflict'] },
        { ...TEAM_BACKEND, repositories: ['org/conflict'] },
      ],
    };
    expect(() => new ConfigLoader(duplicateConfig)).toThrow('org/conflict');
  });

  it('routes known repository to correct team', () => {
    const loader = new ConfigLoader(APP_CONFIG);
    const result = loader.findTeamByRepo('org/frontend-app');
    expect(result.found).toBe(true);
    expect(result.teamConfig?.name).toBe('frontend');
  });

  it('routes other team repository correctly (multi-team isolation)', () => {
    const loader = new ConfigLoader(APP_CONFIG);
    const result = loader.findTeamByRepo('org/backend-api');
    expect(result.found).toBe(true);
    expect(result.teamConfig?.name).toBe('backend');
  });

  it('returns found=false for unknown repository (INV-04)', () => {
    const loader = new ConfigLoader(APP_CONFIG);
    const result = loader.findTeamByRepo('org/unknown-repo');
    expect(result.found).toBe(false);
    expect(result.teamConfig).toBeUndefined();
  });

  it('resolves lark user id from github username', () => {
    const loader = new ConfigLoader(APP_CONFIG);
    const larkId = loader.getLarkUserId(TEAM_FRONTEND, 'alice');
    expect(larkId).toBe('lark_alice_001');
  });

  it('returns undefined for unmapped github username', () => {
    const loader = new ConfigLoader(APP_CONFIG);
    const larkId = loader.getLarkUserId(TEAM_FRONTEND, 'unknown_user');
    expect(larkId).toBeUndefined();
  });
});

// ─── NotificationDispatcher — Card Building ──────────────────────────────────

describe('NotificationDispatcher — card building', () => {
  let mockLarkPost: ReturnType<typeof vi.fn>;
  let dispatcher: NotificationDispatcher;

  beforeEach(() => {
    mockLarkPost = vi.fn().mockResolvedValue({ status: 200, data: { code: 0 } });
    const loader = new ConfigLoader(APP_CONFIG);
    dispatcher = new NotificationDispatcher(loader, mockLarkPost);
  });

  it('PR_OPENED: sends blue card (AC-1 — new PR notifies reviewers)', async () => {
    const payload = makePROpenedPayload();
    await dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND);
    expect(mockLarkPost).toHaveBeenCalledOnce();
    const [, message] = mockLarkPost.mock.calls[0];
    expect(message.card.header.template).toBe<LarkCardColor>('blue');
  });

  it('PR_OPENED: card contains PR title and repo name', async () => {
    const payload = makePROpenedPayload({ title: 'feat: awesome feature', repo: 'org/frontend-app' });
    await dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    const cardText = JSON.stringify(message);
    expect(cardText).toContain('feat: awesome feature');
    expect(cardText).toContain('org/frontend-app');
  });

  it('PR_OPENED: @mentions all requested reviewers', async () => {
    const payload = makePROpenedPayload({ reviewers: ['bob', 'carol'] });
    await dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    const cardText = JSON.stringify(message);
    expect(cardText).toContain('lark_bob_002');
    expect(cardText).toContain('lark_carol_003');
  });

  it('PR_OPENED: skips @ for reviewer without lark mapping', async () => {
    const payload = makePROpenedPayload({ reviewers: ['unknown_dev'] });
    await expect(dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND))
      .resolves.not.toThrow();
    expect(mockLarkPost).toHaveBeenCalledOnce();
  });

  it('PR_MERGED: sends green card (AC-3)', async () => {
    const payload = makePRClosedPayload(true);
    await dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    expect(message.card.header.template).toBe<LarkCardColor>('green');
  });

  it('PR_CLOSED (non-merge): sends red card (AC-4)', async () => {
    const payload = makePRClosedPayload(false);
    await dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    expect(message.card.header.template).toBe<LarkCardColor>('red');
  });

  it('PR_MERGED / PR_CLOSED: @mentions PR creator', async () => {
    const payload = makePRClosedPayload(true);
    await dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    expect(JSON.stringify(message)).toContain('lark_alice_001');
  });

  it('REVIEW_APPROVED: sends green card (AC-3)', async () => {
    const payload = makeReviewSubmittedPayload('approved');
    await dispatcher.dispatch('pull_request_review', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    expect(message.card.header.template).toBe<LarkCardColor>('green');
  });

  it('REVIEW_CHANGES_REQUESTED: sends red card', async () => {
    const payload = makeReviewSubmittedPayload('changes_requested');
    await dispatcher.dispatch('pull_request_review', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    expect(message.card.header.template).toBe<LarkCardColor>('red');
  });

  it('REVIEW_COMMENTED: sends orange card (AC-2)', async () => {
    const payload = makeReviewSubmittedPayload('commented');
    await dispatcher.dispatch('pull_request_review', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    expect(message.card.header.template).toBe<LarkCardColor>('orange');
  });

  it('REVIEW_*: @mentions PR creator', async () => {
    const payload = makeReviewSubmittedPayload('approved');
    await dispatcher.dispatch('pull_request_review', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    expect(JSON.stringify(message)).toContain('lark_alice_001');
  });

  it('REVIEW_*: card contains review body content', async () => {
    const payload = makeReviewSubmittedPayload('approved');
    await dispatcher.dispatch('pull_request_review', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    expect(JSON.stringify(message)).toContain('LGTM');
  });

  it('truncates long PR body to BODY_TRUNCATE_LENGTH chars', async () => {
    const longBody = 'x'.repeat(500);
    const payload = makePROpenedPayload({ body: longBody });
    await dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND);
    const [, message] = mockLarkPost.mock.calls[0];
    const cardText = JSON.stringify(message);
    expect(cardText).not.toContain('x'.repeat(BODY_TRUNCATE_LENGTH + 1));
  });
});

// ─── NotificationDispatcher — Failure Journeys ───────────────────────────────

describe('NotificationDispatcher — failure journeys', () => {
  it('INV-03: Lark 5xx does not throw, logs error', async () => {
    const mockLarkPost = vi.fn().mockRejectedValue(new Error('Lark 500'));
    const loader = new ConfigLoader(APP_CONFIG);
    const dispatcher = new NotificationDispatcher(loader, mockLarkPost);
    const payload = makePROpenedPayload();
    await expect(dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND))
      .resolves.not.toThrow();
  });

  it('INV-03: Lark timeout does not throw', async () => {
    const mockLarkPost = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    const loader = new ConfigLoader(APP_CONFIG);
    const dispatcher = new NotificationDispatcher(loader, mockLarkPost);
    const payload = makePROpenedPayload();
    await expect(dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND))
      .resolves.not.toThrow();
  });

  it('sends to correct Lark webhook URL for the routed team', async () => {
    const mockLarkPost = vi.fn().mockResolvedValue({ status: 200, data: { code: 0 } });
    const loader = new ConfigLoader(APP_CONFIG);
    const dispatcher = new NotificationDispatcher(loader, mockLarkPost);
    const payload = makePROpenedPayload({ repo: 'org/frontend-app' });
    await dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND);
    expect(mockLarkPost.mock.calls[0][0]).toBe(TEAM_FRONTEND.lark_webhook);
  });
});

// ─── WebhookReceiver — Signature Verification (INV-01) ───────────────────────

describe('WebhookReceiver — signature verification (INV-01)', () => {
  let app: express.Application;
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
    mockDispatch = vi.fn().mockResolvedValue(undefined);
    app = createApp({ config: APP_CONFIG, dispatchOverride: mockDispatch });
  });

  afterEach(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  it('INV-01: returns 401 for missing signature header', async () => {
    const res = await request(app)
      .post('/webhook')
      .set('X-GitHub-Event', 'pull_request')
      .send(makePROpenedPayload());
    expect(res.status).toBe(401);
  });

  it('INV-01: returns 401 for invalid signature', async () => {
    const body = JSON.stringify(makePROpenedPayload());
    const res = await request(app)
      .post('/webhook')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', 'sha256=badhash')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(401);
  });

  it('INV-01: dispatcher NOT called when signature is invalid', async () => {
    const body = JSON.stringify(makePROpenedPayload());
    await request(app)
      .post('/webhook')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', 'sha256=badhash')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('returns 200 for valid signature', async () => {
    const body = JSON.stringify(makePROpenedPayload());
    const sig = signPayload(body, WEBHOOK_SECRET);
    const res = await request(app)
      .post('/webhook')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', sig)
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(200);
  });
});

// ─── WebhookReceiver — FSM State Transitions ─────────────────────────────────

describe('WebhookReceiver — FSM state transitions', () => {
  let app: express.Application;
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
    mockDispatch = vi.fn().mockResolvedValue(undefined);
    app = createApp({ config: APP_CONFIG, dispatchOverride: mockDispatch });
  });

  afterEach(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  const postWebhook = (eventType: string, payload: object) => {
    const body = JSON.stringify(payload);
    const sig = signPayload(body, WEBHOOK_SECRET);
    return request(app)
      .post('/webhook')
      .set('X-GitHub-Event', eventType)
      .set('X-Hub-Signature-256', sig)
      .set('Content-Type', 'application/json')
      .send(body);
  };

  it('FSM: VERIFYING → REJECTED (invalid sig) → 401, no dispatch', async () => {
    const body = JSON.stringify(makePROpenedPayload());
    const res = await request(app)
      .post('/webhook')
      .set('X-GitHub-Event', 'pull_request')
      .set('X-Hub-Signature-256', 'sha256=wrong')
      .set('Content-Type', 'application/json')
      .send(body);
    expect(res.status).toBe(401);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('FSM: ROUTING → IGNORED (unknown repo) → 200, no dispatch (INV-04)', async () => {
    const payload = makePROpenedPayload({ repo: 'org/totally-unknown' });
    const res = await postWebhook('pull_request', payload);
    expect(res.status).toBe(200);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('FSM: ROUTING → DISPATCHING (known repo) → dispatch called', async () => {
    const payload = makePROpenedPayload({ repo: 'org/frontend-app' });
    await postWebhook('pull_request', payload);
    expect(mockDispatch).toHaveBeenCalledOnce();
  });

  it('FSM: DISPATCHING → COMPLETED even when dispatch throws (INV-03) → 200', async () => {
    mockDispatch.mockRejectedValue(new Error('Lark failure'));
    const payload = makePROpenedPayload({ repo: 'org/frontend-app' });
    const res = await postWebhook('pull_request', payload);
    expect(res.status).toBe(200);
  });

  it('FSM: unsupported event type → 200, no dispatch', async () => {
    const res = await postWebhook('push', { ref: 'refs/heads/main' });
    expect(res.status).toBe(200);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('FSM: pull_request_review submitted → dispatch called (AC-2)', async () => {
    const payload = makeReviewSubmittedPayload('approved');
    await postWebhook('pull_request_review', payload);
    expect(mockDispatch).toHaveBeenCalledOnce();
  });
});

// ─── Multi-team Isolation ─────────────────────────────────────────────────────

describe('Multi-team isolation (AC-6)', () => {
  let app: express.Application;
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
    mockDispatch = vi.fn().mockResolvedValue(undefined);
    app = createApp({ config: APP_CONFIG, dispatchOverride: mockDispatch });
  });

  afterEach(() => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  const postWebhook = (eventType: string, payload: object) => {
    const body = JSON.stringify(payload);
    const sig = signPayload(body, WEBHOOK_SECRET);
    return request(app)
      .post('/webhook')
      .set('X-GitHub-Event', eventType)
      .set('X-Hub-Signature-256', sig)
      .set('Content-Type', 'application/json')
      .send(body);
  };

  it('frontend repo event routes to frontend team config', async () => {
    const payload = makePROpenedPayload({ repo: 'org/frontend-app' });
    await postWebhook('pull_request', payload);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ name: 'frontend' }),
    );
  });

  it('backend repo event routes to backend team config', async () => {
    const payload = makePROpenedPayload({ repo: 'org/backend-api' });
    await postWebhook('pull_request', payload);
    expect(mockDispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ name: 'backend' }),
    );
  });

  it('frontend repo event does NOT reach backend webhook', async () => {
    const mockLarkPost = vi.fn().mockResolvedValue({ status: 200, data: { code: 0 } });
    const loader = new ConfigLoader(APP_CONFIG);
    const dispatcher = new NotificationDispatcher(loader, mockLarkPost);
    const payload = makePROpenedPayload({ repo: 'org/frontend-app' });
    await dispatcher.dispatch('pull_request', payload, TEAM_FRONTEND);
    expect(mockLarkPost.mock.calls[0][0]).toBe(TEAM_FRONTEND.lark_webhook);
    expect(mockLarkPost.mock.calls[0][0]).not.toBe(TEAM_BACKEND.lark_webhook);
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────

describe('Health check', () => {
  it('GET /health returns 200', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = WEBHOOK_SECRET;
    const app = createApp({ config: APP_CONFIG });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });
});
