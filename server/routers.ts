import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { 
  createDocument, getDocumentsByUser, getDocumentById, deleteDocument,
  createExtraction, getExtractionsByDocument, getExtractionById, updateExtraction, deleteExtraction
} from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { DEFAULT_EXTRACTION_SCHEMA, ExtractionSchema, ExtractedData, LocationData } from "../drizzle/schema";
import { nanoid } from "nanoid";

// Schema validators
const extractionFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "number", "integer", "boolean"]),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

const extractionSchemaValidator = z.object({
  fields: z.array(extractionFieldSchema),
  useClinicalMasterSchema: z.boolean().optional(),
});

// Source location validator
const sourceLocationValidator = z.object({
  page: z.number(),
  section: z.string().optional(),
  specific_location: z.string().optional(),
  exact_text_reference: z.string().optional(),
});

// Legacy location validator (for PDF highlighting)
const locationValidator = z.object({
  page: z.number(),
  exact: z.string(),
  rects: z.array(z.array(z.number())),
  selector: z.object({
    type: z.string(),
    conformsTo: z.string().optional(),
    value: z.string(),
  }),
});

// Extracted field data validator with confidence and source tracking
const extractedFieldDataValidator = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  source_location: sourceLocationValidator.optional(),
  location: locationValidator.optional(),
  notes: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ Document Management ============
  documents: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getDocumentsByUser(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const doc = await getDocumentById(input.id, ctx.user.id);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        return doc;
      }),

    upload: protectedProcedure
      .input(z.object({
        filename: z.string(),
        fileData: z.string(), // base64 encoded
        mimeType: z.string().default("application/pdf"),
        fileSize: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.fileData, "base64");
        const fileKey = `documents/${ctx.user.id}/${nanoid()}-${input.filename}`;
        
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        
        const doc = await createDocument({
          userId: ctx.user.id,
          filename: input.filename,
          s3Url: url,
          fileKey,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
        });
        
        return doc;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const deleted = await deleteDocument(input.id, ctx.user.id);
        if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        return { success: true };
      }),
  }),

  // ============ Extraction Management ============
  extractions: router({
    list: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getExtractionsByDocument(input.documentId, ctx.user.id);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const extraction = await getExtractionById(input.id, ctx.user.id);
        if (!extraction) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });
        return extraction;
      }),

    create: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        schema: extractionSchemaValidator.optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify document exists and belongs to user
        const doc = await getDocumentById(input.documentId, ctx.user.id);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

        const extraction = await createExtraction({
          documentId: input.documentId,
          userId: ctx.user.id,
          schema: input.schema || DEFAULT_EXTRACTION_SCHEMA,
          status: "pending",
        });
        
        return extraction;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        extractedData: z.record(z.string(), extractedFieldDataValidator).optional(),
        summary: z.string().optional(),
        status: z.enum(["pending", "extracting", "completed", "failed"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const updated = await updateExtraction(id, ctx.user.id, data as any);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });
        return updated;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const deleted = await deleteExtraction(input.id, ctx.user.id);
        if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });
        return { success: true };
      }),
  }),

  // ============ AI Operations ============
  ai: router({
    extract: protectedProcedure
      .input(z.object({
        extractionId: z.number(),
        documentText: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const extraction = await getExtractionById(input.extractionId, ctx.user.id);
        if (!extraction) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });

        // Update status to extracting
        await updateExtraction(input.extractionId, ctx.user.id, { status: "extracting" });

        try {
          const schema = extraction.schema as ExtractionSchema;
          const fieldsDescription = schema.fields.map(f => 
            `"${f.name}" (${f.description || f.label})`
          ).join("\n");

          // Build JSON schema for structured output with confidence and source tracking
          const properties: Record<string, any> = {};
          schema.fields.forEach(field => {
            const valueType = field.type === 'number' || field.type === 'integer' 
              ? { type: ["number", "string"], description: `The extracted value for ${field.label}` }
              : field.type === 'boolean'
              ? { type: ["boolean", "string"], description: `The extracted value for ${field.label}` }
              : { type: "string", description: `The extracted value for ${field.label}` };

            properties[field.name] = {
              type: "object",
              properties: {
                content: valueType,
                confidence: { 
                  type: "string", 
                  enum: ["high", "medium", "low"],
                  description: "Confidence level: high (explicitly stated), medium (inferred from context), low (ambiguous or uncertain)"
                },
                source_location: {
                  type: "object",
                  properties: {
                    page: { type: "integer", description: "Page number where data was found (estimate if unsure)" },
                    section: { type: "string", description: "Section heading (e.g., Methods, Results, Table 1)" },
                    specific_location: { type: "string", description: "Specific location (e.g., paragraph 2, Table 2 Row 3)" },
                    exact_text_reference: { type: "string", description: "VERBATIM text snippet (10-30 words) from document containing this data" }
                  },
                  required: ["page", "exact_text_reference"],
                  additionalProperties: false
                },
                notes: { type: "string", description: "Any notes about ambiguity, assumptions, or data quality issues" }
              },
              required: ["content", "confidence", "source_location"],
              additionalProperties: false
            };
          });

          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert clinical data extractor following rigorous systematic review standards. Extract data from clinical trial documents with full provenance tracking.

For EVERY field, you MUST return:
- "content": The extracted value (clean, normalized)
- "confidence": "high" (explicitly stated in text), "medium" (inferred from context), or "low" (ambiguous/uncertain)
- "source_location": {
    "page": Page number (estimate based on document structure if not explicit)
    "section": Section heading where found (e.g., "Methods", "Results", "Table 1")
    "specific_location": Precise location (e.g., "paragraph 2", "Table 2, Row 3, Column 4")
    "exact_text_reference": VERBATIM quote (10-30 words) from document containing this data
  }
- "notes": Any issues with data quality, ambiguity, or assumptions made

Guidelines:
1. ACCURACY: Only extract explicitly stated information. Mark inferences as "medium" confidence.
2. COMPLETENESS: Extract all instances, not just the first occurrence.
3. TRANSPARENCY: Every extraction must have verifiable source location.
4. For tables/figures: Note the specific table/figure number and row/column.
5. If data is NOT found, set content to empty string and confidence to "low" with explanatory notes.`
              },
              {
                role: "user",
                content: `Extract the following fields from this clinical trial document with full provenance:

Fields to extract:
${fieldsDescription}

Document Text:
${input.documentText.substring(0, 50000)}`
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "extraction_result",
                strict: true,
                schema: {
                  type: "object",
                  properties,
                  required: schema.fields.map(f => f.name),
                  additionalProperties: false
                }
              }
            }
          });

          const content = response.choices[0]?.message?.content;
          if (!content || typeof content !== 'string') throw new Error("No response from LLM");

          const parsed = JSON.parse(content);
          
          // Transform to ExtractedData format with full provenance
          const extractedData: ExtractedData = {};
          for (const [key, data] of Object.entries(parsed)) {
            const fieldData = data as { 
              content: string | number | boolean; 
              confidence: 'high' | 'medium' | 'low';
              source_location: {
                page: number;
                section?: string;
                specific_location?: string;
                exact_text_reference: string;
              };
              notes?: string;
            };
            extractedData[key] = {
              value: fieldData.content ?? "",
              confidence: fieldData.confidence || 'low',
              source_location: fieldData.source_location,
              notes: fieldData.notes,
              // Location will be populated by frontend after text grounding for PDF highlighting
            };
          }

          const updated = await updateExtraction(input.extractionId, ctx.user.id, {
            extractedData,
            status: "completed"
          });

          return { success: true, extractedData, extraction: updated };
        } catch (error) {
          await updateExtraction(input.extractionId, ctx.user.id, { status: "failed" });
          console.error("Extraction failed:", error);
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: error instanceof Error ? error.message : "Extraction failed" 
          });
        }
      }),

    summarize: protectedProcedure
      .input(z.object({
        extractionId: z.number(),
        documentText: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const extraction = await getExtractionById(input.extractionId, ctx.user.id);
        if (!extraction) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });

        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: "You are an expert at summarizing clinical trial documents. Provide clear, structured summaries."
              },
              {
                role: "user",
                content: `Summarize this clinical trial document. 
                
Structure your response with these sections:
- **Objective**: What was the study trying to achieve?
- **Methods**: How was the study conducted?
- **Results**: What were the key findings?
- **Conclusion**: What are the main takeaways?

Keep the summary concise (max 200 words).

Document Text:
${input.documentText.substring(0, 50000)}`
              }
            ]
          });

          const summaryContent = response.choices[0]?.message?.content;
          const summary = typeof summaryContent === 'string' ? summaryContent : "";
          
          const updated = await updateExtraction(input.extractionId, ctx.user.id, { summary });

          return { success: true, summary, extraction: updated };
        } catch (error) {
          console.error("Summarization failed:", error);
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: error instanceof Error ? error.message : "Summarization failed" 
          });
        }
      }),
  }),

  // ============ Schema Templates ============
  schemas: router({
    getDefault: publicProcedure.query(() => DEFAULT_EXTRACTION_SCHEMA),

    generateFromPrompt: protectedProcedure
      .input(z.object({
        prompt: z.string().min(10, "Please provide more detail about what you want to extract"),
        documentContext: z.string().optional(), // Optional sample of document text for better schema
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert at designing data extraction schemas for clinical trial documents and scientific papers.

Your task is to analyze the user's description of what they want to extract and create an optimal extraction schema.

For each field you create:
- "name": A snake_case identifier (e.g., "study_id", "sample_size")
- "label": A human-readable label (e.g., "Study ID", "Sample Size")
- "type": One of "text" (short text), "textarea" (long text/paragraphs), or "number"
- "description": A clear description to help the AI extractor understand what to look for

Consider:
1. What specific data points the user wants
2. Common related fields they might need but didn't mention
3. The best data type for each field
4. Clear, unambiguous descriptions for accurate extraction`
              },
              {
                role: "user",
                content: `Create an extraction schema based on this description:

"${input.prompt}"

${input.documentContext ? `Here's a sample of the document to help understand the context:\n${input.documentContext.substring(0, 5000)}` : ""}

Create a comprehensive schema with all relevant fields.`
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "extraction_schema",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    fields: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Snake_case field identifier" },
                          label: { type: "string", description: "Human-readable label" },
                          type: { type: "string", enum: ["text", "textarea", "number"], description: "Field data type" },
                          description: { type: "string", description: "Description for AI extractor" }
                        },
                        required: ["name", "label", "type", "description"],
                        additionalProperties: false
                      }
                    },
                    reasoning: {
                      type: "string",
                      description: "Brief explanation of why these fields were chosen"
                    }
                  },
                  required: ["fields", "reasoning"],
                  additionalProperties: false
                }
              }
            }
          });

          const content = response.choices[0]?.message?.content;
          if (!content || typeof content !== 'string') throw new Error("No response from LLM");

          const parsed = JSON.parse(content);
          
          return {
            success: true,
            schema: { fields: parsed.fields },
            reasoning: parsed.reasoning
          };
        } catch (error) {
          console.error("Schema generation failed:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Schema generation failed"
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
