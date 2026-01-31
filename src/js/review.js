import '../components/annotation-card.js';
import '../components/category-filter.js';
import { PDFViewer } from './pdf-viewer.js';
import { AnnotationManager } from './annotation-manager.js';
import { ResizablePanels } from './resizable-panels.js';
import { getCategoryIcon, escapeHtml } from './utils.js';
import { createLLMProvider } from './llm-provider.js';

// State
let pdfId = null;
let pdfData = null;
let pdfViewer = null;
let annotationManager = null;
let resizablePanels = null;
let categories = [];
let activeCategories = [];
let highlightMode = false;
let pendingSelection = null;
let editingAnnotationId = null;
let popupJustShown = false;

// DOM Elements
const pdfTitle = document.getElementById('pdf-title');
const pdfLoading = document.getElementById('pdf-loading');
const pdfViewerContainer = document.getElementById('pdf-viewer-container');
const currentPageEl = document.getElementById('current-page');
const totalPagesEl = document.getElementById('total-pages');
const zoomSelect = document.getElementById('zoom-select');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnHighlight = document.getElementById('btn-highlight');
const btnBack = document.getElementById('btn-back');
const sortSelect = document.getElementById('sort-select');
const btnExport = document.getElementById('btn-export');
const exportMenu = document.getElementById('export-menu');

const annotationList = document.getElementById('annotation-list');
const annotationListEmpty = document.getElementById('annotation-list-empty');
const annotationCount = document.getElementById('annotation-count');
const categoryFilters = document.getElementById('category-filters');

const selectionPopup = document.getElementById('selection-popup');
const categoryButtons = document.getElementById('category-buttons');

const annotationModal = document.getElementById('annotation-modal');
const modalTitle = document.getElementById('modal-title');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const modalSave = document.getElementById('modal-save');
const selectedTextPreview = document.getElementById('selected-text-preview');
const categoryBadge = document.getElementById('category-badge');
const categorySelect = document.getElementById('category-select');
const commentInput = document.getElementById('comment-input');

const contextMenu = document.getElementById('context-menu');
const categoryMenu = document.getElementById('category-menu');
const toastContainer = document.getElementById('toast-container');
const btnGenerateReview = document.getElementById('btn-generate-review');

const searchWebview = document.getElementById('search-webview');
const btnWebviewBack = document.getElementById('btn-webview-back');
const btnWebviewForward = document.getElementById('btn-webview-forward');
const btnWebviewReload = document.getElementById('btn-webview-reload');
const webviewUrlBar = document.getElementById('webview-url-bar');

// Initialize
async function init() {
  // Get PDF ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  pdfId = urlParams.get('id');

  if (!pdfId) {
    showToast('No PDF specified', 'error');
    await window.api.navigateToHome();
    return;
  }

  // Initialize managers
  annotationManager = new AnnotationManager({
    pdfId,
    onAnnotationCreated: handleAnnotationCreated,
    onAnnotationUpdated: handleAnnotationUpdated,
    onAnnotationDeleted: handleAnnotationDeleted,
    onAnnotationsFiltered: renderAnnotationList
  });

  // Initialize resizable panels
  resizablePanels = new ResizablePanels({
    pdfPanel: document.getElementById('pdf-panel'),
    annotationPanel: document.getElementById('annotation-panel'),
    searchPanel: document.getElementById('search-panel'),
    resizer1: document.getElementById('panel-resizer-1'),
    resizer2: document.getElementById('panel-resizer-2'),
    container: document.querySelector('.main-content'),
    onResize: () => {
      // Trigger PDF re-render if needed
    }
  });

  // Load data
  await loadCategories();
  await loadPDF();
  await loadAnnotations();
  await checkLLMReady();

  setupEventListeners();
  setupKeyboardShortcuts();
}

// Load categories
async function loadCategories() {
  categories = await annotationManager.loadCategories();
  activeCategories = await window.api.getActiveCategories();
  renderCategoryFilters();
  renderCategoryButtons();
  renderCategorySelect();
  renderCategoryMenu();
}

