import type {
  CreativeAssetMetadata,
  StoredCreativeAsset,
  StoredCreativeAssetSummary,
} from "@/types/creative-studio";

const DATABASE_NAME = "vaeora-creative-v1";
const DATABASE_VERSION = 3;
const ASSET_STORE = "assets";
const SUMMARY_STORE = "assetSummaries";
const PROJECT_INDEX = "projectId";
const PROJECT_CREATED_INDEX = "projectCreatedAt";

interface StoredCreativeAssetRecord extends Partial<CreativeAssetMetadata> {
  id: string;
  blob: Blob;
  thumbnail?: Blob;
}

interface StoredCreativeAssetSummaryRecord extends CreativeAssetMetadata {
  thumbnail?: Blob;
}

export interface CreativeAssetPageCursor {
  createdAt: string;
  id: string;
}

export interface CreativeAssetPage {
  assets: StoredCreativeAssetSummary[];
  nextCursor: CreativeAssetPageCursor | null;
  hasMore: boolean;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(
      transaction.error ?? new Error("IndexedDB transaction failed."),
    );
    transaction.onabort = () => reject(
      transaction.error ?? new Error("IndexedDB transaction was aborted."),
    );
  });
}

export class CreativeAssetRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;

    if (typeof indexedDB === "undefined") {
      return Promise.reject(new Error("Creative asset storage is unavailable."));
    }

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.onupgradeneeded = (event) => {
        const database = request.result;
        const transaction = request.transaction;
        const assetStore = database.objectStoreNames.contains(ASSET_STORE)
          ? request.transaction?.objectStore(ASSET_STORE)
          : database.createObjectStore(ASSET_STORE, { keyPath: "id" });

        if (assetStore && !assetStore.indexNames.contains(PROJECT_INDEX)) {
          assetStore.createIndex(PROJECT_INDEX, "projectId", { unique: false });
        }
        if (assetStore && !assetStore.indexNames.contains(PROJECT_CREATED_INDEX)) {
          assetStore.createIndex(
            PROJECT_CREATED_INDEX,
            ["projectId", "createdAt", "id"],
            { unique: false },
          );
        }

        const summaryStore = database.objectStoreNames.contains(SUMMARY_STORE)
          ? transaction?.objectStore(SUMMARY_STORE)
          : database.createObjectStore(SUMMARY_STORE, { keyPath: "id" });

        if (summaryStore && !summaryStore.indexNames.contains(PROJECT_INDEX)) {
          summaryStore.createIndex(PROJECT_INDEX, "projectId", { unique: false });
        }
        if (
          summaryStore &&
          !summaryStore.indexNames.contains(PROJECT_CREATED_INDEX)
        ) {
          summaryStore.createIndex(
            PROJECT_CREATED_INDEX,
            ["projectId", "createdAt", "id"],
            { unique: false },
          );
        }

        // v1/v2 stored metadata, previews and originals in one record. Keep the
        // original untouched for backwards compatibility, while migrating a
        // lightweight summary so opening the studio never reads every 4K Blob.
        if (
          (event as IDBVersionChangeEvent).oldVersion < 3 &&
          assetStore &&
          summaryStore
        ) {
          const cursorRequest = assetStore.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor) return;

            const record = cursor.value as StoredCreativeAssetRecord;
            const summary = {
              ...record,
            } as Partial<StoredCreativeAssetRecord>;
            delete summary.blob;
            if (
              typeof summary.projectId === "string" &&
              typeof summary.createdAt === "string"
            ) {
              summaryStore.put(summary);
            }
            cursor.continue();
          };
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          this.databasePromise = null;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        this.databasePromise = null;
        reject(request.error ?? new Error("Could not open creative asset storage."));
      };
      request.onblocked = () => {
        this.databasePromise = null;
        reject(new Error("Creative asset storage upgrade is blocked."));
      };
    });

    return this.databasePromise;
  }

  async put(
    metadata: CreativeAssetMetadata,
    blob: Blob,
    thumbnail?: Blob,
  ): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(
      [ASSET_STORE, SUMMARY_STORE],
      "readwrite",
    );
    const record: StoredCreativeAssetRecord = {
      id: metadata.id,
      blob,
    };
    transaction.objectStore(ASSET_STORE).put(record);
    transaction.objectStore(SUMMARY_STORE).put({
      ...metadata,
      ...(thumbnail ? { thumbnail } : {}),
    } satisfies StoredCreativeAssetSummaryRecord);
    await transactionComplete(transaction);
  }

  async updateMetadata(metadata: CreativeAssetMetadata): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(SUMMARY_STORE, "readwrite");
    const store = transaction.objectStore(SUMMARY_STORE);
    const current = await requestResult(
      store.get(metadata.id) as IDBRequest<
        StoredCreativeAssetSummaryRecord | undefined
      >,
    );

    if (!current) {
      transaction.abort();
      throw new Error("Creative asset summary was not found.");
    }

    store.put({
      ...metadata,
      ...(current.thumbnail ? { thumbnail: current.thumbnail } : {}),
    } satisfies StoredCreativeAssetSummaryRecord);
    await transactionComplete(transaction);
  }

  async delete(assetId: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(
      [ASSET_STORE, SUMMARY_STORE],
      "readwrite",
    );
    transaction.objectStore(ASSET_STORE).delete(assetId);
    transaction.objectStore(SUMMARY_STORE).delete(assetId);
    await transactionComplete(transaction);
  }

  async listPage(
    projectId: string,
    options: {
      limit?: number;
      cursor?: CreativeAssetPageCursor | null;
    } = {},
  ): Promise<CreativeAssetPage> {
    const database = await this.open();
    const transaction = database.transaction(SUMMARY_STORE, "readonly");
    const completed = transactionComplete(transaction);
    const index = transaction
      .objectStore(SUMMARY_STORE)
      .index(PROJECT_CREATED_INDEX);
    const limit = Math.min(Math.max(options.limit ?? 6, 1), 24);
    const lower: IDBValidKey = [projectId, "", ""];
    const upper: IDBValidKey = options.cursor
      ? [projectId, options.cursor.createdAt, options.cursor.id]
      : [projectId, "\uffff", "\uffff"];
    const range = IDBKeyRange.bound(
      lower,
      upper,
      false,
      Boolean(options.cursor),
    );
    const records = await new Promise<StoredCreativeAssetSummaryRecord[]>(
      (resolve, reject) => {
        const collected: StoredCreativeAssetSummaryRecord[] = [];
        const request = index.openCursor(range, "prev");

        request.onerror = () => reject(
          request.error ?? new Error("Could not read creative assets."),
        );
        request.onsuccess = () => {
          const cursor = request.result;

          if (!cursor || collected.length >= limit + 1) {
            resolve(collected);
            return;
          }

          collected.push(cursor.value as StoredCreativeAssetSummaryRecord);
          cursor.continue();
        };
      },
    );
    await completed;

    const hasMore = records.length > limit;
    const visibleRecords = records.slice(0, limit);
    const assets = visibleRecords.map(
      ({ thumbnail, ...metadata }) => ({
        metadata,
        ...(thumbnail ? { thumbnail } : {}),
      }),
    );
    const last = visibleRecords.at(-1);

    return {
      assets,
      hasMore,
      nextCursor: last
        ? { createdAt: last.createdAt, id: last.id }
        : null,
    };
  }

  async get(assetId: string): Promise<StoredCreativeAsset | null> {
    const database = await this.open();
    const transaction = database.transaction(
      [ASSET_STORE, SUMMARY_STORE],
      "readonly",
    );
    const completed = transactionComplete(transaction);
    const [record, summaryRecord] = await Promise.all([
      requestResult(
      transaction.objectStore(ASSET_STORE).get(assetId) as IDBRequest<
        StoredCreativeAssetRecord | undefined
      >,
      ),
      requestResult(
        transaction.objectStore(SUMMARY_STORE).get(assetId) as IDBRequest<
          StoredCreativeAssetSummaryRecord | undefined
        >,
      ),
    ]);
    await completed;

    if (!record) return null;
    const { blob, thumbnail: legacyThumbnail, ...legacyMetadata } = record;
    const metadata = summaryRecord ?? legacyMetadata;
    if (
      !metadata ||
      typeof metadata.projectId !== "string" ||
      typeof metadata.createdAt !== "string"
    ) {
      return null;
    }
    const thumbnail = summaryRecord?.thumbnail ?? legacyThumbnail;
    const cleanMetadata = summaryRecord
      ? { ...summaryRecord }
      : legacyMetadata;
    if ("thumbnail" in cleanMetadata) delete cleanMetadata.thumbnail;
    return {
      metadata: cleanMetadata as CreativeAssetMetadata,
      blob,
      ...(thumbnail ? { thumbnail } : {}),
    };
  }
}

export const creativeAssetRepository = new CreativeAssetRepository();
