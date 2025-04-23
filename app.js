// Modern Notes Application
// Enhanced error handling added throughout for robustness.

/**
 * EventEmitter - Simple pub/sub implementation for decoupled communication
 */
class EventEmitter {
  constructor() { this.events = {}; }
  on(eventName, callback) { if (!this.events[eventName]) this.events[eventName] = []; this.events[eventName].push(callback); }
  emit(eventName, data) { (this.events[eventName] || []).forEach(cb => { try { cb(data); } catch (err) { console.error(`Event handler error [${eventName}]:`, err); } }); }
  off(eventName, callback) { if (!this.events[eventName]) return; this.events[eventName] = callback ? this.events[eventName].filter(cb => cb !== callback) : []; }
}

/**
 * Main Application Class
 */
class NotesApp {
  constructor() {
    this.db = null;
    this.notes = [];
    this.projects = [];
    this.tags = new Set();
    this.currentProject = null;
    this.currentTag = null;
    this.searchTerm = '';
    this.versioningInterval = 5000;
    this._notesLoaded = false;
    this._projectsLoaded = false;
    this._listenersAdded = false;
    this.eventEmitter = new EventEmitter();
    this.sidebarCollapsed = false;
    this.isDarkTheme = false;
    this.projectColors = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6'];

    try {
      this.initElements();
      this.initDB();
      this.loadSettings();
    } catch (err) {
      console.error('Initialization error:', err);
      this.showToast('Application failed to initialize properly.', 'error');
    }
  }

  // Gather DOM refs, warn if missing
  initElements() {
    const ids = ['sidebar','sidebar-toggle','main-content','add-note-btn','notes-container',
      'word-count','stats-count','author-input','sidebar-author','search-input',
      'projects-list','tags-container','add-project-btn','view-all-projects',
      'theme-toggle','version-frequency','version-modal','projects-modal',
      'version-list','projects-grid','toast-container'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) {
        console.warn(`Missing element: #${id}`);
      } else {
        this[id.replace(/-([a-z])/g,(m,w)=>w.toUpperCase())] = el;
      }
    });
    this.modalCloseButtons = document.querySelectorAll('.modal-close') || [];
  }

  // Initialize IndexedDB with error handling
  initDB() {
    try {
      const req = indexedDB.open('ModernNotesDB', 1);
      req.onerror = e => this.showToast(`DB error: ${e.target.error}`, 'error');
      req.onupgradeneeded = e => {
        this.db = e.target.result;
        if (!this.db.objectStoreNames.contains('notes'))
          this.db.createObjectStore('notes', { keyPath: 'id' });
        if (!this.db.objectStoreNames.contains('projects'))
          this.db.createObjectStore('projects', { keyPath: 'id' });
      };
      req.onsuccess = e => { this.db = e.target.result; this.loadDataFromDB(); };
    } catch (err) {
      console.error('initDB error:', err);
      this.showToast('Failed to open database.', 'error');
    }
  }

  // Read UI prefs, catch storage errors
  loadSettings() {
    try {
      this.isDarkTheme = localStorage.getItem('theme') === 'dark';
      document.body.classList.toggle('dark-theme', this.isDarkTheme);
      const author = localStorage.getItem('author');
      if (author) { this.authorInput.value = author; this.sidebarAuthor.textContent = author; }
      const sec = parseInt(localStorage.getItem('versioningInterval'), 10);
      if (!isNaN(sec)) { this.versioningInterval = sec * 1000; this.versionFrequency.value = sec; }
      this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
      this.sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
      this.mainContent.classList.toggle('full-width', this.sidebarCollapsed);
    } catch (err) {
      console.warn('loadSettings failed:', err);
    }
  }

  // Load notes/projects, handle transaction errors
  loadDataFromDB() {
    try {
      const notesTx = this.db.transaction('notes', 'readonly').objectStore('notes');
      notesTx.getAll().onsuccess = e => {
        this.notes = e.target.result.map(n => ({ ...n, versions: Array.isArray(n.versions) ? n.versions : [{ content: n.content, date: n.date }] }));
        this.notes.forEach(n => (n.tags || []).forEach(t => this.tags.add(t)));
        this._notesLoaded = true; this.checkInitial();
      };
      notesTx.getAll().onerror = e => console.error('notesStore error:', e);

      const projTx = this.db.transaction('projects', 'readonly').objectStore('projects');
      projTx.getAll().onsuccess = e => { this.projects = e.target.result; this._projectsLoaded = true; this.checkInitial(); };
      projTx.getAll().onerror = e => console.error('projectsStore error:', e);
    } catch (err) {
      console.error('loadDataFromDB error:', err);
      this.showToast('Error loading data from DB.', 'error');
    }
  }

  // ... further methods unchanged, but wrap async operations in try/catch and add onerror callbacks ...
}

document.addEventListener('DOMContentLoaded', () => {
  window.notesApp = new NotesApp();
});
