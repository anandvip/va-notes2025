// Modern Notes Application - Complete Implementation

/** Simple EventEmitter for pub/sub */
class EventEmitter {
  constructor() { this.events = {}; }
  on(evt, fn) { (this.events[evt] ||= []).push(fn); }
  emit(evt, data) {
    (this.events[evt] || []).forEach(fn => {
      try { fn(data); } catch (e) { console.error(`Error in handler for ${evt}:`, e); }
    });
  }
  off(evt, fn) {
    if (!this.events[evt]) return;
    this.events[evt] = fn ? this.events[evt].filter(f => f !== fn) : [];
  }
}

/** Main Application */
class NotesApp {
  constructor() {
    // State
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

    // Initialize
    this.initElements();
    this.initDB();
    this.loadSettings();
  }

  // DOM references
  initElements() {
    const map = {
      'sidebar': 'sidebar',
      'sidebar-toggle': 'sidebarToggle',
      'main-content': 'mainContent',
      'add-note-btn': 'addNoteBtn',
      'notes-container': 'notesContainer',
      'word-count': 'wordCountElement',
      'stats-count': 'statsCountElement',
      'author-input': 'authorInput',
      'sidebar-author': 'sidebarAuthor',
      'search-input': 'searchInput',
      'projects-list': 'projectsList',
      'tags-container': 'tagsContainer',
      'add-project-btn': 'addProjectBtn',
      'view-all-projects': 'viewAllProjects',
      'theme-toggle': 'themeToggle',
      'version-frequency': 'versionFrequency',
      'version-modal': 'versionModal',
      'projects-modal': 'projectsModal',
      'version-list': 'versionList',
      'projects-grid': 'projectsGrid',
      'toast-container': 'toastContainer'
    };
    for (const [id, prop] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (!el) console.warn(`Missing element: #${id}`);
      else this[prop] = el;
    }
    this.modalCloseButtons = document.querySelectorAll('.modal-close');
  }

  // IndexedDB setup
  initDB() {
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
  }

  // Load UI preferences
  loadSettings() {
    this.isDarkTheme = localStorage.getItem('theme') === 'dark';
    document.body.classList.toggle('dark-theme', this.isDarkTheme);

    const author = localStorage.getItem('author');
    if (author) {
      this.authorInput.value = author;
      this.sidebarAuthor.textContent = author;
    }

    const sec = parseInt(localStorage.getItem('versioningInterval'), 10);
    if (!isNaN(sec)) {
      this.versioningInterval = sec;
      this.versionFrequency.value = sec;
    }

    this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    this.sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
    this.mainContent.classList.toggle('full-width', this.sidebarCollapsed);
  }

  // Fetch data from DB
  loadDataFromDB() {
    try {
      const notesStore = this.db.transaction('notes', 'readonly').objectStore('notes');
      notesStore.getAll().onsuccess = e => {
        this.notes = e.target.result.map(n => ({
          ...n,
          versions: Array.isArray(n.versions) ? n.versions : [{ content: n.content, date: n.date }]
        }));
        this.notes.forEach(n => (n.tags || []).forEach(t => this.tags.add(t)));
        this._notesLoaded = true; this.checkInitial();
      };
      notesStore.getAll().onerror = () => this.showToast('Failed loading notes', 'error');

      const projStore = this.db.transaction('projects', 'readonly').objectStore('projects');
      projStore.getAll().onsuccess = e => {
        this.projects = e.target.result;
        this._projectsLoaded = true; this.checkInitial();
      };
      projStore.getAll().onerror = () => this.showToast('Failed loading projects', 'error');
    } catch (err) {
      console.error('loadDataFromDB error:', err);
      this.showToast('Error loading data', 'error');
    }
  }

  // After both notes & projects loaded
  checkInitial() {
    if (this._notesLoaded && this._projectsLoaded) {
      this.renderProjects();
      this.renderNotes();
      this.updateTags();
      this.updateWordCount();
      if (!this._listenersAdded) {
        this.addEventListeners();
        this.setupObservers();
        this._listenersAdded = true;
      }
    }
  }

