type ShutdownSaveHandler = () => void | Promise<void>;

const handlers = new Set<ShutdownSaveHandler>();

/** Register a component that may have an in-memory draft when the app closes. */
export function registerShutdownSaveHandler(handler: ShutdownSaveHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/** Flush all registered drafts in registration order. A failing handler does not block others. */
export async function flushShutdownSaves(): Promise<void> {
  const pending = [...handlers].map(async (handler) => {
    try {
      await handler();
    } catch (error) {
      console.error('[ShutdownSave] 保存未完成的编辑失败:', error);
    }
  });
  await Promise.all(pending);
}
