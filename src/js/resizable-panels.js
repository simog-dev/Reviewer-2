// Minimum panel width as a fraction of container width
const MIN_WIDTH_RATIO = 0.20;

export class ResizablePanels {
  constructor(options = {}) {
    this.pdfPanel = options.pdfPanel;
    this.annotationPanel = options.annotationPanel;
    this.searchPanel = options.searchPanel;
    this.resizer1 = options.resizer1;
    this.resizer2 = options.resizer2;
    this.container = options.container;

    this.isDragging = false;
    this.activeDragging = null; // 'resizer1' or 'resizer2'
    this.startX = 0;
    this.startLeftWidth = 0;
    this.startRightWidth = 0;
    this.startSearchWidthAtR1 = 0;
    this.startPdfWidthAtR2 = 0;

    this.pdfCollapsed = false;
    this.annotationCollapsed = false;
    this.searchCollapsed = false;
    this.lastPdfWidth = null;
    this.lastAnnotationWidth = null;
    this.lastSearchWidth = null;

    this.onResize = options.onResize || (() => {});

    this.init();
  }

  init() {
    this.loadSavedLayout();
    this.setupResizers();
    this.setupCollapseButtons();
  }

  loadSavedLayout() {
    window.api.getSetting('panelLayout').then(layout => {
      if (layout) {
        if (layout.pdfWidthPercent) {
          this.setPdfWidthPercent(layout.pdfWidthPercent);
        }
        if (layout.searchWidth) {
          this.searchPanel.style.width = `${layout.searchWidth}px`;
          this.searchPanel.style.flex = 'none';
        }
        if (layout.pdfCollapsed) {
          this.collapsePdf();
        }
        if (layout.annotationCollapsed) {
          this.collapseAnnotations();
        }
        if (layout.searchCollapsed) {
          this.collapseSearch();
        }
      }
    }).catch(() => {});
  }

  saveLayout() {
    const containerWidth = this.container.clientWidth;
    const pdfWidth = this.pdfPanel.clientWidth;
    const pdfWidthPercent = (pdfWidth / containerWidth) * 100;
    const searchWidth = this.searchPanel.clientWidth;

    window.api.setSetting('panelLayout', {
      pdfWidthPercent,
      searchWidth,
      pdfCollapsed: this.pdfCollapsed,
      annotationCollapsed: this.annotationCollapsed,
      searchCollapsed: this.searchCollapsed
    }).catch(() => {});
  }

  // After any collapse/expand, assign flex correctly based on which panels are open.
  _distributeSpace() {
    const openCount = (this.pdfCollapsed ? 0 : 1) + (this.annotationCollapsed ? 0 : 1) + (this.searchCollapsed ? 0 : 1);

    if (openCount === 1) {
      // Single open panel fills everything
      if (!this.pdfCollapsed) {
        this.pdfPanel.style.flex = '1';
        this.pdfPanel.style.width = '';
      } else if (!this.annotationCollapsed) {
        this.annotationPanel.style.flex = '1';
      } else if (!this.searchCollapsed) {
        this.searchPanel.style.flex = '1';
        this.searchPanel.style.width = '';
      }
    } else if (openCount === 2) {
      if (this.pdfCollapsed) {
        // Annotation + Search open: annotation fills
        this.annotationPanel.style.flex = '1';
        this.searchPanel.style.flex = 'none';
      } else if (this.annotationCollapsed) {
        // PDF + Search open: PDF fills
        this.pdfPanel.style.flex = '1';
        this.pdfPanel.style.width = '';
        this.searchPanel.style.flex = 'none';
      } else if (this.searchCollapsed) {
        // PDF + Annotation open: annotation fills
        this.pdfPanel.style.flex = 'none';
        this.annotationPanel.style.flex = '1';
      }
    } else {
      // All three open: PDF fixed, annotation fills, search fixed
      this.pdfPanel.style.flex = 'none';
      this.annotationPanel.style.flex = '1';
      this.searchPanel.style.flex = 'none';
    }

    // resizer1 separates PDF and Annotation: visible only if both are open.
    // resizer2 separates Annotation and Search: visible if Search is open and
    // there is at least one open panel to its left to resize against.
    this.resizer1.style.display = (!this.pdfCollapsed && !this.annotationCollapsed) ? '' : 'none';
    this.resizer2.style.display = (!this.searchCollapsed && (!this.pdfCollapsed || !this.annotationCollapsed)) ? '' : 'none';
  }

