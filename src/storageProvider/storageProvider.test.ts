import { WebhookEvent } from "@octokit/webhooks";
import { WebhookPayloadWithRepository } from "probot";
import { BodyStorageTestEnv } from "./test/BodyStorage.env";
import { FaunaTestEnv } from "./test/FaunaStorage.env";

type Hello = { hello: string };
type Nested = { hello: { world: string } };
type Default = { key: string };
//FaunaTestEnv
describe.each([BodyStorageTestEnv])("StorageProvider", (TestClass) => {
  const env = new TestClass({
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
  } as WebhookEvent<WebhookPayloadWithRepository>);

  beforeEach(async () => {
    await env.setup();
  });

  afterAll(async () => {
    await env.teardown();
  });

  describe(`${TestClass.name}: on issue without metdata`, () => {
    describe("set", () => {
      test("sets a key", async () => {
        const testObect = { hello: "world" };
        const setResult = await env.metadata<Hello>().set(testObect);
        expect(setResult).toMatchObject(testObect);
      });

      test("sets an object", async () => {
        const testObect = { hello: { world: "value " } };
        const setResult = await env.metadata<Nested>().set(testObect);
        expect(setResult).toMatchObject(testObect);
      });
    });

    describe("get", () => {
      test("returns undefined", async () => {
        expect(await env.metadata<Default>().get("key")).toEqual(undefined);
      });

      test("returns undefined without key", async () => {
        expect(await env.metadata<Default>().get()).toEqual(undefined);
      });
    });
  });

  describe(`${TestClass.name}: on issue with existing metadata`, () => {
    beforeEach(async () => {
      await env.metadata<Default>().set("key", "value");
    });

    describe("set", () => {
      test("overwrites exiting metadata", async () => {
        const setResult = await env.metadata<Default>().set("key", "new value");
        expect(setResult).toMatchObject({ key: "new value" });
      });

      test("merges object with existing metadata", async () => {
        const setResult = await env
          .metadata<Default & Hello>()
          .set({ hello: "world" });
        expect(setResult).toMatchObject({ key: "value", hello: "world" });
      });
    });

    describe("get", () => {
      test("returns value", async () => {
        const getResult = await env.metadata<Default>().get();
        expect(getResult.key).toEqual("value");
      });

      test("returns undefined for unknown key", async () => {
        const getResult = await env.metadata().get("unknown");
        expect(getResult).toEqual(undefined);
      });
    });
  });

  describe(`${TestClass.name}: on issue with metadata for a different installation`, () => {
    const differentEnv = new TestClass({
      id: "123",
      name: "push",
      payload: {
        issue: { number: 42 },
        repository: {
          name: "bar2",
          owner: { login: "foo2" },
        },
        installation: { id: 2 },
      },
    } as WebhookEvent<WebhookPayloadWithRepository>);

    beforeEach(async () => {
      await differentEnv.setup();
      await differentEnv.metadata<Default>().set("key", "value");
    });

    afterAll(async () => {
      await differentEnv.teardown();
    });

    describe("set", () => {
      test("sets new metadata", async () => {
        const setResult = await env.metadata<Hello>().set("hello", "world");
        expect(setResult).toMatchObject({ hello: "world" });

        const getOtherInstallation = await differentEnv
          .metadata<Default>()
          .get();
        expect(getOtherInstallation).toMatchObject({ key: "value" });
      });

      test("sets an object", async () => {
        const setResult = await env
          .metadata<Nested>()
          .set({ hello: { world: "lulu" } });
        expect(setResult).toMatchObject({ hello: { world: "lulu" } });

        const getOtherInstallation = await differentEnv
          .metadata<Default>()
          .get();
        expect(getOtherInstallation).toMatchObject({ key: "value" });
      });
    });

    describe("get", () => {
      test("returns undefined for unknown key", async () => {
        expect(await env.metadata().get("unknown")).toEqual(undefined);
      });

      test("returns undefined without a key", async () => {
        expect(await env.metadata().get()).toEqual(undefined);
      });
    });
  });
});
