# Specifica Tecnica: Applicativo Peer-Review per Annotazione PDF

## 1. Panoramica del Progetto

### 1.1 Descrizione
Applicazione desktop cross-platform per peer-reviewer che consente di annotare file PDF con commenti categorizzati, mantenendo sincronizzazione tra visualizzazione PDF e pannello commenti.

### 1.2 Obiettivi Principali
- Gestione efficiente di PDF tramite librerie esistenti (PDF.js)
- Minimizzare gestione manuale di coordinate e rendering
- Interfaccia intuitiva divisa in visualizzatore PDF e pannello annotazioni
- Sistema di categorizzazione e filtraggio dei commenti
- Persistenza delle annotazioni senza duplicazione dei file PDF

### 1.3 Tecnologie Core
- **Framework**: Electron.js (per cross-platform compatibility)
- **PDF Rendering**: PDF.js (Mozilla) per gestione completa del documento
- **Annotation Layer**: PDF.js Annotation Layer API
- **Storage**: File system locale per metadati e annotazioni (JSON/SQLite)

---

## 2. Architettura Tecnica

### 2.1 Stack Tecnologico

```
Frontend:
├── Electron.js (main + renderer process)
├── HTML5 / CSS3
├── JavaScript/TypeScript
└── PDF.js (versione 3.x o superiore)

Backend/Storage:
├── Node.js (built-in con Electron)
├── File System API
└── SQLite o JSON files per metadati

UI Framework (opzionale):
├── React/Vue.js (per gestione stato complessa)
└── Tailwind CSS o Material UI
```

### 2.2 Struttura Dati

#### 2.2.1 Metadati PDF
```json
{
  "id": "uuid-v4",
  "fileName": "article_2024.pdf",
  "filePath": "/absolute/path/to/pdf",
  "fileSize": 2048576,
  "pageCount": 25,
  "dateAdded": "2026-01-27T10:30:00Z",
  "lastModified": "2026-01-27T15:45:00Z",
  "annotationCount": 12
}
```

#### 2.2.2 Annotazione
```json
{
  "id": "uuid-v4",
  "pdfId": "uuid-v4",
  "pageNumber": 5,
  "category": "critical",
  "text": "Metodologia non chiara, mancano dettagli statistici",
  "createdAt": "2026-01-27T11:20:00Z",
  "pdfJsAnnotation": {
    "rect": [100, 200, 300, 220],
    "quadPoints": [[100,220,300,220,100,200,300,200]],
    "subtype": "Highlight"
  }
}
```

#### 2.2.3 Categorie di Annotazione
```json
{
  "categories": [
    {
      "id": "critical",
      "label": "Critical Issue",
      "color": "#FF5252",
      "rgbColor": [255, 82, 82],
      "priority": 1
    },
    {
      "id": "major",
      "label": "Major Comment",
      "color": "#FFA726",
      "rgbColor": [255, 167, 38],
      "priority": 2
    },
    {
      "id": "minor",
      "label": "Minor Comment",
      "color": "#FFEB3B",
      "rgbColor": [255, 235, 59],
      "priority": 3
    },
    {
      "id": "suggestion",
      "label": "Suggestion",
      "color": "#66BB6A",
      "rgbColor": [102, 187, 106],
      "priority": 4
    },
    {
      "id": "question",
      "label": "Question",
      "color": "#42A5F5",
      "rgbColor": [66, 165, 245],
      "priority": 5
    }
  ]
}
```

---

## 3. Interfaccia Utente

### 3.1 Home Page

#### 3.1.1 Layout
```
┌────────────────────────────────────────────────┐
│  [Logo] PDF Peer Reviewer        [Impostazioni]│
├────────────────────────────────────────────────┤
│                                                 │
│  [🔍 Cerca PDF...]                  [+ Nuovo]  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  📄 article_nature_2024.pdf              │  │
│  │  25 pagine • 12 annotazioni • 27/01/26  │  │
│  │  [Apri]                        [Elimina] │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  📄 research_paper_final.pdf             │  │
│  │  18 pagine • 5 annotazioni • 26/01/26   │  │
│  │  [Apri]                        [Elimina] │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  [...]                                          │
│                                                 │
│  [← Prev]  [1] 2 3 4 ... 10  [Next →]         │
└────────────────────────────────────────────────┘
```

#### 3.1.2 Funzionalità
- **Barra di ricerca**: Ricerca per nome file (case-insensitive)
- **Paginazione**: 5 PDF per pagina
- **Card PDF**: Mostra nome, numero pagine, numero annotazioni, data ultimo accesso
- **Azioni**: Apri PDF, Elimina dalla lista (non elimina il file originale)
- **Caricamento**: Drag & drop o click su bottone "+ Nuovo"

### 3.2 Pagina di Revisione

#### 3.2.1 Layout Generale

**Layout Responsivo con Pannelli Ridimensionabili:**

