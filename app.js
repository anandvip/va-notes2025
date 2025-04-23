// Modern Notes Application
// Feature-rich note-taking with project organization, rich text editing, version control, and more.

/**
 * EventEmitter - Simple pub/sub implementation for decoupled communication
 */
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(eventName, callback) {
    if (!this.events[eventName]) this.events[eventName] = [];
    this.events[eventName].push(callback);
  }

  emit(eventName, data) {
    (this.events[eventName] || []).forEach(cb => cb(data));
  }

  off(eventName, callback) {
    if (!this.events[eventName]) return;
    if (callback) {
      this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    } else {
      delete this.events[eventName];
    }
  }
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
    this.eventEmitter = new EventEmitter();
    this.sidebarCollapsed = false;
    this.isDarkTheme = false;
    this._notesLoaded = false;
    this._projectsLoaded = false;
    this.projectColors = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#06b6d4','#3b82f6'];

    this.initElements();
    this.initDB();
    this.loadSettings();
  }

  // Initialize DOM refs
  initElements() {
    const ids = ['sidebar','sidebar-toggle','main-content','add-note-btn','notes-container',
      'word-count','stats-count','author-input','sidebar-author','search-input',
      'projects-list','tags-container','add-project-btn','view-all-projects',
      'theme-toggle','version-frequency','version-modal','projects-modal',
      'version-list','projects-grid','toast-container'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) console.warn(`Missing element: #${id}`);
      else this[id.replace(/-([a-z])/g,(m,w)=>w.toUpperCase())] = el;
    });
    this.modalCloseButtons = document.querySelectorAll('.modal-close') || [];
  }

  initDB() {
    const req = indexedDB.open('ModernNotesDB',1);
    req.onerror = e => this.showToast(`DB error: ${e.target.error}`,'error');
    req.onupgradeneeded = e => {
      this.db = e.target.result;
      if (!this.db.objectStoreNames.contains('notes'))
        this.db.createObjectStore('notes',{keyPath:'id'});
      if (!this.db.objectStoreNames.contains('projects'))
        this.db.createObjectStore('projects',{keyPath:'id'});
    };
    req.onsuccess = e => { this.db = e.target.result; this.loadDataFromDB(); };
  }

  // Event delegation replaces dozens of individual bindings
  addEventListeners() {
    // Sidebar & controls
    this.sidebarToggle.addEventListener('click',() => this.toggleSidebar());
    this.addNoteBtn.addEventListener('click',() => this.createNote());
    this.addProjectBtn.addEventListener('click',() =>
      this.showInputToast('Enter project name:',name=>this.addProject(name))
    );
    this.viewAllProjects.addEventListener('click',() => this.showProjectsModal());
    this.themeToggle.addEventListener('click',() => this.toggleTheme());
    this.versionFrequency.addEventListener('change',e=>this.updateVersioningInterval(e));
    this.modalCloseButtons.forEach(btn=>btn.addEventListener('click',()=>this.closeModals()));
    this.searchInput.addEventListener('input',e=>this.onSearch(e));
    this.authorInput.addEventListener('change',e=>this.onAuthorChange(e));
    window.addEventListener('click',e=>{ if(e.target.classList.contains('modal')) this.closeModals(); });
    document.addEventListener('keydown',e=>this.onKeyDown(e));

    // Delegate note actions
    this.notesContainer.addEventListener('click',e=>this.onNotesClick(e));
    this.notesContainer.addEventListener('input',e=>this.onNotesInput(e));
  }

  // Handler methods
  onSearch(e) {
    this.searchTerm = e.target.value.trim().toLowerCase();
    this.renderNotes();
  }

  onAuthorChange(e) {
    localStorage.setItem('author',e.target.value);
    this.sidebarAuthor.textContent = e.target.value;
  }

  onKeyDown(e) {
    if (e.key==='Escape') this.closeModals();
    if (e.ctrlKey && e.key.toLowerCase()==='n') { e.preventDefault(); this.createNote(); }
  }

  onNotesClick(e) {
    const noteEl = e.target.closest('.note');
    if (!noteEl) return;
    const id = parseInt(noteEl.dataset.id,10);
    if (e.target.classList.contains('versions')) this.showVersionHistory(id);
    else if (e.target.classList.contains('add-tag')) this.showInputToast('Tag:',t=>this.addTag(id,t));
    else if (e.target.classList.contains('delete')) this.deleteNote(id);
  }

  onNotesInput(e) {
    const noteEl = e.target.closest('.note');
    if (!noteEl || !e.target.classList.contains('note-content')) return;
    const id = parseInt(noteEl.dataset.id,10);
    clearTimeout(this._debounce);
    this._debounce = setTimeout(()=>this.updateNote(id,'content',e.target.innerHTML),this.versioningInterval);
  }

  setupObservers() {
    ['noteUpdated','noteAdded','noteDeleted'].forEach(ev=>
      this.eventEmitter.on(ev,()=>{this.renderNotes();this.renderProjects();this.updateTags();})
    );
    ['projectAdded','projectDeleted'].forEach(ev=>
      this.eventEmitter.on(ev,()=>this.renderProjects())
    );
    this.eventEmitter.on('tagSelected',tag=>this.filterByTag(tag));
  }

  // ... rest of methods unchanged ...
}

document.addEventListener('DOMContentLoaded',()=>{
  window.notesApp = new NotesApp();
});
