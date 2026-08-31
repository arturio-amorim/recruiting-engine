/**
 * The live invocation timeline: every entry the dev server traces arrives
 * over the `/api/events` stream, newest first, including a replay of the
 * session buffer on connect. Filtering, holding, and clearing act on this
 * view only; the dev server's bounded buffer is never mutated from here.
 */
export declare function renderTracePanel(container: HTMLElement): () => void;
//# sourceMappingURL=trace.d.ts.map