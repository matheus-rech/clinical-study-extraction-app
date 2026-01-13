import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint, boolean } from "drizzle-orm/mysql-core";

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

export type ExtractionRecord = typeof extractions.$inferSelect;
export type InsertExtraction = typeof extractions.$inferInsert;

/**
 * Study types for template categorization
 */
export const STUDY_TYPES = [
  "rct",           // Randomized Controlled Trial
  "cohort",        // Cohort Study
  "case_control",  // Case-Control Study
  "cross_sectional", // Cross-Sectional Study
  "meta_analysis", // Meta-Analysis
  "systematic_review", // Systematic Review
  "case_report",   // Case Report/Series
  "qualitative",   // Qualitative Study
  "other"          // Other study types
] as const;

export type StudyType = typeof STUDY_TYPES[number];

/**
 * Schema templates table - stores reusable extraction schemas
 */
export const schemaTemplates = mysqlTable("schema_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** User who created the template (null for built-in templates) */
  userId: int("userId"),
  /** Template name */
  name: varchar("name", { length: 256 }).notNull(),
  /** Template description */
  description: text("description"),
  /** Study type this template is designed for */
  studyType: mysqlEnum("studyType", [
    "rct", "cohort", "case_control", "cross_sectional",
    "meta_analysis", "systematic_review", "case_report", "qualitative", "other"
  ]).default("other").notNull(),
  /** The extraction schema JSON */
  schema: json("schema").$type<ExtractionSchema>().notNull(),
  /** Whether this is a built-in system template */
  isBuiltIn: boolean("isBuiltIn").default(false).notNull(),
  /** Whether this template is public (visible to all users) */
  isPublic: boolean("isPublic").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SchemaTemplate = typeof schemaTemplates.$inferSelect;
export type InsertSchemaTemplate = typeof schemaTemplates.$inferInsert;

// ============================================================================
// RIGOROUS CLINICAL EXTRACTION SCHEMA TYPES
// Based on clinical-study-master-extraction.schema.json
// ============================================================================

/**
 * Confidence level for extracted data - indicates reliability of extraction
 */
export type Confidence = "high" | "medium" | "low";

/**
 * Source location with full provenance tracking
 * Every extracted field MUST have source location for verification
 */
export interface SourceLocation {
  /** Page number in the document (1-indexed, required) */
  page: number;
  /** Section heading where data was found */
  section?: string;
  /** Specific location within section (e.g., "Table 2, Row 3", "Figure 1 caption") */
  specific_location?: string;
  /** Exact verbatim text from the document that contains this data */
  exact_text_reference?: string;
}

/**
 * Base extracted field type - every extracted field follows this structure
 */
export interface ExtractedField<T = string> {
  /** The extracted content/value */
  content: T;
  /** Source location in the document */
  source_location: SourceLocation;
  /** Confidence level of the extraction */
  confidence: Confidence;
  /** Additional notes about the extraction (ambiguities, assumptions, etc.) */
  notes?: string;
}

/**
 * Extracted field types with proper typing
 */
export type ExtractedFieldString = ExtractedField<string>;
export type ExtractedFieldStringRequired = ExtractedField<string> & { content: string };
export type ExtractedFieldInteger = ExtractedField<number>;
export type ExtractedFieldNumber = ExtractedField<number>;
export type ExtractedFieldBoolean = ExtractedField<boolean>;
export type ExtractedFieldTriState = ExtractedField<boolean | null>;

/**
 * Generic extracted item for arrays (interventions, complications, etc.)
 */
export interface ExtractedItem {
  data_type: string;
  content: unknown;
  source_location: SourceLocation;
  confidence: Confidence;
  notes?: string;
}

// ============================================================================
// CLINICAL STUDY MASTER EXTRACTION SCHEMA
// ============================================================================

/**
 * Step 1: Study Identification
 */
export interface StudyId {
  citation: ExtractedFieldStringRequired;
  doi?: ExtractedFieldString;
  pmid?: ExtractedFieldString;
  journal?: ExtractedFieldString;
  year?: ExtractedFieldInteger;
  country?: ExtractedFieldString;
  centers?: ExtractedFieldString;
  funding?: ExtractedFieldString;
  conflicts?: ExtractedFieldString;
  registration?: ExtractedFieldString;
}

/**
 * Step 2: PICO-T Framework
 */
export interface PicoT {
  population?: ExtractedFieldString;
  intervention?: ExtractedFieldString;
  comparator?: ExtractedFieldString;
  outcomesMeasured?: ExtractedFieldString;
  timingFollowUp?: ExtractedFieldString;
  studyType?: ExtractedFieldString;
  inclusionMet: ExtractedFieldBoolean;
}

/**
 * Step 3: Baseline Demographics
 */
export interface Baseline {
  sampleSize: {
    totalN: ExtractedFieldInteger;
    surgicalN?: ExtractedFieldInteger;
    controlN?: ExtractedFieldInteger;
  };
  age?: {
    mean?: ExtractedFieldNumber;
    sd?: ExtractedFieldNumber;
    median?: ExtractedFieldNumber;
    iqr?: {
      lowerQ1?: ExtractedFieldNumber;
      upperQ3?: ExtractedFieldNumber;
    };
  };
  gender?: {
    maleN?: ExtractedFieldInteger;
    femaleN?: ExtractedFieldInteger;
  };
  clinicalScores?: {
    prestrokeMRS?: ExtractedFieldNumber;
    nihssMeanOrMedian?: ExtractedFieldNumber;
    gcsMeanOrMedian?: ExtractedFieldNumber;
  };
}

/**
 * Step 4: Imaging
 */
export interface Imaging {
  vascularTerritory?: ExtractedFieldString;
  infarctVolume?: ExtractedFieldNumber;
  strokeVolumeCerebellum?: ExtractedFieldString;
  edema?: {
    description?: ExtractedFieldString;
    peakSwellingWindow?: ExtractedFieldString;
  };
  involvementAreas?: {
    brainstemInvolvement?: ExtractedFieldTriState;
    supratentorialInvolvement?: ExtractedFieldTriState;
    nonCerebellarStroke?: ExtractedFieldTriState;
  };
}

/**
 * Step 5: Interventions
 */
export interface Interventions {
  surgicalIndications?: ExtractedItem[];
  interventionTypes?: ExtractedItem[];
}

/**
 * Step 6: Study Arms
 */
export interface StudyArm {
  armId?: ExtractedFieldString;
  label?: ExtractedFieldString;
  description?: ExtractedFieldString;
}

/**
 * Step 7: Outcomes
 */
export interface MortalityOutcome {
  armId?: ExtractedFieldString;
  timepoint?: ExtractedFieldString;
  deathsN?: ExtractedFieldInteger;
  totalN?: ExtractedFieldInteger;
  notes?: ExtractedFieldString;
}

export interface MRSOutcome {
  armId?: ExtractedFieldString;
  timepoint?: ExtractedFieldString;
  definition?: ExtractedFieldString;
  eventsN?: ExtractedFieldInteger;
  totalN?: ExtractedFieldInteger;
  notes?: ExtractedFieldString;
}

export interface Outcomes {
  mortality?: MortalityOutcome[];
  mrs?: MRSOutcome[];
}

/**
 * Step 8: Complications
 */
export interface ComplicationItem {
  armId?: ExtractedFieldString;
  complication?: ExtractedFieldString;
  eventsN?: ExtractedFieldInteger;
  totalN?: ExtractedFieldInteger;
  timepoint?: ExtractedFieldString;
  notes?: ExtractedFieldString;
}

export interface PredictorAnalysis {
  predictor?: ExtractedFieldString;
  effectMeasure?: ExtractedFieldString;
  estimate?: ExtractedFieldNumber;
  ciLower?: ExtractedFieldNumber;
  ciUpper?: ExtractedFieldNumber;
  pValue?: ExtractedFieldNumber;
  adjusted?: ExtractedFieldBoolean;
  modelNotes?: ExtractedFieldString;
}

export interface Complications {
  items?: ComplicationItem[];
  predictorsSummary?: ExtractedFieldString;
  predictorAnalyses?: PredictorAnalysis[];
}

/**
 * Extraction Log - generic extracted data with summary
 */
export interface ExtractionLog {
  extracted_data?: ExtractedItem[];
  summary?: {
    document_type?: string;
    total_extractions?: number;
    demographics?: Record<string, unknown>;
    clinical_aspects?: Record<string, unknown>;
    interventional_aspects?: Record<string, unknown>;
    picos?: {
      population?: string;
      intervention?: string;
      comparison?: string;
      outcomes?: string;
    };
  };
}

/**
 * Complete Clinical Study Master Extraction
 */
export interface ClinicalStudyExtraction {
  meta?: {
    schemaVersion?: string;
  };
  studyId: StudyId;
  picoT: PicoT;
  baseline: Baseline;
  imaging?: Imaging;
  interventions?: Interventions;
  studyArms?: StudyArm[];
  outcomes?: Outcomes;
  complications?: Complications;
  extractionLog?: ExtractionLog;
}

// ============================================================================
// FLEXIBLE EXTRACTION SCHEMA (for custom user-defined schemas)
// ============================================================================

/**
 * Field definition for custom extraction schemas
 */
export interface ExtractionField {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "integer";
  description?: string;
  required?: boolean;
}

export interface ExtractionSchema {
  fields: ExtractionField[];
  /** Optional: use clinical study master schema */
  useClinicalMasterSchema?: boolean;
}

/**
 * Legacy location data (for backward compatibility)
 */
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

/**
 * Extracted field data with full provenance
 */
export interface ExtractedFieldData {
  /** The extracted value */
  value: string | number | boolean;
  /** Confidence level */
  confidence?: Confidence;
  /** Source location in PDF */
  source_location?: SourceLocation;
  /** Legacy location data for PDF highlighting */
  location?: LocationData;
  /** Additional notes */
  notes?: string;
}

export interface ExtractedData {
  [fieldName: string]: ExtractedFieldData;
}

// ============================================================================
// DEFAULT SCHEMAS
// ============================================================================

/** Default clinical trial extraction schema with PICO-T focus */
export const DEFAULT_EXTRACTION_SCHEMA: ExtractionSchema = {
  fields: [
    { name: "citation", label: "Citation", type: "text", description: "Full citation (Author et al., Year)", required: true },
    { name: "doi", label: "DOI", type: "text", description: "Digital Object Identifier" },
    { name: "pmid", label: "PMID", type: "text", description: "PubMed ID" },
    { name: "registration", label: "Trial Registration", type: "text", description: "Clinical trial registration number (e.g., NCT number)" },
    { name: "study_type", label: "Study Type", type: "text", description: "RCT, cohort, case-control, etc." },
    { name: "population", label: "Population (P)", type: "textarea", description: "Who was studied? Include inclusion/exclusion criteria" },
    { name: "intervention", label: "Intervention (I)", type: "textarea", description: "What intervention was applied?" },
    { name: "comparator", label: "Comparator (C)", type: "textarea", description: "What was the comparison/control group?" },
    { name: "outcomes", label: "Outcomes (O)", type: "textarea", description: "Primary and secondary outcomes measured" },
    { name: "timing", label: "Timing/Follow-up (T)", type: "text", description: "Duration of follow-up" },
    { name: "total_n", label: "Total Sample Size", type: "integer", description: "Total number of participants", required: true },
    { name: "age_mean", label: "Mean Age", type: "number", description: "Mean age of participants" },
    { name: "male_n", label: "Male Participants", type: "integer", description: "Number of male participants" },
    { name: "female_n", label: "Female Participants", type: "integer", description: "Number of female participants" },
  ],
};

/** Clinical Study Master Schema - comprehensive extraction */
export const CLINICAL_MASTER_SCHEMA: ExtractionSchema = {
  useClinicalMasterSchema: true,
  fields: [
    // Step 1: Study ID
    { name: "citation", label: "Citation", type: "text", description: "Full citation (Author et al., Year)", required: true },
    { name: "doi", label: "DOI", type: "text", description: "Digital Object Identifier" },
    { name: "pmid", label: "PMID", type: "text", description: "PubMed ID" },
    { name: "journal", label: "Journal", type: "text", description: "Journal name" },
    { name: "year", label: "Publication Year", type: "integer", description: "Year of publication" },
    { name: "country", label: "Country", type: "text", description: "Country where study was conducted" },
    { name: "centers", label: "Centers", type: "text", description: "Single-center or multi-center" },
    { name: "funding", label: "Funding", type: "text", description: "Funding sources" },
    { name: "conflicts", label: "Conflicts of Interest", type: "text", description: "Declared conflicts of interest" },
    { name: "registration", label: "Trial Registration", type: "text", description: "Clinical trial registration number" },
    // Step 2: PICO-T
    { name: "population", label: "Population (P)", type: "textarea", description: "Who was studied?" },
    { name: "intervention", label: "Intervention (I)", type: "textarea", description: "What intervention was applied?" },
    { name: "comparator", label: "Comparator (C)", type: "textarea", description: "What was the comparison?" },
    { name: "outcomes_measured", label: "Outcomes Measured (O)", type: "textarea", description: "What outcomes were measured?" },
    { name: "timing_followup", label: "Timing/Follow-up (T)", type: "text", description: "Duration of follow-up" },
    { name: "study_type", label: "Study Type", type: "text", description: "RCT, cohort, case-control, etc." },
    { name: "inclusion_met", label: "Inclusion Criteria Met", type: "boolean", description: "Does study meet inclusion criteria?" },
    // Step 3: Baseline
    { name: "total_n", label: "Total N", type: "integer", description: "Total sample size", required: true },
    { name: "surgical_n", label: "Surgical Group N", type: "integer", description: "Sample size in surgical/intervention group" },
    { name: "control_n", label: "Control Group N", type: "integer", description: "Sample size in control group" },
    { name: "age_mean", label: "Age (Mean)", type: "number", description: "Mean age" },
    { name: "age_sd", label: "Age (SD)", type: "number", description: "Standard deviation of age" },
    { name: "age_median", label: "Age (Median)", type: "number", description: "Median age" },
    { name: "male_n", label: "Male N", type: "integer", description: "Number of males" },
    { name: "female_n", label: "Female N", type: "integer", description: "Number of females" },
    { name: "nihss", label: "NIHSS (Mean/Median)", type: "number", description: "NIH Stroke Scale score" },
    { name: "gcs", label: "GCS (Mean/Median)", type: "number", description: "Glasgow Coma Scale score" },
  ],
};