```
┌─────────────────────────────────────────────────────────────┐
│  [←] article_nature_2024.pdf                    [Esporta]   │
├────────────────────────────║─────────────────────────────────┤
│                            ║                                │
│  PDF VIEWER                ║  ANNOTATION PANEL              │
│  (ridimensionabile)        ║  (ridimensionabile)            │
│  [◀] collapse              ║              collapse [▶]      │
│                            ║                                │
│  [Toolbar]                 ║  [Filtri Categoria]            │
│  ├─ Zoom: [-] 100% [+]    ║  [All] [Crit] [Maj] [Min]     │
│  └─ [🖊️ Highlight Mode]   ║                                │
│                            ║  ┌──────────────────────────┐  │
│  ┌──────────────────────┐  ║  │ 🔴 Critical • Pag 5      │  │
│  │                      │  ║  │ "Metodologia non chiara" │  │
│  │   Page 1             │  ║  │ 27/01 11:20   [Elimina]  │  │
│  │   [content]          │  ║  └──────────────────────────┘  │
│  │                      │  ║                                │
│  ├──────────────────────┤  ║  ┌──────────────────────────┐  │
│  │   Page 2             │  ║  │ 🟠 Major • Pag 7         │  │
│  │   [Selected text]    │  ║  │ "Riferimento mancante"   │  │
│  │                      │  ║  │ 27/01 11:25   [Elimina]  │  │
│  ├──────────────────────┤  ║  └──────────────────────────┘  │
│  │   Page 3             │  ║                                │
│  │   [content]          │  ║  [...]                         │
│  │   (scroll continuo)  │  ║  (scroll verticale)            │
│  └──────────────────────┘  ║                                │
│                            ║                                │
└────────────────────────────╨────────────────────────────────┘
       ↕ Drag divider per ridimensionare pannelli
```

**Caratteristiche Layout:**
- **Divider centrale**: Drag per ridimensionare proporzione pannelli
- **Range ridimensionamento**: Minimo 30% - Massimo 70% per ogni pannello
- **Collapse buttons**: 
  - Click ◀ → Collassa PDF panel, annotation panel va a 100%
  - Click ▶ → Collassa annotation panel, PDF va a 100%
  - Click di nuovo per ripristinare layout precedente
- **Scroll verticale continuo**: Tutte le pagine PDF in una singola colonna scrollabile
- **Lazy rendering**: Solo pagine visibili + buffer renderizzate (gestito da PDF.js)

#### 3.2.2 Pannello PDF (Ridimensionabile 30%-70%)

**Toolbar Superiore:**
- **Zoom**: Pulsanti -/+ o dropdown (50%, 75%, 100%, 125%, 150%, 200%, Fit Width)
- **Modalità Highlight**: Toggle button per attivare/disattivare selezione testo
- **Page indicator**: Mostra pagina corrente (es. "Pag 5 di 25") - aggiornato durante scroll
- **Collapse button**: ◀ per nascondere pannello PDF
- **Altre opzioni**: Rotazione pagina, download PDF annotato

**Area Visualizzazione PDF:**
- **Rendering continuo verticale**: Tutte le pagine in una colonna scrollabile
- Rendering tramite **PDF.js canvas layer** con lazy loading automatico
- **Text layer** abilitato per selezione testo
- **Annotation layer** per visualizzare highlight esistenti
- **Scroll verticale continuo**: Nessuna paginazione, scroll fluido tra pagine
- **Virtual scrolling**: PDF.js renderizza solo pagine visibili + buffer (3-5 pagine in memoria)

**Gestione Highlight:**
- Quando modalità highlight attiva: selezione testo mostra popup
- Popup contiene: [Categoria dropdown] [Aggiungi Commento]
- Click su highlight esistente: evidenzia nel pannello destro e scrolla

#### 3.2.3 Pannello Annotazioni (Ridimensionabile 30%-70%)

**Header Pannello:**
- **Collapse button**: ▶ per nascondere pannello annotazioni
- **Filtri Categoria**: Chips/badges clickable per categoria (All + 5 categorie)
- Badge mostra count annotazioni per categoria
- Multi-selezione possibile

**Controlli Ordinamento:**
- Dropdown compatto: "Per Pagina" (default) | "Per Data" | "Per Categoria"

**Lista Annotazioni:**
- Scroll verticale indipendente dal PDF
- Card annotazione contiene:
  - Icona colorata categoria
  - Numero pagina
  - Testo commento (max 100 caratteri, espandibile)
  - Timestamp
  - Pulsante elimina
  - Dropdown cambio categoria

**Interazioni:**
- Click su card: scrolla PDF alla pagina e evidenzia highlight
- Click su elimina: rimuove annotazione e highlight dal PDF
- Cambio categoria: aggiorna colore highlight nel PDF

---

## 4. Integrazione PDF.js

### 4.1 Perché PDF.js

PDF.js è la soluzione ideale perché:
- **Native Annotation Support**: Gestione built-in di annotazioni PDF standard
- **Text Layer**: Selezione testo già implementata con coordinate precise
- **Rendering ottimizzato**: Canvas rendering con caching automatico
- **Zoom e Transform**: Gestione automatica di trasformazioni viewport
- **Continuous scrolling**: Supporto nativo per scroll verticale multi-pagina
- **Virtual scrolling**: Lazy loading automatico delle pagine visibili
- **Cross-platform**: JavaScript puro, funziona ovunque

