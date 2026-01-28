export class ResizablePanels {
  constructor(options = {}) {
    this.pdfPanel = options.pdfPanel;
    this.annotationPanel = options.annotationPanel;
    this.resizer = options.resizer;
    this.container = options.container;

    this.minPanelPercent = options.minPanelPercent || 30;
    this.maxPanelPercent = options.maxPanelPercent || 70;

    this.isDragging = false;
    this.startX = 0;
    this.startPdfWidth = 0;

    this.pdfCollapsed = false;
    this.annotationCollapsed = false;
    this.lastPdfWidth = null;
    this.lastAnnotationWidth = null;

    this.onResize = options.onResize || (() => {});

    this.init();
  }

  init() {
    this.loadSavedLayout();
    this.setupResizer();
    this.setupCollapseButtons();
  }

  loadSavedLayout() {
    window.api.getSetting('panelLayout').then(layout => {
      if (layout) {
        if (layout.pdfWidthPercent) {
          this.setPdfWidthPercent(layout.pdfWidthPercent);
        }
        if (layout.pdfCollapsed) {
          this.collapsePdf();
        }
        if (layout.annotationCollapsed) {
          this.collapseAnnotations();
        }
      }
    }).catch(() => {});
  }

  saveLayout() {
    const containerWidth = this.container.clientWidth;
    const pdfWidth = this.pdfPanel.clientWidth;
    const pdfWidthPercent = (pdfWidth / containerWidth) * 100;

    window.api.setSetting('panelLayout', {
      pdfWidthPercent,
      pdfCollapsed: this.pdfCollapsed,
      annotationCollapsed: this.annotationCollapsed
    }).catch(() => {});
  }

  setupResizer() {
    this.resizer.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.startX = e.clientX;
      this.startPdfWidth = this.pdfPanel.clientWidth;
      this.resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      const containerWidth = this.container.clientWidth;
      const resizerWidth = this.resizer.clientWidth;
      const delta = e.clientX - this.startX;
      let newPdfWidth = this.startPdfWidth + delta;

      // Calculate percentages
      const minWidth = (this.minPanelPercent / 100) * containerWidth;
      const maxWidth = (this.maxPanelPercent / 100) * containerWidth;

      // Clamp to limits
      newPdfWidth = Math.max(minWidth, Math.min(maxWidth, newPdfWidth));

      // Apply new width
      this.pdfPanel.style.flex = 'none';
      this.pdfPanel.style.width = `${newPdfWidth}px`;
      this.annotationPanel.style.flex = '1';

      this.onResize();
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        this.saveLayout();
      }
    });
  }

  setupCollapseButtons() {
    const collapsePdfBtn = document.getElementById('collapse-pdf');
    const collapseAnnotationsBtn = document.getElementById('collapse-annotations');

    if (collapsePdfBtn) {
      collapsePdfBtn.addEventListener('click', () => {
        if (this.pdfCollapsed) {
          this.expandPdf();
        } else {
          this.collapsePdf();
        }
      });
    }

    if (collapseAnnotationsBtn) {
      collapseAnnotationsBtn.addEventListener('click', () => {
        if (this.annotationCollapsed) {
          this.expandAnnotations();
        } else {
          this.collapseAnnotations();
        }
      });
    }
  }

  setPdfWidthPercent(percent) {
    const containerWidth = this.container.clientWidth;
    const newWidth = (percent / 100) * containerWidth;
    this.pdfPanel.style.flex = 'none';
    this.pdfPanel.style.width = `${newWidth}px`;
    this.annotationPanel.style.flex = '1';
  }

  collapsePdf() {
    if (this.annotationCollapsed) {
      this.expandAnnotations();
    }

    this.lastPdfWidth = this.pdfPanel.clientWidth;
    this.pdfPanel.classList.add('collapsed');
    this.pdfPanel.style.flex = 'none';
    this.pdfPanel.style.width = '40px';
    this.resizer.style.display = 'none';
    this.pdfCollapsed = true;

    const btn = document.getElementById('collapse-pdf');
    if (btn) {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      `;
      btn.title = 'Expand PDF Panel';
    }

    this.saveLayout();
    this.onResize();
  }

  expandPdf() {
    this.pdfPanel.classList.remove('collapsed');
    this.resizer.style.display = '';

    if (this.lastPdfWidth) {
      this.pdfPanel.style.width = `${this.lastPdfWidth}px`;
    } else {
      this.pdfPanel.style.flex = '1';
      this.pdfPanel.style.width = '';
    }

    this.pdfCollapsed = false;

    const btn = document.getElementById('collapse-pdf');
    if (btn) {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      `;
      btn.title = 'Collapse PDF Panel';
    }

    this.saveLayout();
    this.onResize();
  }

  collapseAnnotations() {
    if (this.pdfCollapsed) {
      this.expandPdf();
    }

    this.lastAnnotationWidth = this.annotationPanel.clientWidth;
    this.annotationPanel.classList.add('collapsed');
    this.resizer.style.display = 'none';
    this.annotationCollapsed = true;

    // Make PDF panel expand to fill space
    this.pdfPanel.style.flex = '1';
    this.pdfPanel.style.width = '';

    const btn = document.getElementById('collapse-annotations');
    if (btn) {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      `;
      btn.title = 'Expand Annotation Panel';
    }

    this.saveLayout();
    this.onResize();
  }

  expandAnnotations() {
    this.annotationPanel.classList.remove('collapsed');
    this.resizer.style.display = '';
    this.annotationCollapsed = false;

    // Restore PDF panel to previous size or default
    if (this.lastPdfWidth) {
      this.pdfPanel.style.flex = 'none';
      this.pdfPanel.style.width = `${this.lastPdfWidth}px`;
    } else {
      // Default to equal split
      this.pdfPanel.style.flex = '1';
      this.pdfPanel.style.width = '';
    }
    this.annotationPanel.style.flex = '0 0 350px';

    const btn = document.getElementById('collapse-annotations');
    if (btn) {
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      `;
      btn.title = 'Collapse Annotation Panel';
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
}

export default ResizablePanels;
