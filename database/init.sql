-- Clinical Study Extraction Database Schema
-- Initialize database tables for storing extraction results

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    file_path TEXT,
    file_size BIGINT,
    mime_type VARCHAR(100),
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tables extraction results
CREATE TABLE IF NOT EXISTS extracted_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    table_index INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    extraction_method VARCHAR(50),
    markdown_content TEXT,
    rows INTEGER,
    cols INTEGER,
    bbox JSONB,  -- Bounding box coordinates
    confidence_score FLOAT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Figures extraction results
CREATE TABLE IF NOT EXISTS extracted_figures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    figure_index INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    caption TEXT,
    image_path TEXT,
    image_data BYTEA,  -- Store small images directly
    width INTEGER,
    height INTEGER,
    bbox JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Form answers/annotations
CREATE TABLE IF NOT EXISTS form_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    field_name VARCHAR(255) NOT NULL,
    field_value TEXT,
    field_type VARCHAR(50),
    page_number INTEGER,
    confidence_score FLOAT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extraction jobs for async processing
CREATE TABLE IF NOT EXISTS extraction_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL,  -- 'tables', 'figures', 'forms', 'all'
    status VARCHAR(50) DEFAULT 'queued',  -- 'queued', 'processing', 'completed', 'failed'
    progress INTEGER DEFAULT 0,
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Export history
CREATE TABLE IF NOT EXISTS export_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    export_format VARCHAR(50) NOT NULL,  -- 'csv', 'excel', 'json', 'html', 'pdf'
    export_type VARCHAR(50) NOT NULL,  -- 'tables', 'figures', 'forms', 'annotated_pdf'
    file_path TEXT,
    file_size BIGINT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking (for olmOCR cost monitoring)
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    api_provider VARCHAR(50) NOT NULL,  -- 'olmocr', 'gemini', 'anthropic'
    api_method VARCHAR(100),
    tokens_input INTEGER,
    tokens_output INTEGER,
    cost_usd DECIMAL(10, 6),
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);
CREATE INDEX IF NOT EXISTS idx_documents_upload_date ON documents(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);
CREATE INDEX IF NOT EXISTS idx_extracted_tables_document_id ON extracted_tables(document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_tables_page ON extracted_tables(page_number);
CREATE INDEX IF NOT EXISTS idx_extracted_figures_document_id ON extracted_figures(document_id);
CREATE INDEX IF NOT EXISTS idx_form_answers_document_id ON form_answers(document_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_history_document_id ON export_history(document_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_provider ON api_usage(api_provider);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at DESC);

-- Full text search index on markdown content
CREATE INDEX IF NOT EXISTS idx_extracted_tables_markdown_search 
    ON extracted_tables USING gin(to_tsvector('english', markdown_content));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_answers_updated_at BEFORE UPDATE ON form_answers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- Uncomment if you want test data
/*
INSERT INTO documents (filename, file_path, file_size, mime_type, processed, processing_status)
VALUES 
    ('Won2024.pdf', '/uploads/Won2024.pdf', 583793, 'application/pdf', TRUE, 'completed'),
    ('sample_study.pdf', '/uploads/sample_study.pdf', 1234567, 'application/pdf', FALSE, 'pending');
*/

-- Create view for document statistics
CREATE OR REPLACE VIEW document_statistics AS
SELECT 
    d.id,
    d.filename,
    d.upload_date,
    d.processed,
    COUNT(DISTINCT et.id) as table_count,
    COUNT(DISTINCT ef.id) as figure_count,
    COUNT(DISTINCT fa.id) as form_answer_count,
    SUM(CASE WHEN au.api_provider = 'olmocr' THEN au.cost_usd ELSE 0 END) as olmocr_cost,
    MAX(ej.completed_at) as last_processed_at
FROM documents d
LEFT JOIN extracted_tables et ON d.id = et.document_id
LEFT JOIN extracted_figures ef ON d.id = ef.document_id
LEFT JOIN form_answers fa ON d.id = fa.document_id
LEFT JOIN api_usage au ON d.id = au.document_id
LEFT JOIN extraction_jobs ej ON d.id = ej.document_id
GROUP BY d.id, d.filename, d.upload_date, d.processed;

-- Grant permissions (adjust as needed for your security requirements)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Clinical Study Extraction Database initialized successfully!';
END $$;
