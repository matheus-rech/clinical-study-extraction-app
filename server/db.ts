import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  documents, InsertDocument, Document,
  extractions, InsertExtraction, ExtractionRecord,
  ExtractedData, ExtractionSchema
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ User Queries ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Document Queries ============

export async function createDocument(doc: InsertDocument): Promise<Document> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(documents).values(doc);
  const insertId = result[0].insertId;
  
  const [created] = await db.select().from(documents).where(eq(documents.id, insertId));
  return created;
}

export async function getDocumentsByUser(userId: number): Promise<Document[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.createdAt));
}

export async function getDocumentById(id: number, userId: number): Promise<Document | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const [doc] = await db.select().from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return doc;
}

export async function deleteDocument(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return result[0].affectedRows > 0;
}

// ============ Extraction Queries ============

export async function createExtraction(extraction: InsertExtraction): Promise<ExtractionRecord> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(extractions).values(extraction);
  const insertId = result[0].insertId;
  
  const [created] = await db.select().from(extractions).where(eq(extractions.id, insertId));
  return created;
}

export async function getExtractionsByDocument(documentId: number, userId: number): Promise<ExtractionRecord[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(extractions)
    .where(and(eq(extractions.documentId, documentId), eq(extractions.userId, userId)))
    .orderBy(desc(extractions.createdAt));
}

export async function getExtractionById(id: number, userId: number): Promise<ExtractionRecord | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const [extraction] = await db.select().from(extractions)
    .where(and(eq(extractions.id, id), eq(extractions.userId, userId)));
  return extraction;
}

export async function updateExtraction(
  id: number, 
  userId: number, 
  data: Partial<Pick<ExtractionRecord, 'extractedData' | 'summary' | 'status'>>
): Promise<ExtractionRecord | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  await db.update(extractions)
    .set(data)
    .where(and(eq(extractions.id, id), eq(extractions.userId, userId)));

  return getExtractionById(id, userId);
}

export async function deleteExtraction(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(extractions)
    .where(and(eq(extractions.id, id), eq(extractions.userId, userId)));
  return result[0].affectedRows > 0;
}
