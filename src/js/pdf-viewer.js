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

// Category highlight colors (rgba with alpha for fill)
const CATEGORY_COLORS = {
  critical:   { r: 220, g: 38,  b: 38  },  // #dc2626
  major:      { r: 234, g: 88,  b: 12  },  // #ea580c
  minor:      { r: 202, g: 138, b: 4   },  // #ca8a04
  suggestion: { r: 37,  g: 99,  b: 235 },  // #2563eb
  question:   { r: 124, g: 58,  b: 237 },  // #7c3aed
};

export class PDFViewer {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.viewerElement = null;
    this.pdf = null;
    this.pages = [];               // PDF page objects (fetched during placeholder init)
    this.pageElements = new Map(); // pageNumber → {container, canvas, textLayer, highlightCanvas}
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
    this.dualPageMode = false;

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

      const highlightCanvas = document.createElement('canvas');
      highlightCanvas.className = 'highlight-canvas';
      highlightCanvas.width = 0;
      highlightCanvas.height = 0;

      pageContainer.appendChild(canvas);
      pageContainer.appendChild(highlightCanvas);
      pageContainer.appendChild(textLayerDiv);
      // Append to viewer; rebuildLayout will reorganize if dual mode
      this.viewerElement.appendChild(pageContainer);

      this.pageElements.set(i, {
        container: pageContainer,
        canvas,
        textLayer: textLayerDiv,
        highlightCanvas,
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

      textLayerDiv.addEventListener('contextmenu', (e) => {
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
          e.preventDefault();
          e.stopPropagation();
          this.onHighlightClick(hitAnnotation, e, true);
        }
      });

      // Cursor hit-test: show pointer when hovering over a highlight
      textLayerDiv.addEventListener('mousemove', (e) => {
        if (this.highlightModeEnabled) {
          textLayerDiv.classList.remove('over-highlight');
          return;
        }

        const pageRect = pageContainer.getBoundingClientRect();
        const mx = (e.clientX - pageRect.left) / this.scale;
        const my = (e.clientY - pageRect.top) / this.scale;

        const overHighlight = this.annotations.some(ann => {
          if (ann.page_number !== pageNumber) return false;
          return ann.highlight_rects.some(rect =>
            mx >= rect.left && mx <= rect.left + rect.width &&
            my >= rect.top && my <= rect.top + rect.height
          );
        });

        textLayerDiv.classList.toggle('over-highlight', overHighlight);
      });

      textLayerDiv.addEventListener('mouseleave', () => {
        textLayerDiv.classList.remove('over-highlight');
      });
    }