// Load PDF
async function loadPDF() {
  try {
    pdfData = await window.api.getPDF(pdfId);
    if (!pdfData) {
      showToast('PDF not found', 'error');
      await window.api.navigateToHome();
      return;
    }

    pdfTitle.textContent = pdfData.name;
    pdfTitle.title = pdfData.path;

    // Update last opened
    await window.api.updatePDF(pdfId, { lastOpenedAt: new Date().toISOString() });

    // Load PDF file
    const fileData = await window.api.readPDFFile(pdfData.path);

    // Initialize PDF viewer
    pdfViewer = new PDFViewer(pdfViewerContainer, {
      onPageChange: (page) => {
        currentPageEl.textContent = page;
      },
      onTextSelected: handleTextSelected,
      onHighlightClick: handleHighlightClick
    });

    const totalPages = await pdfViewer.load(fileData);
    totalPagesEl.textContent = totalPages;

    // Hide loading
    pdfLoading.classList.add('hidden');
  } catch (error) {
    console.error('Error loading PDF:', error);
    showToast('Failed to load PDF', 'error');
  }
}

// Load annotations
async function loadAnnotations() {
  const annotations = await annotationManager.loadAnnotations();
  pdfViewer.setAnnotations(annotationManager.annotations);
  renderCategoryFilters();
  renderAnnotationList(annotations);
  updateAnnotationCount();
  updateCategoryFilterCounts();
}

