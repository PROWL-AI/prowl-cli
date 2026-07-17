export const EXIT = { OK: 0, RUNTIME: 1, USAGE: 2, AUTH: 3, BALANCE: 4, NETWORK: 5 };
export class CliError extends Error { constructor(message, code = EXIT.RUNTIME) { super(message); this.code = code; } }
