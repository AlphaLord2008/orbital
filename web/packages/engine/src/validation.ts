/**
 * Input checks (port of orbital/_validation.py, requirements I5, I8).
 * JavaScript has no integer/float/bool distinction inside one `number` type, so the
 * checks are on `typeof`: booleans and strings are rejected like Python rejects them.
 */
import { ValueError } from './errors';

/** A 2D vector as the engine accepts it. */
export type Vec2Input = readonly unknown[] | Float64Array;

/** Return `value` as a new [x, y] pair of finite numbers, or throw ValueError. */
export function asVector2(value: unknown, name: string): [number, number] {
  if (!(Array.isArray(value) || value instanceof Float64Array)) {
    throw new ValueError(`${name} must be an array of 2 real numbers, got ${typeof value}`);
  }
  const arr = value as ArrayLike<unknown>;
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'number') {
      throw new ValueError(`${name} must contain real numbers, got ${typeof arr[i]}`);
    }
  }
  if (arr.length !== 2) {
    throw new ValueError(`${name} must have shape (2,), got length ${String(arr.length)}`);
  }
  const x = arr[0] as number;
  const y = arr[1] as number;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new ValueError(`${name} must be finite, got [${String(x)}, ${String(y)}]`);
  }
  return [x, y];
}

/**
 * Return `value` as an integer >= 1, or throw ValueError. Unlike Python, JavaScript cannot
 * tell 3 from 3.0, so an integral float is accepted; booleans, strings and 2.5 are rejected.
 */
export function asPositiveInt(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValueError(`${name} must be an integer, got ${String(value)}`);
  }
  if (value < 1) throw new ValueError(`${name} must be >= 1, got ${String(value)}`);
  return value;
}

/** Return `value` as a finite number > 0, or throw ValueError. */
export function asPositiveScalar(value: unknown, name: string): number {
  if (typeof value !== 'number') {
    throw new ValueError(`${name} must be a real number, got ${String(value)}`);
  }
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValueError(`${name} must be finite and > 0, got ${String(value)}`);
  }
  return value;
}