### 4.2 Architettura PDF.js

```
PDFViewerApplication
  ├─ PDFDocument (loaded PDF)
  ├─ PDFViewer (scrollMode: VERTICAL)
  │   ├─ PDFPageView[] (one per page)
  │   │   ├─ Canvas Layer (rendering)
  │   │   ├─ Text Layer (text selection)
  │   │   └─ Annotation Layer (highlights)
  │   └─ EventBus (for communication)
  └─ PDFLinkService (navigation)
```

**Configurazione Scroll Verticale:**
```javascript
const pdfViewer = new pdfjsViewer.PDFViewer({
  container: viewerContainer,
  viewer: viewerElement,
  
  // SCROLL CONTINUO VERTICALE
  scrollMode: pdfjsViewer.ScrollMode.VERTICAL, // Pagine in colonna
  spreadMode: pdfjsViewer.SpreadMode.NONE, // No vista affiancata
  
  // Ottimizzazioni
  textLayerMode: 2, // ENABLE text layer
  annotationMode: 2, // ENABLE annotations
  enableScripting: false,
  removePageBorders: false,
  
  // Performance
  maxCanvasPixels: 16777216,
  useOnlyCssZoom: false
});
```

### 4.3 Implementazione Highlight

#### 4.3.1 Creazione Highlight

**Step 1: Cattura Selezione Testo**
```javascript
// PDF.js fornisce coordinate precise tramite text layer
textLayer.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (selection.toString().length > 0) {
    const range = selection.getRangeAt(0);
    
    // PDF.js text layer ha già mappato coordinate testo -> PDF
    const textLayerElements = getSelectedTextElements(range);
    const pdfCoordinates = convertTextLayerToPDFCoordinates(
      textLayerElements, 
      pageView.viewport
    );
    
    showAnnotationPopup(pdfCoordinates);
  }
});
```

**Step 2: Creazione Annotazione PDF.js**
```javascript
function createHighlightAnnotation(pdfCoordinates, category) {
  // PDF.js annotation format (standard PDF spec)
  const annotation = {
    annotationType: pdfjsLib.AnnotationType.HIGHLIGHT,
    rect: pdfCoordinates.rect, // [x1, y1, x2, y2]
    quadPoints: pdfCoordinates.quadPoints, // precise highlight bounds
    color: categoryColors[category].rgbColor,
    opacity: 0.4,
    contents: "", // commento verrà aggiunto dopo
    id: generateUUID()
  };
  
  // Aggiungi a annotation layer
  pageView.annotationLayer.appendAnnotation(annotation);
  
  return annotation;
}
```

#### 4.3.2 Gestione Zoom e Resize

**CRUCIALE**: PDF.js gestisce automaticamente trasformazioni

```javascript
// PDF.js viewport gestisce zoom/resize
pageView.viewport = page.getViewport({ scale: zoomLevel });

// Annotation layer si aggiorna automaticamente
pageView.annotationLayer.render({
  viewport: pageView.viewport,
  annotations: pageAnnotations
});

// LE COORDINATE RIMANGONO IN PDF COORDINATE SPACE
// Non serve ricalcolare posizioni manualmente!
```

**Coordinate Spaces in PDF.js:**
- **PDF Space**: Coordinate native del documento (invarianti)
- **Viewport Space**: Coordinate visualizzazione (cambiano con zoom)
- **Conversione**: PDF.js fornisce `viewport.convertToViewportPoint()` e `viewport.convertToPdfPoint()`

#### 4.3.3 Sincronizzazione Click

**Dal PDF al Pannello:**
```javascript
annotationLayer.on('annotationclick', (event) => {
  const annotationId = event.detail.id;
  
  // Trova card nel pannello destro
  scrollToAnnotationCard(annotationId);
  highlightAnnotationCard(annotationId);
});
```

**Dal Pannello al PDF:**
```javascript
function onAnnotationCardClick(annotation) {
  const pageNumber = annotation.pageNumber;
  
  // PDF.js navigation
  pdfViewer.currentPageNumber = pageNumber;
  
  // Scroll alla posizione (PDF.js gestisce viewport)
  pdfViewer.scrollPageIntoView({
    pageNumber: pageNumber,
    destArray: [null, { name: 'XYZ' }, ...annotation.rect]
  });
  
  // Highlight temporaneo dell'annotazione
  highlightAnnotationTemporarily(annotation.id);
}
```

### 4.4 Persistenza Annotazioni

**Strategia Hybrid:**
- **In-memory**: PDF.js annotation objects per rendering veloce
- **Persistent storage**: JSON/SQLite per annotazioni + metadati

