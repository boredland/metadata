import { Context } from "probot";
import { StorageProvider, StorageType } from "..";

export class BodyStorage<T extends StorageType> implements StorageProvider<T> {
  private github: Context["octokit"];
  private prefix: string;
  private regex = /\n\n<!-- probot = (.*) -->/;

  constructor(
    private context: Context,
    private issue: {
      issue_number: number;
      owner: string;
      repo: string;
      body?: string;
    } = context.issue()
  ) {
    this.github = context.octokit;
    this.prefix = context.payload.installation.id;
  }

  private async body() {
    return (
      this.issue?.body ??
      (await this.github.issues.get(this.issue)).data.body ??
      ""
    );
  }

  async set(value: Partial<T>): Promise<Partial<T>> {
    let body = await this.body();
    let data: Record<string, Partial<T>> = {};

    body = body.replace(this.regex, (_, json) => {
      data = JSON.parse(json);
      return "";
    });

    data[this.prefix] = { ...data[this.prefix], ...value };

    body = `${body}\n\n<!-- probot = ${JSON.stringify(data)} -->`;

    await this.github.issues.update({ ...this.issue, body });

    return data[this.prefix];
  }

  async get(key?: keyof T): Promise<T[keyof T] | Partial<T> | undefined> {
    const match = (await this.body()).match(this.regex);

    if (match) {
      const data = JSON.parse(match[1])[this.prefix] as Partial<T>;
      return key ? data && data[key] : data;
    }
    return undefined;
  }
}
