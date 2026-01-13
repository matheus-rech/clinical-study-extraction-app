# PDF Data Extractor - Project TODO

## Core Features

- [x] PDF viewer with PDF.js integration (page navigation, zoom, text layer)
- [x] Gemini AI auto-extraction endpoint for clinical trial fields
- [x] Gemini AI document summarization endpoint
- [x] Form sidebar with extraction fields and source location tracking
- [x] Customizable extraction form with JSON schema support
- [x] AI-automated text linking system (agents find and link source locations)
- [x] Visual highlight overlay system for source viewing
- [x] Robust text locator algorithm for AI-extracted quotes
- [x] Export modal with W3C-style JSON annotations
- [x] PDF upload and persistence to S3 storage
- [x] Document library management with metadata in database
- [x] Backend API proxy for secure Gemini API key handling
- [x] Loading states and error handling throughout

## Database Schema

- [x] Documents table (id, filename, s3Url, fileKey, fileSize, uploadDate, userId)
- [x] Extractions table (id, documentId, schema, extractedData, createdAt, updatedAt)

## Backend API

- [x] Document upload endpoint with S3 storage
- [x] Document list/retrieve endpoints
- [x] AI extraction endpoint (Gemini integration)
- [x] AI summarization endpoint (Gemini integration)
- [x] Save extraction data endpoint

## Frontend Components

- [x] Document library page
- [x] PDF viewer component
- [x] Extraction sidebar component
- [x] Schema editor component
- [x] Export modal component
- [x] Summary modal component

## Testing

- [x] Backend API tests for extraction endpoints
- [x] Document upload/retrieval tests


## New Features

- [x] Natural language prompt field for schema generation
- [x] AI agent to build optimal extraction schema from user description
- [x] Three schema modes: Visual Editor, JSON Editor, Prompt-based Generation


## Rigorous Clinical Extraction Schema Enhancement

- [x] Add confidence levels (high/medium/low) to extracted fields
- [x] Add detailed source location tracking (page, section, specific_location, exact_text_reference)
- [x] Support PICO-T framework fields in default schema
- [x] Add clinical study master extraction schema as preset
- [x] Display confidence indicators in UI (color-coded badges)
- [x] Show exact text reference in source view
- [x] Export with full provenance data


## Schema Templates Feature

- [x] Database: Add schema_templates table (id, name, description, studyType, schema, isBuiltIn, userId, createdAt, updatedAt)
- [x] Backend: Template CRUD endpoints (list, get, create, update, delete)
- [x] Backend: Built-in preset templates (RCT, Cohort Study, Case-Control, Meta-Analysis, Systematic Review)
- [x] UI: Template selector dropdown in schema editor
- [x] UI: Save current schema as template dialog
- [x] UI: Template management page (view, edit, delete templates)
- [x] UI: Template preview before applying
- [x] Tests: Template CRUD operations


## Multi-Agent Extraction & Comparison Feature

### Backend - Multi-Provider AI Integration
- [x] Add Claude API integration (Anthropic) for extraction
- [x] Add OpenRouter API integration for third provider access
- [x] Create unified extraction interface for all 3 providers
- [x] Store extraction results per agent/provider in database
- [x] Add agent metadata (provider, model, timestamp) to extractions

### Extraction Comparison View
- [x] Side-by-side comparison UI for 3 agent extractions
- [x] Field-level agreement indicators (all agree, partial, disagree)
- [x] Inter-rater reliability metrics (percent agreement)
- [x] Highlight discrepancies between agents
- [x] Allow user to select "consensus" value or override

### Full JSON Schema Form Rendering
- [ ] Render nested object fields (e.g., source_location with page, section, etc.)
- [ ] Render array fields with add/remove items
- [ ] Render confidence level selectors (high/medium/low)
- [ ] Render all field types from clinical schema (extractedFieldString, extractedFieldNumber, etc.)
- [ ] Group fields by section (Study ID, PICO-T, Baseline, etc.)

### CSV/Excel Export
- [x] Export single extraction to CSV
- [x] Export comparison data with all 3 agent values
- [x] Include confidence levels and source locations in export
- [x] Support TSV format (Excel compatible)


### Paginated Sidebar (Step-by-Step Form)
- [x] Paginated sidebar: separate extraction phases into pages/tabs
- [x] Step navigation with previous/next buttons
- [x] Progress indicators showing filled fields per step
- [x] Overall progress bar at the top
