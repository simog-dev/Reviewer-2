import '../components/pdf-card.js';
import { debounce } from './utils.js';
import * as pdfjsLib from '../../node_modules/pdfjs-dist/build/pdf.min.mjs';

// Initialize PDF.js worker
const basePath = new URL('..', window.location.href).href;
const workerSrc = `${basePath}node_modules/pdfjs-dist/build/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Constants
const ITEMS_PER_PAGE = 5;

// State
let allPDFs = [];
let filteredPDFs = [];
let currentPage = 1;
let searchQuery = '';
let deleteTargetId = null;

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const pdfGrid = document.getElementById('pdf-grid');
const pagination = document.getElementById('pagination');
const paginationInfo = document.getElementById('pagination-info');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const searchInput = document.getElementById('search-input');
const dropZone = document.getElementById('drop-zone');
const btnAddPdf = document.getElementById('btn-add-pdf');
const btnAddPdfEmpty = document.getElementById('btn-add-pdf-empty');
const btnSettings = document.getElementById('btn-settings');
const toastContainer = document.getElementById('toast-container');

// Delete Modal Elements
const deleteModal = document.getElementById('delete-modal');
const deleteModalClose = document.getElementById('delete-modal-close');
const deleteModalCancel = document.getElementById('delete-modal-cancel');
const deleteModalConfirm = document.getElementById('delete-modal-confirm');
const deletePdfName = document.getElementById('delete-pdf-name');
const deleteAnnotationsCheckbox = document.getElementById('delete-annotations-checkbox');

// Initialize
async function init() {
  await loadPDFs();
  setupEventListeners();
  setupKeyboardShortcuts();
}

// Load PDFs from database
async function loadPDFs() {
  showLoading();
  try {
    allPDFs = await window.api.getAllPDFs();
    filterAndRender();
  } catch (error) {
    console.error('Error loading PDFs:', error);
    showToast('Failed to load PDFs', 'error');
  }
}

// Filter and render PDFs
function filterAndRender() {
  // Apply search filter
  if (searchQuery) {
    filteredPDFs = allPDFs.filter(pdf =>
      pdf.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  } else {
    filteredPDFs = [...allPDFs];
  }

  // Calculate pagination
  const totalPages = Math.ceil(filteredPDFs.length / ITEMS_PER_PAGE);
  currentPage = Math.min(currentPage, Math.max(1, totalPages));

  // Get current page items
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filteredPDFs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Update UI
  hideLoading();

  if (filteredPDFs.length === 0) {
    if (searchQuery) {
      showEmpty('No PDFs match your search');
    } else {
      showEmpty();
    }
  } else {
    renderPDFs(pageItems);
    updatePagination(totalPages);
  }
}

// Render PDF cards
function renderPDFs(pdfs) {
  emptyState.classList.add('hidden');
  pdfGrid.classList.remove('hidden');

  pdfGrid.innerHTML = pdfs.map(pdf => `
    <pdf-card
      pdf-id="${pdf.id}"
      name="${escapeAttr(pdf.name)}"
      path="${escapeAttr(pdf.path)}"
      page-count="${pdf.page_count || 0}"
      annotation-count="${pdf.annotation_count || 0}"
      updated-at="${pdf.updated_at}"
    ></pdf-card>
  `).join('');
}

// Update pagination controls
function updatePagination(totalPages) {
  if (totalPages <= 1) {
    pagination.classList.add('hidden');
    return;
  }

  pagination.classList.remove('hidden');
  paginationInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  btnPrev.disabled = currentPage === 1;
  btnNext.disabled = currentPage === totalPages;
}

// Show/Hide states
function showLoading() {
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  pdfGrid.classList.add('hidden');
  pagination.classList.add('hidden');
}

function hideLoading() {
  loadingState.classList.add('hidden');
}

function showEmpty(message) {
  emptyState.classList.remove('hidden');
  pdfGrid.classList.add('hidden');
  pagination.classList.add('hidden');

  const titleEl = emptyState.querySelector('.empty-state-title');
  const textEl = emptyState.querySelector('.empty-state-text');

  if (message) {
    titleEl.textContent = message;
    textEl.textContent = 'Try adjusting your search or add a new PDF.';
  } else {
    titleEl.textContent = 'No PDFs yet';
    textEl.textContent = 'Drag and drop a PDF file here, or click the "Add PDF" button to get started.';
  }
}

// Add PDF handler
async function handleAddPDF() {
  try {
    const filePath = await window.api.openPDFDialog();
    if (!filePath) return;

    await addPDFFromPath(filePath);
  } catch (error) {
    console.error('Error adding PDF:', error);
    showToast('Failed to add PDF', 'error');
  }
}

// Add PDF from file path
async function addPDFFromPath(filePath) {
  try {
    // Get metadata
    const metadata = await window.api.getPDFMetadata(filePath);

    // Read PDF to get page count
    const pdfData = await window.api.readPDFFile(filePath);
    const pageCount = await getPDFPageCount(pdfData);

    // Save to database
    const pdf = await window.api.addPDF({
      name: metadata.name,
      path: filePath,
      pageCount: pageCount
    });

    // Update local state and re-render
    const existingIndex = allPDFs.findIndex(p => p.id === pdf.id);
    if (existingIndex >= 0) {
      allPDFs[existingIndex] = pdf;
      showToast('PDF already exists, opening...', 'success');
    } else {
      allPDFs.unshift(pdf);
      showToast('PDF added successfully', 'success');
    }

    filterAndRender();

    // Navigate to review page
    await window.api.navigateToReview(pdf.id);
  } catch (error) {
    console.error('Error adding PDF:', error);
    throw error;
  }
}

// Get PDF page count using PDF.js
async function getPDFPageCount(data) {
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

  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

// Delete PDF handler
function handleDeletePDF(id, name) {
  deleteTargetId = id;
  deletePdfName.textContent = name;
  deleteAnnotationsCheckbox.checked = true;
  deleteModal.classList.add('active');
}

async function confirmDelete() {
  if (!deleteTargetId) return;

  try {
    const deleteAnnotations = deleteAnnotationsCheckbox.checked;
    await window.api.deletePDF(deleteTargetId, deleteAnnotations);

    // Update local state
    allPDFs = allPDFs.filter(pdf => pdf.id !== deleteTargetId);

    closeDeleteModal();
    filterAndRender();
    showToast('PDF removed successfully', 'success');
  } catch (error) {
    console.error('Error deleting PDF:', error);
    showToast('Failed to remove PDF', 'error');
  }
}

function closeDeleteModal() {
  deleteModal.classList.remove('active');
  deleteTargetId = null;
}

// Drag and drop handlers
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');
}

async function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove('drag-over');

  const files = Array.from(e.dataTransfer.files);
  const pdfFiles = files.filter(file => file.type === 'application/pdf' || file.name.endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    showToast('Please drop a PDF file', 'warning');
    return;
  }

  const file = pdfFiles[0];

  // If file.path is available (non-sandboxed), use it directly
  if (file.path) {
    try {
      await addPDFFromPath(file.path);
      return;
    } catch (error) {
      console.error('Error adding PDF from path:', error);
      showToast('Failed to add PDF: ' + error.message, 'error');
      return;
    }
  }

  // Otherwise read file data via FileReader and send to main process
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    // Save file to app storage via main process, get back the path
    const savedPath = await window.api.addPDFFromData(file.name, data);
    await addPDFFromPath(savedPath);
  } catch (error) {
    console.error('Error adding dropped PDF:', error);
    showToast('Failed to add PDF: ' + error.message, 'error');
  }
}

// Search handler
const handleSearch = debounce((query) => {
  searchQuery = query;
  currentPage = 1;
  filterAndRender();
}, 300);

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
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

  // Auto remove after 4 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 4000);
}

// Utility: Escape HTML attributes
function escapeAttr(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Event Listeners
function setupEventListeners() {
  // Settings button
  btnSettings.addEventListener('click', () => window.api.navigateToSettings());

  // Add PDF buttons
  btnAddPdf.addEventListener('click', handleAddPDF);
  btnAddPdfEmpty.addEventListener('click', handleAddPDF);

  // Search
  searchInput.addEventListener('input', (e) => handleSearch(e.target.value));

  // Pagination
  btnPrev.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      filterAndRender();
    }
  });

  btnNext.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredPDFs.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
      currentPage++;
      filterAndRender();
    }
  });

  // Drag and drop
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('dragleave', handleDragLeave);
  dropZone.addEventListener('drop', handleDrop);

  // Delete modal
  deleteModalClose.addEventListener('click', closeDeleteModal);
  deleteModalCancel.addEventListener('click', closeDeleteModal);
  deleteModalConfirm.addEventListener('click', confirmDelete);
  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  // PDF card events (delegated)
  document.addEventListener('pdf-open', async (e) => {
    const { id } = e.detail;
    await window.api.navigateToReview(id);
  });

  document.addEventListener('pdf-delete', (e) => {
    const { id, name } = e.detail;
    handleDeletePDF(id, name);
  });
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+O: Open PDF
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      handleAddPDF();
    }

    // Escape: Close modal
    if (e.key === 'Escape') {
      if (deleteModal.classList.contains('active')) {
        closeDeleteModal();
      }
    }

    // Focus search: Ctrl+F or /
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
