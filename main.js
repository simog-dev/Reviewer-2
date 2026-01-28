const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('./src/database/db');

let mainWindow;
let db;

// Get user data path for database storage
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'database.sqlite');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Initialize database
  db = new Database(dbPath);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (db) {
    db.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers

// PDF Operations
ipcMain.handle('dialog:openPDF', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('pdf:readFile', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    // Convert Buffer to Uint8Array for proper IPC serialization
    return new Uint8Array(buffer);
  } catch (error) {
    console.error('Error reading PDF file:', error);
    throw error;
  }
});

ipcMain.handle('pdf:getMetadata', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    };
  } catch (error) {
    console.error('Error getting PDF metadata:', error);
    throw error;
  }
});

// Database Operations - PDFs
ipcMain.handle('db:addPDF', async (event, pdfData) => {
  return db.addPDF(pdfData);
});

ipcMain.handle('db:getAllPDFs', async () => {
  return db.getAllPDFs();
});

ipcMain.handle('db:getPDF', async (event, id) => {
  return db.getPDF(id);
});

ipcMain.handle('db:updatePDF', async (event, id, data) => {
  return db.updatePDF(id, data);
});

ipcMain.handle('db:deletePDF', async (event, id, deleteAnnotations) => {
  return db.deletePDF(id, deleteAnnotations);
});

ipcMain.handle('db:searchPDFs', async (event, query) => {
  return db.searchPDFs(query);
});

// Database Operations - Annotations
ipcMain.handle('db:addAnnotation', async (event, annotationData) => {
  return db.addAnnotation(annotationData);
});

ipcMain.handle('db:getAnnotationsForPDF', async (event, pdfId) => {
  return db.getAnnotationsForPDF(pdfId);
});

ipcMain.handle('db:getAnnotation', async (event, id) => {
  return db.getAnnotation(id);
});

ipcMain.handle('db:updateAnnotation', async (event, id, data) => {
  return db.updateAnnotation(id, data);
});

ipcMain.handle('db:deleteAnnotation', async (event, id) => {
  return db.deleteAnnotation(id);
});

ipcMain.handle('db:getAnnotationCountByCategory', async (event, pdfId) => {
  return db.getAnnotationCountByCategory(pdfId);
});

// Database Operations - Categories
ipcMain.handle('db:getAllCategories', async () => {
  return db.getAllCategories();
});

ipcMain.handle('db:getCategory', async (event, id) => {
  return db.getCategory(id);
});

// Export Operations
ipcMain.handle('export:saveFile', async (event, { defaultName, filters, content }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: filters
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  try {
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('Error saving file:', error);
    return { success: false, error: error.message };
  }
});

// Settings/Preferences
ipcMain.handle('settings:get', async (event, key) => {
  return db.getSetting(key);
});

ipcMain.handle('settings:set', async (event, key, value) => {
  return db.setSetting(key, value);
});

// Navigation
ipcMain.handle('navigate:review', async (event, pdfId) => {
  mainWindow.loadFile('src/review.html', { query: { id: pdfId } });
});

ipcMain.handle('navigate:home', async () => {
  mainWindow.loadFile('src/index.html');
});
