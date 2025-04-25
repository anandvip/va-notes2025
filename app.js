/**
 * Modern Notes Application
 * A note-taking app with tagging, projects, and version control
 */

// ---------------
// EventEmitter - Simple pub/sub pattern implementation
// ---------------
class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Event name to subscribe to
   * @param {Function} callback - Function to execute when event is emitted
   */
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
  }

  /**
   * Unsubscribe from an event
   * @param {string} eventName - Event name to unsubscribe from
   * @param {Function} [callback] - Specific callback to remove, or all if omitted
   */
  off(eventName, callback) {
    if (!this.events[eventName]) return;
    
    if (callback) {
      this.events[eventName] = this.events[eventName].filter(cb => cb !== callback);
    } else {
      this.events[eventName] = [];
    }
  }

  /**
   * Emit an event
   * @param {string} eventName - Event name to emit
   * @param {*} data - Data to pass to callbacks
   */
  emit(eventName, data) {
    if (!this.events[eventName]) return;
    
    this.events[eventName].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for ${eventName}:`, error);
      }
    });
  }
}

// ---------------
// Database Service
// ---------------
class DatabaseService {
  constructor(dbName, version, onReady) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.onReady = onReady;
    this.init();
  }

  /**
   * Initialize the database
   */
  init() {
    const request = indexedDB.open(this.dbName, this.version);
    
    request.onerror = (event) => {
      console.error("Database error:", event.target.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('projectId', 'projectId', { unique: false });
        notesStore.createIndex('date', 'date', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (event) => {
      this.db = event.target.result;
      console.log("Database initialized successfully");
      if (typeof this.onReady === 'function') {
        this.onReady();
      }
    };
  }

  /**
   * Get all items from a store
   * @param {string} storeName - Name of the object store
   * @returns {Promise<Array>} - Promise resolving to array of items
   */
  getAll(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a specific item from a store
   * @param {string} storeName - Name of the object store
   * @param {string|number} id - ID of the item to get
   * @returns {Promise<Object>} - Promise resolving to the item
   */
  get(storeName, id) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add or update an item in a store
   * @param {string} storeName - Name of the object store
   * @param {Object} item - Item to add or update
   * @returns {Promise<void>}
   */
  put(storeName, item) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      
      request.onsuccess = () => resolve();
      request.onerror = (event) => {
        console.error("Error putting data in IndexedDB:", event.target.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete an item from a store
   * @param {string} storeName - Name of the object store
   * @param {string|number} id - ID of the item to delete
   * @returns {Promise<void>}
   */
  delete(storeName, id) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// ---------------
// Toast Service
// ---------------
class ToastService {
  constructor(containerSelector) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) {
      console.warn(`Toast container not found: ${containerSelector}`);
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      document.body.appendChild(this.container);
    }
  }

  /**
   * Show a toast notification
   * @param {string} message - Message to display
   * @param {string} type - Type of toast (success, error, info)
   * @param {number} duration - Duration in milliseconds
   */
  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    this.container.appendChild(toast);
    
    // Force reflow to enable transition
    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300); // Wait for fade-out transition
    }, duration);
  }

  /**
   * Show a toast with an input field
   * @param {string} message - Message/question to display
   * @param {Function} callback - Function to call with input value
   */
  showInputPrompt(message, callback) {
    const toast = document.createElement('div');
    toast.className = 'toast info';
    
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    
    const input = document.createElement('input');
    input.setAttribute('type', 'text');
    
    const button = document.createElement('button');
    button.textContent = 'OK';
    button.className = 'gradient-button';
    button.style.marginTop = '8px';
    button.addEventListener('click', () => {
      callback(input.value);
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    });
    
    toast.appendChild(messageDiv);
    toast.appendChild(input);
    toast.appendChild(button);
    
    this.container.appendChild(toast);
    
    // Force reflow to enable transition
    setTimeout(() => {
      toast.classList.add('visible');
      input.focus();
    }, 10);
    
    // Handle Enter key
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        button.click();
      }
    });
  }
}

// ---------------
// Main Application
// ---------------
class NotesApp {
  constructor() {
    // State
    this.notes = [];
    this.projects = [];
    this.tags = new Set();
    this.currentProject = null;
    this.currentTag = null;
    this.searchTerm = '';
    this.versioningInterval = 5000; // Default: 5 seconds
    this.isDarkTheme = false;
    this.sidebarCollapsed = false;
    this.projectColors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', 
      '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'
    ];
    
    // Services
    this.events = new EventEmitter();
    this.toastService = new ToastService('#toast-container');
    
    // Init app
    this.initElements();
    this.loadSettings();
    this.setupDatabase();
  }

  /**
   * Initialize and cache DOM element references
   */
  initElements() {
    // Main elements
    this.elements = {
      sidebar: document.getElementById('sidebar'),
      sidebarToggle: document.getElementById('sidebar-toggle'),
      mainContent: document.getElementById('main-content'),
      notesContainer: document.getElementById('notes-container'),
      projectsList: document.getElementById('projects-list'),
      tagsContainer: document.getElementById('tags-container'),
      searchInput: document.getElementById('search-input'),
      wordCount: document.getElementById('word-count'),
      statsCount: document.getElementById('stats-count'),
      authorInput: document.getElementById('author-input'),
      sidebarAuthor: document.getElementById('sidebar-author'),
      themeToggle: document.getElementById('theme-toggle'),
      addNoteBtn: document.getElementById('add-note-btn'),
      addProjectBtn: document.getElementById('add-project-btn'),
      viewAllProjects: document.getElementById('view-all-projects'),
      versionFrequency: document.getElementById('version-frequency'),
      
      // Modals
      versionModal: document.getElementById('version-modal'),
      projectsModal: document.getElementById('projects-modal'),
      versionList: document.getElementById('version-list'),
      projectsGrid: document.getElementById('projects-grid')
    };
    
    // Check if all required elements exist
    Object.entries(this.elements).forEach(([key, element]) => {
      if (!element) {
        console.warn(`Element not found: #${key}`);
      }
    });
    
    // Modal close buttons
    this.modalCloseButtons = document.querySelectorAll('.modal-close');
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    // Theme preference
    this.isDarkTheme = localStorage.getItem('theme') === 'dark';
    document.body.classList.toggle('dark-theme', this.isDarkTheme);
    
    // Author name
    const author = localStorage.getItem('author');
    if (author) {
      this.elements.authorInput.value = author;
      this.elements.sidebarAuthor.textContent = author;
    }
    
    // Versioning interval
    const interval = parseInt(localStorage.getItem('versioningInterval'), 10);
    if (!isNaN(interval)) {
      this.versioningInterval = interval;
      this.elements.versionFrequency.value = interval.toString();
    }
    
    // Sidebar state
    this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    this.elements.sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
    this.elements.mainContent.classList.toggle('full-width', this.sidebarCollapsed);
  }

  /**
   * Set up the database and load initial data
   */
  setupDatabase() {
    try {
      this.db = new DatabaseService('ModernNotesDB', 1, () => {
        this.loadData();
      });
    } catch (error) {
      console.error('Failed to initialize database:', error);
      this.toastService.show('Failed to connect to database. Some features may not work.', 'error');
      // Basic fallback - empty arrays for notes and projects
      this.notes = [];
      this.projects = [];
      this.renderProjects();
      this.renderNotes();
      this.renderTags();
    }
  }

  /**
   * Load all data from database
   */
  async loadData() {
    try {
      // Load notes
      const notes = await this.db.getAll('notes');
      console.log('Loaded notes from IndexedDB:', notes);
      
      this.notes = notes.map(note => ({
        ...note,
        versions: Array.isArray(note.versions) 
          ? note.versions 
          : [{ content: note.content, date: note.date }]
      }));
      
      // Extract tags from notes
      this.notes.forEach(note => {
        (note.tags || []).forEach(tag => this.tags.add(tag));
      });
      
      // Load projects
      this.projects = await this.db.getAll('projects');
      console.log('Loaded projects from IndexedDB:', this.projects);
      
      // Initial render
      this.renderProjects();
      this.renderNotes();
      this.renderTags();
      this.updateWordCount();
      
      // Add event listeners after data is loaded
      this.addEventListeners();
      
      this.toastService.show('Data loaded successfully', 'success');
    } catch (error) {
      console.error('Error loading data:', error);
      this.toastService.show('Error loading data', 'error');
    }
  }

  /**
   * Attach event listeners to UI elements
   */
  addEventListeners() {
    // Sidebar toggle
    this.elements.sidebarToggle.addEventListener('click', () => {
      this.toggleSidebar();
    });
    
    // Add note button
    this.elements.addNoteBtn.addEventListener('click', () => {
      this.createNote();
    });
    
    // Add project button
    this.elements.addProjectBtn.addEventListener('click', () => {
      this.toastService.showInputPrompt('Enter project name:', (name) => {
        if (name.trim()) {
          this.addProject(name);
        }
      });
    });
    
    // View all projects
    this.elements.viewAllProjects.addEventListener('click', () => {
      this.showProjectsModal();
    });
    
    // Theme toggle
    this.elements.themeToggle.addEventListener('click', () => {
      this.toggleTheme();
    });
    
    // Versioning frequency change
    this.elements.versionFrequency.addEventListener('change', (e) => {
      this.updateVersioningInterval(e.target.value);
    });
    
    // Modal close buttons
    this.modalCloseButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.closeModals();
      });
    });
    
    // Search input
    this.elements.searchInput.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase();
      this.renderNotes();
    });
    
    // Author input
    this.elements.authorInput.addEventListener('change', (e) => {
      const author = e.target.value;
      localStorage.setItem('author', author);
      this.elements.sidebarAuthor.textContent = author;
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeModals();
      }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Escape to close modals
      if (e.key === 'Escape') {
        this.closeModals();
      }
      
      // Ctrl+N to create a new note
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.createNote();
      }
    });
  }

  /**
   * Toggle sidebar visibility
   */
  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.elements.sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
    this.elements.mainContent.classList.toggle('full-width', this.sidebarCollapsed);
    localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed.toString());
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    document.body.classList.toggle('dark-theme', this.isDarkTheme);
    localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
    this.toastService.show('Theme updated', 'success');
  }

  /**
   * Update the versioning interval
   * @param {number|string} value - New interval in milliseconds
   */
  updateVersioningInterval(value) {
    this.versioningInterval = parseInt(value, 10) || 0;
    localStorage.setItem('versioningInterval', this.versioningInterval.toString());
    
    const seconds = this.versioningInterval / 1000;
    this.toastService.show(
      seconds > 0 ? `Auto-save set to ${seconds}s` : 'Auto-save disabled', 
      'info'
    );
  }

  /**
   * Create a new note
   * @param {string} title - Note title
   * @param {string} content - Note content
   */
  createNote(title = 'New Note', content = '') {
    const now = new Date().toISOString();
    const formattedDate = new Date(now).toLocaleString();
    
    const note = {
      id: Date.now().toString(),
      title,
      content,
      author: this.elements.authorInput.value || 'Anonymous',
      projectId: this.currentProject,
      date: now,
      formattedDate: formattedDate,
      tags: [],
      versions: [{ content, date: now }]
    };
    
    this.notes.unshift(note);
    this.db.put('notes', note)
      .then(() => {
        console.log('Note created successfully:', note);
        this.renderNotes();
        this.updateWordCount();
        this.toastService.show('Note created', 'success');
      })
      .catch(error => {
        console.error('Error creating note:', error);
        this.toastService.show('Error creating note', 'error');
      });
  }

  /**
   * Sanitize HTML content to prevent XSS attacks
   * @param {string} html - HTML content to sanitize
   * @returns {string} - Sanitized HTML
   */
  sanitizeHtml(html) {
    if (!html) return '';
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove script tags
    const scripts = temp.querySelectorAll('script');
    scripts.forEach(function(script) {
      script.remove();
    });
    
    // Remove potentially dangerous attributes
    const allElements = temp.querySelectorAll('*');
    const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 
                          'onkeydown', 'onkeypress', 'onkeyup', 'onchange', 'onsubmit',
                          'javascript:', 'data-', 'href="javascript'];
    
    allElements.forEach(function(el) {
      dangerousAttrs.forEach(function(attr) {
        el.removeAttribute(attr);
      });
    });
    
    return temp.innerHTML;
  }

  /**
   * Extract hashtags from content and convert them to tags
   * @param {string} content - Note content to extract tags from
   * @returns {Array} - Array of tags without the # symbol
   */
  extractTags(content) {
    // Create a temporary div to handle HTML content
    const div = document.createElement('div');
    div.innerHTML = content;
    const text = div.textContent || div.innerText || '';
    
    // Find all hashtags (word starting with # and containing letters, numbers, underscores, or hyphens)
    const hashtagRegex = /#([\w-]+)/g;
    const matches = text.match(hashtagRegex);
    
    // Return unique tags without the # symbol, converted to lowercase for consistency
    if (matches) {
      return [...new Set(matches.map(tag => tag.substring(1).toLowerCase()))];
    }
    return [];
  }

  /**
   * Update a note's field
   * @param {string|number} id - Note ID
   * @param {string} field - Field to update
   * @param {*} value - New value
   */
  updateNote(id, field, value) {
    const noteIndex = this.notes.findIndex(n => n.id == id);
    if (noteIndex === -1) {
      console.error('Note not found for update:', id);
      return;
    }
    
    const note = { ...this.notes[noteIndex] };
    const oldValue = note[field];
    
    // Sanitize HTML content if needed
    if (field === 'content') {
      value = this.sanitizeHtml(value);
    }
    
    note[field] = value;
    const now = new Date().toISOString();
    note.date = now;
    note.formattedDate = new Date(now).toLocaleString();
    
    // If content was updated, extract tags
    if (field === 'content') {
      try {
        // Extract hashtags from content
        const extractedTags = this.extractTags(value);
        
        // Update note tags
        note.tags = extractedTags;
        
        // Update global tags collection
        this.updateTags();
      } catch (error) {
        console.error('Error extracting tags:', error);
        // Continue with update even if tag extraction fails
      }
    }
    
    // Handle version history for content changes
    if (field === 'content' && value !== oldValue && this.versioningInterval > 0) {
      try {
        if (!Array.isArray(note.versions)) {
          note.versions = [];
        }
        
        const lastVersion = note.versions.length > 0 ? note.versions[note.versions.length - 1] : null;
        
        if (lastVersion) {
          const timeSinceLastVersion = Date.now() - new Date(lastVersion.date).getTime();
          
          if (timeSinceLastVersion >= this.versioningInterval) {
            // Add new version
            note.versions.push({ content: value, date: note.date });
          } else {
            // Update latest version
            lastVersion.content = value;
            lastVersion.date = note.date;
          }
        } else {
          // No versions exist, create first one
          note.versions.push({ content: value, date: note.date });
        }
      } catch (error) {
        console.error('Error updating version history:', error);
        // Ensure note has versions array
        note.versions = [{ content: value, date: note.date }];
      }
    }
    
    // Update notes array
    this.notes[noteIndex] = note;
    
    // Save to database
    this.db.put('notes', note)
      .then(() => {
        console.log(`Note ${id} updated:`, field, value);
        this.updateWordCount();
      })
      .catch(error => {
        console.error(`Error updating note ${id}:`, error);
        this.toastService.show('Error updating note', 'error');
      });
  }

  /**
   * Delete a note
   * @param {string|number} id - Note ID 
   */
  deleteNote(id) {
    this.db.delete('notes', id)
      .then(() => {
        this.notes = this.notes.filter(note => note.id != id);
        this.renderNotes();
        this.updateTags();
        this.updateWordCount();
        this.toastService.show('Note deleted', 'success');
      })
      .catch(error => {
        console.error('Error deleting note:', error);
        this.toastService.show('Error deleting note', 'error');
      });
  }

  /**
   * Add a new project
   * @param {string} name - Project name
   */
  addProject(name) {
    const project = {
      id: Date.now().toString(),
      name,
      color: this.projectColors[Math.floor(Math.random() * this.projectColors.length)]
    };
    
    this.projects.push(project);
    this.db.put('projects', project)
      .then(() => {
        console.log('Project created:', project);
        this.renderProjects();
        this.toastService.show(`Project "${name}" created`, 'success');
      })
      .catch(error => {
        console.error('Error creating project:', error);
        this.toastService.show('Error creating project', 'error');
      });
  }

  /**
   * Delete a project and its notes
   * @param {string|number} id - Project ID
   */
  deleteProject(id) {
    // First delete the project
    this.db.delete('projects', id)
      .then(() => {
        this.projects = this.projects.filter(project => project.id != id);
        
        // Then delete all notes in that project
        const projectNotes = this.notes.filter(note => note.projectId == id);
        const deletePromises = projectNotes.map(note => {
          return this.db.delete('notes', note.id);
        });
        
        return Promise.all(deletePromises);
      })
      .then(() => {
        // Update notes array after deletion
        this.notes = this.notes.filter(note => note.projectId != id);
        this.renderProjects();
        this.renderNotes();
        this.updateTags();
        this.updateWordCount();
        this.toastService.show('Project and its notes deleted', 'success');
      })
      .catch(error => {
        console.error('Error deleting project:', error);
        this.toastService.show('Error deleting project', 'error');
      });
  }

  /**
   * Add a tag to a note
   * @param {string|number} noteId - Note ID
   * @param {string} tag - Tag to add
   */
  addTag(noteId, tag) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note) return;
    
    if (!note.tags) {
      note.tags = [];
    }
    
    if (!note.tags.includes(tag)) {
      note.tags.push(tag);
      this.tags.add(tag);
      
      this.db.put('notes', note)
        .then(() => {
          this.renderTags();
          this.renderNotes();
        })
        .catch(error => {
          console.error('Error adding tag:', error);
        });
    }
  }

  /**
   * Remove a tag from a note
   * @param {string|number} noteId - Note ID
   * @param {string} tag - Tag to remove
   */
  removeTag(noteId, tag) {
    const note = this.notes.find(n => n.id == noteId);
    if (!note || !note.tags) return;
    
    note.tags = note.tags.filter(t => t !== tag);
    
    this.db.put('notes', note)
      .then(() => {
        this.updateTags();
        this.renderNotes();
      })
      .catch(error => {
        console.error('Error removing tag:', error);
      });
  }

  /**
   * Filter notes by tag
   * @param {string} tag - Tag to filter by
   */
  filterByTag(tag) {
    if (this.currentTag === tag) {
      // Clicking the active tag deselects it
      this.currentTag = null;
    } else {
      this.currentTag = tag;
    }
    
    this.renderTags();
    this.renderNotes();
  }

  /**
   * Update tags collection from notes
   */
  updateTags() {
    this.tags.clear();
    this.notes.forEach(note => {
      (note.tags || []).forEach(tag => {
        this.tags.add(tag);
      });
    });
    this.renderTags();
  }

  /**
   * Render the projects list
   */
  renderProjects() {
    const projectsList = this.elements.projectsList;
    projectsList.innerHTML = '';
    
    this.projects.forEach(project => {
      const projectNotes = this.notes.filter(note => note.projectId == project.id);
      
      const projectItem = document.createElement('div');
      projectItem.className = 'project-item';
      projectItem.dataset.id = project.id;
      
      const projectHeader = document.createElement('div');
      projectHeader.className = `project-header ${this.currentProject == project.id ? 'active' : ''}`;
      
      const projectTitle = document.createElement('div');
      projectTitle.className = 'project-title';
      
      const projectColor = document.createElement('span');
      projectColor.className = 'project-color';
      projectColor.style.backgroundColor = project.color;
      
      const projectName = document.createTextNode(project.name);
      
      const noteCount = document.createElement('span');
      noteCount.className = 'project-note-count';
      noteCount.textContent = `${projectNotes.length} note${projectNotes.length !== 1 ? 's' : ''}`;
      
      // Assemble project item
      projectTitle.appendChild(projectColor);
      projectTitle.appendChild(projectName);
      
      projectHeader.appendChild(projectTitle);
      projectHeader.appendChild(noteCount);
      
      projectItem.appendChild(projectHeader);
      
      // Add click event
      projectHeader.addEventListener('click', () => {
        this.currentProject = this.currentProject == project.id ? null : project.id;
        this.renderProjects(); // Update active state
        this.renderNotes();
        
        this.toastService.show(
          this.currentProject ? `Viewing ${project.name}` : 'Viewing all projects', 
          'info'
        );
      });
      
      projectsList.appendChild(projectItem);
    });
  }

  /**
   * Render notes based on current filters
   */
  renderNotes() {
    const notesContainer = this.elements.notesContainer;
    notesContainer.innerHTML = '';
    
    // Apply filters
    let filteredNotes = [...this.notes];
    
    if (this.currentProject) {
      filteredNotes = filteredNotes.filter(note => note.projectId == this.currentProject);
    }
    
    if (this.currentTag) {
      filteredNotes = filteredNotes.filter(note => 
        Array.isArray(note.tags) && note.tags.includes(this.currentTag)
      );
    }
    
    if (this.searchTerm) {
      filteredNotes = filteredNotes.filter(note => 
        note.title.toLowerCase().includes(this.searchTerm) || 
        (note.content && note.content.toLowerCase().includes(this.searchTerm))
      );
    }
    
    // Sort notes by date (newest first)
    filteredNotes.sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });
    
    // Show message if no notes
    if (filteredNotes.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = '<h3>No notes found</h3>';
      notesContainer.appendChild(emptyState);
      return;
    }
    
    // Render each note
    filteredNotes.forEach(note => {
      const noteElement = document.createElement('div');
      noteElement.className = 'note';
      noteElement.dataset.id = note.id;
      
      // Note project indicator
      let projectInfo = '';
      if (note.projectId) {
        const project = this.projects.find(p => p.id == note.projectId);
        if (project) {
          projectInfo = `
            <div class="note-project">
              <span class="project-color" style="background-color: ${project.color}"></span>
              ${project.name}
            </div>
          `;
        }
      }
      
      // Format date for display
      const displayDate = note.formattedDate || new Date(note.date).toLocaleString();
      
      // Note content
      noteElement.innerHTML = `
        ${projectInfo}
        <div class="note-header">
          <div class="note-title-container">
            <input class="note-title" value="${this.escapeHtml(note.title)}">
          </div>
          <div class="note-controls">
            <button class="icon-button delete">
              <svg class="icon" viewBox="0 0 16 16">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="note-content" contenteditable="true">${note.content || ''}</div>
        <div class="note-footer">
          <span>${note.author || 'Anonymous'} • ${displayDate}</span>
          <span class="note-versions">${(note.versions && note.versions.length) || 1} version${(note.versions && note.versions.length) !== 1 ? 's' : ''}</span>
        </div>
      `;
      
      // Add event listeners
      const titleInput = noteElement.querySelector('.note-title');
      titleInput.addEventListener('change', (e) => {
        this.updateNote(note.id, 'title', e.target.value);
      });
      
      // Render note content element
      const contentElement = noteElement.querySelector('.note-content');
      
      // Use debounce for content updates to avoid excessive saving
      let contentUpdateTimeout = null;
      contentElement.addEventListener('input', () => {
        clearTimeout(contentUpdateTimeout);
        contentUpdateTimeout = setTimeout(() => {
          this.updateNote(note.id, 'content', contentElement.innerHTML);
        }, 750); // Debounce for 750ms for better performance
      });
      
      // Add contenteditable blur event to ensure saving completes
      contentElement.addEventListener('blur', () => {
        clearTimeout(contentUpdateTimeout);
        this.updateNote(note.id, 'content', contentElement.innerHTML);
      });
      
      const deleteButton = noteElement.querySelector('.delete');
      deleteButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this note?')) {
          this.deleteNote(note.id);
        }
      });
      
      const versionsLink = noteElement.querySelector('.note-versions');
      versionsLink.addEventListener('click', () => {
        this.showVersionHistory(note);
      });
      
      notesContainer.appendChild(noteElement);
    });
  }

  /**
   * Show version history modal for a note
   * @param {Object} note - Note object
   */
  showVersionHistory(note) {
    const versionList = this.elements.versionList;
    versionList.innerHTML = '';
    
    if (!note.versions || note.versions.length === 0) {
      versionList.innerHTML = '<div class="empty-state">No version history available</div>';
    } else {
      // Create version items
      note.versions.forEach((version, index) => {
        const versionItem = document.createElement('div');
        versionItem.className = 'version-item';
        
        const versionNumber = note.versions.length - index;
        const versionDate = new Date(version.date).toLocaleString();
        
        versionItem.innerHTML = `
          <div class="version-info">
            <div class="version-number">Version ${versionNumber}</div>
            <div class="version-date">${versionDate}</div>
          </div>
          <div class="version-actions">
            <button class="text-button restore-version">Restore</button>
            <button class="text-button view-version">View</button>
          </div>
        `;
        
        // Restore button
        const restoreButton = versionItem.querySelector('.restore-version');
        restoreButton.addEventListener('click', () => {
          this.updateNote(note.id, 'content', version.content);
          this.closeModals();
          this.renderNotes();
          this.toastService.show('Version restored', 'success');
        });
        
        // View button
        const viewButton = versionItem.querySelector('.view-version');
        viewButton.addEventListener('click', () => {
          // Create a temporary div to show the content
          const contentPreview = document.createElement('div');
          contentPreview.className = 'version-content-preview';
          contentPreview.innerHTML = version.content || 'Empty note';
          
          // Replace existing preview if any
          const existingPreview = versionItem.querySelector('.version-content-preview');
          if (existingPreview) {
            existingPreview.remove();
            return;
          }
          
          versionItem.appendChild(contentPreview);
        });
        
        versionList.appendChild(versionItem);
      });
    }
    
    // Show the modal
    this.elements.versionModal.classList.add('active');
  }

  /**
   * Show projects modal
   */
  showProjectsModal() {
    const projectsGrid = this.elements.projectsGrid;
    projectsGrid.innerHTML = '';
    
    this.projects.forEach(project => {
      const projectNotes = this.notes.filter(note => note.projectId == project.id);
      
      const projectCard = document.createElement('div');
      projectCard.className = 'project-card';
      projectCard.style.setProperty('--project-color', project.color);
      projectCard.style.borderLeft = `4px solid ${project.color}`;
      
      projectCard.innerHTML = `
        <div class="project-card-title">${project.name}</div>
        <div class="project-card-count">${projectNotes.length} note${projectNotes.length !== 1 ? 's' : ''}</div>
        <div class="project-card-actions">
          <button class="text-button select-project">Select</button>
          <button class="text-button delete-project">Delete</button>
        </div>
      `;
      
      // Add note previews if available
      if (projectNotes.length > 0) {
        const notesPreview = document.createElement('div');
        notesPreview.className = 'project-card-notes';
        
        projectNotes.slice(0, 3).forEach(note => {
          const notePreview = document.createElement('div');
          notePreview.className = 'project-card-note';
          notePreview.textContent = note.title;
          notesPreview.appendChild(notePreview);
        });
        
        if (projectNotes.length > 3) {
          const moreNotes = document.createElement('div');
          moreNotes.className = 'project-card-note';
          moreNotes.textContent = `+ ${projectNotes.length - 3} more...`;
          notesPreview.appendChild(moreNotes);
        }
        
        projectCard.appendChild(notesPreview);
      }
      
      // Select project button
      const selectButton = projectCard.querySelector('.select-project');
      selectButton.addEventListener('click', () => {
        this.currentProject = project.id;
        this.renderProjects();
        this.renderNotes();
        this.closeModals();
        this.toastService.show(`Switched to ${project.name}`, 'info');
      });
      
      // Delete project button
      const deleteButton = projectCard.querySelector('.delete-project');
      deleteButton.addEventListener('click', () => {
        if (confirm(`Are you sure you want to delete the project "${project.name}" and all its notes?`)) {
          this.deleteProject(project.id);
          this.closeModals();
        }
      });
      
      projectsGrid.appendChild(projectCard);
    });
    
    // Add "Create New Project" card
    const newProjectCard = document.createElement('div');
    newProjectCard.className = 'project-card new-project';
    newProjectCard.innerHTML = `
      <div class="project-card-title">Create New Project</div>
      <div class="project-card-icon">+</div>
    `;
    
    newProjectCard.addEventListener('click', () => {
      this.toastService.showInputPrompt('Enter project name:', (name) => {
        if (name.trim()) {
          this.addProject(name);
          this.closeModals();
        }
      });
    });
    
    projectsGrid.appendChild(newProjectCard);
    
    // Show the modal
    this.elements.projectsModal.classList.add('active');
  }

  /**
   * Close all modals
   */
  closeModals() {
    this.elements.versionModal.classList.remove('active');
    this.elements.projectsModal.classList.remove('active');
  }

  /**
   * Render tags in the sidebar
   */
  renderTags() {
    const tagsContainer = this.elements.tagsContainer;
    tagsContainer.innerHTML = '';
    
    // Sort tags alphabetically
    const sortedTags = Array.from(this.tags).sort();
    
    sortedTags.forEach(tag => {
      const tagElement = document.createElement('div');
      tagElement.className = `tag ${this.currentTag === tag ? 'active' : ''}`;
      tagElement.textContent = tag;
      
      tagElement.addEventListener('click', () => {
        this.filterByTag(tag);
      });
      
      tagsContainer.appendChild(tagElement);
    });
  }

  /**
   * Update word count display
   */
  updateWordCount() {
    const wordCountEl = this.elements.wordCount;
    const statsCountEl = this.elements.statsCount;
    
    if (!wordCountEl || !statsCountEl) return;
    
    // Calculate word count across all notes
    const totalText = this.notes
      .map(note => this.stripHtml(note.content || ''))
      .join(' ');
    
    const wordCount = totalText
      .split(/\s+/)
      .filter(word => word.trim().length > 0)
      .length;
    
    wordCountEl.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
    statsCountEl.textContent = `${this.notes.length} note${this.notes.length !== 1 ? 's' : ''}`;
  }

  /**
   * Strip HTML tags from a string
   * @param {string} html - HTML string
   * @returns {string} - Plain text
   */
  stripHtml(html) {
    if (!html) return '';
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || '';
  }
  
  /**
   * Escape HTML for safe insertion
   * @param {string} text - Text to escape
   * @returns {string} - Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.notesApp = new NotesApp();
});
