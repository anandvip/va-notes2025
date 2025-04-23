# Notes Application Features
private notes application no third party library. no cloud storage. just you and your notes. offline tool to make notes, i use it as journaling no **xss** iIndexedDB storage sweet and small application.

## Data & Persistence

- **IndexedDB storage** for both notes and projects, ensuring data persists across sessions.
- **Database versioning** to migrate existing notes into the updated schema.

## Note CRUD

- **Create**, **edit**, and **delete** notes.
- Each note includes a **title** field and a **content** area (contenteditable).
- **Autosave** on input, debounced according to the version control interval.

## Project Management

- **Sidebar** listing all projects.
- Buttons to **Add** and **Delete** projects.
- **Filter** notes by project when a project is selected.
- Deleting a project **removes** all its associated notes.

## Version Control

- **Configurable snapshot interval** (e.g., every 5s, 10s, etc.) via a select dropdown in the sidebar.
- **Version history modal** displaying timestamped snapshots of each note.
- **Preview** and **restore** previous versions; restoring creates a new snapshot.

## Formatting Toolbar

- Toolbar with **bold**, **italic**, **underline**, and **strikethrough** actions.
- Block formatting for **H1–H4**, **paragraph**, **unordered list**, and **ordered list**.
- Utilizes `document.execCommand()` for rich-text editing.

## Theming & UI

- **Light/Dark mode toggle**, persisted in `localStorage`.
- **CSS custom properties** drive consistent theming (`--bg-primary`, `--accent`, etc.).
- **Collapsible sidebar** with a hamburger toggle, expanding main content to full width when collapsed.
- **Toast notifications** for feedback (e.g., "New note added", "Theme toggled").
- **Word count** display in the header.
- **Author name** input (persisted in `localStorage`), stamped on each note.

## UX Details

- **Fixed Add Note button** at bottom-right corner for quick note creation.
- **Hover states** on buttons, delete icons, and version-history controls.
- **Modal overlay** for version history and version previews.
- **SVG trash icons** for delete actions.

*This markdown summarizes the key features of the legacy Notes application.*
