# Windows Build Notes

## Uninstaller Fix

The "Installer integrity check has failed" error has been addressed with the following changes:

### Changes Made:

1. **Updated NSIS Configuration** (`package.json`):
   - Changed `shortcutName` from "PDF Reviewer" to "Reviewer 2"
   - **Changed `perMachine` from `false` to `true`** - This is the critical fix for custom directory installations!
   - Added `artifactName` for consistent naming
   - Added `warningsAsErrors: false` to prevent build issues
   - Removed custom installer script (electron-builder's built-in NSIS handles everything correctly)

**Why this works:**
- `perMachine: true` tells NSIS to use machine-wide installation (HKLM registry)
- This mode properly handles custom installation directories
- Requires admin privileges, but works reliably with any installation path
- Electron-builder's default NSIS configuration is robust and well-tested

### How to Build for Windows:

```bash
npm run build:win
```

The installer will be created in the `dist/` directory.

### Important Notes:

- **Always close the application completely before uninstalling**
- The app name has been changed from "PDF Reviewer" to "Reviewer 2"
- If upgrading from an old version, uninstall the old version first
- **Installer now uses per-machine installation (`perMachine: true`)** - This requires admin privileges but works much better with custom installation directories
- Default installation path: `C:\Program Files\Reviewer 2\`
- Custom installation paths are fully supported and the uninstaller will find the correct location
- The uninstaller is always located in the installation directory: `<install_dir>\Uninstall Reviewer 2.exe`

### Common Uninstall Issues:

1. **"Installer integrity check has failed" during installation**
   - **Cause**: Corrupted download or antivirus interference
   - **Solution**:
     - Re-download the installer
     - Temporarily disable antivirus during installation
     - Run installer as Administrator

2. **"Installer integrity check has failed" during uninstallation**
   - **Cause**: Application is still running
   - **Solution**:
     - Close all Reviewer 2 windows
     - Check Task Manager for `Reviewer2.exe` and end the process
     - Run the uninstaller as Administrator
     - This should now be fixed with per-machine installation mode

3. **Issues with custom installation directory (OLD builds)**
   - **Cause**: Old builds used `perMachine: false` which conflicts with custom directories
   - **Solution**: The new build uses `perMachine: true` - this is fully fixed!
   - For old installations: Manually delete the folder and registry keys, then reinstall with new build

3. **App not appearing in "Add/Remove Programs"**
   - **Solution**: Check both `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall` and `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall` in registry
   - Look for the `InstallLocation` value to find where the app is installed
   - Use the manual uninstaller at that location

4. **Permission errors**
   - **Solution**: Run the uninstaller as Administrator (right-click → Run as Administrator)
   - The new build requires admin privileges for both install and uninstall

### Testing Checklist:

Before releasing a Windows build, test:
- [ ] Fresh installation works
- [ ] App launches correctly after installation
- [ ] Desktop shortcut is created
- [ ] Start menu shortcut is created
- [ ] Uninstaller appears in "Add/Remove Programs"
- [ ] Uninstaller works when app is closed
- [ ] App can be reinstalled after uninstalling

### For Future Updates:

When building new versions:
1. Update the version number in `package.json`
2. Build with `npm run build:win`
3. Test installation on a clean Windows machine
4. Test uninstallation before distributing
