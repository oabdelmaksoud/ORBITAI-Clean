/**
 * Test environment capability probes.
 *
 * These constants let infra-dependent suites skip gracefully (via
 * `describe.skipIf` / `it.skipIf`) when the required external dependency is
 * absent, so the suite is a trustworthy signal even without external infra.
 *
 * Top-level `await` guarantees (per ESM evaluation order) that these values are
 * resolved before any importing test file's `describe` calls run, so
 * `describe.skipIf(!hasMongo)` sees a concrete boolean at collection time.
 */
import net from 'net';

/** Fast, side-effect-free TCP reachability probe (no mongoose connection). */
export function probeTcp(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

function mongoHostPort(): { host: string; port: number } {
  const uri =
    process.env.TEST_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
  try {
    // mongodb://host:port/... or mongodb+srv://host/...
    const m = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@]*@)?([^/:,?]+)(?::(\d+))?/i);
    if (m) {
      return { host: m[1], port: m[2] ? parseInt(m[2], 10) : 27017 };
    }
  } catch {
    /* fall through */
  }
  return { host: '127.0.0.1', port: 27017 };
}

const mongo = mongoHostPort();

/** True when a MongoDB server is reachable. Gates all DB-backed suites. */
export const hasMongo = await probeTcp(mongo.host, mongo.port, 1500);

/** True when the E2B sandbox API key is configured. Gates E2B code-exec suites. */
export const hasE2B = !!process.env.E2B_API_KEY;

/** True when an embedding provider API key is configured. Gates embedding/vector suites. */
export const hasEmbeddingApi = !!(
  process.env.OPENAI_API_KEY ||
  process.env.VOYAGE_API_KEY ||
  process.env.COHERE_API_KEY ||
  process.env.EMBEDDING_API_KEY
);

/**
 * True only when explicitly opted in via RUN_MCP_INFRA_TESTS=1.
 * MCP health checks spawn live MCP server processes / make outbound network
 * calls the CI/test sandbox cannot satisfy, so they are off by default.
 */
export const hasMcpRuntime = process.env.RUN_MCP_INFRA_TESTS === '1';

/**
 * True when CUA cloud credentials are configured. The CUA adapter statically
 * imports the @trycua/agent SDK, which ships no built dist/ in this environment;
 * its tests load the service via dynamic import inside a guarded describe so the
 * unresolvable package is never touched unless cloud is actually configured.
 */
export const hasCuaCloud = !!process.env.CUA_CLOUD_URL && !!process.env.CUA_API_KEY;
