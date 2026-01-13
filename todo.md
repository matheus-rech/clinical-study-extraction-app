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
