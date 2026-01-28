# Troubleshooting Guide

## PDF Loading Issues

### Issue: "Failed to resolve module specifier 'pdfjs-dist'"

**Cause:** ES modules in Electron's renderer process can't use bare module specifiers.

**Solution:** Fixed by importing pdfjs-dist at the top of the file with proper worker configuration.

### Issue: "No GlobalWorkerOptions.workerSrc specified"

**Cause:** PDF.js v4 requires a worker file to be specified.

**Solution:** Set the worker source to the correct path:
```javascript
const basePath = new URL('..', window.location.href).href;
const workerSrc = `${basePath}node_modules/pdfjs-dist/build/pdf.worker.min.mjs`;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
```

### Issue: PDF displays blank or doesn't load

**Possible causes:**
1. Buffer serialization issue in IPC
2. Incorrect worker path
3. Content Security Policy blocking worker

**Solutions:**
1. Ensure Buffer is converted to Uint8Array in main.js:
   ```javascript
   return new Uint8Array(buffer);
   ```

2. Check browser console for CSP violations

3. Verify worker path is accessible

## Installation Issues

### Issue: better-sqlite3 installation fails

**Solution:**
```bash
npm run rebuild
```

If that doesn't work:
```bash
npm install --force
npm run rebuild
```

### Issue: Electron version mismatch

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run rebuild
```

## Testing Issues

### E2E Tests Fail

**Common causes:**
1. App not building correctly
2. Database path conflicts
3. Playwright not installed

**Solutions:**
```bash
# Install Playwright browsers
npx playwright install

# Clean and reinstall
npm run test:install

# Run tests with debug
npm run test:e2e:headed
```

### Unit Tests Fail

**Check:**
1. Database schema is up to date
2. All dependencies installed correctly
3. SQLite native module compiled

**Run specific tests:**
```bash
npm run test:unit
npm run test:pdf  # Test PDF.js loading
```

## Development Issues

### DevTools not opening

**Solution:** Start with dev flag:
```bash
npm run start:dev
```

### Hot reload not working

**Note:** Electron doesn't support hot reload by default. You need to:
1. Close the app
2. Make your changes
3. Run `npm start` again

### Database locked error

**Cause:** Previous instance still running or didn't close properly.

**Solution:**
1. Quit all Electron instances
2. Delete `~/Library/Application Support/pdf-reviewer/database.sqlite-wal` (macOS)
3. Restart the app

## Build Issues

### Build fails on macOS

**Check:**
1. Xcode Command Line Tools installed:
   ```bash
   xcode-select --install
   ```

2. Proper signing configuration in package.json

### Build fails on Windows

**Check:**
1. Visual Studio Build Tools installed
2. Python installed (required for node-gyp)

### Build fails on Linux

**Check:**
1. Required system libraries:
   ```bash
   sudo apt-get install build-essential libsqlite3-dev
   ```

## Runtime Errors

### "Cannot find module" errors

**Solution:**
1. Check all import paths are correct
2. Ensure files exist
3. Clear cache: `rm -rf ~/.electron`

### CSP violations

**Check** `Content-Security-Policy` meta tags in HTML files allow:
- `script-src 'self' 'unsafe-eval' blob:`
- `worker-src 'self' blob: file:`
- `img-src 'self' data: blob:`

### IPC errors

**Check:**
1. All IPC handlers defined in main.js
2. All API calls in preload.js
3. contextBridge exposes all needed functions

## Performance Issues

### PDF rendering slow

**Solutions:**
1. Reduce initial scale
2. Implement lazy loading for large PDFs
3. Limit rendered pages to visible viewport

### Memory leaks

**Check:**
1. PDF documents are properly destroyed
2. Event listeners are cleaned up
3. No circular references in annotations

## Getting Help

If you encounter issues not listed here:

1. **Check console logs:** Open DevTools with `npm run start:dev`
2. **Run tests:** `npm test` to identify specific failures
3. **Check test results:** `npm run test:report` for detailed HTML report
4. **File an issue:** Include:
   - OS and version
   - Node.js version
   - Error messages from console
   - Steps to reproduce
   - Test results (if applicable)

## Debug Mode

Enable verbose logging:
```javascript
// In main.js, add:
if (process.argv.includes('--debug')) {
  console.log('Debug mode enabled');
  // Add more logging
}
```

Run with:
```bash
electron . --dev --debug
```

## Clean Slate

To start fresh:
```bash
# Remove all generated files
rm -rf node_modules
rm -rf dist
rm -rf tests/e2e-results
rm -rf tests/e2e-report
rm package-lock.json

# Remove user data
rm -rf ~/Library/Application\ Support/pdf-reviewer  # macOS
rm -rf ~/.config/pdf-reviewer                        # Linux
rm -rf %APPDATA%\pdf-reviewer                        # Windows

# Reinstall
npm install
npm run rebuild
npm test
```
