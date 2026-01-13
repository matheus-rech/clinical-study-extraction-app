import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "documents/1/test-file.pdf",
    url: "https://storage.example.com/documents/1/test-file.pdf",
  }),
}));

// Mock database functions
vi.mock("./db", () => ({
  createDocument: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    filename: "test.pdf",
    s3Url: "https://storage.example.com/documents/1/test.pdf",
    fileKey: "documents/1/test.pdf",
    fileSize: 1024,
    mimeType: "application/pdf",
    pageCount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getDocumentsByUser: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      filename: "test.pdf",
      s3Url: "https://storage.example.com/documents/1/test.pdf",
      fileKey: "documents/1/test.pdf",
      fileSize: 1024,
      mimeType: "application/pdf",
      pageCount: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getDocumentById: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    filename: "test.pdf",
    s3Url: "https://storage.example.com/documents/1/test.pdf",
    fileKey: "documents/1/test.pdf",
    fileSize: 1024,
    mimeType: "application/pdf",
    pageCount: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  deleteDocument: vi.fn().mockResolvedValue(true),
  createExtraction: vi.fn().mockResolvedValue({
    id: 1,
    documentId: 1,
    userId: 1,
    schema: { fields: [] },
    extractedData: null,
    summary: null,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getExtractionsByDocument: vi.fn().mockResolvedValue([]),
  getExtractionById: vi.fn().mockResolvedValue({
    id: 1,
    documentId: 1,
    userId: 1,
    schema: { fields: [] },
    extractedData: null,
    summary: null,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  updateExtraction: vi.fn().mockResolvedValue({
    id: 1,
    documentId: 1,
    userId: 1,
    schema: { fields: [] },
    extractedData: { test: { value: "test" } },
    summary: null,
    status: "completed",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  deleteExtraction: vi.fn().mockResolvedValue(true),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("documents router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists documents for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.documents.list();

    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("test.pdf");
  });

  it("gets a document by id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.documents.get({ id: 1 });

    expect(result.id).toBe(1);
    expect(result.filename).toBe("test.pdf");
  });

  it("uploads a document", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.documents.upload({
      filename: "test.pdf",
      fileData: "dGVzdA==", // base64 "test"
      mimeType: "application/pdf",
      fileSize: 1024,
    });

    expect(result.id).toBe(1);
    expect(result.filename).toBe("test.pdf");
  });

  it("deletes a document", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.documents.delete({ id: 1 });

    expect(result.success).toBe(true);
  });
});

// Mock LLM for schema generation
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          fields: [
            { name: "study_id", label: "Study ID", type: "text", description: "Clinical trial registration number" },
            { name: "sample_size", label: "Sample Size", type: "number", description: "Total number of participants" },
          ],
          reasoning: "These are the core fields for clinical trial extraction"
        })
      }
    }]
  })
}));

describe("extractions router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an extraction session", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.extractions.create({
      documentId: 1,
      schema: {
        fields: [
          { name: "study_id", label: "Study ID", type: "text" },
        ],
      },
    });

    expect(result.id).toBe(1);
    expect(result.status).toBe("pending");
  });

  it("updates extraction data", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.extractions.update({
      id: 1,
      extractedData: {
        study_id: { value: "NCT12345678" },
      },
      status: "completed",
    });

    expect(result.status).toBe("completed");
  });

  it("gets default schema", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.schemas.getDefault();

    expect(result.fields).toBeDefined();
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.fields[0].name).toBe("citation");
  });
});


describe("schemas router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates schema from natural language prompt", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.schemas.generateFromPrompt({
      prompt: "I need to extract study ID and sample size from clinical trials",
    });

    expect(result.success).toBe(true);
    expect(result.schema).toBeDefined();
    expect(result.schema.fields).toHaveLength(2);
    expect(result.schema.fields[0].name).toBe("study_id");
    expect(result.reasoning).toBeDefined();
  });
});