  _resizersTotalWidth() {
    return this.resizer1.clientWidth + this.resizer2.clientWidth;
  }

  setupResizers() {
    const startDrag = (e, resizerEl, activeName) => {
      e.preventDefault();
      this.isDragging = true;
      this.activeDragging = activeName;
      this.startX = e.clientX;
      this.startLeftWidth = this.pdfPanel.clientWidth;
      this.startRightWidth = this.searchPanel.clientWidth;
      this.startSearchWidthAtR1 = this.searchPanel.clientWidth;
      this.startPdfWidthAtR2 = this.pdfPanel.clientWidth;
      resizerEl.classList.add('dragging');
      // Capture pointer so mousemove/mouseup always reach this element,
      // even if the cursor enters a webview (which swallows events).
      resizerEl.setPointerCapture(e.pointerId);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };

    const onMove = (e) => {
      if (!this.isDragging) return;

      const containerWidth = this.container.clientWidth;
      const delta = e.clientX - this.startX;
      const resizersWidth = this._resizersTotalWidth();
      const usable = containerWidth - resizersWidth;
      const minWidth = Math.round(containerWidth * MIN_WIDTH_RATIO);

      if (this.annotationCollapsed) {
        // Annotation is collapsed (40px); PDF and Search share remaining space
        const annotFixed = 40;
        const available = usable - annotFixed;

        if (this.activeDragging === 'resizer1') {
          let newPdfWidth = this.startLeftWidth + delta;
          newPdfWidth = Math.max(minWidth, Math.min(available - minWidth, newPdfWidth));
          this.pdfPanel.style.flex = 'none';
          this.pdfPanel.style.width = `${newPdfWidth}px`;
          this.annotationPanel.style.flex = 'none';
          this.annotationPanel.style.width = '40px';
          this.searchPanel.style.flex = '1';
        } else {
          let newSearchWidth = this.startRightWidth - delta;
          newSearchWidth = Math.max(minWidth, Math.min(available - minWidth, newSearchWidth));
          this.searchPanel.style.flex = 'none';
          this.searchPanel.style.width = `${newSearchWidth}px`;
          this.annotationPanel.style.flex = 'none';
          this.annotationPanel.style.width = '40px';
          this.pdfPanel.style.flex = '1';
        }
      } else if (this.activeDragging === 'resizer1') {
        // Resizer1: PDF grows/shrinks. Annotation absorbs first; if annotation
        // hits min, search also shrinks (only if search is open).
        const searchMin = this.searchCollapsed ? 40 : minWidth;
        let newPdfWidth = this.startLeftWidth + delta;
        const maxPdf = usable - minWidth - searchMin;
        newPdfWidth = Math.max(minWidth, Math.min(maxPdf, newPdfWidth));

        const remaining = usable - newPdfWidth;
        let searchWidth = this.searchCollapsed ? 40 : this.startSearchWidthAtR1;
        let annotationWidth = remaining - searchWidth;
        if (annotationWidth < minWidth) {
          annotationWidth = minWidth;
          searchWidth = remaining - minWidth;
        }

        this.pdfPanel.style.flex = 'none';
        this.pdfPanel.style.width = `${newPdfWidth}px`;
        this.searchPanel.style.flex = 'none';
        this.searchPanel.style.width = `${searchWidth}px`;
        this.annotationPanel.style.flex = '1';
      } else {
        // Resizer2: Search grows/shrinks. Annotation absorbs first; if annotation
        // hits min, PDF also shrinks (only if PDF is open).
        const pdfMin = this.pdfCollapsed ? 40 : minWidth;
        let newSearchWidth = this.startRightWidth - delta;
        const maxSearch = usable - minWidth - pdfMin;
        newSearchWidth = Math.max(minWidth, Math.min(maxSearch, newSearchWidth));

        const remaining = usable - newSearchWidth;
        let pdfWidth = this.pdfCollapsed ? 40 : this.startPdfWidthAtR2;
        let annotationWidth = remaining - pdfWidth;
        if (annotationWidth < minWidth) {
          annotationWidth = minWidth;
          pdfWidth = remaining - minWidth;
        }

        this.searchPanel.style.flex = 'none';
        this.searchPanel.style.width = `${newSearchWidth}px`;
        this.pdfPanel.style.flex = 'none';
        this.pdfPanel.style.width = `${pdfWidth}px`;
        this.annotationPanel.style.flex = '1';
      }

      this.onResize();
    };

    const endDrag = () => {
      if (this.isDragging) {
        this.isDragging = false;
        if (this.activeDragging === 'resizer1') {
          this.resizer1.classList.remove('dragging');
        } else if (this.activeDragging === 'resizer2') {
          this.resizer2.classList.remove('dragging');
        }
        this.activeDragging = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        this.saveLayout();
      }
    };

    // Use pointer events on the resizers so capture works across webview boundaries
    this.resizer1.addEventListener('pointerdown', (e) => startDrag(e, this.resizer1, 'resizer1'));
    this.resizer2.addEventListener('pointerdown', (e) => startDrag(e, this.resizer2, 'resizer2'));
    this.resizer1.addEventListener('pointermove', onMove);
    this.resizer2.addEventListener('pointermove', onMove);
    this.resizer1.addEventListener('pointerup', endDrag);
    this.resizer2.addEventListener('pointerup', endDrag);

    // Fallback: document-level mouseup in case pointer events miss
    document.addEventListener('mouseup', endDrag);
  }