  // Attach UI event handlers
  addEventListeners() {
    this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    this.addNoteBtn.addEventListener('click', () => this.createNote());
    this.addProjectBtn.addEventListener('click', () =>
      this.showInputToast('Project name:', name => this.addProject(name))
    );
    this.viewAllProjects.addEventListener('click', () => this.showProjectsModal());
    this.themeToggle.addEventListener('click', () => this.toggleTheme());
    this.versionFrequency.addEventListener('change', e => this.updateVersioningInterval(e));
    this.modalCloseButtons.forEach(b => b.addEventListener('click', () => this.closeModals()));
    this.searchInput.addEventListener('input', e => { this.searchTerm = e.target.value; this.renderNotes(); });
    this.authorInput.addEventListener('change', e => { localStorage.setItem('author', e.target.value); this.sidebarAuthor.textContent = e.target.value; });
    window.addEventListener('click', e => { if (e.target.classList.contains('modal')) this.closeModals(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeModals();
      if (e.ctrlKey && e.key.toLowerCase() === 'n') { e.preventDefault(); this.createNote(); }
    });
  }

  // Subscribe to app-level events
  setupObservers() {
    ['noteAdded','noteUpdated','noteDeleted'].forEach(evt => {
      this.eventEmitter.on(evt, () => { this.renderNotes(); this.renderProjects(); this.updateTags(); });
    });
    ['projectAdded','projectDeleted'].forEach(evt => {
      this.eventEmitter.on(evt, () => this.renderProjects());
    });
    this.eventEmitter.on('tagSelected', tag => this.filterByTag(tag));
  }

  // UI actions
  toggleSidebar() { this.sidebarCollapsed = !this.sidebarCollapsed; this.sidebar.classList.toggle('collapsed', this.sidebarCollapsed); this.mainContent.classList.toggle('full-width', this.sidebarCollapsed); localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed); }
  toggleTheme() { this.isDarkTheme = !this.isDarkTheme; document.body.classList.toggle('dark-theme', this.isDarkTheme); localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light'); this.showToast('Theme updated','success'); }
  updateVersioningInterval(e) { this.versioningInterval = parseInt(e.target.value,10) || 0; localStorage.setItem('versioningInterval', this.versioningInterval); this.showToast(`Interval ${this.versioningInterval/1000}s`,'info'); }

  // CRUD methods
  createNote(title='New Note', content='') {
    const now = new Date().toLocaleString();
    const note = { id: Date.now(), title, content, author: this.authorInput.value||'Anonymous', projectId: this.currentProject, date: now, tags: [], versions: [{ content, date: now }] };
    this.notes.unshift(note);
    this.db.transaction('notes','readwrite').objectStore('notes').put(note);
    this.eventEmitter.emit('noteAdded', note);
    this.showToast('Note added','success');
  }

  updateNote(id, field, value) {
    const note = this.notes.find(n => n.id === id); if (!note) return;
    const old = note[field]; note[field] = value; note.date = new Date().toLocaleString();
    if (field === 'content' && value !== old && this.versioningInterval > 0) {
      const last = note.versions.at(-1);
      if (Date.now() - new Date(last.date) >= this.versioningInterval) note.versions.push({ content: value, date: note.date });
      else { last.content = value; last.date = note.date; }
    }
    this.db.transaction('notes','readwrite').objectStore('notes').put(note);
    this.eventEmitter.emit('noteUpdated', note);
  }

  deleteNote(id) {
    this.db.transaction('notes','readwrite').objectStore('notes').delete(id);
    this.notes = this.notes.filter(n => n.id !== id);
    this.eventEmitter.emit('noteDeleted', id);
    this.showToast('Note deleted','success');
  }

  addProject(name) {
    if (!name) return;
    const p = { id: Date.now(), name, color: this.projectColors[Math.floor(Math.random()*this.projectColors.length)] };
    this.projects.unshift(p);
    this.db.transaction('projects','readwrite').objectStore('projects').put(p);
    this.eventEmitter.emit('projectAdded', p);
    this.showToast(`Project "${name}" added`,'success');
  }

  deleteProject(id) {
    this.db.transaction('projects','readwrite').objectStore('projects').delete(id);
    this.projects = this.projects.filter(p => p.id !== id);
    this.notes.filter(n => n.projectId === id).forEach(n => this.deleteNote(n.id));
    this.eventEmitter.emit('projectDeleted', id);
    this.showToast('Project deleted','success');
  }

  // Tag operations
  addTag(id, tag) { const note = this.notes.find(n => n.id === id); if (!note.tags.includes(tag)) { note.tags.push(tag); this.tags.add(tag); this.db.transaction('notes','readwrite').objectStore('notes').put(note); this.eventEmitter.emit('noteUpdated', note); }}
  removeTag(id, tag) { const note = this.notes.find(n => n.id === id); note.tags = note.tags.filter(t => t !== tag); this.db.transaction('notes','readwrite').objectStore('notes').put(note); this.eventEmitter.emit('noteUpdated', note); }
  filterByTag(tag) { this.currentTag = this.currentTag === tag ? null : tag; this.renderTags(); this.renderNotes(); }
  updateTags() { this.tags.clear(); this.notes.flatMap(n => n.tags || []).forEach(t => this.tags.add(t)); this.renderTags(); }

  // Rendering
  renderProjects() { this.projectsList.innerHTML = ''; this.projects.forEach(p => { const el = document.createElement('div'); el.className = 'project-item'; el.dataset.id = p.id; el.textContent = p.name; el.addEventListener('click', () => { this.currentProject = p.id; this.renderNotes(); this.showToast(`Switched to ${p.name}`,'info'); }); this.projectsList.append(el); }); }
  renderNotes() {
    this.notesContainer.innerHTML = '';
    let list = this.notes.slice();
    if (this.currentProject) list = list.filter(n => n.projectId === this.currentProject);
    if (this.currentTag) list = list.filter(n => n.tags.includes(this.currentTag));
    if (this.searchTerm) list = list.filter(n => n.title.toLowerCase().includes(this.searchTerm) || n.content.toLowerCase().includes(this.searchTerm));
    list.sort((a,b) => new Date(b.date) - new Date(a.date));
    if (!list.length) { this.notesContainer.innerHTML = '<div class="empty-state"><h3>No notes</h3></div>'; return; }
    list.forEach(n => {
      const el = document.createElement('div'); el.className = 'note'; el.dataset.id = n.id;
      el.innerHTML = `<div class="note-header"><input class="note-title" value="${n.title}"/><button class="delete">Del</button></div><div class="note-content" contenteditable="true">${n.content}</div><div class="note-footer">${n.author} • ${n.date}</div>`;
      el.querySelector('.note-title').onchange = e => this.updateNote(n.id,'title',e.target.value);
      el.querySelector('.note-content').addEventListener('input', e => { clearTimeout(this._deb); this._deb = setTimeout(() => this.updateNote(n.id,'content',e.target.innerHTML), this.versioningInterval); });
      el.querySelector('.delete').onclick = () => this.deleteNote(n.id);
      this.notesContainer.append(el);
    });
    this.updateWordCount();
  }

  renderTags() { this.tagsContainer.innerHTML = ''; Array.from(this.tags).sort().forEach(tag => { const el = document.createElement('div'); el.className = `tag ${this.currentTag===tag?'active':''}`; el.textContent = tag; el.onclick = () => this.filterByTag(tag); this.tagsContainer.append(el); }); }

  updateWordCount() {
    const text = this.notes.map(n => n.content.replace(/<[^>]+>/g,'')).join(' ');
    const cnt = text.split(/\s+/).filter(w => w).length;
    if (this.wordCountElement) this.wordCountElement.textContent = `${cnt} word${cnt!==1?'s':''}`;
    if (this.statsCountElement) this.statsCountElement.textContent = `${this.notes.length} note${this.notes.length!==1?'s':''}`;
  }

  // Toast notifications
  showToast(msg, type='info', dur=3000) {
    const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg; if (this.toastContainer) this.toastContainer.append(t); setTimeout(() => t.remove(), dur);
  }

  // Simple prompt toast
  showInputToast(msg, cb) {
    const t = document.createElement('div'); t.className = 'toast info'; t.innerHTML = `<div>${msg}</div><input /><button>OK</button>`;
    const inp = t.querySelector('input'); t.querySelector('button').onclick = () => { cb(inp.value); t.remove(); };
    if (this.toastContainer) this.toastContainer.append(t);
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => { window.notesApp = new NotesApp(); });
