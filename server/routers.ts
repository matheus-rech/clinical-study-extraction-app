import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { 
  createDocument, getDocumentsByUser, getDocumentById, deleteDocument,
  createExtraction, getExtractionsByDocument, getExtractionById, updateExtraction, deleteExtraction,
  getTemplatesForUser, getTemplatesByStudyType, getTemplateById, createTemplate, updateTemplate, deleteTemplate, getBuiltInTemplates,
  createAgentExtraction, getAgentExtractionsByExtractionId, getAgentExtractionByProvider, updateAgentExtraction, deleteAgentExtractionsByExtractionId
} from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { DEFAULT_EXTRACTION_SCHEMA, ExtractionSchema, ExtractedData, LocationData, STUDY_TYPES, StudyType, AI_PROVIDERS, AIProvider } from "../drizzle/schema";
import Anthropic from "@anthropic-ai/sdk";
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

    // Multi-agent extraction with 3 providers
    multiAgentExtract: protectedProcedure
      .input(z.object({
        extractionId: z.number(),
        documentText: z.string(),
        providers: z.array(z.enum(["gemini", "claude", "openrouter"])).default(["gemini", "claude", "openrouter"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const extraction = await getExtractionById(input.extractionId, ctx.user.id);
        if (!extraction) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });

        const schema = extraction.schema as ExtractionSchema;
        const fieldsDescription = schema.fields.map(f => `- ${f.label}: ${f.description || f.type}`).join('\n');

        // Build JSON schema for structured output
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
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              source_location: {
                type: "object",
                properties: {
                  page: { type: "integer" },
                  section: { type: "string" },
                  specific_location: { type: "string" },
                  exact_text_reference: { type: "string" }
                },
                required: ["page", "exact_text_reference"],
                additionalProperties: false
              },
              notes: { type: "string" }
            },
            required: ["content", "confidence", "source_location"],
            additionalProperties: false
          };
        });

        const systemPrompt = `You are an expert clinical data extractor. Extract data with full provenance tracking.
For EVERY field return: content, confidence (high/medium/low), source_location (page, section, exact_text_reference), and notes.`;

        const userPrompt = `Extract these fields from the clinical document:\n${fieldsDescription}\n\nDocument:\n${input.documentText.substring(0, 50000)}`;

        const results: Array<{ provider: AIProvider; extractedData: ExtractedData | null; status: string; error?: string }> = [];

        // Extract with each provider in parallel
        const extractionPromises = input.providers.map(async (provider: AIProvider) => {
          try {
            let extractedData: ExtractedData = {};

            if (provider === 'gemini') {
              // Use built-in LLM (Gemini)
              const response = await invokeLLM({
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt }
                ],
                response_format: {
                  type: "json_schema",
                  json_schema: {
                    name: "extraction_result",
                    strict: true,
                    schema: { type: "object", properties, required: schema.fields.map(f => f.name), additionalProperties: false }
                  }
                }
              });
              const content = response.choices[0]?.message?.content;
              if (content && typeof content === 'string') {
                const parsed = JSON.parse(content);
                for (const [key, data] of Object.entries(parsed)) {
                  const fieldData = data as any;
                  extractedData[key] = {
                    value: fieldData.content ?? "",
                    confidence: fieldData.confidence || 'low',
                    source_location: fieldData.source_location,
                    notes: fieldData.notes,
                  };
                }
              }
            } else if (provider === 'claude') {
              // Use Anthropic Claude
              const anthropic = new Anthropic();
              const response = await anthropic.messages.create({
                model: "claude-sonnet-4-20250514",
                max_tokens: 8192,
                system: systemPrompt,
                messages: [{ role: "user", content: userPrompt + "\n\nRespond with valid JSON only." }]
              });
              const textBlock = response.content.find((b: any) => b.type === 'text');
              if (textBlock && 'text' in textBlock) {
                const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  for (const [key, data] of Object.entries(parsed)) {
                    const fieldData = data as any;
                    extractedData[key] = {
                      value: fieldData.content ?? fieldData.value ?? "",
                      confidence: fieldData.confidence || 'low',
                      source_location: fieldData.source_location,
                      notes: fieldData.notes,
                    };
                  }
                }
              }
            } else if (provider === 'openrouter') {
              // Use OpenRouter API
              const openrouterKey = process.env.OPENROUTER_API_KEY;
              if (!openrouterKey) throw new Error('OpenRouter API key not configured');
              
              const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${openrouterKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'openai/gpt-4o',
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt + "\n\nRespond with valid JSON only." }
                  ],
                  response_format: { type: "json_object" }
                })
              });
              const data = await response.json();
              const content = data.choices?.[0]?.message?.content;
              if (content) {
                const parsed = JSON.parse(content);
                for (const [key, fieldData] of Object.entries(parsed)) {
                  const fd = fieldData as any;
                  extractedData[key] = {
                    value: fd.content ?? fd.value ?? "",
                    confidence: fd.confidence || 'low',
                    source_location: fd.source_location,
                    notes: fd.notes,
                  };
                }
              }
            }

            // Save agent extraction to database
            await createAgentExtraction({
              extractionId: input.extractionId,
              provider,
              modelName: provider === 'gemini' ? 'gemini-pro' : provider === 'claude' ? 'claude-sonnet-4' : 'gpt-4o',
              extractedData,
              status: 'completed',
            });

            return { provider, extractedData, status: 'completed' };
          } catch (error) {
            console.error(`${provider} extraction failed:`, error);
            return { provider, extractedData: null, status: 'failed', error: error instanceof Error ? error.message : 'Unknown error' };
          }
        });

        const extractionResults = await Promise.all(extractionPromises);
        results.push(...extractionResults);

        // Build consensus from successful extractions
        const successfulExtractions = results.filter(r => r.status === 'completed' && r.extractedData);
        let consensus: ExtractedData = {};
        
        if (successfulExtractions.length > 0) {
          // Use majority voting for consensus
          const allFields = new Set<string>();
          successfulExtractions.forEach(e => {
            if (e.extractedData) Object.keys(e.extractedData).forEach(k => allFields.add(k));
          });

          for (const field of Array.from(allFields)) {
            const values = successfulExtractions
              .map(e => e.extractedData?.[field])
              .filter(v => v && v.value !== undefined && v.value !== '');
            
            if (values.length > 0) {
              // Pick the value with highest confidence, or most common
              const highConf = values.find(v => v?.confidence === 'high');
              consensus[field] = highConf || values[0]!;
            }
          }
        }

        return { success: true, results, consensus };
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
  templates: router({
    /** List all templates accessible to the user */
    list: protectedProcedure
      .input(z.object({
        studyType: z.enum(["rct", "cohort", "case_control", "cross_sectional", "meta_analysis", "systematic_review", "case_report", "qualitative", "other"]).optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        if (input?.studyType) {
          return getTemplatesByStudyType(ctx.user.id, input.studyType);
        }
        return getTemplatesForUser(ctx.user.id);
      }),

    /** Get a single template by ID */
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const template = await getTemplateById(input.id, ctx.user.id);
        if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        return template;
      }),

    /** Create a new template */
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "Name is required").max(256),
        description: z.string().optional(),
        studyType: z.enum(["rct", "cohort", "case_control", "cross_sectional", "meta_analysis", "systematic_review", "case_report", "qualitative", "other"]),
        schema: extractionSchemaValidator,
        isPublic: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const template = await createTemplate({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          studyType: input.studyType,
          schema: input.schema,
          isPublic: input.isPublic || false,
          isBuiltIn: false,
        });
        return template;
      }),

    /** Update a template (only owner can update) */
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(256).optional(),
        description: z.string().optional(),
        studyType: z.enum(["rct", "cohort", "case_control", "cross_sectional", "meta_analysis", "systematic_review", "case_report", "qualitative", "other"]).optional(),
        schema: extractionSchemaValidator.optional(),
        isPublic: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const updated = await updateTemplate(id, ctx.user.id, data as any);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found or you don't have permission to edit it" });
        return updated;
      }),

    /** Delete a template (only owner can delete) */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const deleted = await deleteTemplate(input.id, ctx.user.id);
        if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found or you don't have permission to delete it" });
        return { success: true };
      }),

    /** Get study type options */
    getStudyTypes: publicProcedure.query(() => {
      return STUDY_TYPES.map(type => ({
        value: type,
        label: type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      }));
    }),
  }),

  // ============ Schema Generation ============
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

  // ============ Multi-Agent Extraction ============
  agents: router({
    /** Get all agent extractions for an extraction session */
    list: protectedProcedure
      .input(z.object({ extractionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const extraction = await getExtractionById(input.extractionId, ctx.user.id);
        if (!extraction) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });
        return getAgentExtractionsByExtractionId(input.extractionId);
      }),

    /** Run multi-agent extraction with all 3 providers */
    extractWithAllAgents: protectedProcedure
      .input(z.object({
        extractionId: z.number(),
        documentText: z.string(),
        providers: z.array(z.enum(["gemini", "claude", "openrouter"])).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const extraction = await getExtractionById(input.extractionId, ctx.user.id);
        if (!extraction) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });

        const providers = input.providers || ["gemini", "claude", "openrouter"] as AIProvider[];
        const schema = extraction.schema as ExtractionSchema;
        
        // Create agent extraction records for each provider
        const agentRecords = await Promise.all(
          providers.map(provider => 
            createAgentExtraction({
              extractionId: input.extractionId,
              provider,
              status: "pending",
            })
          )
        );

        // Update main extraction status
        await updateExtraction(input.extractionId, ctx.user.id, { status: "extracting" });

        // Run extractions in parallel
        const results = await Promise.allSettled(
          agentRecords.map(async (record) => {
            const startTime = Date.now();
            try {
              await updateAgentExtraction(record.id, { status: "extracting" });
              
              const extractedData = await runAgentExtraction(
                record.provider as AIProvider,
                schema,
                input.documentText
              );
              
              const processingTimeMs = Date.now() - startTime;
              await updateAgentExtraction(record.id, {
                extractedData,
                status: "completed",
                processingTimeMs,
                modelName: getModelName(record.provider as AIProvider),
              });
              
              return { provider: record.provider, extractedData, success: true };
            } catch (error) {
              const processingTimeMs = Date.now() - startTime;
              await updateAgentExtraction(record.id, {
                status: "failed",
                errorMessage: error instanceof Error ? error.message : "Unknown error",
                processingTimeMs,
              });
              return { provider: record.provider, error: error instanceof Error ? error.message : "Unknown error", success: false };
            }
          })
        );

        // Check if at least one succeeded
        const successCount = results.filter(r => r.status === "fulfilled" && (r.value as any).success).length;
        await updateExtraction(input.extractionId, ctx.user.id, { 
          status: successCount > 0 ? "completed" : "failed" 
        });

        return {
          success: successCount > 0,
          results: results.map((r, i) => {
            const baseResult = r.status === "fulfilled" ? r.value : { success: false, error: (r as any).reason?.message };
            return {
              ...baseResult,
              provider: providers[i],
            };
          })
        };
      }),

    /** Run extraction with a single agent */
    extractWithAgent: protectedProcedure
      .input(z.object({
        extractionId: z.number(),
        documentText: z.string(),
        provider: z.enum(["gemini", "claude", "openrouter"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const extraction = await getExtractionById(input.extractionId, ctx.user.id);
        if (!extraction) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });

        const schema = extraction.schema as ExtractionSchema;
        
        // Check if agent extraction already exists
        let agentRecord = await getAgentExtractionByProvider(input.extractionId, input.provider);
        if (!agentRecord) {
          agentRecord = await createAgentExtraction({
            extractionId: input.extractionId,
            provider: input.provider,
            status: "pending",
          });
        }

        const startTime = Date.now();
        try {
          await updateAgentExtraction(agentRecord.id, { status: "extracting" });
          
          const extractedData = await runAgentExtraction(
            input.provider,
            schema,
            input.documentText
          );
          
          const processingTimeMs = Date.now() - startTime;
          const updated = await updateAgentExtraction(agentRecord.id, {
            extractedData,
            status: "completed",
            processingTimeMs,
            modelName: getModelName(input.provider),
          });
          
          return { success: true, agentExtraction: updated };
        } catch (error) {
          const processingTimeMs = Date.now() - startTime;
          await updateAgentExtraction(agentRecord.id, {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            processingTimeMs,
          });
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "Extraction failed"
          });
        }
      }),

    /** Get comparison metrics for agent extractions */
    getComparison: protectedProcedure
      .input(z.object({ extractionId: z.number() }))
      .query(async ({ ctx, input }) => {
        const extraction = await getExtractionById(input.extractionId, ctx.user.id);
        if (!extraction) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });

        const agentExtractions = await getAgentExtractionsByExtractionId(input.extractionId);
        const schema = extraction.schema as ExtractionSchema;
        
        // Calculate field-level agreement
        const fieldComparisons: Record<string, {
          fieldName: string;
          values: { provider: string; value: any; confidence: string }[];
          agreement: "full" | "partial" | "none";
          consensusValue?: any;
        }> = {};

        for (const field of schema.fields) {
          const values = agentExtractions
            .filter(ae => ae.status === "completed" && ae.extractedData)
            .map(ae => {
              const data = (ae.extractedData as ExtractedData)?.[field.name];
              return {
                provider: ae.provider,
                value: data?.value ?? null,
                confidence: data?.confidence ?? "low"
              };
            });

          // Determine agreement level
          const uniqueValues = new Set(values.map(v => JSON.stringify(v.value)));
          let agreement: "full" | "partial" | "none" = "none";
          if (uniqueValues.size === 1 && values.length > 1) {
            agreement = "full";
          } else if (uniqueValues.size < values.length && values.length > 1) {
            agreement = "partial";
          }

          // Find consensus (most common value, weighted by confidence)
          const valueCounts = new Map<string, { count: number; highConfCount: number; value: any }>();
          for (const v of values) {
            const key = JSON.stringify(v.value);
            const existing = valueCounts.get(key) || { count: 0, highConfCount: 0, value: v.value };
            existing.count++;
            if (v.confidence === "high") existing.highConfCount++;
            valueCounts.set(key, existing);
          }
          const sorted = Array.from(valueCounts.values()).sort((a, b) => 
            b.highConfCount - a.highConfCount || b.count - a.count
          );
          const consensusValue = sorted[0]?.value;

          fieldComparisons[field.name] = {
            fieldName: field.label,
            values,
            agreement,
            consensusValue
          };
        }

        // Calculate overall metrics
        const totalFields = schema.fields.length;
        const fullAgreementCount = Object.values(fieldComparisons).filter(f => f.agreement === "full").length;
        const partialAgreementCount = Object.values(fieldComparisons).filter(f => f.agreement === "partial").length;
        
        return {
          fieldComparisons,
          metrics: {
            totalFields,
            fullAgreement: fullAgreementCount,
            partialAgreement: partialAgreementCount,
            noAgreement: totalFields - fullAgreementCount - partialAgreementCount,
            agreementRate: totalFields > 0 ? (fullAgreementCount / totalFields) * 100 : 0,
          },
          agentExtractions: agentExtractions.map(ae => ({
            id: ae.id,
            provider: ae.provider,
            modelName: ae.modelName,
            status: ae.status,
            processingTimeMs: ae.processingTimeMs,
            errorMessage: ae.errorMessage,
          }))
        };
      }),

    /** Accept consensus or specific agent value for a field */
    acceptValue: protectedProcedure
      .input(z.object({
        extractionId: z.number(),
        fieldName: z.string(),
        value: z.any(),
        sourceProvider: z.string().optional(), // Which agent's value to use
      }))
      .mutation(async ({ ctx, input }) => {
        const extraction = await getExtractionById(input.extractionId, ctx.user.id);
        if (!extraction) throw new TRPCError({ code: "NOT_FOUND", message: "Extraction not found" });

        // Get source agent's full data if specified
        let fieldData: any = { value: input.value, confidence: "high" };
        if (input.sourceProvider) {
          const agentExtraction = await getAgentExtractionByProvider(
            input.extractionId, 
            input.sourceProvider as AIProvider
          );
          if (agentExtraction?.extractedData) {
            const sourceData = (agentExtraction.extractedData as ExtractedData)?.[input.fieldName];
            if (sourceData) {
              fieldData = { ...sourceData, value: input.value };
            }
          }
        }

        // Update main extraction with accepted value
        const currentData = (extraction.extractedData || {}) as ExtractedData;
        const updatedData = {
          ...currentData,
          [input.fieldName]: fieldData
        };

        const updated = await updateExtraction(input.extractionId, ctx.user.id, {
          extractedData: updatedData
        });

        return { success: true, extraction: updated };
      }),

    /** Get available AI providers */
    getProviders: publicProcedure.query(() => {
      return AI_PROVIDERS.map(provider => ({
        value: provider,
        label: provider === "gemini" ? "Google Gemini" : 
               provider === "claude" ? "Anthropic Claude" : "OpenRouter",
        description: provider === "gemini" ? "Built-in, fast extraction" :
                     provider === "claude" ? "High accuracy, detailed reasoning" :
                     "Access to multiple models"
      }));
    }),
  }),
});

