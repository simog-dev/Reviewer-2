-- PDFs table
CREATE TABLE IF NOT EXISTS pdfs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    page_count INTEGER DEFAULT 0,
    last_opened_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Annotations table
CREATE TABLE IF NOT EXISTS annotations (
    id TEXT PRIMARY KEY,
    pdf_id TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    page_number INTEGER NOT NULL,
    selected_text TEXT,
    comment TEXT,
    highlight_rects TEXT NOT NULL, -- JSON array of rect objects
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Settings table for user preferences
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_annotations_pdf_id ON annotations(pdf_id);
CREATE INDEX IF NOT EXISTS idx_annotations_page_number ON annotations(page_number);
CREATE INDEX IF NOT EXISTS idx_annotations_category_id ON annotations(category_id);
CREATE INDEX IF NOT EXISTS idx_pdfs_name ON pdfs(name);

-- Default categories
INSERT OR IGNORE INTO categories (id, name, color, icon, sort_order) VALUES
    (1, 'Critical', '#dc2626', 'error', 1),
    (2, 'Major', '#ea580c', 'warning', 2),
    (3, 'Minor', '#ca8a04', 'info', 3),
    (4, 'Suggestion', '#2563eb', 'lightbulb', 4),
    (5, 'Question', '#7c3aed', 'help', 5);
