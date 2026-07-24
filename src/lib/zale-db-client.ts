/**
 * Typed client for the real Zale DB control-plane API
 * (github.com/zenulbashar/DB), the serverless-Postgres platform Zale Hosting
 * provisions managed databases from.
 *
 * It mirrors that repo's sanctioned `@nimbusdb/api-client` (ADR-012: exactly one
 * HTTP client, spec-first from `api/openapi.yaml`) — same base URL shape
 * (`https://api.db.zaleit.com.au/v1`), `Authorization: Bearer <ndb_ key>`,
 * `Idempotency-Key` support, and RFC 7807 `application/problem+json` errors.
 *
 * The resource hierarchy is org → project → branch → endpoints. Hosting maps a
 * project's "database" to a Zale DB **project** and a preview deployment's
 * database to a Zale DB **branch** (a copy-on-write data fork), and reads
 * connection strings from `/connection-uri`. Scale-to-zero (suspend/resume) is
 * first-class; wake-on-connect at the gateway is transparent (ADR-014).
 */

export type EndpointKind = "rw_pooled" | "rw_direct" | "ro_pooled";
export type BranchRole = "production" | "preview" | "development";
export type ResourceState =
  | "provisioning"
  | "ready"
  | "suspending"
  | "suspended"
  | "resuming"
  | "resizing"
  | "error"
  | "deleting";

export type ZdbProject = {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  region: string;
  pg_version: number;
  state: "pending" | "provisioning" | "ready" | "error" | "deleting";
  default_branch_id: string | null;
  created_at: string;
};

export type ZdbEndpoint = {
  id: string;
  branch_id: string;
  kind: EndpointKind;
  host: string;
  state: ResourceState;
  created_at: string;
};

export type ZdbBranch = {
  id: string;
  project_id: string;
  parent: string | null;
  name: string;
  role: BranchRole;
  state: ResourceState;
  compute: { min_cu: number; max_cu: number; current_cu?: number; suspend_timeout_s: number };
  retention_days: number;
  bootstrap_at?: string | null;
  created_at: string;
  endpoints?: ZdbEndpoint[];
};

export type ZdbProjectCreated = {
  project: ZdbProject;
  owner_role: { name: string; password: string };
  database: { name: string };
};

export type ZdbConnectionUri = {
  uri: string;
  endpoint: string;
  branch_id: string;
  role: string;
  database: string;
  revealed: boolean;
};

/** RFC 7807 problem raised by the control plane. */
export class ZaleDbApiError extends Error {
  constructor(
    public status: number,
    public problem: { type?: string; title: string; status: number; detail?: string; request_id?: string }
  ) {
    super(`Zale DB: ${problem.title} (${status})`);
  }
}

export type ZaleDbClientOptions = {
  baseUrl: string; // e.g. https://api.db.zaleit.com.au/v1
  apiKey: string; // ndb_ / zdb_ service key
  fetchImpl?: typeof fetch;
};

export function createZaleDbClient(opts: ZaleDbClientOptions) {
  const f = opts.fetchImpl ?? fetch;
  const base = opts.baseUrl.replace(/\/$/, "");

  async function request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    };
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const res = await f(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const json = await res.json().catch(() => ({ title: res.statusText, status: res.status }));
    if (!res.ok) throw new ZaleDbApiError(res.status, json as ZaleDbApiError["problem"]);
    return json as T;
  }

  return {
    request,

    health: () => request<{ status: string; version?: string }>("GET", "/healthz"),

    createProject: (
      input: { org_id: string; name: string; region?: string; pg_version?: 16 | 17 },
      idempotencyKey?: string
    ) => request<ZdbProjectCreated>("POST", "/projects", { region: "syd1", pg_version: 17, ...input }, idempotencyKey),

    getProject: (prj: string) => request<ZdbProject>("GET", `/projects/${encodeURIComponent(prj)}`),

    deleteProject: (prj: string) => request<void>("DELETE", `/projects/${encodeURIComponent(prj)}`),

    /** Assemble a connection string; masked unless `reveal` (needs roles:write, audit-logged). */
    getConnectionUri: (
      prj: string,
      params?: { branch?: string; endpoint?: EndpointKind; role?: string; database?: string; reveal?: boolean }
    ) => {
      const q = new URLSearchParams();
      if (params?.branch) q.set("branch", params.branch);
      q.set("endpoint", params?.endpoint ?? "rw_pooled");
      if (params?.role) q.set("role", params.role);
      if (params?.database) q.set("database", params.database);
      if (params?.reveal) q.set("reveal", "true");
      return request<ZdbConnectionUri>("GET", `/projects/${encodeURIComponent(prj)}/connection-uri?${q}`);
    },

    createBranch: (
      prj: string,
      input: {
        name: string;
        from_branch?: string | null;
        role?: BranchRole;
        compute_min_cu?: number;
        compute_max_cu?: number;
        suspend_timeout_s?: number;
      },
      idempotencyKey?: string
    ) => request<ZdbBranch>("POST", `/projects/${encodeURIComponent(prj)}/branches`, input, idempotencyKey),

    getBranch: (br: string) => request<ZdbBranch>("GET", `/branches/${encodeURIComponent(br)}`),

    deleteBranch: (br: string) => request<void>("DELETE", `/branches/${encodeURIComponent(br)}`),

    /** Scale-to-zero. Idempotent per ADR-014. */
    suspendBranch: (br: string) => request<ZdbBranch>("POST", `/branches/${encodeURIComponent(br)}/suspend`),
    resumeBranch: (br: string) => request<ZdbBranch>("POST", `/branches/${encodeURIComponent(br)}/resume`),
  };
}

export type ZaleDbClient = ReturnType<typeof createZaleDbClient>;
