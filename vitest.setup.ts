import { AsyncLocalStorage } from "node:async_hooks";
import "@testing-library/jest-dom/vitest";

if (!("AsyncLocalStorage" in globalThis)) {
  Object.defineProperty(
    globalThis,
    "AsyncLocalStorage",
    {
      value: AsyncLocalStorage,
      configurable: true,
    }
  );
}
