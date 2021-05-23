import { WebhookEvent } from "@octokit/webhooks";
import { TestEnv } from "./TestEnv";
import { Metadata, StorageProvider, StorageType } from "../..";
import { BodyStorage } from "../bodyStorage";
import nock, { Scope } from "nock";
import { WebhookPayloadWithRepository } from "probot";

export class BodyStorageTestEnv extends TestEnv {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: BodyStorage<any>;
  response: { body: string };
  mock: Scope;

  constructor(event: WebhookEvent<WebhookPayloadWithRepository>) {
    super(event);
    this.storage = new BodyStorage(this.context);
    this.response = { body: "initial body" };

    this.mock = nock("https://api.github.com");
  }

  public metadata = <T extends StorageType>(): Metadata<T> => {
    return new Metadata<T>(this.storage as StorageProvider<T>);
  };

  public setup = async (): Promise<void> => {
    nock.disableNetConnect();

    this.mock.removeAllListeners();

    this.response = { body: "" };

    const issueUri = `/repos/${this.context.issue().owner}/${
      this.context.issue().repo
    }/issues/${this.context.issue().issue_number}`;

    // mock getting the body
    this.mock
      .get((uri) => uri === issueUri)
      .optionally()
      .reply(200, () => this.response)
      .persist();

    // mock updating the body
    this.mock
      .patch((uri) => uri === issueUri)
      .optionally()
      .reply(200, (_uri, body) => {
        this.response = body as { body: string };
        return body;
      })
      .persist();
  };

  public teardown = async (): Promise<void> => {
    nock.enableNetConnect();
  };
}