```javascript
// Al caricamento PDF
async function loadPDFWithAnnotations(pdfPath, pdfId) {
  // 1. Carica PDF con PDF.js
  const loadingTask = pdfjsLib.getDocument(pdfPath);
  const pdfDocument = await loadingTask.promise;
  
  // 2. Carica annotazioni dal database
  const savedAnnotations = await database.getAnnotations(pdfId);
  
  // 3. Inietta annotazioni in PDF.js
  for (const page of pdfDocument.pages) {
    const pageAnnotations = savedAnnotations.filter(
      ann => ann.pageNumber === page.pageNumber
    );
    
    // PDF.js gestisce rendering
    page._annotations = [...page._annotations, ...pageAnnotations];
  }
  
  return pdfDocument;
}

// Al salvataggio annotazione
async function saveAnnotation(annotation) {
  // 1. Salva in database
  await database.insertAnnotation({
    id: annotation.id,
    pdfId: currentPdfId,
    pageNumber: annotation.pageNumber,
    category: annotation.category,
    text: annotation.text,
    pdfJsAnnotation: annotation.pdfJsData // coordinate + metadata
  });
  
  // 2. Già renderizzato da PDF.js, nessun aggiornamento UI necessario
}
```

---

## 5. Funzionalità Dettagliate

### 5.1 Gestione PDF

#### 5.1.1 Caricamento PDF
- **Metodo 1**: Drag & drop su home page
- **Metodo 2**: Click bottone "Aggiungi" → file picker
- **Validazione**: Verifica che file sia PDF valido
- **Metadati**: Estrazione automatica (pagine, dimensione, data)
- **Storage**: Salva solo path assoluto, non duplica file

#### 5.1.2 Rimozione PDF dalla Lista
- Pulsante "Elimina" su card
- Conferma prima della rimozione
- **Elimina solo metadati e annotazioni**, NON il file originale
- Opzione: "Elimina anche annotazioni" (checkbox nel dialog)

### 5.2 Sistema di Annotazione

#### 5.2.1 Creazione Annotazione

**Workflow:**
1. Utente attiva modalità highlight (toggle button)
2. Seleziona testo nel PDF
3. Popup appare con dropdown categoria
4. Utente seleziona categoria e clicca "Aggiungi"
5. Modal si apre per inserire commento dettagliato
6. Conferma → highlight appare nel PDF + card nel pannello

**UI Modal Commento:**
```
┌────────────────────────────────────┐
│  Aggiungi Commento                 │
├────────────────────────────────────┤
│  Categoria: [🔴 Critical       ▼]  │
│                                    │
│  Testo Selezionato:                │
│  "metodologia di analisi..."       │
│                                    │
│  Commento:                         │
│  ┌────────────────────────────┐   │
│  │                            │   │
│  │ [Textarea per commento]    │   │
│  │                            │   │
│  └────────────────────────────┘   │
│                                    │
│       [Annulla]  [Salva]           │
└────────────────────────────────────┘
```

#### 5.2.2 Modifica Categoria

- Dropdown nel pannello annotazioni
- Al cambio: aggiorna colore highlight nel PDF (PDF.js re-render)
- Aggiorna database

#### 5.2.3 Eliminazione Annotazione

**Metodo 1: Dal Pannello**
- Click pulsante "Elimina" su card
- Conferma (opzionale)
- Rimuove highlight dal PDF + card dal pannello

**Metodo 2: Dal PDF**
- Right-click su highlight → menu contestuale "Elimina"
- Conferma (opzionale)
- Rimuove highlight + card corrispondente

### 5.4 Pannelli Ridimensionabili e Collassabili

#### 5.4.1 Divider Ridimensionabile

**Implementazione Vanilla JS:**

```javascript
class ResizablePanels {
  constructor(pdfPanel, divider, annotationPanel) {
    this.pdfPanel = pdfPanel;
    this.divider = divider;
    this.annotationPanel = annotationPanel;
    this.isDragging = false;
    this.previousLayout = { pdfWidth: 50, annotationWidth: 50 };
    
    this.initDragHandlers();
  }
  
  initDragHandlers() {
    this.divider.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      const containerWidth = this.pdfPanel.parentElement.clientWidth;
      const pdfWidth = (e.clientX / containerWidth) * 100;
      
      // Limiti: 30% - 70%
      if (pdfWidth >= 30 && pdfWidth <= 70) {
        this.setPanelWidths(pdfWidth, 100 - pdfWidth);
      }
    });
    
    document.addEventListener('mouseup', () => {
      this.isDragging = false;
      document.body.style.cursor = 'default';
    });
  }
  
  setPanelWidths(pdfPercent, annotationPercent) {
    this.pdfPanel.style.width = `${pdfPercent}%`;
    this.annotationPanel.style.width = `${annotationPercent}%`;
    
    // Salva layout per restore dopo collapse
    this.previousLayout = {
      pdfWidth: pdfPercent,
      annotationWidth: annotationPercent
    };
    
    // Notify PDF.js di resize per re-render
    window.dispatchEvent(new Event('resize'));
  }
  
  collapsePDF() {
    this.pdfPanel.classList.add('collapsed');
    this.divider.style.display = 'none';
    this.annotationPanel.style.width = '100%';
  }
  
  collapseAnnotations() {
    this.annotationPanel.classList.add('collapsed');
    this.divider.style.display = 'none';
    this.pdfPanel.style.width = '100%';
    
    // Notify PDF.js per ri-layout a full width
    window.dispatchEvent(new Event('resize'));
  }
  
  restoreLayout() {
    this.pdfPanel.classList.remove('collapsed');
    this.annotationPanel.classList.remove('collapsed');
    this.divider.style.display = 'block';
    
    this.setPanelWidths(
      this.previousLayout.pdfWidth,
      this.previousLayout.annotationWidth
    );
  }
}

// Inizializzazione
const panels = new ResizablePanels(
  document.getElementById('pdf-panel'),
  document.getElementById('divider'),
  document.getElementById('annotation-panel')
);

// Collapse buttons
document.getElementById('collapse-pdf-btn').addEventListener('click', () => {
  if (pdfPanel.classList.contains('collapsed')) {
    panels.restoreLayout();
  } else {
    panels.collapsePDF();
  }
});

document.getElementById('collapse-annotation-btn').addEventListener('click', () => {
  if (annotationPanel.classList.contains('collapsed')) {
    panels.restoreLayout();
  } else {
    panels.collapseAnnotations();
  }
});
```

