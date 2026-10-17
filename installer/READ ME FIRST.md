# Edith — install or update

The same steps every time.

1. Unzip the download. You get a folder with **Edith.app**, **Install Edith.command**, this file, and **Edith Brand.md**. (Updating? Same steps; the installer replaces the old copy and keeps your settings, history and open tabs.)
2. Double-click **Install Edith.command**.
   - If macOS says it "cannot be opened" or "Apple could not verify…": click **Done**, open **System Settings → Privacy & Security**, scroll down, click **Open Anyway**, then double-click it again.
   - Or skip the warning: open **Terminal**, type `bash ` (with a space), drag the installer file into the Terminal window, press Return.
3. A Terminal window reports "Installed to: /Applications/Edith.app" and Edith opens. Close that Terminal window.
4. Keep it in the Dock: right-click Edith's Dock icon → **Options → Keep in Dock**.
5. Delete the download: the zip and the unzipped folder. Edith lives in your Applications folder; your settings, history and open tabs carry over.

## Where things live
- Your documents: wherever you save them. Autosave writes into that same file; there is no separate autosave file.
- Images you paste: a folder named `<your file>-images` next to the document.
- Settings, version history, recent files, open tabs: `~/Library/Application Support/Edith` (Help → Show Data Folder in Finder).
- Notes attached to text: kept by Edith in the same data folder, not inside your .md file, so the file stays clean. To send notes along with a file, use File → Export → Save a .md Copy with Notes.

Requires macOS 13 Ventura or newer on an Apple Silicon Mac (M1 or newer).