// Build the list of categories to show in filters:
// union of active categories + categories referenced by annotations in this document
function getFilterCategories() {
  const byId = new Map();

  // Add active categories first
  activeCategories.forEach(cat => byId.set(cat.id, cat));

  // Add categories from existing annotations (may include inactive ones)
  annotationManager.annotations.forEach(a => {
    if (!byId.has(a.category_id)) {
      byId.set(a.category_id, {
        id: a.category_id,
        name: a.category_name,
        color: a.category_color,
        icon: a.category_icon,
        sort_order: Infinity
      });
    }
  });

  // Sort: categories with known sort_order first, then annotation-only ones at the end
  return Array.from(byId.values()).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

// Render functions
function renderCategoryFilters() {
  const filterCats = getFilterCategories();
  const hasActiveFilters = annotationManager.activeFilters.size > 0;
  categoryFilters.innerHTML = `
    <category-filter
      category-id="0"
      name="All"
      color="#3b82f6"
      icon="info"
      count="0"
      ${!hasActiveFilters ? 'active' : ''}
    ></category-filter>
    ${filterCats.map(cat => `
      <category-filter
        category-id="${cat.id}"
        name="${cat.name}"
        color="${cat.color}"
        icon="${cat.icon}"
        count="0"
        ${annotationManager.activeFilters.has(cat.id) ? 'active' : ''}
      ></category-filter>
    `).join('')}
  `;
}

function renderCategoryButtons() {
  categoryButtons.innerHTML = activeCategories.map(cat => `
    <button class="category-btn ${cat.name.toLowerCase()}"
            data-category-id="${cat.id}"
            data-tooltip="${cat.name}"
            style="background-color: ${cat.color}">
      ${getCategoryIcon(cat.icon)}
    </button>
  `).join('');
}

function renderCategorySelect() {
  categorySelect.innerHTML = activeCategories.map(cat => `
    <option value="${cat.id}">${cat.name}</option>
  `).join('');
}

function renderCategoryMenu() {
  categoryMenu.innerHTML = activeCategories.map(cat => `
    <div class="context-menu-item" data-category-id="${cat.id}" style="color: ${cat.color}">
      ${getCategoryIcon(cat.icon)}
      ${cat.name}
    </div>
  `).join('');
}

function renderAnnotationList(annotations) {
  if (annotations.length === 0) {
    annotationListEmpty.classList.remove('hidden');
    annotationList.querySelectorAll('annotation-card').forEach(el => el.remove());
    return;
  }

  annotationListEmpty.classList.add('hidden');

  // Clear existing cards
  annotationList.querySelectorAll('annotation-card').forEach(el => el.remove());

  // Render cards
  annotations.forEach(annotation => {
    const card = document.createElement('annotation-card');
    card.setAttribute('annotation-id', annotation.id);
    card.setAttribute('category-name', annotation.category_name);
    card.setAttribute('category-color', annotation.category_color);
    card.setAttribute('category-icon', annotation.category_icon);
    card.setAttribute('page-number', annotation.page_number);
    card.setAttribute('selected-text', annotation.selected_text || '');
    card.setAttribute('comment', annotation.comment || '');
    card.setAttribute('created-at', annotation.created_at);

    annotationList.appendChild(card);
  });
}

function updateAnnotationCount() {
  annotationCount.textContent = annotationManager.annotations.length;
}

function updateCategoryFilterCounts() {
  const counts = annotationManager.getCategoryCounts();
  const total = annotationManager.annotations.length;

  // Update "All" filter
  const allFilter = categoryFilters.querySelector('[category-id="0"]');
  if (allFilter) {
    allFilter.setAttribute('count', total);
  }

  // Update category filters for all visible filter chips
  const filterCats = getFilterCategories();
  filterCats.forEach(cat => {
    const filter = categoryFilters.querySelector(`[category-id="${cat.id}"]`);
    if (filter) {
      filter.setAttribute('count', counts[cat.id] || 0);
    }
  });
}

// Event handlers
function handleTextSelected({ pageNumber, selectedText, rects, mouseX, mouseY }) {
  console.log('handleTextSelected called:', { pageNumber, selectedText, rects: rects?.length });
  if (!highlightMode) {
    console.log('Highlight mode not enabled, ignoring');
    return;
  }

  pendingSelection = { pageNumber, selectedText, rects };
  console.log('pendingSelection set:', pendingSelection);

  // Position and show popup
  selectionPopup.style.left = `${mouseX}px`;
  selectionPopup.style.top = `${mouseY + 10}px`;
  selectionPopup.classList.add('active');
  popupJustShown = true;
  requestAnimationFrame(() => { popupJustShown = false; });
}

function handleHighlightClick(annotation, event, isContextMenu = false) {
  if (isContextMenu) {
    showContextMenu(annotation, event.clientX, event.clientY);
  } else {
    scrollToAnnotationCard(annotation.id);
  }
}

function handleAnnotationCreated(annotation) {
  console.log('handleAnnotationCreated called with:', annotation);
  console.log('Total annotations:', annotationManager.annotations.length);
  pdfViewer.setAnnotations(annotationManager.annotations);
  renderCategoryFilters();
  renderAnnotationList(annotationManager.getFilteredAndSorted());
  updateAnnotationCount();
  updateCategoryFilterCounts();

  showToast('Annotation created', 'success');
}

function handleAnnotationUpdated(annotation) {
  pdfViewer.setAnnotations(annotationManager.annotations);
  renderCategoryFilters();
  renderAnnotationList(annotationManager.getFilteredAndSorted());
  updateCategoryFilterCounts();
  showToast('Annotation updated', 'success');
}

function handleAnnotationDeleted(annotationId) {
  pdfViewer.setAnnotations(annotationManager.annotations);
  renderCategoryFilters();
  renderAnnotationList(annotationManager.getFilteredAndSorted());
  updateAnnotationCount();
  updateCategoryFilterCounts();
  showToast('Annotation deleted', 'success');
}

// UI Actions
function toggleHighlightMode() {
  highlightMode = !highlightMode;
  btnHighlight.classList.toggle('active', highlightMode);
  pdfViewer.setHighlightMode(highlightMode);

  if (!highlightMode) {
    hideSelectionPopup();
  }
}

function hideSelectionPopup() {
  const wasActive = selectionPopup.classList.contains('active');
  selectionPopup.classList.remove('active');
  pendingSelection = null;
  // Only clear text selection if the popup was showing (highlight mode flow)
  if (wasActive) {
    pdfViewer.clearSelection();
  }
}

function showAnnotationModal(categoryId) {
  if (!pendingSelection) return;

  const category = categories.find(c => c.id === categoryId);
  if (!category) return;

  // Hide selection popup visually (but keep pendingSelection)
  selectionPopup.classList.remove('active');

  modalTitle.textContent = editingAnnotationId ? 'Edit Annotation' : 'Add Annotation';
  selectedTextPreview.textContent = pendingSelection.selectedText;
  categoryBadge.textContent = category.name;
  categoryBadge.style.backgroundColor = category.color;
  categorySelect.value = categoryId;
  commentInput.value = '';

  if (editingAnnotationId) {
    const annotation = annotationManager.getAnnotation(editingAnnotationId);
    if (annotation) {
      commentInput.value = annotation.comment || '';
    }
  }

  annotationModal.classList.add('active');
  commentInput.focus();
}

function hideAnnotationModal() {
  annotationModal.classList.remove('active');
  hideSelectionPopup();
  editingAnnotationId = null;
}

async function saveAnnotation() {
  console.log('saveAnnotation called');
  console.log('editingAnnotationId:', editingAnnotationId);
  console.log('pendingSelection:', pendingSelection);

  try {
    if (editingAnnotationId) {
      // Update existing
      console.log('Updating existing annotation:', editingAnnotationId);
      await annotationManager.updateAnnotation(editingAnnotationId, {
        categoryId: parseInt(categorySelect.value, 10),
        comment: commentInput.value.trim()
      });
    } else if (pendingSelection) {
      // Create new
      console.log('Creating new annotation with:', {
        categoryId: parseInt(categorySelect.value, 10),
        pageNumber: pendingSelection.pageNumber,
        selectedText: pendingSelection.selectedText,
        comment: commentInput.value.trim(),
        highlightRects: pendingSelection.rects
      });
      const result = await annotationManager.createAnnotation({
        categoryId: parseInt(categorySelect.value, 10),
        pageNumber: pendingSelection.pageNumber,
        selectedText: pendingSelection.selectedText,
        comment: commentInput.value.trim(),
        highlightRects: pendingSelection.rects
      });
      console.log('Annotation created:', result);
    } else {
      console.log('No editingAnnotationId or pendingSelection - nothing to save');
    }
  } catch (error) {
    console.error('Error saving annotation:', error);
    showToast('Failed to save annotation: ' + error.message, 'error');
    return;
  }

  hideAnnotationModal();
}

function scrollToAnnotationCard(annotationId) {
  // Remove active from all cards
  annotationList.querySelectorAll('annotation-card').forEach(card => {
    card.setActive(false);
  });

  // Find and activate the target card
  const targetCard = annotationList.querySelector(`[annotation-id="${annotationId}"]`);
  if (targetCard) {
    targetCard.setActive(true);
    targetCard.flash();
    // Scroll the card into view
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function scrollToHighlight(annotationId) {
  pdfViewer.highlightAnnotation(annotationId);
}

function showContextMenu(annotation, x, y) {
  contextMenu.classList.remove('hidden');
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.dataset.annotationId = annotation.id;

  // Ensure menu is within viewport
  const rect = contextMenu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${x - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${y - rect.height}px`;
  }
}

function hideContextMenu() {
  contextMenu.classList.add('hidden');
  categoryMenu.classList.add('hidden');
}

function showCategoryMenu(x, y) {
  categoryMenu.classList.remove('hidden');
  categoryMenu.style.left = `${x}px`;
  categoryMenu.style.top = `${y}px`;
}

async function handleContextMenuAction(action, annotationId) {
  hideContextMenu();

  const annotation = annotationManager.getAnnotation(annotationId);
  if (!annotation) return;

  switch (action) {
    case 'edit':
      editingAnnotationId = annotationId;
      pendingSelection = {
        selectedText: annotation.selected_text,
        rects: annotation.highlight_rects,
        pageNumber: annotation.page_number
      };
      showAnnotationModal(annotation.category_id);
      break;

    case 'change-category':
      const rect = contextMenu.getBoundingClientRect();
      showCategoryMenu(rect.right + 5, rect.top);
      categoryMenu.dataset.annotationId = annotationId;
      break;

    case 'delete':
      if (confirm('Delete this annotation?')) {
        await annotationManager.deleteAnnotation(annotationId);
      }
      break;
  }
}

async function changeCategoryFromMenu(categoryId, annotationId) {
  hideContextMenu();
  await annotationManager.updateAnnotation(annotationId, { categoryId });
}

// Export functions
function toggleExportMenu() {
  exportMenu.classList.toggle('active');
}

async function exportAnnotations(format) {
  exportMenu.classList.remove('active');

  try {
    let content, defaultName, filters;

    if (format === 'json') {
      content = await annotationManager.exportAsJSON();
      defaultName = `${pdfData.name.replace('.pdf', '')}_annotations.json`;
      filters = [{ name: 'JSON Files', extensions: ['json'] }];
    } else {
      content = await annotationManager.exportAsCSV();
      defaultName = `${pdfData.name.replace('.pdf', '')}_annotations.csv`;
      filters = [{ name: 'CSV Files', extensions: ['csv'] }];
    }

    const result = await window.api.saveFile({ defaultName, filters, content });

    if (result.success) {
      showToast(`Exported to ${result.filePath}`, 'success');
    } else if (!result.canceled) {
      showToast('Export failed', 'error');
    }
  } catch (error) {
    console.error('Export error:', error);
    showToast('Export failed', 'error');
  }
}

// Check if LLM is configured (API key set)
async function checkLLMReady() {
  const apiKey = await window.api.getSetting('llm_api_key');
  if (apiKey) {
    btnGenerateReview.disabled = false;
    btnGenerateReview.removeAttribute('data-tooltip');
  } else {
    btnGenerateReview.disabled = true;
    btnGenerateReview.setAttribute('data-tooltip', 'API key required — configure in Settings');
  }
}

// Generate review using LLM
async function generateReview() {
  const annotations = annotationManager.annotations;
  if (annotations.length === 0) {
    showToast('No annotations to review', 'error');
    return;
  }

  // Set loading state
  btnGenerateReview.disabled = true;
  btnGenerateReview.querySelector('.generate-review-icon').style.display = 'none';
  btnGenerateReview.querySelector('.generate-review-spinner').style.display = 'flex';
  btnGenerateReview.querySelector('.generate-review-label').textContent = 'Generating...';

  try {
    const apiKey = await window.api.getSetting('llm_api_key');
    const provider = await window.api.getSetting('llm_provider') || 'google';
    const model = await window.api.getSetting('llm_model') || '';
    const temperature = parseFloat(await window.api.getSetting('llm_temperature') || '0.7');
    const prompt = await window.api.getSetting('llm_prompt') || undefined;

    const llmProvider = createLLMProvider(provider, { apiKey, model, temperature, prompt });
    const reviewText = await llmProvider.generateReview(annotations, pdfData.name);

    // Save as .txt file
    const defaultName = `${pdfData.name.replace('.pdf', '')}-review.txt`;
    const result = await window.api.saveFile({
      defaultName,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
      content: reviewText
    });

    if (result.success) {
      showToast('Review generated and saved', 'success');
    } else if (!result.canceled) {
      showToast('Failed to save review file', 'error');
    }
  } catch (error) {
    console.error('Generate review error:', error);
    showToast('Review generation failed: ' + error.message, 'error');
  } finally {
    // Reset button state
    btnGenerateReview.querySelector('.generate-review-icon').style.display = '';
    btnGenerateReview.querySelector('.generate-review-spinner').style.display = 'none';
    btnGenerateReview.querySelector('.generate-review-label').textContent = 'Generate Review';
    await checkLLMReady();
  }
}

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  toastContainer.appendChild(toast);

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => toast.remove());

  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 4000);
}

// Event Listeners
function setupEventListeners() {
  // Navigation
  btnBack.addEventListener('click', () => window.api.navigateToHome());

  // Zoom controls
  btnZoomIn.addEventListener('click', async () => {
    await pdfViewer.zoomIn();
    updateZoomSelect();
  });

  btnZoomOut.addEventListener('click', async () => {
    await pdfViewer.zoomOut();
    updateZoomSelect();
  });

  zoomSelect.addEventListener('change', async (e) => {
    const value = e.target.value;
    await pdfViewer.setScale(value === 'fit-width' ? value : parseFloat(value));
  });

  // Dual page mode
  const btnDualPage = document.getElementById('btn-dual-page');
  btnDualPage.addEventListener('click', () => {
    btnDualPage.classList.toggle('active');
    pdfViewer.setDualPageMode(btnDualPage.classList.contains('active'));
  });

  // Highlight mode
  btnHighlight.addEventListener('click', toggleHighlightMode);

  // Sort
  sortSelect.addEventListener('change', (e) => {
    annotationManager.setSortBy(e.target.value);
  });

  // Generate Review
  btnGenerateReview.addEventListener('click', generateReview);

  // Export
  btnExport.addEventListener('click', toggleExportMenu);

  exportMenu.querySelectorAll('.export-menu-item').forEach(item => {
    item.addEventListener('click', () => {
      exportAnnotations(item.dataset.format);
    });
  });

  // Category buttons in selection popup
  categoryButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (btn) {
      const categoryId = parseInt(btn.dataset.categoryId, 10);
      // Show modal first, then hide popup
      // (hideSelectionPopup clears pendingSelection, so call it after)
      showAnnotationModal(categoryId);
    }
  });

  // Category filters
  categoryFilters.addEventListener('filter-change', (e) => {
    const { categoryId, active } = e.detail;
    const clickedFilter = categoryFilters.querySelector(`[category-id="${categoryId}"]`);

    if (categoryId === 0) {
      // "All" filter - clear all filters
      annotationManager.clearFilters();
      categoryFilters.querySelectorAll('category-filter').forEach(filter => {
        const id = parseInt(filter.getAttribute('category-id'), 10);
        if (id === 0) {
          filter.setAttribute('active', '');
        } else {
          filter.removeAttribute('active');
        }
      });
    } else {
      // Category filter - toggle it
      annotationManager.toggleFilter(categoryId);

      // Sync the component's active state with the actual filter state
      const isActive = annotationManager.activeFilters.has(categoryId);
      if (isActive) {
        clickedFilter.setAttribute('active', '');
      } else {
        clickedFilter.removeAttribute('active');
      }

      // Update "All" filter state
      const allFilter = categoryFilters.querySelector('[category-id="0"]');
      if (allFilter) {
        if (annotationManager.activeFilters.size === 0) {
          allFilter.setAttribute('active', '');
        } else {
          allFilter.removeAttribute('active');
        }
      }
    }
  });

  // Annotation modal
  modalClose.addEventListener('click', hideAnnotationModal);
  modalCancel.addEventListener('click', hideAnnotationModal);
  modalSave.addEventListener('click', saveAnnotation);

  annotationModal.addEventListener('click', (e) => {
    if (e.target === annotationModal) hideAnnotationModal();
  });

  categorySelect.addEventListener('change', () => {
    const category = categories.find(c => c.id === parseInt(categorySelect.value, 10));
    if (category) {
      categoryBadge.textContent = category.name;
      categoryBadge.style.backgroundColor = category.color;
    }
  });

  // Annotation card events
  document.addEventListener('annotation-click', (e) => {
    const { id } = e.detail;
    scrollToHighlight(id);
  });

  document.addEventListener('annotation-edit', (e) => {
    const { id } = e.detail;
    const annotation = annotationManager.getAnnotation(id);
    if (annotation) {
      editingAnnotationId = id;
      pendingSelection = {
        selectedText: annotation.selected_text,
        rects: annotation.highlight_rects,
        pageNumber: annotation.page_number
      };
      showAnnotationModal(annotation.category_id);
    }
  });

  document.addEventListener('annotation-delete', async (e) => {
    const { id } = e.detail;
    if (confirm('Delete this annotation?')) {
      await annotationManager.deleteAnnotation(id);
    }
  });

  // Context menu
  contextMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.context-menu-item');
    if (item) {
      const action = item.dataset.action;
      const annotationId = contextMenu.dataset.annotationId;
      handleContextMenuAction(action, annotationId);
    }
  });

  categoryMenu.addEventListener('click', (e) => {
    const item = e.target.closest('.context-menu-item');
    if (item) {
      const categoryId = parseInt(item.dataset.categoryId, 10);
      const annotationId = categoryMenu.dataset.annotationId;
      changeCategoryFromMenu(categoryId, annotationId);
    }
  });

  // Close menus on outside click
  document.addEventListener('click', (e) => {
    // Ignore clicks within the search panel
    const searchPanel = document.getElementById('search-panel');
    if (searchPanel && searchPanel.contains(e.target)) {
      return;
    }

    if (!contextMenu.contains(e.target) && !categoryMenu.contains(e.target)) {
      hideContextMenu();
    }
    if (!btnExport.contains(e.target) && !exportMenu.contains(e.target)) {
      exportMenu.classList.remove('active');
    }
    // Close selection popup when clicking outside of it
    // Skip if popup was just shown this frame (selection mouseup + click fire together)
    if (!popupJustShown &&
        !selectionPopup.contains(e.target) &&
        !annotationModal.contains(e.target)) {
      hideSelectionPopup();
    }
  });

  // Webview navigation controls
  if (btnWebviewBack && searchWebview) {
    btnWebviewBack.addEventListener('click', () => {
      if (searchWebview.canGoBack()) {
        searchWebview.goBack();
      }
    });
  }

  if (btnWebviewForward && searchWebview) {
    btnWebviewForward.addEventListener('click', () => {
      if (searchWebview.canGoForward()) {
        searchWebview.goForward();
      }
    });
  }

  if (btnWebviewReload && searchWebview) {
    btnWebviewReload.addEventListener('click', () => {
      searchWebview.reload();
    });
  }

  // URL bar navigation
  if (webviewUrlBar && searchWebview) {
    webviewUrlBar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        let input = webviewUrlBar.value.trim();
        if (!input) return;

        let url;

        // Check if input is a URL or a search query
        if (input.match(/^[a-zA-Z]+:\/\//)) {
          // Already has protocol (http://, https://, etc.)
          url = input;
        } else if (input.includes(' ') || !input.includes('.')) {
          // Contains spaces or no dots -> treat as search query
          url = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
        } else if (input.match(/^[\w-]+(\.[\w-]+)+/)) {
          // Looks like a domain (word.word pattern) -> treat as URL
          url = 'https://' + input;
        } else {
          // Default to search
          url = `https://www.google.com/search?q=${encodeURIComponent(input)}`;
        }

        searchWebview.src = url;
        webviewUrlBar.blur();
      }
    });
  }

  // Update navigation button states and URL bar based on webview navigation
  if (searchWebview) {
    const updateNavigationState = () => {
      if (btnWebviewBack) {
        btnWebviewBack.disabled = !searchWebview.canGoBack();
      }
      if (btnWebviewForward) {
        btnWebviewForward.disabled = !searchWebview.canGoForward();
      }
      if (webviewUrlBar) {
        webviewUrlBar.value = searchWebview.getURL();
      }
    };

    searchWebview.addEventListener('did-navigate', updateNavigationState);
    searchWebview.addEventListener('did-navigate-in-page', updateNavigationState);

    // Initial state update after webview loads
    searchWebview.addEventListener('dom-ready', updateNavigationState);
  }
}