#### 5.4.2 HTML Structure

```html
<div class="review-container">
  <header class="app-header">
    <button id="back-btn">←</button>
    <span class="pdf-title">article_nature_2024.pdf</span>
    <button id="export-btn">Esporta</button>
  </header>
  
  <div class="review-layout">
    <!-- PDF Panel -->
    <div id="pdf-panel" class="pdf-panel">
      <div class="panel-header">
        <button id="collapse-pdf-btn" class="collapse-btn" title="Nascondi PDF">◀</button>
        <div class="toolbar">
          <!-- Zoom, highlight mode, etc -->
        </div>
      </div>
      <div id="viewer-container" class="pdf-viewer-container">
        <!-- PDF.js viewer -->
      </div>
    </div>
    
    <!-- Divider -->
    <div id="divider" class="divider"></div>
    
    <!-- Annotation Panel -->
    <div id="annotation-panel" class="annotation-panel">
      <div class="panel-header">
        <button id="collapse-annotation-btn" class="collapse-btn" title="Nascondi Annotazioni">▶</button>
        <div class="filters">
          <!-- Category filters -->
        </div>
      </div>
      <div class="annotations-list">
        <!-- Annotation cards -->
      </div>
    </div>
  </div>
</div>
```

#### 5.4.3 CSS per Layout Ridimensionabile

```css
.review-layout {
  display: flex;
  height: calc(100vh - 60px); /* minus header */
  position: relative;
}

.pdf-panel,
.annotation-panel {
  overflow: auto;
  transition: width 0.3s ease;
}

.pdf-panel {
  width: 50%; /* default */
  border-right: 1px solid #ddd;
}

.annotation-panel {
  width: 50%; /* default */
}

.divider {
  width: 4px;
  background: #e0e0e0;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.2s;
}

.divider:hover {
  background: #2196F3;
}

.divider:active {
  background: #1976D2;
}

.collapsed {
  display: none;
}

.collapse-btn {
  padding: 4px 8px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.collapse-btn:hover {
  background: #e0e0e0;
}
```

#### 5.3.1 Filtri Categoria
- Chips/badges per ogni categoria + "All"
- Click chip: toggle filtro on/off
- Multi-selezione: mostra annotazioni di tutte le categorie selezionate
- Count badge aggiornato in real-time

#### 5.3.2 Ordinamento
- Dropdown: "Per Pagina" (default) | "Per Data" | "Per Categoria"
- Ordinamento real-time

---

## 6. Storage e Database

### 6.0 SQLite vs JSON: Perché SQLite

**SQLite è la scelta ottimale per questo progetto:**

| Criterio | SQLite | JSON Files |
|----------|--------|------------|
| **Query performance** | ✅ Indici, query complesse veloci | ❌ Lettura intero file, filter in-memory |
| **Filtering** | ✅ WHERE clauses native | ❌ Array.filter() lento su grandi dataset |
| **Sorting** | ✅ ORDER BY ottimizzato | ❌ Sort in-memory |
| **Pagination** | ✅ LIMIT/OFFSET | ❌ Slice dopo load completo |
| **Transazioni** | ✅ ACID compliance | ❌ Rischio corruzione |
| **Concurrent writes** | ✅ Lock management | ❌ Race conditions |
| **Size @ 1000 PDFs** | ~5-10 MB | ~8-15 MB (indentato) |
| **Backup** | ✅ Singolo file | ❌ Multipli file da sincronizzare |

**Esempio pratico:**

```javascript
// SQLite - Query annotazioni per categoria (veloce anche con 10k+ annotations)
const annotations = db.prepare(`
  SELECT * FROM annotations 
  WHERE pdf_id = ? AND category IN ('critical', 'major')
  ORDER BY page_number
`).all(pdfId);
// Execution: <1ms con indici

// JSON - Stesso risultato (lento con dataset grandi)
const allData = JSON.parse(fs.readFileSync('annotations.json'));
const annotations = allData
  .filter(a => a.pdfId === pdfId && ['critical', 'major'].includes(a.category))
  .sort((a, b) => a.pageNumber - b.pageNumber);
// Execution: 10-50ms su file grandi, intero file in memoria
```

