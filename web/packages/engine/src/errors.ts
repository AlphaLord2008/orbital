/**
 * Error classes mirroring the Python engine's (C8 conformance: same class and field).
 * `field` is the parameter the message is about: the first word of the message, as in Python.
 */

/** Python `ValueError`: an input failed validation. */
export class ValueError extends Error {
  override readonly name = 'ValueError';
  readonly field: string;
  constructor(message: string) {
    super(message);
    this.field = message.split(' ', 1)[0] ?? '';
  }
}

/** Python `RuntimeError`: the computation failed (non-finite state, no convergence). */
export class RuntimeError extends Error {
  override readonly name = 'RuntimeError';
}
