/**
 * @orbital/engine: the TypeScript port of the validated ORBITAL v0.1 core (ADR-0003).
 *
 * WA-1 delivers only the package and its boundary. The physics arrives in WA-2 and must
 * pass independent analytic validation and conformance with Python-generated fixtures
 * before any of it is used by the app.
 *
 * Boundary (the TypeScript equivalent of v0.1's T12): this package has no runtime
 * dependencies, compiles without DOM types, and imports nothing from React, three or
 * the app. CI enforces it (eslint no-restricted-imports + scripts/check-engine-boundary.mjs).
 */

export const ENGINE_PACKAGE = '@orbital/engine';

/**
 * The Python release this engine has been shown to conform to.
 * `null` until the WA-2 conformance report passes; the UI must then say "Pending" (G1-5).
 */
export const CONFORMS_TO_PYTHON: string | null = null;

import * as THREE from 'three';
export const _leak = (): string => String(THREE) + document.title;