**Conclusione**: SQLite vince su performance, scalabilità e integrità dati.

### 6.1 Struttura Database (SQLite)

```sql
-- Tabella PDF
CREATE TABLE pdfs (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_size INTEGER,
    page_count INTEGER,
    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Annotazioni
CREATE TABLE annotations (
    id TEXT PRIMARY KEY,
    pdf_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    category TEXT NOT NULL,
    comment_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- PDF.js annotation data (JSON)
    rect TEXT, -- [x1, y1, x2, y2]
    quad_points TEXT, -- [[x1,y1,x2,y2,x3,y3,x4,y4], ...]
    selected_text TEXT,
    
    FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
);

-- Tabella Categorie
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL,
    rgb_color TEXT NOT NULL, -- JSON [r,g,b]
    priority INTEGER
);

-- Indici
CREATE INDEX idx_annotations_pdf ON annotations(pdf_id);
CREATE INDEX idx_annotations_page ON annotations(pdf_id, page_number);
CREATE INDEX idx_annotations_category ON annotations(category);
```

### 6.2 File System Organization

```
~/.pdf-reviewer/
├── database.sqlite         # Database principale
├── config.json            # Configurazioni app
├── categories.json        # Definizioni categorie
└── logs/
    └── app.log
```

### 6.3 Backup e Export

- **Backup automatico**: Database SQLite copiato periodicamente
- **Export annotazioni**: 
  - JSON (per re-import)
  - CSV (per analisi esterna)
  - PDF annotato (con highlight embedding nel PDF)

---

## 7. Performance e Ottimizzazioni

### 7.1 PDF.js Optimizations

```javascript
// Lazy loading delle pagine con scroll continuo verticale
const pdfViewer = new pdfjsViewer.PDFViewer({
  container: viewerContainer,
  viewer: viewerElement,
  
  // SCROLL CONTINUO VERTICALE
  scrollMode: pdfjsViewer.ScrollMode.VERTICAL, // Tutte pagine in colonna
  spreadMode: pdfjsViewer.SpreadMode.NONE,
  
  // Ottimizzazioni
  textLayerMode: 2, // ENABLE text layer
  annotationMode: 2, // ENABLE annotations
  enableScripting: false, // Disabilita JS nel PDF
  removePageBorders: false,
  
  // Performance
  renderInteractiveForms: false,
  maxCanvasPixels: 16777216, // 4096x4096 max
  useOnlyCssZoom: false // usa canvas scaling per qualità
});

// Virtual scrolling automatico di PDF.js
// Con scroll continuo: rende solo pagine visibili + buffer (3-5 pagine)
// PDF 100+ pagine = memory footprint costante

// Tracking pagina corrente durante scroll
pdfViewer.on('pagechanging', (event) => {
  updatePageIndicator(event.pageNumber);
});
```

### 7.2 Annotation Layer Caching

- PDF.js cache automatica delle annotazioni renderizzate
- Ri-render solo quando necessario (zoom, cambio categoria)
- Debouncing su zoom slider

### 7.3 Database Queries

```javascript
// Index usage per query veloci
// Esempio: Get annotazioni per PDF e pagina
const query = `
  SELECT * FROM annotations 
  WHERE pdf_id = ? AND page_number = ?
  ORDER BY created_at DESC
`;
// → usa idx_annotations_page (veloce)

// Prepared statements per sicurezza + performance
```

---

## 8. User Experience (UX)

### 8.1 Feedback Visivo

- **Loading states**: Spinner durante caricamento PDF
- **Hover effects**: Su highlights, cards annotazioni
- **Transizioni**: Smooth scroll tra pagine e annotazioni
- **Toast notifications**: Conferma azioni (salvataggio, eliminazione)

### 8.2 Keyboard Shortcuts

```
Ctrl/Cmd + O     → Apri PDF
Ctrl/Cmd + F     → Ricerca nel PDF (PDF.js built-in)
Ctrl/Cmd + +/-   → Zoom in/out
Ctrl/Cmd + 0     → Reset zoom (100%)
H                → Toggle highlight mode
Esc              → Deselect/close modal
Ctrl/Cmd + Del   → Elimina annotazione selezionata
Ctrl/Cmd + [     → Collapse PDF panel
Ctrl/Cmd + ]     → Collapse annotation panel
Ctrl/Cmd + \     → Restore both panels
```

### 8.3 Accessibilità

- **Keyboard navigation**: Tab index corretto
- **ARIA labels**: Screen reader support
- **Color contrast**: WCAG AA compliance
- **Focus indicators**: Visibili su tutti elementi interattivi

---

## 9. Tecnologie e Librerie Consigliate

### 9.1 Core Dependencies

```json
{
  "dependencies": {
    "electron": "^28.x",
    "pdfjs-dist": "^3.11.x",
    "better-sqlite3": "^9.x",
    "uuid": "^9.x"
  },
  "devDependencies": {
    "electron-builder": "^24.x",
    "typescript": "^5.x"
  }
}
```

### 9.2 UI Framework - Soluzione Leggera

