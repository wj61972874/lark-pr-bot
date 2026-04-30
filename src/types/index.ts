// source: docs/traces/FEAT-3c25-lark-pr-bot.md
// spec:   docs/specs/FEAT-3c25-lark-pr-bot.spec.md

// ─── Config ───────────────────────────────────────────────────────────────────

export interface TeamConfig {
  name: string;
  lark_webhook: string;
  repositories: string[];
  user_mappings: Record<string, string>;
}

export interface AppConfig {
  teams: TeamConfig[];
}

// ─── GitHub Webhook ───────────────────────────────────────────────────────────

export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepository {
  full_name: string;
  html_url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  user: GitHubUser;
  requested_reviewers: GitHubUser[];
  merged: boolean;
  state: 'open' | 'closed';
}

export interface GitHubReview {
  state: PullRequestReviewState;
  body: string | null;
  html_url: string;
  user: GitHubUser;
}

export type PullRequestAction = 'opened' | 'closed';

export type PullRequestReviewState =
  | 'approved'
  | 'changes_requested'
  | 'commented';

export interface PullRequestEvent {
  action: PullRequestAction;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
}

export interface PullRequestReviewEvent {
  action: 'submitted';
  review: GitHubReview;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
}

export type GitHubWebhookEvent =
  | { type: 'pull_request'; payload: PullRequestEvent }
  | { type: 'pull_request_review'; payload: PullRequestReviewEvent };

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'PR_OPENED'
  | 'PR_MERGED'
  | 'PR_CLOSED'
  | 'REVIEW_APPROVED'
  | 'REVIEW_CHANGES'
  | 'REVIEW_COMMENTED';

export type LarkCardColor = 'blue' | 'green' | 'red' | 'orange' | 'grey';

export interface LarkCardHeader {
  title: { tag: 'plain_text'; content: string };
  template: LarkCardColor;
}

export interface LarkCardElement {
  tag: string;
  [key: string]: unknown;
}

export interface LarkCard {
  header: LarkCardHeader;
  elements: LarkCardElement[];
}

export interface LarkCardMessage {
  msg_type: 'interactive';
  card: LarkCard;
}

// ─── Routing ──────────────────────────────────────────────────────────────────

export interface RouteResult {
  found: boolean;
  teamConfig?: TeamConfig;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export class WebhookSignatureError extends Error {
  constructor() {
    super('Invalid webhook signature');
    this.name = 'WebhookSignatureError';
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const SUPPORTED_GITHUB_EVENTS = ['pull_request', 'pull_request_review'] as const;
export const SUPPORTED_PR_ACTIONS: PullRequestAction[] = ['opened', 'closed'];
export const SUPPORTED_REVIEW_ACTIONS = ['submitted'] as const;
export const WEBHOOK_PATH = '/webhook';
export const DEFAULT_PORT = 3000;
export const BODY_TRUNCATE_LENGTH = 200;
export const LARK_REQUEST_TIMEOUT_MS = 5000;