function updateZoomSelect() {
  const scale = pdfViewer.getScale();

  // Find the closest matching option
  const options = Array.from(zoomSelect.options).filter(opt => opt.value !== 'fit-width');
  let closestOption = options[0];
  let closestDiff = Math.abs(parseFloat(options[0].value) - scale);

  for (const option of options) {
    const diff = Math.abs(parseFloat(option.value) - scale);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestOption = option;
    }
  }

  if (closestOption && closestDiff < 0.1) {
    zoomSelect.value = closestOption.value;
  }
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in input fields
    if (e.target.matches('input, textarea, select')) {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    // Ctrl+O: Go back to home (open new PDF)
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      window.api.navigateToHome();
    }

    // Ctrl+F: Focus PDF search (built-in)
    // Let default behavior happen

    // D: Toggle dual page mode
    if (e.key === 'd' || e.key === 'D') {
      e.preventDefault();
      const btnDualPage = document.getElementById('btn-dual-page');
      btnDualPage.click();
    }

    // H: Toggle highlight mode
    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      toggleHighlightMode();
    }

    // Escape: Close modal/deselect
    if (e.key === 'Escape') {
      if (annotationModal.classList.contains('active')) {
        hideAnnotationModal();
      } else if (selectionPopup.classList.contains('active')) {
        hideSelectionPopup();
      } else if (!contextMenu.classList.contains('hidden')) {
        hideContextMenu();
      }
    }

    // Ctrl+[: Collapse PDF panel
    if ((e.ctrlKey || e.metaKey) && e.key === '[') {
      e.preventDefault();
      resizablePanels.togglePdf();
    }

    // Ctrl+]: Collapse annotation panel
    if ((e.ctrlKey || e.metaKey) && e.key === ']') {
      e.preventDefault();
      resizablePanels.toggleAnnotations();
    }

    // Ctrl+/: Toggle search panel
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      resizablePanels.toggleSearch();
    }

    // Ctrl+\: Restore all panels
    if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
      e.preventDefault();
      resizablePanels.restorePanels();
    }

    // Ctrl+- / Ctrl+=: Zoom
    if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_')) {
      e.preventDefault();
      pdfViewer.zoomOut().then(updateZoomSelect);
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      pdfViewer.zoomIn().then(updateZoomSelect);
    }
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
