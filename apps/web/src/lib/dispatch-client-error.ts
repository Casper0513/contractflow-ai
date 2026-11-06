export class DispatchClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchClientError";
  }
}
