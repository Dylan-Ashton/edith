## 3.7.5
- New on the website: try Edith in your browser before you install it.
- Fixed: closing a long document right after switching between Write and Markdown could leave Edith finishing work for a tab that was already closed.
- Fixed: Close Tab (⌘W) on Home with no documents open caused an error. It now does nothing.

## 3.7.4
- Remove a document from Recent: hover over its card on Home (or move to it with Tab) and click the **×**. It also leaves File → Open Recent. The file itself is not touched.
- Opening a recent document from Home now fades the page in, briefly. With Reduce Motion on, it appears at once.
- Switching from Markdown back to Write is faster on long documents, up to about three times faster on very long ones.
- The first switch to each theme no longer makes the page jump. Edith now loads every theme's fonts in the background after it starts.
- Fixed: tabs showed no highlight when you pointed at them, especially on Home. They do now, in every theme.
- Fixed: in a window of the usual size, **Wide** and **Full window** page widths looked the same. **Wide** now sits between Comfortable and Full window.
- Fixed: choosing a text size such as 115% showed 113% in the status bar. It now shows the size you chose.
- The download no longer includes the brand sheet (Edith Brand.md). It stays with the source code on GitHub.

## 3.7.3
- Edith is now free and open source, under the MIT license. The code is on GitHub.
- New: Help → **Report a Problem…** opens a bug report with your Edith and macOS versions filled in.
- Edith 3.7.3 needs macOS 13 Ventura or later. It is built on a current version of Electron, which gets security fixes again.
- Fonts are built in. Edith no longer loads them from Google, so it looks the same offline, and its only network request is the check for a newer version.
- Images linked from the web are not loaded, so Edith never contacts other sites. Images stored on your Mac are shown. A picture from the web shows its description in a quiet box instead of a broken image, on screen and in print.
- Fixed: pictures stored beside a document, like the ones you paste in, now show inside Edith. The Markdown keeps the same paths.
- Safer with files from anywhere. A link in a document can no longer open a page inside Edith or start another app: web and email links open in your browser or mail app, and anything else is ignored. Edith only reads and writes files you opened, saved or dropped on it yourself.
- PDF import uses a newer pdf.js with a security fix.
- The installer only replaces Edith.app. It no longer touches apps named "Markdown Editor" or their data.
- Corrected the install notes: notes are kept by Edith, not inside your .md file.
- Fixed: after adding a note in Markdown mode and switching to Write mode, ⌘Z removed the note instead of undoing your latest edit.

## 3.7.2
- Fixed: clicking Write while already in Write (or Markdown while in Markdown, or Shift+Cmd+1/2) no longer makes the page jump and flicker.

## 3.7.1
- Fixed: switching between Write and Markdown no longer flickers. The Markdown preview stays where you were reading instead of jumping to the cursor, and the page no longer blinks as it comes back.
- Changed: the Markdown view is centered when the sidebar is closed, like the Write view.

## 3.7.0
- Undo now covers notes. Add, delete or resolve a note, press **⌘Z**, and the note comes back (redo: **⇧⌘Z**). Notes and text undo in the order you did them, like Google Docs, so undoing a deleted note no longer rewinds your text.
- Notes no longer need sorting. The Change / Ask / Keep choice is tucked behind **Mark as a question or keep-as-is** in the note box, and most notes need nothing. The prompt Edith builds now asks the AI to use its own judgement on each note (answer questions first, make clear edits, leave alone what works) instead of locking each one in.
- "Copy notes for Claude" is now **Copy as prompt**, because it works in any AI chat. It is a small button beside Page order / Latest, and also under File → Export → **Copy notes as a prompt** (⇧⌘R). The **Beside the page** switch moved to the bottom of the Notes list. Other mentions of Claude in the app now say "an AI chat".
- Fixed: switching between Write and Markdown no longer flickers or stutters.
- Fixed: the indent buttons showed on the Home page.

