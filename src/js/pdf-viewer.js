// PDF.js Viewer for Electron
// Compatible with pdfjs-dist v4.x

import * as pdfjsLib from '../../node_modules/pdfjs-dist/build/pdf.min.mjs';

// Initialize PDF.js worker
const basePath = new URL('..', window.location.href).href;
const pdfjsWorkerSrc = `${basePath}node_modules/pdfjs-dist/build/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc;

async function initPdfJs() {
  return pdfjsLib;
}

// Pages within this many viewport heights of the visible area are pre-rendered
const RENDER_BUFFER_VIEWPORTS = 2;

export class PDFViewer {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.viewerElement = null;
    this.pdf = null;
    this.pages = [];               // PDF page objects (fetched during placeholder init)
    this.pageElements = new Map(); // pageNumber → {container, canvas, textLayer, highlightLayer}
    this.renderedPages = new Set(); // pages with canvas + text currently rendered
    this.renderGeneration = 0;     // incremented on scale change to discard stale in-flight renders
    this.scale = options.scale || 1;
    this.currentPage = 1;
    this.totalPages = 0;

    this.onPageChange = options.onPageChange || (() => {});
    this.onTextSelected = options.onTextSelected || (() => {});
    this.onHighlightClick = options.onHighlightClick || (() => {});

    this.highlightModeEnabled = false;
    this.annotations = [];
    this.observer = null;

    this.init();
  }

  init() {
    this.viewerElement = this.container.querySelector('.pdf-viewer') ||
                          this.container.appendChild(document.createElement('div'));
    this.viewerElement.className = 'pdf-viewer';

    this.setupScrollListener();
    this.setupSelectionListener();
  }

  async load(data) {
    try {
      const pdfjs = await initPdfJs();

      // Ensure data is Uint8Array
      let pdfData = data;
      if (ArrayBuffer.isView(data)) {
        pdfData = new Uint8Array(data.buffer || data);
      } else if (data instanceof ArrayBuffer) {
        pdfData = new Uint8Array(data);
      } else if (typeof data === 'object' && data.data) {
        // Handle serialized Buffer from IPC
        pdfData = new Uint8Array(data.data);
      }

      const loadingTask = pdfjs.getDocument({
        data: pdfData,
        cMapUrl: '../node_modules/pdfjs-dist/cmaps/',
        cMapPacked: true,
      });

      this.pdf = await loadingTask.promise;
      this.totalPages = this.pdf.numPages;

      this.viewerElement.innerHTML = '';
      this.pages = [];
      this.pageElements.clear();
      this.renderedPages.clear();
      this.renderGeneration++;
      this.destroyObserver();

      // Create sized placeholders for all pages (no canvas rendering yet).
      // This establishes the correct total scroll height immediately.
      await this.initPagePlaceholders();

      // Observe pages and render those near the viewport
      this.setupObserver();
      this.renderVisiblePages();
      this.updateCurrentPageFromScroll();

      return this.totalPages;
    } catch (error) {
      console.error('Error loading PDF:', error);
      throw error;
    }
  }

  // Create lightweight placeholder containers for every page.
  // Each gets the correct layout dimensions so scroll positions are accurate,
  // but no canvas or text layer content is rendered yet.
  async initPagePlaceholders() {
    for (let i = 1; i <= this.totalPages; i++) {
      const page = await this.pdf.getPage(i);
      this.pages[i - 1] = page;
      const viewport = page.getViewport({ scale: this.scale });

      const pageContainer = document.createElement('div');
      pageContainer.className = 'pdf-page';
      pageContainer.dataset.pageNumber = i;
      pageContainer.style.width = `${viewport.width}px`;
      pageContainer.style.height = `${viewport.height}px`;

      const canvas = document.createElement('canvas');
      canvas.width = 0;
      canvas.height = 0;

      const textLayerDiv = document.createElement('div');
      textLayerDiv.className = 'textLayer';
      textLayerDiv.style.setProperty('--scale-factor', viewport.scale);

      const highlightLayer = document.createElement('div');
      highlightLayer.className = 'highlight-layer';
      highlightLayer.dataset.pageNumber = i;

      pageContainer.appendChild(canvas);
      pageContainer.appendChild(textLayerDiv);
      pageContainer.appendChild(highlightLayer);
      this.viewerElement.appendChild(pageContainer);

      this.pageElements.set(i, {
        container: pageContainer,
        canvas,
        textLayer: textLayerDiv,
        highlightLayer,
        viewport
      });

      // Click hit-test for highlight navigation.
      // The text layer (z-index: 2) sits above the highlight layer (z-index: 1),
      // so clicks on highlighted text reach spans first. This listener performs
      // a coordinate hit-test to forward matching clicks to onHighlightClick.
      // Attached once per page; reads live state at click time.
      const pageNumber = i;
      textLayerDiv.addEventListener('click', (e) => {
        if (this.highlightModeEnabled) return;

        const pageRect = pageContainer.getBoundingClientRect();
        const clickX = (e.clientX - pageRect.left) / this.scale;
        const clickY = (e.clientY - pageRect.top) / this.scale;

        const hitAnnotation = this.annotations.find(ann => {
          if (ann.page_number !== pageNumber) return false;
          return ann.highlight_rects.some(rect =>
            clickX >= rect.left && clickX <= rect.left + rect.width &&
            clickY >= rect.top && clickY <= rect.top + rect.height
          );
        });

        if (hitAnnotation) {
          e.stopPropagation();
          this.onHighlightClick(hitAnnotation, e);
        }
      });
    }
  }

  setupObserver() {
    const vh = this.container.getBoundingClientRect().height;
    const margin = vh * RENDER_BUFFER_VIEWPORTS;

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageNumber = parseInt(entry.target.dataset.pageNumber, 10);
          this.renderPageIfNeeded(pageNumber);
        }
      });
    }, {
      root: this.container,
      rootMargin: `${margin}px 0px ${margin}px 0px`
    });

    this.pageElements.forEach((elements) => {
      this.observer.observe(elements.container);
    });
  }

  destroyObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  // Synchronous check: render any pages within the buffer zone around the viewport.
  // Used on initial load and after zoom to kick off immediate rendering for visible pages.
  renderVisiblePages() {
    const containerRect = this.container.getBoundingClientRect();
    const bufferSize = containerRect.height * RENDER_BUFFER_VIEWPORTS;

    this.pageElements.forEach((elements, pageNumber) => {
      const pageRect = elements.container.getBoundingClientRect();
      if (pageRect.bottom >= containerRect.top - bufferSize &&
          pageRect.top <= containerRect.bottom + bufferSize) {
        this.renderPageIfNeeded(pageNumber);
      }
    });
  }

  // Render a single page's canvas and text layer on demand.
  // Idempotent: returns immediately if the page is already rendered.
  async renderPageIfNeeded(pageNumber) {
    if (this.renderedPages.has(pageNumber)) return;
    this.renderedPages.add(pageNumber);

    const generation = this.renderGeneration;
    const pdfjs = await initPdfJs();
    const page = this.pages[pageNumber - 1];
    const elements = this.pageElements.get(pageNumber);
    if (!page || !elements) {
      this.renderedPages.delete(pageNumber);
      return;
    }

    const { canvas, textLayer: textLayerDiv } = elements;
    const pixelRatio = window.devicePixelRatio || 1;

    // Canvas renders at device-pixel resolution for crisp output on retina displays.
    // CSS size stays at layout resolution so the page occupies the correct space.
    const renderViewport = page.getViewport({ scale: this.scale * pixelRatio });
    const layoutViewport = page.getViewport({ scale: this.scale });

    const context = canvas.getContext('2d');
    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    canvas.style.width = `${layoutViewport.width}px`;
    canvas.style.height = `${layoutViewport.height}px`;

    await page.render({
      canvasContext: context,
      viewport: renderViewport
    }).promise;

    // Bail out if a zoom change invalidated this render
    if (generation !== this.renderGeneration) {
      this.renderedPages.delete(pageNumber);
      return;
    }

    // Text layer uses the layout viewport (CSS pixels), not the device-pixel viewport
    try {
      const textContent = await page.getTextContent();

      if (pdfjs.TextLayer) {
        const textLayer = new pdfjs.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: layoutViewport
        });
        await textLayer.render();
      } else if (pdfjs.renderTextLayer) {
        await pdfjs.renderTextLayer({
          textContent: textContent,
          container: textLayerDiv,
          viewport: layoutViewport,
          textDivs: []
        }).promise;
      }
    } catch (textError) {
      console.warn('Text layer rendering failed:', textError);
    }

    // Render any annotations belonging to this page
    this.annotations
      .filter(ann => ann.page_number === pageNumber)
      .forEach(ann => this.renderHighlight(ann));

    // Apply current highlight-mode pointer-event state to new highlights
    if (this.highlightModeEnabled) {
      elements.container.querySelectorAll('.annotation-highlight').forEach(el => {
        el.style.pointerEvents = 'none';
      });
    }
  }

  async setScale(newScale) {
    if (newScale === 'fit-width') {
      const containerWidth = this.container.clientWidth - 48; // padding
      const page = this.pages[0];
      if (page) {
        const viewport = page.getViewport({ scale: 1 });
        newScale = containerWidth / viewport.width;
      } else {
        newScale = 1;
      }
    }

    this.scale = newScale;
    this.renderGeneration++; // invalidate any in-flight renders at the previous scale
    const scrollRatio = this.container.scrollTop / this.container.scrollHeight;

    // Update placeholder dimensions and clear all rendered content
    this.pageElements.forEach((elements, pageNumber) => {
      const page = this.pages[pageNumber - 1];
      if (!page) return;

      const viewport = page.getViewport({ scale: this.scale });
      elements.container.style.width = `${viewport.width}px`;
      elements.container.style.height = `${viewport.height}px`;
      elements.viewport = viewport;
      elements.textLayer.style.setProperty('--scale-factor', viewport.scale);

      // Clear rendered content so pages re-render at new scale
      elements.canvas.width = 0;
      elements.canvas.height = 0;
      elements.canvas.style.width = '';
      elements.canvas.style.height = '';
      elements.textLayer.innerHTML = '';
      elements.highlightLayer.innerHTML = '';
    });
    this.renderedPages.clear();

    // Restore scroll position and re-render visible pages at new scale
    this.container.scrollTop = scrollRatio * this.container.scrollHeight;
    this.renderVisiblePages();
  }

  zoomIn() {
    const newScale = Math.min(this.scale * 1.25, 3);
    return this.setScale(newScale);
  }

  zoomOut() {
    const newScale = Math.max(this.scale / 1.25, 0.25);
    return this.setScale(newScale);
  }

  getScale() {
    return this.scale;
  }

  setupScrollListener() {
    let scrollTimeout;
    this.container.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.updateCurrentPageFromScroll();
        this.renderVisiblePages();
      }, 100);
    });
  }

  updateCurrentPageFromScroll() {
    const containerRect = this.container.getBoundingClientRect();
    const containerCenter = containerRect.top + containerRect.height / 2;

    let closestPage = 1;
    let closestDistance = Infinity;

    this.pageElements.forEach((elements, pageNumber) => {
      const rect = elements.container.getBoundingClientRect();
      const pageCenter = rect.top + rect.height / 2;
      const distance = Math.abs(pageCenter - containerCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = pageNumber;
      }
    });

    if (closestPage !== this.currentPage) {
      this.currentPage = closestPage;
      this.onPageChange(this.currentPage);
    }
  }

  scrollToPage(pageNumber) {
    const pageElement = this.pageElements.get(pageNumber);
    if (pageElement) {
      pageElement.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  setupSelectionListener() {
    document.addEventListener('mouseup', (e) => {
      if (!this.highlightModeEnabled) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const range = selection.getRangeAt(0);
      if (!range) return;

      // Check if selection is within the PDF viewer
      const textLayer = range.commonAncestorContainer.closest?.('.textLayer') ||
                        range.commonAncestorContainer.parentElement?.closest?.('.textLayer');
      if (!textLayer) return;

      const pageContainer = textLayer.closest('.pdf-page');
      if (!pageContainer) return;

      const pageNumber = parseInt(pageContainer.dataset.pageNumber, 10);
      const selectedText = selection.toString().trim();

      if (!selectedText) return;

      // Get bounding rects relative to the page
      const pageRect = pageContainer.getBoundingClientRect();
      const rects = [];

      for (let i = 0; i < range.getClientRects().length; i++) {
        const rect = range.getClientRects()[i];
        rects.push({
          left: (rect.left - pageRect.left) / this.scale,
          top: (rect.top - pageRect.top) / this.scale,
          width: rect.width / this.scale,
          height: rect.height / this.scale
        });
      }

      // Merge adjacent rects
      const mergedRects = this.mergeRects(rects);

      this.onTextSelected({
        pageNumber,
        selectedText,
        rects: mergedRects,
        mouseX: e.clientX,
        mouseY: e.clientY
      });
    });
  }

  mergeRects(rects) {
    if (rects.length === 0) return [];

    // Sort by top then left
    rects.sort((a, b) => a.top - b.top || a.left - b.left);

    const merged = [];
    let current = { ...rects[0] };

    for (let i = 1; i < rects.length; i++) {
      const rect = rects[i];

      // Check if rects are on the same line and adjacent
      if (Math.abs(rect.top - current.top) < 5 &&
          rect.left <= current.left + current.width + 5) {
        // Merge
        current.width = Math.max(current.left + current.width, rect.left + rect.width) - current.left;
        current.height = Math.max(current.height, rect.height);
      } else {
        merged.push(current);
        current = { ...rect };
      }
    }
    merged.push(current);

    return merged;
  }

  setHighlightMode(enabled) {
    this.highlightModeEnabled = enabled;
    this.container.style.cursor = enabled ? 'text' : 'default';

    // When in highlight mode, disable pointer events on highlights to allow text selection
    // When not in highlight mode, enable pointer events so highlights are clickable
    const highlights = this.viewerElement.querySelectorAll('.annotation-highlight');
    highlights.forEach(highlight => {
      highlight.style.pointerEvents = enabled ? 'none' : 'auto';
    });
  }

  setAnnotations(annotations) {
    this.annotations = annotations;
    this.renderAllHighlights();
  }

  renderAllHighlights() {
    // Only update highlights on pages that are already rendered;
    // unrendered pages will get their highlights when renderPageIfNeeded runs
    this.pageElements.forEach((elements, pageNumber) => {
      if (!this.renderedPages.has(pageNumber)) return;
      elements.highlightLayer.innerHTML = '';
    });

    this.annotations.forEach(annotation => {
      if (this.renderedPages.has(annotation.page_number)) {
        this.renderHighlight(annotation);
      }
    });
  }

  renderHighlight(annotation) {
    const pageElements = this.pageElements.get(annotation.page_number);
    if (!pageElements) return;

    const { highlightLayer } = pageElements;
    const rects = annotation.highlight_rects;
    const categoryClass = `highlight-${annotation.category_name.toLowerCase()}`;

    rects.forEach((rect, index) => {
      const highlightEl = document.createElement('div');
      highlightEl.className = `annotation-highlight ${categoryClass}`;
      highlightEl.dataset.annotationId = annotation.id;
      highlightEl.dataset.rectIndex = index;
      highlightEl.style.left = `${rect.left * this.scale}px`;
      highlightEl.style.top = `${rect.top * this.scale}px`;
      highlightEl.style.width = `${rect.width * this.scale}px`;
      highlightEl.style.height = `${rect.height * this.scale}px`;
      highlightEl.title = `${annotation.category_name}: ${annotation.comment || annotation.selected_text}`;

      // Disable pointer events when in highlight mode to allow text selection
      if (this.highlightModeEnabled) {
        highlightEl.style.pointerEvents = 'none';
      }

      highlightEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onHighlightClick(annotation, e);
      });

      highlightEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onHighlightClick(annotation, e, true);
      });

      highlightLayer.appendChild(highlightEl);
    });
  }

  updateHighlight(annotationId, categoryName) {
    const highlights = this.viewerElement.querySelectorAll(`[data-annotation-id="${annotationId}"]`);
    highlights.forEach(el => {
      // Remove old category class
      el.className = el.className.replace(/highlight-\w+/, '');
      // Add new category class
      el.classList.add(`highlight-${categoryName.toLowerCase()}`);
    });
  }

  removeHighlight(annotationId) {
    const highlights = this.viewerElement.querySelectorAll(`[data-annotation-id="${annotationId}"]`);
    highlights.forEach(el => el.remove());
  }

  async highlightAnnotation(annotationId) {
    // Ensure the target page is rendered before trying to find highlight elements
    const annotation = this.annotations.find(a => a.id === annotationId);
    if (annotation) {
      await this.renderPageIfNeeded(annotation.page_number);
    }

    // Remove active from all
    this.viewerElement.querySelectorAll('.annotation-highlight.active')
      .forEach(el => el.classList.remove('active'));

    // Add active to this annotation
    const highlights = this.viewerElement.querySelectorAll(`[data-annotation-id="${annotationId}"]`);
    highlights.forEach(el => {
      el.classList.add('active');
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 900);
    });

    // Scroll to the highlight itself so it lands in view regardless of zoom level
    if (highlights.length > 0) {
      highlights[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (annotation) {
      // Fallback: scroll to the page placeholder even if highlight elements not found
      const elements = this.pageElements.get(annotation.page_number);
      if (elements) {
        elements.container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  clearSelection() {
    window.getSelection()?.removeAllRanges();
  }

  destroy() {
    this.destroyObserver();
    this.pdf = null;
    this.pages = [];
    this.pageElements.clear();
    this.renderedPages.clear();
    this.viewerElement.innerHTML = '';
  }
}

export default PDFViewer;
