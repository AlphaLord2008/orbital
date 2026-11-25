import { CONFORMS_TO_PYTHON } from '@orbital/engine';

/**
 * WA-1 application shell: the name, the build commit and the engine's conformance status.
 * No product UI is built before WA-3 (gate G2); the approved designs are in docs/design/.
 */
export function App() {
  const conformance =
    CONFORMS_TO_PYTHON === null ? 'Pending' : `Python orbital ${CONFORMS_TO_PYTHON}`;
  return (
    <main className="shell">
      <h1 className="shell__title">ORBITAL</h1>
      <p className="shell__meta">
        <span>Web Alpha · build {__ORBITAL_COMMIT__}</span>
        <span>Browser engine conformance: {conformance}</span>
      </p>
    </main>
  );
}
