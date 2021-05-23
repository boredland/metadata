import { WebhookEvent } from "@octokit/webhooks";
import { FaunaStorage } from "../faunaStorage";
import faunadb, { query as q } from "faunadb";
import { TestEnv } from "./TestEnv";
import { Metadata, StorageProvider, StorageType } from "../..";
import { WebhookPayloadWithRepository } from "probot";

export class FaunaTestEnv extends TestEnv {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storage: FaunaStorage<any>;
  client: faunadb.Client;

  constructor(event: WebhookEvent<WebhookPayloadWithRepository>) {
    super(event);
    this.client = new faunadb.Client({
      secret: process.env.FAUNADB_SECRET as string,
    });
    this.storage = new FaunaStorage(this.context);
  }

  public metadata = <T extends StorageType>(): Metadata<T> => {
    return new Metadata<T>(this.storage as StorageProvider<T>);
  };

  public setup = async (): Promise<void> => {
    await this.client.query(
      q.Map(
        q.Paginate(q.Documents(this.storage.collectionRef), { size: 9999 }),
        q.Lambda(["ref"], q.Delete(q.Var("ref")))
      )
    );
  };

  public teardown = async (): Promise<void> => {
    await this.client.close();
  };
}
