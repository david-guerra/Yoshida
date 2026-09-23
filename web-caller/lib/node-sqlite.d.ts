// Node 24 runtime API; the frontends currently share Node 20 declaration packages.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      get(...parameters: (string | number | null)[]): unknown;
      run(...parameters: (string | number | null)[]): {changes: number | bigint};
    };
    close(): void;
  }
}
