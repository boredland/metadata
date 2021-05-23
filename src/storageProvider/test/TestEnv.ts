import { Context, ProbotOctokit, WebhookPayloadWithRepository } from "probot";
import logger from "pino";
import { Metadata, StorageType } from "../..";
import { WebhookEvent } from "@octokit/webhooks";

export abstract class TestEnv {
  protected context: Context;
  protected logger = logger();
  protected octokit = new ProbotOctokit({
    throttle: { enabled: false },
    retry: { enabled: false },
  });

  constructor(event: WebhookEvent<WebhookPayloadWithRepository>) {
    this.context = new Context(event, this.octokit, this.logger);
  }

  abstract setup: () => Promise<void>;
  abstract teardown: () => Promise<void>;
  abstract metadata: <T extends StorageType>() => Metadata<T>;
}
