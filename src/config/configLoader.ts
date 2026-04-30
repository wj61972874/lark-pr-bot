import {
  AppConfig,
  TeamConfig,
  RouteResult,
  ConfigValidationError,
} from '../types/index';

export class ConfigLoader {
  private config: AppConfig;
  private repoToTeam: Map<string, TeamConfig>;

  constructor(config: AppConfig) {
    this.config = config;
    this.repoToTeam = new Map();
    this.validateAndIndex();
  }

  private validateAndIndex(): void {
    for (const team of this.config.teams) {
      for (const repo of team.repositories) {
        if (this.repoToTeam.has(repo)) {
          throw new ConfigValidationError(
            `Duplicate repository "${repo}" found in multiple teams`,
          );
        }
        this.repoToTeam.set(repo, team);
      }
    }
  }

  getConfig(): AppConfig {
    return this.config;
  }

  findTeamByRepo(repoFullName: string): RouteResult {
    const teamConfig = this.repoToTeam.get(repoFullName);
    return teamConfig ? { found: true, teamConfig } : { found: false };
  }

  getLarkUserId(team: TeamConfig, githubUsername: string): string | undefined {
    return team.user_mappings[githubUsername];
  }
}