**RACCOMANDAZIONE: Vanilla JavaScript + Web Components**

Per mantenere l'applicazione leggera e performante, si consiglia di evitare framework pesanti come React/Vue.

**Stack UI Leggero:**

```json
{
  "dependencies": {
    "electron": "^28.x",
    "pdfjs-dist": "^3.11.x",
    "better-sqlite3": "^9.x",
    "uuid": "^9.x"
  },
  "devDependencies": {
    "electron-builder": "^24.x"
  }
}
```

**Approccio Vanilla JS:**
- **Nessun framework**: HTML/CSS/JavaScript nativo
- **Web Components**: Per componenti riusabili (annotation card, filter chips)
- **CSS moderno**: CSS Grid, Flexbox, CSS Variables per theming
- **Event delegation**: Per gestione efficiente eventi

**Vantaggi:**
- Bundle size minimo (~500KB vs 2MB+ con React)
- Startup time più veloce
- Zero overhead di Virtual DOM
- Maggior controllo su performance
- Integrazione diretta con PDF.js (stessa filosofia vanilla)

**Struttura HTML Componenti:**
```javascript
// Esempio: Custom Element per Annotation Card
class AnnotationCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  
  connectedCallback() {
    this.render();
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; margin: 8px 0; }
        .card { border: 1px solid #ddd; padding: 12px; border-radius: 4px; }
        /* ... */
      </style>
      <div class="card">
        <div class="category-badge"></div>
        <div class="content"></div>
        <button class="delete-btn">Elimina</button>
      </div>
    `;
  }
}

customElements.define('annotation-card', AnnotationCard);
```

**Alternative solo se necessario:**
- **Lit**: Libreria ultra-leggera per Web Components (~5KB)
- **Alpine.js**: Framework minimale per interattività (~15KB)

**Evitare:**
- ❌ React (~140KB minified + ReactDOM)
- ❌ Vue.js (~90KB minified)
- ❌ Angular (>500KB)

### 9.3 Styling - CSS Nativo

**CSS Moderno Senza Framework:**

```css
/* CSS Variables per theming */
:root {
  --primary-color: #2196F3;
  --critical-color: #FF5252;
  --major-color: #FFA726;
  --minor-color: #FFEB3B;
  --suggestion-color: #66BB6A;
  --question-color: #42A5F5;
  
  --sidebar-width: 30%;
  --divider-width: 4px;
  
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
}

/* Layout con CSS Grid */
.review-layout {
  display: grid;
  grid-template-columns: 1fr var(--divider-width) 1fr;
  height: 100vh;
}

.pdf-panel { grid-column: 1; }
.divider { grid-column: 2; cursor: col-resize; }
.annotation-panel { grid-column: 3; }

/* Responsive utilities */
.collapsed { display: none; }
.full-width { grid-column: 1 / -1; }
```

**Librerie CSS opzionali (leggere):**
- **Normalize.css** (~2KB): Cross-browser consistency
- **Open Props** (opzionale): CSS Variables pre-configurate

**NO framework CSS pesanti:**
- ❌ Tailwind CSS (~3MB in dev, richiede build step)
- ❌ Bootstrap (~200KB)
- ❌ Material UI (~300KB)

**Alternativa ultra-leggera:**
```json
{
  "dependencies": {
    "normalize.css": "^8.x"  // Solo 2KB
  }
}
```

---

## 10. Implementazione: Roadmap

### Phase 1: MVP (2-3 settimane)
- [ ] Setup Electron + PDF.js
- [ ] Home page con lista PDF
- [ ] Caricamento PDF e visualizzazione base
- [ ] Creazione highlight e annotazioni
- [ ] Pannello annotazioni con lista
- [ ] Database SQLite setup

### Phase 2: Core Features (2 settimane)
- [ ] Sistema categorie con colori
- [ ] Sincronizzazione click PDF ↔ Pannello
- [ ] Filtri categoria
- [ ] Eliminazione annotazioni
- [ ] Toolbar zoom e navigazione

### Phase 3: Polish (1-2 settimane)
- [ ] Ricerca PDF in home page
- [ ] Paginazione home page
- [ ] Keyboard shortcuts
- [ ] Export annotazioni
- [ ] Ottimizzazioni performance
- [ ] UI/UX refinement

### Phase 4: Advanced (opzionale)
- [ ] PDF annotato export (embedd highlights)
- [ ] Backup automatico
- [ ] Multi-utente (sincronizzazione cloud)
- [ ] Template commenti frequenti
- [ ] Statistiche annotazioni

---

## 11. Considerazioni Tecniche Critiche

### 11.1 Gestione Coordinate - FONDAMENTALE

**NON GESTIRE COORDINATE MANUALMENTE**

```javascript
// ❌ SBAGLIATO - Calcolo manuale
const x = mouseEvent.clientX - containerOffset.left;
const y = mouseEvent.clientY - containerOffset.top;
const pdfX = x / zoomLevel;
const pdfY = y / zoomLevel;

// ✅ CORRETTO - Usa PDF.js APIs
const pageView = pdfViewer.getPageView(pageNumber - 1);
const viewport = pageView.viewport;