## 3.6.0
- Notes can now say what they are. When you add a note, mark it **Change** (an edit you want), **Ask** (a question you want Claude's own expert assessment of before anything changes) or **Keep** (a passage that works and should be left alone). Edith suggests Ask when your note reads like a question. **Copy notes for Claude** (⇧⌘R) groups them that way, so a question is never sent as an instruction to revise.
- Notes beside the page: switch on **Beside the page** at the top of the Notes panel (or View → Show Notes Beside the Page) to see each note next to the passage it points to. Off by default; the list in the sidebar stays either way.
- The Notes list is now in page order (top to bottom), with resolved notes at the bottom.
- Notes inside notes: a note on one word and another on the whole paragraph can both be clicked now.
- Fixed: a note across several paragraphs now highlights all of them, not just a few words.
- Notes no longer live inside your .md files. Edith keeps them itself (with plain-text backups in its data folder), so files stay clean wherever you send them. Notes from older files are moved over automatically and the file is cleaned on its next save. Notes follow a file if you rename or move it. **Save a .md copy with notes** is there if you ever want them in a file.
- Deleted notes wait under **Recently deleted** (90 days) with a Restore button.
- The Notes list can be sorted by **Page order** or **Latest**.
- Fixed: Undo while typing a note undid the document instead of the note.
- Rich Text (.rtf) files open, like Word and PDF.
- Indent: **⌘]** and **⌘[** (and two toolbar buttons) indent and outdent. Shift-Tab also pulls a paragraph that got stuck inside a bullet back out. Pasting several lines into a bullet now makes one bullet per line.
- Your place on the page is kept when you switch between Write and Markdown, change the text size or page width, hide the sidebar, or switch tabs.
- Fixed: closing Find now leaves you at the match you found instead of jumping back to where you started.
- Fixed: the Save button flickered on every letter typed into a note (typing rewrote the word count behind the window).
- Gentle feedback: the Save and Copy Markdown buttons confirm with a quick "Saved ✓", dialogs fade out, new notes slide in, messages fade. Hover highlights added to the Outline / Notes / History tabs, note cards, the Add note bubble and more. All off with macOS Reduce Motion.
- Check for Updates now always tells you the result (up to date, new version, or why it could not check), and notes what it is doing while it checks.

## 3.5.0
- Copy notes as a revision prompt: add notes to the passages you want changed, then click **Copy as revision prompt** at the top of the Notes panel (⇧⌘R, or File → Export). Every open note goes into one message, each with the passage it points at and the section it sits under, ready to paste into Claude.
- Paste from clipboard: on Home (or File → New Scratch from Clipboard, ⇧⌘N), Edith opens whatever you copied as a scratch document. Edit it, then click **Copy Markdown**. A scratch document never asks to be saved; use Save As if you want to keep it.
- Fixed: selecting text on Home no longer offers to add a note.
- Fixed: a note's highlight no longer disappears when you edit the passage it points at (it now follows the start and end of the original text), and notes made in Markdown mode highlight in Write mode.
- Fixed: Replace all can now be undone with a single ⌘Z.
- Fixed: the window no longer opens off-screen if its last monitor is unplugged.
- Edith now tells you if it can't keep a recovery copy of a very large unsaved document.

## 3.4.1
- Find & replace: typing in the search box no longer edits your document; matches are highlighted while you keep typing, and Enter steps to the next match.
- Opening Home now closes the find bar.
- Tabs with unsaved changes no longer disappear or sit out of line; tabs also lift slightly and shade when you hover over them.
- You can drag the window by any empty part of the top bar, including beside the tabs.
- Edith checks for new versions when it opens (and under Edith → Check for Updates…). It tells you; it never installs by itself.

## 3.4
- Home is always one click away: the house button beside the tabs (⇧⌘H). Logo and greeting centred; recent documents as preview cards.
- Open does everything: Markdown, text, Word and PDF. The separate Import option is gone.
- Open Recent is a proper submenu in the File menu.
- Toolbar icons redrawn (bold, italic, strikethrough, code, headings, divider).
- Subtle motion: menus and dialogs fade in, highlights pulse; off when macOS Reduce Motion is on. Themed scrollbars.

## 3.3
- New home screen when no tabs are open: the boat, a greeting, and recent documents as cards with a preview of their first lines.
- Tabs moved up beside the window controls, Safari-style; the toolbar belongs to the document now. Double-click a tab to rename.
- One File menu in the app (the toolbar one only appears in the browser version).
- The search icon toggles the find bar.
- Clicking a note scrolls smoothly to its text and pulses the highlight.
- Theme menu layout fixed.

## 3.2
- Checklists now show checkboxes (a styling bug made them look like bullets).
- The page uses more of the window, and the scrollbar sits at the window edge. Choose Comfortable, Wide or Full-window page width from the zoom control.
- The zoom control in the bottom-right is now a menu: −/+, presets, and page width.
- Clicking anywhere on a note card scrolls to its text.
- Start page when no tabs are open: new, open, import, recent files.
- Focus mode (⇧⌘F) hides everything but the page.
- Edith notices when a file was changed by another app and asks before overwriting it.
- Pasted or dropped images are saved as files next to your document instead of being embedded.
- Files that begin with a `---` front-matter block keep it intact.
- Word count shows the selection when text is selected.
- Saving no longer makes the Downloads stack in the Dock flicker.
- Menus no longer wrap awkwardly.

## 3.1
- Paper-boat icon and parchment palette; Dusk theme.
- Much better PDF import for textbooks and reports: numbered headings, bold headings, two-column pages, running headers removed.
- Version history uses a metadata index, so large histories stay fast; total-size cap with automatic pruning.

## 3.0
- Edith. Tabs, smart paste from Claude/ChatGPT, copy as formatted text, responsive toolbar, reset layout, version viewer with full text, zoom as a percentage.
