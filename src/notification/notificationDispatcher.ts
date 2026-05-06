import axios from 'axios';
import {
  TeamConfig,
  LarkCardMessage,
  LarkCardColor,
  LarkCardElement,
  BODY_TRUNCATE_LENGTH,
  LARK_REQUEST_TIMEOUT_MS,
} from '../types/index';
import { ConfigLoader } from '../config/configLoader';

type PostFn = (url: string, message: unknown) => Promise<unknown>;

export class NotificationDispatcher {
  private loader: ConfigLoader;
  private post: PostFn;

  constructor(loader: ConfigLoader, postFn?: PostFn) {
    this.loader = loader;
    this.post = postFn ?? defaultPost;
  }

  async dispatch(
    eventType: string,
    payload: unknown,
    teamConfig: TeamConfig,
  ): Promise<void> {
    try {
      const message = this.buildMessage(eventType, payload as Record<string, unknown>, teamConfig);
      if (!message) return;
      await this.post(teamConfig.lark_webhook, message);
    } catch (err) {
      console.error('[NotificationDispatcher] Failed to send Lark message:', err);
    }
  }

  private buildMessage(
    eventType: string,
    payload: Record<string, unknown>,
    teamConfig: TeamConfig,
  ): LarkCardMessage | null {
    if (eventType === 'pull_request') {
      return this.buildPRMessage(payload, teamConfig);
    }
    if (eventType === 'pull_request_review') {
      return this.buildReviewMessage(payload, teamConfig);
    }
    return null;
  }

  private buildPRMessage(payload: Record<string, unknown>, teamConfig: TeamConfig): LarkCardMessage {
    const pr = payload.pull_request as Record<string, unknown>;
    const repo = payload.repository as Record<string, unknown>;
    const sender = payload.sender as Record<string, unknown>;
    const action = payload.action as string;

    let color: LarkCardColor;
    let title: string;
    let mentionUsernames: string[];

    if (action === 'opened') {
      color = 'blue';
      title = `新 PR 待 Review: #${pr.number} ${pr.title}`;
      const creatorLogin = (pr.user as Record<string, unknown>).login as string;
      const reviewerLogins = (pr.requested_reviewers as Array<Record<string, unknown>>).map(
        (r) => r.login as string,
      );
      mentionUsernames = [creatorLogin, ...reviewerLogins];
    } else if (action === 'closed' && pr.merged === true) {
      color = 'green';
      title = `PR 已 Merge: #${pr.number} ${pr.title}`;
      mentionUsernames = [(pr.user as Record<string, unknown>).login as string];
    } else {
      color = 'red';
      title = `PR 已关闭: #${pr.number} ${pr.title}`;
      mentionUsernames = [(pr.user as Record<string, unknown>).login as string];
    }

    const body = pr.body ? (pr.body as string).slice(0, BODY_TRUNCATE_LENGTH) : '';
    const mentions = this.resolveMentions(mentionUsernames, teamConfig);

    return buildCard({
      color,
      title,
      repoName: repo.full_name as string,
      prUrl: pr.html_url as string,
      body,
      mentions,
      actor: sender.login as string,
    });
  }

  private buildReviewMessage(payload: Record<string, unknown>, teamConfig: TeamConfig): LarkCardMessage {
    const review = payload.review as Record<string, unknown>;
    const pr = payload.pull_request as Record<string, unknown>;
    const repo = payload.repository as Record<string, unknown>;

    const state = review.state as string;
    let color: LarkCardColor;
    let stateLabel: string;

    if (state === 'approved') {
      color = 'green';
      stateLabel = 'Approved';
    } else if (state === 'changes_requested') {
      color = 'red';
      stateLabel = 'Changes Requested';
    } else {
      color = 'orange';
      stateLabel = 'Commented';
    }

    const creatorLogin = (pr.user as Record<string, unknown>).login as string;
    const reviewerLogin = (review.user as Record<string, unknown>).login as string;
    const mentions = this.resolveMentions([creatorLogin], teamConfig);
    const reviewBody = review.body
      ? (review.body as string).slice(0, BODY_TRUNCATE_LENGTH)
      : '';

    return buildCard({
      color,
      title: `Review [${stateLabel}]: #${pr.number} ${pr.title}`,
      repoName: repo.full_name as string,
      prUrl: pr.html_url as string,
      body: reviewBody,
      mentions,
      actor: reviewerLogin,
    });
  }

  private resolveMentions(githubUsernames: string[], teamConfig: TeamConfig): string[] {
    return githubUsernames
      .map((username) => this.loader.getLarkUserId(teamConfig, username))
      .filter((id): id is string => id !== undefined);
  }
}

function buildCard(opts: {
  color: LarkCardColor;
  title: string;
  repoName: string;
  prUrl: string;
  body: string;
  mentions: string[];
  actor: string;
}): LarkCardMessage {
  const elements: LarkCardElement[] = [];

  elements.push({
    tag: 'div',
    text: { tag: 'lark_md', content: `**仓库**: ${opts.repoName}\n**操作人**: ${opts.actor}` },
  });

  if (opts.body) {
    elements.push({
      tag: 'div',
      text: { tag: 'lark_md', content: opts.body },
    });
  }

  if (opts.mentions.length > 0) {
    const mentionText = opts.mentions.map((id) => `<at id=${id}></at>`).join(' ');
    elements.push({
      tag: 'div',
      text: { tag: 'lark_md', content: mentionText },
    });
  }

  elements.push({
    tag: 'action',
    actions: [
      {
        tag: 'button',
        text: { tag: 'lark_md', content: '查看 PR' },
        type: 'default',
        url: opts.prUrl,
      },
    ],
  });

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: opts.title },
        template: opts.color,
      },
      elements,
    },
  };
}

async function defaultPost(url: string, message: unknown): Promise<unknown> {
  const response = await axios.post(url, message, {
    timeout: LARK_REQUEST_TIMEOUT_MS,
  });
  return response;
}
