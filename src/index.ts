import { Context } from "probot";
import { BodyStorage } from "./storageProvider/bodyStorage";

export type StorageType = Record<string, unknown>;

export interface StorageProvider<T extends StorageType = StorageType> {
  get(key?: keyof T): Promise<T[keyof T] | Partial<T> | undefined>;
  // sets and merges the object l=1
  set: (value: Partial<T>) => Promise<Partial<T>>;
}

export type Issue = {
  issue_number: number;
  owner: string;
  repo: string;
  body?: string;
};

/**
 * purely an adapter to pass methods to the storage provider
 */
export class Metadata<T extends StorageType = StorageType> {
  constructor(private storageProvider: StorageProvider<T>) {}

  // returns the currently saved and partially typed metadata
  get(): Promise<Partial<T>>;
  // returns just the requested key if set
  get(key: keyof T): Promise<T[keyof T]>;

  public get(key?: keyof T): Promise<T[keyof T] | Partial<T> | undefined> {
    return this.storageProvider.get(key);
  }

  public set(
    args: { key: keyof T; value: T[keyof T] } | keyof T | Partial<T>,
    value?: T[keyof T]
  ): Promise<Partial<T>> {
    // key, value input
    if (typeof args === "string") {
      if (!value) throw new Error("no value provided!");
      return this.storageProvider.set({
        [args as keyof T]: value,
      } as Partial<T>);
    }

    // param object input
    if (
      typeof (args as { key: keyof T; value: T[keyof T] })["key"] ===
        "string" &&
      (args as { key: keyof T; value: T[keyof T] }).value
    )
      return this.storageProvider?.set({
        [(args as { key: keyof T; value: T[keyof T] }).key]: (
          args as { key: keyof T; value: T[keyof T] }
        ).value,
      } as Partial<T>);

    // object input
    return this.storageProvider?.set(args as Partial<T>);
  }
}

/**
 * @deprecated
 * This mimics the old behaviour of providing the issue storage.
 * In the future you should initialize an instance of Metadata with the StorageProvider of your liking
 */
export default <T extends StorageType = StorageType>(
  context: Context,
  issue?: Issue,
  provider?: StorageProvider<T>
): Metadata<T> => {
  if (!provider) return new Metadata<T>(new BodyStorage(context, issue));
  return new Metadata<T>(provider);
};