// PDF.js converte automaticamente
const pdfPoint = viewport.convertToPdfPoint(x, y);
```

**Perché?**
- PDF.js gestisce rotazione, zoom, offset automaticamente
- Viewport transforms sono complessi (matrice 6 parametri)
- Manual calculation = bugs con zoom/resize

### 11.2 Text Selection → Highlight

**Usa PDF.js Text Layer**

```javascript
// PDF.js text layer fornisce già mapping testo → coordinate
const textContent = await page.getTextContent();

// Ogni character ha:
// - str: il carattere
// - transform: matrice trasformazione
// - width, height: dimensioni
// - fontName: font utilizzato

// Selection API usa questi dati per calcolare quadPoints
const selection = window.getSelection();
const range = selection.getRangeAt(0);

// Converti range in PDF coordinates usando text layer
const highlightQuads = extractQuadPointsFromRange(
  range, 
  textLayer, 
  viewport
);
```

### 11.3 Persistenza Senza Modifica PDF Originale

**Approccio:**
- PDF originale NON viene mai modificato
- Annotazioni salvate in database esterno
- Al caricamento: PDF.js rendering + overlay annotazioni
- Export: genera nuovo PDF con annotazioni embedded (opzionale)

### 11.4 Multi-Page Performance

```javascript
// PDF.js virtual scrolling automatico
// Rende solo pagine visibili + 1-2 buffer pages

// Per 100+ pagine PDF:
// - Solo 3-5 pagine renderizzate in DOM contemporaneamente
// - Annotazioni caricate on-demand per pagina visibile
// - Memory footprint costante

// Implementazione:
pdfViewer.on('pagesinit', () => {
  // Setup completo
});

pdfViewer.on('pagerendered', (event) => {
  const pageNumber = event.pageNumber;
  // Inietta annotazioni per questa pagina
  loadAnnotationsForPage(pageNumber);
});
```

---

## 12. Security e Privacy

### 12.1 File Access
- Solo lettura PDF (mai scrittura sul file originale)
- Permessi file system controllati da Electron
- No upload file a server esterni

### 12.2 Database
- SQLite locale (no cloud sync di default)
- Path PDF salvati come assoluti (attenzione a portabilità)
- Possibile cifratura database (opzionale: SQLCipher)

---

## 13. Testing

### 13.1 Unit Tests
- Database operations (CRUD annotazioni)
- Coordinate conversions (se implementate)
- Categoria color mapping

### 13.2 Integration Tests
- PDF loading + annotation injection
- Click synchronization PDF ↔ Panel
- Filter + sorting correctness

### 13.3 E2E Tests (Spectron/Playwright)
- Workflow completo: load PDF → annotate → filter → delete
- Multi-page navigation
- Zoom persistence

---

## 14. Deployment

### 14.1 Build Platforms

```json
{
  "build": {
    "appId": "com.yourcompany.pdfreview",
    "productName": "PDF Peer Reviewer",
    "directories": {
      "output": "dist"
    },
    "mac": {
      "target": ["dmg", "zip"],
      "category": "public.app-category.productivity"
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.ico"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Office"
    }
  }
}
```

### 14.2 Auto-Update (opzionale)
- Electron-updater per aggiornamenti automatici
- Server per distribuire nuove versioni

---

## 15. Documentazione Utente

### 15.1 In-App Help
- Tooltip su strumenti
- Tour guidato al primo avvio (optional)
- Sezione Help con FAQ

### 15.2 User Manual
- Quick start guide
- Video tutorial (opzionale)
- Keyboard shortcuts reference

---

## Conclusione

Questa specifica fornisce una roadmap completa per sviluppare un applicativo di peer-review PDF professionale, sfruttando al massimo PDF.js per evitare implementazioni manuali complesse e error-prone. 

**Key Takeaways:**
✅ Usa PDF.js Annotation Layer API (nativo, performante)
✅ Scroll verticale continuo con lazy loading automatico
✅ Pannelli ridimensionabili (30%-70%) e collassabili per flessibilità
✅ NON gestire coordinate/zoom manualmente - delega a PDF.js
✅ Vanilla JavaScript + Web Components per stack ultra-leggero
✅ SQLite per performance query e scalabilità
✅ UI reattiva con sincronizzazione bidirezionale PDF ↔ Annotazioni
✅ Categorie colorate per workflow organizzato

**Vantaggi Architetturali:**
- **Leggero**: ~500KB bundle (no framework pesanti)
- **Performante**: Virtual scrolling + query ottimizzate
- **Flessibile**: Layout adattabile alle preferenze utente
- **Manutenibile**: Vanilla JS + PDF.js (tecnologie stabili)
- **Scalabile**: Gestisce PDF 100+ pagine senza problemi


Per domande o chiarimenti su implementazione specifica, consultare:
- PDF.js Documentation: https://mozilla.github.io/pdf.js/
- PDF.js Examples (continuous scroll): https://mozilla.github.io/pdf.js/examples/
- Electron Documentation: https://www.electronjs.org/docs
- Better SQLite3: https://github.com/WiseLibs/better-sqlite3