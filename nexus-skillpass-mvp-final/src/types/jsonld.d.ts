// The parts of jsonld (CommonJS, no bundled types) that SkillPass uses.
declare module 'jsonld' {
  export type RemoteDocument = { contextUrl: string | null; documentUrl: string; document: unknown };
  export type DocumentLoader = (url: string) => Promise<RemoteDocument>;
  export interface CanonizeOptions {
    algorithm?: 'RDFC-1.0' | 'URDNA2015';
    format?: 'application/n-quads';
    documentLoader?: DocumentLoader;
    /** Throw when a term or value would be dropped instead of signed (JSON-LD "safe mode"). */
    safe?: boolean;
  }
  const jsonld: {
    canonize(input: unknown, options?: CanonizeOptions): Promise<string>;
    expand(input: unknown, options?: { documentLoader?: DocumentLoader; safe?: boolean }): Promise<unknown[]>;
  };
  export default jsonld;
}
