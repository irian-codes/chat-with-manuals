import EventEmitter, {on} from 'node:events';
import {z} from 'zod';

export const pendingDocumentEventsSchema = z.enum([
  'added',
  'finished',
  'cancelled',
  'error',
]);

interface AppEvents {
  pendingDocument: (
    action: z.infer<typeof pendingDocumentEventsSchema>
  ) => void;
}

export class AppEventEmitter extends EventEmitter {
  override on<T extends keyof AppEvents>(
    event: T,
    listener: AppEvents[T]
  ): this {
    return super.on(event, listener);
  }

  override off<T extends keyof AppEvents>(
    event: T,
    listener: AppEvents[T]
  ): this {
    return super.off(event, listener);
  }

  override once<T extends keyof AppEvents>(
    event: T,
    listener: AppEvents[T]
  ): this {
    return super.once(event, listener);
  }

  override emit<T extends keyof AppEvents>(
    event: T,
    ...args: Parameters<AppEvents[T]>
  ): boolean {
    return super.emit(event, ...args);
  }

  public toIterable<T extends keyof AppEvents>(
    event: T,
    opts: NonNullable<Parameters<typeof on>[2]>
  ): AsyncIterable<Parameters<AppEvents[T]>> {
    return on(this, event, opts) as AsyncIterable<Parameters<AppEvents[T]>>;
  }
}
