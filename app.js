/**
 * Modern Notes Application
 * A feature-rich note-taking application with project organization, 
 * rich text editing, version control, and more.
 */

/**
 * EventEmitter - Simple pub/sub implementation for decoupled communication
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }

    /**
     * Subscribe to an event
     * @param {string} eventName - Name of the event to subscribe to
     * @param {function} callback - Function to call when event is emitted
     */
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);
    }

    /**
     * Publish an event
     * @param {string} eventName - Name of the event to emit
     * @param {any} data - Data to pass to subscribers
     */
    emit(eventName, data) {
        const event = this.events[eventName];
        if (event) {
            event.forEach(callback => callback(data));
        }
    }
    
    /**
     * Remove event subscription
     * @param {string} eventName - Name of the event
     * @param {function} callback - Callback to remove (if not provided, removes all callbacks)
     */
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
        // Application state
        this.db = null;
        this.notes = [];
        this.projects = [];
        this.tags = new Set();
        this.currentProject = null;
        this.currentTag = null;
        this.versioningInterval = 5000; // Default to 5 seconds
        this.eventEmitter = new EventEmitter();
        this.sidebarCollapsed = false;
        this.isDarkTheme = false;
        this.searchTerm = '';
        
        // Available project colors
        this.projectColors = [
            '#6366f1', // Indigo
            '#8b5cf6', // Purple
            '#ec4899', // Pink
            '#ef4444', // Red
            '#f59e0b', // Amber
            '#10b981', // Emerald
            '#06b6d4', // Cyan
            '#3b82f6'  // Blue
        ];

        // Initialize
        this.initElements();
        this.initDB();
        this.loadSettings();
        this.addEventListeners();
        this.setupObservers();
    }

    /**
     * Initialize DOM element references
     */
    initElements() {
        // Main structure elements
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.mainContent = document.getElementById('main-content');
        this.addNoteBtn = document.getElementById('add-note-btn');
        this.notesContainer = document.getElementById('notes-container');
        
        // Header elements
        this.wordCountElement = document.getElementById('word-count');
        this.statsCountElement = document.getElementById('stats-count');
        this.authorInput = document.getElementById('author-input');
        this.sidebarAuthor = document.getElementById('sidebar-author');
        this.searchInput = document.getElementById('search-input');
        
        // Sidebar elements
        this.projectsList = document.getElementById('projects-list');
        this.tagsContainer = document.getElementById('tags-container');
        this.addProjectBtn = document.getElementById('add-project-btn');
        this.viewAllProjectsBtn = document.getElementById('view-all-projects');
        this.themeToggle = document.getElementById('theme-toggle');
        this.versionFrequency = document.getElementById('version-frequency');
        
        // Modal elements
        this.versionModal = document.getElementById('version-modal');
        this.projectsModal = document.getElementById('projects-modal');
        this.versionList = document.getElementById('version-list');
        this.projectsGrid = document.getElementById('projects-grid');
        
        // Modal close buttons
        this.modalCloseButtons = document.querySelectorAll('.modal-close');
        
        // Toast container
        this.toastContainer = document.getElementById('toast-container');
    }

    /**
     * Initialize IndexedDB database
     */
    initDB() {
        const dbName = 'ModernNotesDB';
        const dbVersion = 1;
        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = (event) => this.showToast("Database error: " + event.target.error, 'error');

        request.onsuccess = (event) => {
            this.db = event.target.result;
            this.loadDataFromDB();
        };

        request.onupgradeneeded = (event) => {
            this.db = event.target.result;
            if (!this.db.objectStoreNames.contains('notes')) {
                this.db.createObjectStore('notes', { keyPath: 'id' });
            }
            if (!this.db.objectStoreNames.contains('projects')) {
                this.db.createObjectStore('projects', { keyPath: 'id' });
            }
        };
    }

    /**
     * Load user settings from localStorage
     */
    loadSettings() {
        // Load theme preference
        this.isDarkTheme = localStorage.getItem('theme') === 'dark';
        if (this.isDarkTheme) {
            document.body.classList.add('dark-theme');
        }

        // Load author name
        const savedAuthor = localStorage.getItem('author');
        if (savedAuthor) {
            this.authorInput.value = savedAuthor;
            this.sidebarAuthor.textContent = savedAuthor;
        }

        // Load versioning interval preference
        const savedInterval = localStorage.getItem('versioningInterval');
        if (savedInterval) {
            this.versioningInterval = parseInt(savedInterval);
            this.versionFrequency.value = savedInterval;
        }
        
        // Load sidebar state
        this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
        if (this.sidebarCollapsed) {
            this.sidebar.classList.add('collapsed');
            this.mainContent.classList.add('full-width');
        }
    }

    /**
     * Add event listeners to DOM elements
     */
    addEventListeners() {
        // Sidebar toggle
        this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        
        // Note actions
        this.addNoteBtn.addEventListener('click', () => this.createNote());
        
        // Project actions
        this.addProjectBtn.addEventListener('click', () => 
            this.showInputToast("Enter project name:", (name) => this.addProject(name)));
        this.viewAllProjectsBtn.addEventListener('click', () => this.showProjectsModal());
        
        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        
        // Version control
        this.versionFrequency.addEventListener('change', (e) => this.updateVersioningInterval(e));
        
        // Modal close buttons
        this.modalCloseButtons.forEach(button => {
            button.addEventListener('click', () => this.closeModals());
        });
        
        // Search functionality
        this.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.trim().toLowerCase();
            this.renderNotes();
        });
        
        // Author input
        this.authorInput.addEventListener('change', (e) => {
            localStorage.setItem('author', e.target.value);
            this.sidebarAuthor.textContent = e.target.value;
        });
        
        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModals();
            }
        });
        
        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape key closes modals
            if (e.key === 'Escape') {
                this.closeModals();
            }
            
            // Ctrl+N creates a new note
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.createNote();
            }
        });
    }

    /**
     * Set up event observers for application state changes
     */
    setupObservers() {
        this.eventEmitter.on('noteUpdated', () => this.updateWordCount());
        this.eventEmitter.on('noteUpdated', () => this.renderProjects());
        this.eventEmitter.on('noteUpdated', () => this.updateTags());
        
        this.eventEmitter.on('noteAdded', () => this.renderNotes());
        this.eventEmitter.on('noteAdded', () => this.renderProjects());
        this.eventEmitter.on('noteAdded', () => this.updateTags());
        
        this.eventEmitter.on('noteDeleted', () => this.renderNotes());
        this.eventEmitter.on('noteDeleted', () => this.renderProjects());
        this.eventEmitter.on('noteDeleted', () => this.updateTags());
        
        this.eventEmitter.on('projectAdded', () => this.renderProjects());
        this.eventEmitter.on('projectDeleted', () => this.renderProjects());
        this.eventEmitter.on('projectDeleted', () => this.renderNotes());
        
        this.eventEmitter.on('tagSelected', (tag) => this.filterByTag(tag));
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        this.sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
        this.mainContent.classList.toggle('full-width', this.sidebarCollapsed);
        localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        document.body.classList.toggle('dark-theme', this.isDarkTheme);
        localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
        this.showToast("Theme updated", 'success');
    }

    /**
     * Update versioning interval
     */
    updateVersioningInterval(e) {
        this.versioningInterval = parseInt(e.target.value);
        localStorage.setItem('versioningInterval', this.versioningInterval);
        this.showToast(`Version control interval set to ${this.versioningInterval / 1000} seconds`, 'info');
    }

    /**
     * Load data from IndexedDB
     */
    loadDataFromDB() {
        // Load notes
        const notesStore = this.db.transaction('notes', 'readonly').objectStore('notes');
        notesStore.getAll().onsuccess = (event) => {
            this.notes = event.target.result;
            
            // Ensure each note has a versions array
            this.notes.forEach(note => {
                if (!Array.isArray(note.versions)) {
                    note.versions = [{
                        content: note.content,
                        date: note.date
                    }];
                    this.saveToIndexedDB('notes', note);
                }
                
                // Extract tags from notes
                if (note.tags && Array.isArray(note.tags)) {
                    note.tags.forEach(tag => this.tags.add(tag));
                }
            });
            
            this.eventEmitter.emit('noteUpdated');
            this.renderNotes();
        };
        
        // Load projects
        const projectsStore = this.db.transaction('projects', 'readonly').objectStore('projects');
        projectsStore.getAll().onsuccess = (event) => {
            this.projects = event.target.result;
            this.eventEmitter.emit('projectAdded');
        };
    }

    /**
     * Save data to IndexedDB
     * @param {string} storeName - Name of the object store
     * @param {object} data - Data to save
     * @returns {Promise} - Promise resolving to the result of the operation
     */
    saveToIndexedDB(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    /**
     * Delete data from IndexedDB
     * @param {string} storeName - Name of the object store
     * @param {number} id - ID of the item to delete
     * @returns {Promise} - Promise resolving to the result of the operation
     */
    deleteFromIndexedDB(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    /**
     * Create a new note
     * @param {string} title - Title of the note (default: 'New Note')
     * @param {string} content - Content of the note (default: '')
     * @param {number} projectId - ID of the project to associate with (default: currentProject)
     */
    createNote(title = 'New Note', content = '', projectId = this.currentProject) {
        const note = {
            id: Date.now(),
            title: title,
            content: content,
            author: this.authorInput.value || 'Anonymous',
            projectId: projectId,
            date: new Date().toLocaleString(),
            tags: [],
            versions: [{
                content: content,
                date: new Date().toLocaleString()
            }]
        };
        
        this.notes.push(note);
        this.saveToIndexedDB('notes', note)
            .then(() => {
                this.eventEmitter.emit('noteAdded', note);
                this.showToast("New note added", 'success');
            })
            .catch(error => this.showToast("Error adding note: " + error, 'error'));
    }

    /**
     * Update a note
     * @param {number} id - ID of the note to update
     * @param {string} field - Field to update
     * @param {any} value - New value
     */
    updateNote(id, field, value) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            const oldContent = note.content;
            note[field] = value;
            note.author = this.authorInput.value || note.author;
            note.date = new Date().toLocaleString();

            // Handle versioning for content changes
            if (field === 'content' && value !== oldContent && this.versioningInterval > 0) {
                const lastVersion = note.versions[note.versions.length - 1];
                const timeSinceLastVersion = new Date() - new Date(lastVersion.date);
                
                if (timeSinceLastVersion >= this.versioningInterval) {
                    note.versions.push({
                        content: value,
                        date: new Date().toLocaleString()
                    });
                } else {
                    lastVersion.content = value;
                    lastVersion.date = new Date().toLocaleString();
                }
            }

            this.saveToIndexedDB('notes', note)
                .then(() => {
                    this.eventEmitter.emit('noteUpdated', note);
                })
                .catch(error => this.showToast("Error updating note: " + error, 'error'));
        }
    }

    /**
     * Delete a note
     * @param {number} id - ID of the note to delete
     */
    deleteNote(id) {
        this.deleteFromIndexedDB('notes', id)
            .then(() => {
                this.notes = this.notes.filter(note => note.id !== id);
                this.eventEmitter.emit('noteDeleted', id);
                this.showToast("Note deleted", 'success');
            })
            .catch(error => this.showToast("Error deleting note: " + error, 'error'));
    }

    /**
     * Add a tag to a note
     * @param {number} noteId - ID of the note
     * @param {string} tag - Tag to add
     */
    addTag(noteId, tag) {
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            if (!note.tags) {
                note.tags = [];
            }
            
            if (!note.tags.includes(tag)) {
                note.tags.push(tag);
                this.tags.add(tag);
                
                this.saveToIndexedDB('notes', note)
                    .then(() => {
                        this.eventEmitter.emit('noteUpdated', note);
                        this.renderTags();
                    })
                    .catch(error => this.showToast("Error adding tag: " + error, 'error'));
            }
        }
    }

    /**
     * Remove a tag from a note
     * @param {number} noteId - ID of the note
     * @param {string} tag - Tag to remove
     */
    removeTag(noteId, tag) {
        const note = this.notes.find(n => n.id === noteId);
        if (note && note.tags) {
            note.tags = note.tags.filter(t => t !== tag);
            
            this.saveToIndexedDB('notes', note)
                .then(() => {
                    this.eventEmitter.emit('noteUpdated', note);
                    this.updateTags();
                })
                .catch(error => this.showToast("Error removing tag: " + error, 'error'));
        }
    }

    /**
     * Update the list of all tags in the application
     */
    updateTags() {
        this.tags.clear();
        this.notes.forEach(note => {
            if (note.tags && Array.isArray(note.tags)) {
                note.tags.forEach(tag => this.tags.add(tag));
            }
        });
        this.renderTags();
    }

    /**
     * Filter notes by tag
     * @param {string} tag - Tag to filter by
     */
    filterByTag(tag) {
        if (this.currentTag === tag) {
            this.currentTag = null;
        } else {
            this.currentTag = tag;
        }
        this.renderTags();
        this.renderNotes();
    }

    /**
     * Add a new project
     * @param {string} projectName - Name of the project
     */
    addProject(projectName) {
        if (projectName) {
            // Assign a random color from the available colors
            const colorIndex = Math.floor(Math.random() * this.projectColors.length);
            
            const project = {
                id: Date.now(),
                name: projectName,
                color: this.projectColors[colorIndex]
            };
            
            this.projects.push(project);
            this.saveToIndexedDB('projects', project)
                .then(() => {
                    this.eventEmitter.emit('projectAdded', project);
                    this.showToast("New project added: " + projectName, 'success');
                })
                .catch(error => this.showToast("Error adding project: " + error, 'error'));
        }
    }

    /**
     * Delete a project
     * @param {number} id - ID of the project to delete
     */
    deleteProject(id) {
        this.deleteFromIndexedDB('projects', id)
            .then(() => {
                this.projects = this.projects.filter(project => project.id !== id);
                
                // Handle associated notes
                const notesToDelete = this.notes.filter(note => note.projectId === id);
                Promise.all(notesToDelete.map(note => this.deleteFromIndexedDB('notes', note.id)))
                    .then(() => {
                        this.notes = this.notes.filter(note => note.projectId !== id);
                        if (this.currentProject === id) {
                            this.currentProject = null;
                        }
                        this.eventEmitter.emit('projectDeleted', id);
                        this.showToast("Project and associated notes deleted", 'success');
                    })
                    .catch(error => this.showToast("Error deleting project notes: " + error, 'error'));
            })
            .catch(error => this.showToast("Error deleting project: " + error, 'error'));
    }

    /**
     * Show version history for a note
     * @param {number} noteId - ID of the note
     */
    showVersionHistory(noteId) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        this.versionList.innerHTML = '';
        
        note.versions.forEach((version, index) => {
            const versionItem = document.createElement('div');
            versionItem.className = 'version-item';
            versionItem.innerHTML = `
                <div class="version-info">
                    <span class="version-number">Version ${index + 1}</span>
                    <span class="version-date">${version.date}</span>
                </div>
                <div class="version-actions">
                    <button class="preview-btn gradient-button">Preview</button>
                    <button class="restore-btn gradient-button">Restore</button>
                </div>
            `;
            
            versionItem.querySelector('.preview-btn').addEventListener('click', () => 
                this.previewVersion(noteId, index));
                
            versionItem.querySelector('.restore-btn').addEventListener('click', () => 
                this.restoreVersion(noteId, index));
                
            this.versionList.appendChild(versionItem);
        });

        this.versionModal.classList.add('active');
    }

    /**
     * Preview a specific version of a note
     * @param {number} noteId - ID of the note
     * @param {number} versionIndex - Index of the version to preview
     */
    previewVersion(noteId, versionIndex) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        const versionToPreview = note.versions[versionIndex];
        
        // Close the version history modal
        this.versionModal.classList.remove('active');
