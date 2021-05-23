import { Context } from "probot";
import { StorageProvider, StorageType } from "..";
import faunadb, { Expr, query as q } from "faunadb";

export class FaunaStorage<T extends StorageType> implements StorageProvider<T> {
  public collectionName: string;
  public indexName: string;
  private _key: string;

  get collectionRef(): Expr {
    return q.Collection(this.collectionName);
  }

  get indexRef(): Expr {
    return q.Index(this.indexName);
  }

  constructor(private context: Context, private faunaClient?: faunadb.Client) {
    this.collectionName = `${this.context.payload.installation.id}`;
    this.indexName = `unique-index-${this.context.payload.installation.id}`;
    this._key = this.key;

    if (!this.faunaClient) {
      if (!process.env.FAUNADB_SECRET) {
        throw new Error(
          "Neither an instance of faunaClient, nor the FAUNA_SECRET provided!"
        );
      }
      this.faunaClient = new faunadb.Client({
        secret: process.env.FAUNADB_SECRET,
      });
    }
  }

  get key(): string {
    if (this._key) return this._key;

    const issue = this.context.issue();
    if (issue) {
      return `${issue.owner}-${issue.repo}_${issue.issue_number}`;
    }

    // TODO handle non-issue events
    return "nonissuekey";
  }

  async initialize(): Promise<void> {
    await this.faunaClient
      ?.query(
        q.CreateCollection({
          name: this.collectionName,
        })
      )
      .catch((e) => {
        if (e.message !== "instance already exists") throw e;
      });

    await this.faunaClient
      ?.query(
        q.CreateIndex({
          name: this.indexName,
          source: this.collectionRef,
          terms: [{ field: ["data", "key"] }],
          unique: true,
        })
      )
      .catch((e) => {
        if (e.message !== "instance already exists") throw e;
      });
  }

  async set(input: Partial<T>): Promise<Partial<T> | undefined> {
    await this.initialize();
    const before = await this.get();

    const value = { ...before, ...input };

    const res = await this.faunaClient?.query<{
      data: { value: Partial<T> };
    }>(
      q.If(
        q.Exists(q.Match(this.indexRef, this.key)),
        q.Update(this.collectionRef, {
          data: {
            key: this.key,
            value,
          },
        }),
        q.Create(this.collectionRef, {
          data: {
            key: this.key,
            value,
          },
        })
      )
    );

    return res?.data.value;
  }

  // returns the currently saved and partially typed metadata
  get(): Promise<Partial<T>>;
  // returns just the requested key if set
  get(key: keyof T): Promise<T[keyof T]>;
  async get(key?: keyof T): Promise<T[keyof T] | Partial<T> | undefined> {
    await this.initialize();
    const res = await this.faunaClient
      ?.query<{ data: { value: Partial<T> } }>(
        q.Get(q.Match(this.indexRef, this.key))
      )
      .catch((e) => {
        if (e.name === "NotFound") return { data: { value: undefined } };
      });
    if (key) return res?.data.value ? res?.data.value[key] : undefined;
    return res?.data.value;
  }
}
