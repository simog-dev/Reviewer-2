const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class DBManager {
  constructor(dbPath) {
    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initialize();
    this.prepareStatements();
  }

  initialize() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);

    // Add 'removed' column for soft-delete (preserves annotations)
    try {
      this.db.exec(`ALTER TABLE pdfs ADD COLUMN removed INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists, ignore
    }
  }

  prepareStatements() {
    // PDF statements
    this.stmts = {
      // PDFs
      insertPDF: this.db.prepare(`
        INSERT INTO pdfs (id, name, path, page_count, created_at, updated_at)
        VALUES (@id, @name, @path, @pageCount, datetime('now'), datetime('now'))
      `),
      getAllPDFs: this.db.prepare(`
        SELECT p.*,
               (SELECT COUNT(*) FROM annotations WHERE pdf_id = p.id) as annotation_count
        FROM pdfs p
        WHERE p.removed = 0
        ORDER BY p.updated_at DESC
      `),
      getPDF: this.db.prepare(`
        SELECT p.*,
               (SELECT COUNT(*) FROM annotations WHERE pdf_id = p.id) as annotation_count
        FROM pdfs p
        WHERE p.id = ?
      `),
      updatePDF: this.db.prepare(`
        UPDATE pdfs
        SET name = COALESCE(@name, name),
            page_count = COALESCE(@pageCount, page_count),
            last_opened_at = COALESCE(@lastOpenedAt, last_opened_at),
            updated_at = datetime('now')
        WHERE id = @id
      `),
      deletePDF: this.db.prepare(`DELETE FROM pdfs WHERE id = ?`),
      searchPDFs: this.db.prepare(`
        SELECT p.*,
               (SELECT COUNT(*) FROM annotations WHERE pdf_id = p.id) as annotation_count
        FROM pdfs p
        WHERE p.removed = 0 AND p.name LIKE ?
        ORDER BY p.updated_at DESC
      `),
      softDeletePDF: this.db.prepare(`UPDATE pdfs SET removed = 1, updated_at = datetime('now') WHERE id = ?`),
      restorePDF: this.db.prepare(`UPDATE pdfs SET removed = 0, updated_at = datetime('now') WHERE id = ?`),
      findRemovedPDFByPath: this.db.prepare(`SELECT * FROM pdfs WHERE path = ? AND removed = 1`),

      // Annotations
      insertAnnotation: this.db.prepare(`
        INSERT INTO annotations (id, pdf_id, category_id, page_number, selected_text, comment, highlight_rects, created_at, updated_at)
        VALUES (@id, @pdfId, @categoryId, @pageNumber, @selectedText, @comment, @highlightRects, datetime('now'), datetime('now'))
      `),
      getAnnotationsForPDF: this.db.prepare(`
        SELECT a.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM annotations a
        JOIN categories c ON a.category_id = c.id
        WHERE a.pdf_id = ?
        ORDER BY a.page_number ASC, a.created_at ASC
      `),
      getAnnotation: this.db.prepare(`
        SELECT a.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM annotations a
        JOIN categories c ON a.category_id = c.id
        WHERE a.id = ?
      `),
      updateAnnotation: this.db.prepare(`
        UPDATE annotations
        SET category_id = COALESCE(@categoryId, category_id),
            comment = COALESCE(@comment, comment),
            updated_at = datetime('now')
        WHERE id = @id
      `),
      deleteAnnotation: this.db.prepare(`DELETE FROM annotations WHERE id = ?`),
      deleteAnnotationsForPDF: this.db.prepare(`DELETE FROM annotations WHERE pdf_id = ?`),
      getAnnotationCountByCategory: this.db.prepare(`
        SELECT c.id, c.name, c.color, c.icon, COUNT(a.id) as count
        FROM categories c
        LEFT JOIN annotations a ON a.category_id = c.id AND a.pdf_id = ?
        GROUP BY c.id
        ORDER BY c.sort_order
      `),

      // Categories
      getAllCategories: this.db.prepare(`
        SELECT * FROM categories ORDER BY sort_order
      `),
      getCategory: this.db.prepare(`SELECT * FROM categories WHERE id = ?`),

      // Settings
      getSetting: this.db.prepare(`SELECT value FROM settings WHERE key = ?`),
      setSetting: this.db.prepare(`
        INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
      `)
    };
  }

  // PDF Methods
  addPDF(pdfData) {
    // Check if this PDF was soft-deleted (removed but annotations kept)
    const removed = this.stmts.findRemovedPDFByPath.get(pdfData.path);
    if (removed) {
      // Restore it — same ID, so all annotations are still linked
      this.stmts.restorePDF.run(removed.id);
      this.updatePDF(removed.id, { lastOpenedAt: new Date().toISOString() });
      return this.getPDF(removed.id);
    }

    const id = uuidv4();
    const data = {
      id,
      name: pdfData.name,
      path: pdfData.path,
      pageCount: pdfData.pageCount || 0
    };

    try {
      this.stmts.insertPDF.run(data);
      return this.getPDF(id);
    } catch (error) {
      // If PDF already exists (same path), return existing one
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const existing = this.db.prepare('SELECT * FROM pdfs WHERE path = ?').get(pdfData.path);
        if (existing) {
          this.updatePDF(existing.id, { lastOpenedAt: new Date().toISOString() });
          return this.getPDF(existing.id);
        }
      }
      throw error;
    }
  }

  getAllPDFs() {
    return this.stmts.getAllPDFs.all();
  }

  getPDF(id) {
    return this.stmts.getPDF.get(id);
  }

  updatePDF(id, data) {
    this.stmts.updatePDF.run({
      id,
      name: data.name || null,
      pageCount: data.pageCount || null,
      lastOpenedAt: data.lastOpenedAt || null
    });
    return this.getPDF(id);
  }

  deletePDF(id, deleteAnnotations = true) {
    if (deleteAnnotations) {
      // Hard delete: remove annotations then PDF row (CASCADE would also work)
      this.stmts.deleteAnnotationsForPDF.run(id);
      return this.stmts.deletePDF.run(id);
    } else {
      // Soft delete: hide the PDF but keep annotations intact
      return this.stmts.softDeletePDF.run(id);
    }
  }

  searchPDFs(query) {
    return this.stmts.searchPDFs.all(`%${query}%`);
  }

  // Annotation Methods
  addAnnotation(annotationData) {
    const id = uuidv4();
    const data = {
      id,
      pdfId: annotationData.pdfId,
      categoryId: annotationData.categoryId,
      pageNumber: annotationData.pageNumber,
      selectedText: annotationData.selectedText || null,
      comment: annotationData.comment || null,
      highlightRects: JSON.stringify(annotationData.highlightRects)
    };

    this.stmts.insertAnnotation.run(data);
    return this.getAnnotation(id);
  }

  getAnnotationsForPDF(pdfId) {
    const annotations = this.stmts.getAnnotationsForPDF.all(pdfId);
    return annotations.map(a => ({
      ...a,
      highlight_rects: JSON.parse(a.highlight_rects)
    }));
  }

  getAnnotation(id) {
    const annotation = this.stmts.getAnnotation.get(id);
    if (annotation) {
      annotation.highlight_rects = JSON.parse(annotation.highlight_rects);
    }
    return annotation;
  }

  updateAnnotation(id, data) {
    this.stmts.updateAnnotation.run({
      id,
      categoryId: data.categoryId || null,
      comment: data.comment !== undefined ? data.comment : null
    });
    return this.getAnnotation(id);
  }

  deleteAnnotation(id) {
    return this.stmts.deleteAnnotation.run(id);
  }

  getAnnotationCountByCategory(pdfId) {
    return this.stmts.getAnnotationCountByCategory.all(pdfId);
  }

  // Category Methods
  getAllCategories() {
    return this.stmts.getAllCategories.all();
  }

  getCategory(id) {
    return this.stmts.getCategory.get(id);
  }

  // Settings Methods
  getSetting(key) {
    const result = this.stmts.getSetting.get(key);
    if (result) {
      try {
        return JSON.parse(result.value);
      } catch {
        return result.value;
      }
    }
    return null;
  }

  setSetting(key, value) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    this.stmts.setSetting.run(key, stringValue);
  }

  close() {
    this.db.close();
  }
}

module.exports = DBManager;
