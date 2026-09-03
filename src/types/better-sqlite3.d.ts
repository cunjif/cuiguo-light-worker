declare module 'better-sqlite3' {
  interface Database {
    pragma(pragma: string): any;
    exec(sql: string): void;
    prepare(sql: string): Statement;
    transaction<T>(fn: () => T): (() => T);
    close(): void;
  }

  interface Statement {
    run(...params: any[]): RunResult;
    get(...params: any[]): any;
    all(...params: any[]): any[];
  }

  interface RunResult {
    lastInsertRowid: number | bigint;
    changes: number;
  }

  class Database {
    constructor(filename: string, options?: any);
  }

  export default Database;
}