  setupCollapseButtons() {
    const collapsePdfBtn = document.getElementById('collapse-pdf');
    const collapseAnnotationsBtn = document.getElementById('collapse-annotations');
    const collapseSearchBtn = document.getElementById('collapse-search');

    if (collapsePdfBtn) {
      collapsePdfBtn.addEventListener('click', () => this.togglePdf());
    }

    if (collapseAnnotationsBtn) {
      collapseAnnotationsBtn.addEventListener('click', () => this.toggleAnnotations());
    }

    if (collapseSearchBtn) {
      collapseSearchBtn.addEventListener('click', () => this.toggleSearch());
    }
  }

  setPdfWidthPercent(percent) {
    const containerWidth = this.container.clientWidth;
    const newWidth = (percent / 100) * containerWidth;
    this.pdfPanel.style.flex = 'none';
    this.pdfPanel.style.width = `${newWidth}px`;
    this.annotationPanel.style.flex = '1';
  }

  _collapsedCount() {
    return (this.pdfCollapsed ? 1 : 0) + (this.annotationCollapsed ? 1 : 0) + (this.searchCollapsed ? 1 : 0);
  }

  _minWidth() {
    return Math.round(this.container.clientWidth * MIN_WIDTH_RATIO);
  }

  // Chevron SVGs — all buttons are at top-right, so:
  //   left chevron = collapse (shrink this panel)
  //   right chevron = expand (grow this panel)
  _collapseChevron() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6"/>
    </svg>`;
  }

  _expandChevron() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>`;
  }

  collapsePdf() {
    if (this._collapsedCount() >= 2) return;

    this.lastPdfWidth = this.pdfPanel.clientWidth;
    this.pdfPanel.classList.add('collapsed');
    this.pdfPanel.style.flex = 'none';
    this.pdfPanel.style.width = '40px';
    this.pdfCollapsed = true;

    this._distributeSpace();

    const btn = document.getElementById('collapse-pdf');
    if (btn) {
      btn.innerHTML = this._expandChevron();
      btn.title = 'Expand PDF Panel';
    }

    this.saveLayout();
    this.onResize();
  }

  expandPdf() {
    this.pdfPanel.classList.remove('collapsed');
    this.pdfCollapsed = false;

    // Snapshot sibling widths so they have explicit inline widths when
    // _distributeSpace switches them to flex: none.
    this.annotationPanel.style.flex = 'none';
    this.annotationPanel.style.width = `${this.annotationPanel.clientWidth}px`;
    this.searchPanel.style.flex = 'none';
    this.searchPanel.style.width = `${this.searchPanel.clientWidth}px`;

    this.pdfPanel.style.flex = 'none';
    this.pdfPanel.style.width = `${this._minWidth()}px`;

    this._distributeSpace();

    const btn = document.getElementById('collapse-pdf');
    if (btn) {
      btn.innerHTML = this._collapseChevron();
      btn.title = 'Collapse PDF Panel';
    }

    this.saveLayout();
    this.onResize();
  }

  collapseAnnotations() {
    if (this._collapsedCount() >= 2) return;

    this.lastAnnotationWidth = this.annotationPanel.clientWidth;
    this.lastPdfWidth = this.pdfPanel.clientWidth;
    this.lastSearchWidth = this.searchPanel.clientWidth;
    this.annotationPanel.classList.add('collapsed');
    this.annotationCollapsed = true;

    // Lock PDF and search at their current widths before distributing
    this.pdfPanel.style.flex = 'none';
    this.pdfPanel.style.width = `${this.lastPdfWidth}px`;
    this.searchPanel.style.flex = 'none';
    this.searchPanel.style.width = `${this.lastSearchWidth}px`;

    this._distributeSpace();

    const btn = document.getElementById('collapse-annotations');
    if (btn) {
      btn.innerHTML = this._expandChevron();
      btn.title = 'Expand Annotation Panel';
    }

    this.saveLayout();
    this.onResize();
  }

  expandAnnotations() {
    this.annotationPanel.classList.remove('collapsed');
    this.annotationCollapsed = false;

    // Snapshot current rendered widths of PDF and Search so they have explicit
    // inline widths when _distributeSpace switches them to flex: none.
    this.pdfPanel.style.flex = 'none';
    this.pdfPanel.style.width = `${this.pdfPanel.clientWidth}px`;
    this.searchPanel.style.flex = 'none';
    this.searchPanel.style.width = `${this.searchPanel.clientWidth}px`;

    this.annotationPanel.style.flex = 'none';
    this.annotationPanel.style.width = `${this._minWidth()}px`;

    this._distributeSpace();

    const btn = document.getElementById('collapse-annotations');
    if (btn) {
      btn.innerHTML = this._collapseChevron();
      btn.title = 'Collapse Annotation Panel';
    }

    this.saveLayout();
    this.onResize();
  }

  collapseSearch() {
    if (this._collapsedCount() >= 2) return;

    this.lastSearchWidth = this.searchPanel.clientWidth;
    this.searchPanel.classList.add('collapsed');
    this.searchPanel.style.flex = 'none';
    this.searchPanel.style.width = '40px';
    this.searchCollapsed = true;

    this._distributeSpace();

    const btn = document.getElementById('collapse-search');
    if (btn) {
      btn.innerHTML = this._expandChevron();
      btn.title = 'Expand Search Panel';
    }

    this.saveLayout();
    this.onResize();
  }

  expandSearch() {
    this.searchPanel.classList.remove('collapsed');
    this.searchCollapsed = false;

    // Snapshot sibling widths so they have explicit inline widths when
    // _distributeSpace switches them to flex: none.
    this.pdfPanel.style.flex = 'none';
    this.pdfPanel.style.width = `${this.pdfPanel.clientWidth}px`;
    this.annotationPanel.style.flex = 'none';
    this.annotationPanel.style.width = `${this.annotationPanel.clientWidth}px`;

    this.searchPanel.style.flex = 'none';
    this.searchPanel.style.width = `${this._minWidth()}px`;

    this._distributeSpace();

    const btn = document.getElementById('collapse-search');
    if (btn) {
      btn.innerHTML = this._collapseChevron();
      btn.title = 'Collapse Search Panel';
    }

    this.saveLayout();
    this.onResize();
  }

  restorePanels() {
    if (this.pdfCollapsed) {
      this.expandPdf();
    }
    if (this.annotationCollapsed) {
      this.expandAnnotations();
    }
    if (this.searchCollapsed) {
      this.expandSearch();
    }
  }

  togglePdf() {
    if (this.pdfCollapsed) {
      this.expandPdf();
    } else {
      this.collapsePdf();
    }
  }

  toggleAnnotations() {
    if (this.annotationCollapsed) {
      this.expandAnnotations();
    } else {
      this.collapseAnnotations();
    }
  }

  toggleSearch() {
    if (this.searchCollapsed) {
      this.expandSearch();
    } else {
      this.collapseSearch();
    }
  }
}

export default ResizablePanels;
