import { Context, ProbotOctokit } from "probot";
import nock from "nock";
import metadata, { Metadata } from "..";
import logger from "pino";
import { BodyStorage } from "./bodyStorage";
import { WebhookEvent } from "@octokit/webhooks";

nock.disableNetConnect();

describe("bodyStorage", () => {
  let context: Context;
  let event: WebhookEvent;

  beforeEach(() => {
    event = {
      id: "123",
      name: "push",
      payload: {
        issue: { number: 42 },
        repository: {
          name: "bar",
          owner: { login: "foo" },
        },
        installation: { id: 1 },
      },
    };

    context = new Context(
      event,
      new ProbotOctokit({
        throttle: { enabled: false },
        retry: { enabled: false },
      }),
      logger()
    );
  });

  const issueGetMock = (originalBody: string | null) => {
    return nock("https://api.github.com")
      .get(`/repos/foo/bar/issues/${event.payload.issue.number}`)
      .reply(200, {
        body: originalBody,
      });
  };

  const issueGetPatchMock = (
    originalBody: string | null,
    patchedBody: string
  ) => {
    return issueGetMock(originalBody)
      .patch(
        `/repos/foo/bar/issues/${event.payload.issue.number}`,
        (requestBody) => {
          expect(requestBody.body).toEqual(patchedBody);
          return true;
        }
      )
      .reply(200, (_uri, body) => {
        return body;
      });
  };

  describe("on an issue with no content in the body", () => {
    describe("set", () => {
      test("sets new metadata", async () => {
        const mock = issueGetPatchMock(
          null,
          '\n\n<!-- probot = {"1":{"hello":"world"}} -->'
        );

        const metadata = new Metadata<{ hello: string }>(
          new BodyStorage(context)
        );

        await metadata.set("hello", "world");
        expect(mock.activeMocks()).toStrictEqual([]);
      });

      test("sets an object", async () => {
        const mock = issueGetPatchMock(
          null,
          '\n\n<!-- probot = {"1":{"hello":"world"}} -->'
        );

        const metadata = new Metadata<{ hello: string }>(
          new BodyStorage(context)
        );

        await metadata.set({ hello: "world" });
        expect(mock.activeMocks()).toStrictEqual([]);
      });
    });

    describe("get", () => {
      test("returns undefined for unknown key", async () => {
        const mock = issueGetMock(null);

        const metadata = new Metadata<{ unknown: string }>(
          new BodyStorage(context)
        );

        expect(await metadata.get("unknown")).toEqual(undefined);
        expect(mock.activeMocks()).toStrictEqual([]);
      });

      test("returns undefined without a key", async () => {
        const mock = issueGetMock(null);

        const metadata = new Metadata<{ unknown: string }>(
          new BodyStorage(context)
        );

        expect(await metadata.get()).toEqual(undefined);
        expect(mock.activeMocks()).toStrictEqual([]);
      });
    });
  });

  describe("when given body in issue params", () => {
    const issue = {
      owner: "foo",
      repo: "bar",
      issue_number: 42,
      body: 'hello world\n\n<!-- probot = {"1":{"hello":"world"}} -->',
    };

    describe("get", () => {
      test("returns the value without an API call", async () => {
        const metadata = new Metadata<{ hello: string }>(
          new BodyStorage(context, issue)
        );

        expect(await metadata.get("hello")).toEqual("world");
      });
    });

    describe("set", () => {
      test("updates the value without an API call", async () => {
        const mock = nock("https://api.github.com")
          .patch("/repos/foo/bar/issues/42", (requestBody) => {
            expect(requestBody.body).toEqual(
              'hello world\n\n<!-- probot = {"1":{"hello":"world","foo":"bar"}} -->'
            );
            return true;
          })
          .reply(200, (_uri, body) => {
            return body;
          });

        const metadata = new Metadata<{ foo: string }>(
          new BodyStorage(context, issue)
        );

        await metadata.set("foo", "bar");
        expect(mock.activeMocks()).toStrictEqual([]);
      });
    });
  });
});
