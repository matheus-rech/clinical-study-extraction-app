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
  type: z.enum(["text", "textarea", "number"]),
  description: z.string().optional(),
});

const extractionSchemaValidator = z.object({
  fields: z.array(extractionFieldSchema),
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
        extractedData: z.record(z.string(), z.object({
          value: z.string(),
          location: z.object({
            page: z.number(),
            exact: z.string(),
            rects: z.array(z.array(z.number())),
            selector: z.object({
              type: z.string(),
              conformsTo: z.string().optional(),
              value: z.string(),
            }),
          }).optional(),
        })).optional(),
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

          // Build JSON schema for structured output
          const properties: Record<string, any> = {};
          schema.fields.forEach(field => {
            properties[field.name] = {
              type: "object",
              properties: {
                value: { type: "string", description: `The extracted value for ${field.label}` },
                quote: { type: "string", description: `A UNIQUE, VERBATIM text snippet (5-15 words) from the document that contains this value` }
              },
              required: ["value", "quote"],
              additionalProperties: false
            };
          });

          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are an expert clinical data extractor. Extract data from clinical trial documents with high precision.
                
For each field, you MUST return:
- "value": The clean, extracted answer
- "quote": A UNIQUE, VERBATIM text snippet (5-15 words) from the document that contains the answer. This quote will be used to locate the source in the PDF.

If a field cannot be found, return an empty string for both value and quote.`
              },
              {
                role: "user",
                content: `Extract the following fields from this clinical trial document:

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
          
          // Transform to ExtractedData format (location will be added by frontend text locator)
          const extractedData: ExtractedData = {};
          for (const [key, data] of Object.entries(parsed)) {
            const fieldData = data as { value: string; quote: string };
            extractedData[key] = {
              value: fieldData.value || "",
              // Location will be populated by frontend after text grounding
            };
            // Store quote separately for frontend to use in text location
            if (fieldData.quote) {
              extractedData[`${key}_quote`] = { value: fieldData.quote };
            }
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
  }),
});

export type AppRouter = typeof appRouter;
