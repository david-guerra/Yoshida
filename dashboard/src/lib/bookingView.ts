import { BookingReadError } from "./orders.ts";

export type BookingViewState<T> = {
  data?: T;
  pending: boolean;
  error?: BookingReadError;
  updatedAt?: Date;
};

/** A single account/query lifetime. Superseding reads and disposal reject late results. */
export function createBookingView<T>(
  read: (signal: AbortSignal) => Promise<T>,
  publish: (state: BookingViewState<T>) => void,
) {
  let state: BookingViewState<T> = { pending: true };
  let controller: AbortController | undefined;
  let generation = 0;
  let closed = false;
  let revoked = false;
  return {
    async refresh() {
      if (closed || revoked) return false;
      const current = ++generation;
      controller?.abort();
      controller = new AbortController();
      state = { ...state, pending: true };
      publish(state);
      try {
        const data = await read(controller.signal);
        if (closed || current !== generation) return false;
        state = {data, pending: false, updatedAt: new Date()};
        publish(state);
        return true;
      } catch (error) {
        if (closed || current !== generation) return false;
        const failure = error instanceof BookingReadError ? error : new BookingReadError("unavailable");
        if (failure.kind === "auth" || failure.kind === "setup" || failure.kind === "not-found") {
          state = { pending: false, error: failure };
          revoked = failure.kind === "auth";
        } else state = { ...state, pending: false, error: failure };
        publish(state);
        throw failure;
      }
    },
    dispose() { closed = true; generation++; controller?.abort(); },
    invalidateSession() {
      if (closed) return;
      revoked = true;
      generation++;
      controller?.abort();
      state = { pending: false, error: new BookingReadError("auth") };
      publish(state);
    },
  };
}