    // Organize into spreads if dual page mode is active
    if (this.dualPageMode) {
      this.rebuildLayout();
    }
  }

  setDualPageMode(enabled) {
    if (this.dualPageMode === enabled) return;
    this.dualPageMode = enabled;
    if (this.totalPages === 0) return;

    const scrollRatio = this.container.scrollTop / this.container.scrollHeight;
    this.rebuildLayout();
    this.container.scrollTop = scrollRatio * this.container.scrollHeight;
  }

  rebuildLayout() {
    // Remove all children from viewer without destroying pageContainers
    // First remove any existing spread wrappers
    this.viewerElement.querySelectorAll('.pdf-page-spread').forEach(s => {
      // Move children back out before removing spread
      while (s.firstChild) {
        this.viewerElement.appendChild(s.firstChild);
      }
      s.remove();
    });

    // Detach all page containers
    const pages = [];
    this.pageElements.forEach((elements, pageNumber) => {
      pages.push({ pageNumber, container: elements.container });
    });
    pages.sort((a, b) => a.pageNumber - b.pageNumber);
    pages.forEach(p => p.container.remove());

    if (!this.dualPageMode) {
      // Single page: append directly
      pages.forEach(p => this.viewerElement.appendChild(p.container));
    } else {
      // Dual page: page 1 alone, then pairs [2,3], [4,5], ...
      let i = 0;
      while (i < pages.length) {
        const spread = document.createElement('div');
        spread.className = 'pdf-page-spread';

        if (i === 0) {
          // First page alone
          spread.appendChild(pages[i].container);
          i++;
        } else {
          spread.appendChild(pages[i].container);
          i++;
          if (i < pages.length) {
            spread.appendChild(pages[i].container);
            i++;
          }
        }

        this.viewerElement.appendChild(spread);
      }
    }

    // Recreate observer
    this.destroyObserver();
    this.setupObserver();
    this.renderVisiblePages();
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

    const { canvas, textLayer: textLayerDiv, highlightCanvas } = elements;
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

    // Size highlight canvas to match PDF canvas
    highlightCanvas.width = renderViewport.width;
    highlightCanvas.height = renderViewport.height;
    highlightCanvas.style.width = `${layoutViewport.width}px`;
    highlightCanvas.style.height = `${layoutViewport.height}px`;

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
    this.redrawPageHighlights(pageNumber);
  }

  async setScale(newScale) {
    if (newScale === 'fit-width') {
      const containerWidth = this.container.clientWidth - 48; // padding
      const page = this.pages[0];
      if (page) {
        const viewport = page.getViewport({ scale: 1 });
        if (this.dualPageMode) {
          // Two pages + gap (16px)
          newScale = (containerWidth - 16) / (viewport.width * 2);
        } else {
          newScale = containerWidth / viewport.width;
        }
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
      elements.highlightCanvas.width = 0;
      elements.highlightCanvas.height = 0;
      elements.highlightCanvas.style.width = '';
      elements.highlightCanvas.style.height = '';
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
      this._scrollElementIntoContainer(pageElement.container, 'start');
    }
  }

  // Scroll an element into view within this.container without affecting outer layout.
  _scrollElementIntoContainer(element, block = 'center') {
    const containerRect = this.container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const offset = elementRect.top - containerRect.top + this.container.scrollTop;

    let target;
    if (block === 'start') {
      target = offset;
    } else {
      // center
      target = offset - (containerRect.height - elementRect.height) / 2;
    }

    this.container.scrollTo({ top: target, behavior: 'smooth' });
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
      this.redrawPageHighlights(pageNumber);
    });
  }

  // Clear and redraw all highlights for a single page on its highlight canvas
  redrawPageHighlights(pageNumber) {
    const elements = this.pageElements.get(pageNumber);
    if (!elements || !elements.highlightCanvas.width) return;

    const ctx = elements.highlightCanvas.getContext('2d');
    ctx.clearRect(0, 0, elements.highlightCanvas.width, elements.highlightCanvas.height);

    const pixelRatio = window.devicePixelRatio || 1;
    const pageAnnotations = this.annotations.filter(a => a.page_number === pageNumber);

    for (const ann of pageAnnotations) {
      this._drawAnnotationRects(ctx, ann, pixelRatio, 0.25);
    }
  }

  // Draw the rectangles for a single annotation on a canvas context
  _drawAnnotationRects(ctx, annotation, pixelRatio, alpha) {
    const color = CATEGORY_COLORS[annotation.category_name.toLowerCase()];
    if (!color) return;

    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;

    for (const rect of annotation.highlight_rects) {
      ctx.fillRect(
        rect.left * this.scale * pixelRatio,
        rect.top * this.scale * pixelRatio,
        rect.width * this.scale * pixelRatio,
        rect.height * this.scale * pixelRatio
      );
    }
  }

  renderHighlight(annotation) {
    // For canvas-based highlights, just redraw the whole page
    this.redrawPageHighlights(annotation.page_number);
  }

  updateHighlight(annotationId, categoryName) {
    const annotation = this.annotations.find(a => a.id === annotationId);
    if (annotation) {
      this.redrawPageHighlights(annotation.page_number);
    }
  }

  removeHighlight(annotationId) {
    // Find which page this annotation was on before it was removed from this.annotations
    // Caller should pass the page number or we scan all rendered pages
    // Since the annotation may already be removed from this.annotations, redraw all rendered pages
    this.pageElements.forEach((elements, pageNumber) => {
      if (this.renderedPages.has(pageNumber)) {
        this.redrawPageHighlights(pageNumber);
      }
    });
  }

  async highlightAnnotation(annotationId) {
    const annotation = this.annotations.find(a => a.id === annotationId);
    if (!annotation) return;

    await this.renderPageIfNeeded(annotation.page_number);

    const elements = this.pageElements.get(annotation.page_number);
    if (!elements || !elements.highlightCanvas.width) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const ctx = elements.highlightCanvas.getContext('2d');
    const pageNumber = annotation.page_number;

    // Flash animation: alternate between high and normal opacity
    let flashCount = 0;
    const maxFlashes = 4; // 2 full cycles (high-low-high-low)
    const flashInterval = 300;

    const flash = () => {
      this.redrawPageHighlights(pageNumber);
      if (flashCount < maxFlashes) {
        // Draw this annotation's rects with higher opacity on even counts
        if (flashCount % 2 === 0) {
          this._drawAnnotationRects(ctx, annotation, pixelRatio, 0.55);
        }
        flashCount++;
        setTimeout(() => requestAnimationFrame(flash), flashInterval);
      }
    };

    requestAnimationFrame(flash);

    // Scroll so the first highlight rect is vertically centered in the container.
    const firstRect = annotation.highlight_rects[0];
    if (firstRect) {
      const rectHeight = firstRect.height * this.scale;
      const containerRect = this.container.getBoundingClientRect();
      const pageRect = elements.container.getBoundingClientRect();
      // Where the rect center is on screen right now
      const rectScreenCenter = pageRect.top + firstRect.top * this.scale + rectHeight / 2;
      // Where we want it (container center)
      const containerCenter = containerRect.top + containerRect.height / 2;
      // Adjust scrollTop by the difference (+ fixed offset to correct undershoot)
      const SCROLL_CORRECTION = 200;
      this.container.scrollTo({
        top: this.container.scrollTop + (rectScreenCenter - containerCenter) + SCROLL_CORRECTION,
        behavior: 'smooth'
      });
    } else {
      this._scrollElementIntoContainer(elements.container, 'center');
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