// Helper function to get model name for each provider
function getModelName(provider: AIProvider): string {
  switch (provider) {
    case "gemini": return "gemini-1.5-flash";
    case "claude": return "claude-3-5-sonnet-20241022";
    case "openrouter": return "anthropic/claude-3.5-sonnet";
    default: return "unknown";
  }
}

// Helper function to run extraction with a specific provider
async function runAgentExtraction(
  provider: AIProvider,
  schema: ExtractionSchema,
  documentText: string
): Promise<ExtractedData> {
  const fieldsDescription = schema.fields.map(f => 
    `"${f.name}" (${f.description || f.label})`
  ).join("\n");

  const systemPrompt = `You are an expert clinical data extractor following rigorous systematic review standards. Extract data from clinical trial documents with full provenance tracking.

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
5. If data is NOT found, set content to empty string and confidence to "low" with explanatory notes.`;

  const userPrompt = `Extract the following fields from this clinical trial document with full provenance:

Fields to extract:
${fieldsDescription}

Document Text:
${documentText.substring(0, 50000)}`;

  // Build JSON schema for structured output
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
          description: "Confidence level"
        },
        source_location: {
          type: "object",
          properties: {
            page: { type: "integer" },
            section: { type: "string" },
            specific_location: { type: "string" },
            exact_text_reference: { type: "string" }
          },
          required: ["page", "exact_text_reference"],
          additionalProperties: false
        },
        notes: { type: "string" }
      },
      required: ["content", "confidence", "source_location"],
      additionalProperties: false
    };
  });

  let parsed: any;

  if (provider === "gemini") {
    // Use built-in LLM (Gemini)
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
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
    if (!content || typeof content !== 'string') throw new Error("No response from Gemini");
    parsed = JSON.parse(content);

  } else if (provider === "claude") {
    // Use Anthropic Claude
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        { role: "user", content: userPrompt + "\n\nRespond with valid JSON only, no markdown." }
      ]
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new Error("No text response from Claude");
    // Extract JSON from response (Claude might wrap in markdown)
    let jsonStr = content.text;
    const jsonMatch = jsonStr.match(/```json\n?([\s\S]*?)\n?```/) || jsonStr.match(/```\n?([\s\S]*?)\n?```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    parsed = JSON.parse(jsonStr.trim());

  } else if (provider === "openrouter") {
    // Use OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.VITE_FRONTEND_FORGE_API_URL || "https://manus.im",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3.5-sonnet",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt + "\n\nRespond with valid JSON only, no markdown." }
        ],
        max_tokens: 8192,
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    let jsonStr = data.choices?.[0]?.message?.content || "";
    const jsonMatch = jsonStr.match(/```json\n?([\s\S]*?)\n?```/) || jsonStr.match(/```\n?([\s\S]*?)\n?```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    parsed = JSON.parse(jsonStr.trim());
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  // Transform to ExtractedData format
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
    };
  }

  return extractedData;
}

export type AppRouter = typeof appRouter;
