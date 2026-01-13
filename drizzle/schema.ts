import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Documents table - stores PDF metadata and S3 references
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  filename: varchar("filename", { length: 512 }).notNull(),
  s3Url: text("s3Url").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileSize: bigint("fileSize", { mode: "number" }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).default("application/pdf").notNull(),
  pageCount: int("pageCount"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Extractions table - stores extraction sessions with schema and extracted data
 */
export const extractions = mysqlTable("extractions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("documentId").notNull(),
  userId: int("userId").notNull(),
  /** JSON schema defining what fields to extract */
  schema: json("schema").$type<ExtractionSchema>().notNull(),
  /** Extracted data with values and location references */
  extractedData: json("extractedData").$type<ExtractedData>(),
  /** AI-generated document summary */
  summary: text("summary"),
  status: mysqlEnum("status", ["pending", "extracting", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Extraction = typeof extractions.$inferSelect;
export type InsertExtraction = typeof extractions.$inferInsert;

/**
 * Type definitions for extraction schema and data
 */
export interface ExtractionField {
  name: string;
  label: string;
  type: "text" | "textarea" | "number";
  description?: string;
}

export interface ExtractionSchema {
  fields: ExtractionField[];
}

export interface LocationData {
  page: number;
  exact: string;
  rects: number[][];
  selector: {
    type: string;
    conformsTo?: string;
    value: string;
  };
}

export interface ExtractedFieldData {
  value: string;
  location?: LocationData;
}

export interface ExtractedData {
  [fieldName: string]: ExtractedFieldData;
}

/** Default clinical trial extraction schema */
export const DEFAULT_EXTRACTION_SCHEMA: ExtractionSchema = {
  fields: [
    { name: "study_id", label: "Study ID / DOI", type: "text", description: "DOI or Protocol ID" },
    { name: "trial_id", label: "Trial ID", type: "text", description: "NCT Number" },
    { name: "sample_size", label: "Sample Size", type: "text", description: "Number of participants randomized" },
    { name: "outcome", label: "Primary Outcome", type: "textarea", description: "Primary outcome measure" },
  ],
};
