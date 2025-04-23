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
        if (!note) {
            console.error(`Note with ID ${noteId} not found.`);
            return;
        }
        if (!note.versions || versionIndex < 0 || versionIndex >= note.versions.length) {
            console.error(`Invalid versionIndex: ${versionIndex}.`);
            return;
        }
        
        const versionToPreview = note.versions[versionIndex];
        
        // Close the version history modal
        this.versionModal.classList.remove('active');
        
        // Create a modal to preview the version
        const previewModal = document.createElement('div');
        previewModal.className = 'modal active';
        previewModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title">Preview of Version ${versionIndex + 1} - ${versionToPreview.date}</div>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="preview-content">
                    ${versionToPreview.content}
                </div>
                <div style="margin-top: 1rem; text-align: right;">
                    <button class="restore-preview-btn gradient-button">Restore This Version</button>
                </div>
            </div>
        `;
        
        // Add event listeners
        previewModal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(previewModal);
            this.versionModal.classList.add('active');
        });
        
        previewModal.querySelector('.restore-preview-btn').addEventListener('click', () => {
            document.body.removeChild(previewModal);
            this.restoreVersion(noteId, versionIndex);
        });
        
        document.body.appendChild(previewModal);
    }

    /**
     * Restore a specific version of a note
     * @param {number} noteId - ID of the note
     * @param {number} versionIndex - Index of the version to restore
     */
    restoreVersion(noteId, versionIndex) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        const versionToRestore = note.versions[versionIndex];
        const newVersion = {
            content: note.content,
            date: new Date().toLocaleString()
        };
        
        // Add current content as a new version
        note.versions.push(newVersion);
        
        // Restore the selected version content
        note.content = versionToRestore.content;
        note.date = new Date().toLocaleString();

        this.saveToIndexedDB('notes', note)
            .then(() => {
                this.eventEmitter.emit('noteUpdated', note);
                this.closeModals();
                this.showToast("Version restored", 'success');
            })
            .catch(error => this.showToast("Error restoring version: " + error, 'error'));
    }

    /**
     * Show modal with all projects in a grid view
     */
    showProjectsModal() {
        this.projectsGrid.innerHTML = '';
        
        this.projects.forEach(project => {
            const projectCard = document.createElement('div');
            projectCard.className = 'project-card';
            projectCard.style.setProperty('--project-color', project.color);
            projectCard.style.setProperty('border-left', `4px solid ${project.color}`);
            
            // Count notes in this project
            const projectNotes = this.notes.filter(note => note.projectId === project.id);
            
            projectCard.innerHTML = `
                <div class="project-card-title">${project.name}</div>
                <div class="project-card-count">${projectNotes.length} notes</div>
                <div class="project-card-notes">
                    ${projectNotes.slice(0, 3).map(note => `
                        <div class="project-card-note">${note.title}</div>
                    `).join('')}
                    ${projectNotes.length > 3 ? `<div class="project-card-note">... and ${projectNotes.length - 3} more</div>` : ''}
                </div>
            `;
            
            projectCard.addEventListener('click', () => {
                this.currentProject = project.id;
                this.renderNotes();
                this.closeModals();
                
                // Find and expand the project in the sidebar
                const projectElement = document.querySelector(`.project-item[data-id="${project.id}"]`);
                if (projectElement) {
                    const projectNotes = projectElement.querySelector('.project-notes');
                    if (projectNotes && !projectNotes.classList.contains('expanded')) {
                        projectNotes.classList.add('expanded');
                    }
                }
                
                this.showToast(`Switched to project: ${project.name}`, 'info');
            });
            
            this.projectsGrid.appendChild(projectCard);
        });
        
        this.projectsModal.classList.add('active');
    }

    /**
     * Close all modals
     */
    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    /**
     * Apply formatting to note content
     * @param {number} noteId - ID of the note
     * @param {string} format - Format to apply
     */
    applyFormatting(noteId, format) {
        const noteContent = document.querySelector(`.note[data-id="${noteId}"] .note-content`);
        const selection = window.getSelection();
        
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        if (range.toString().length > 0) {
            switch(format) {
                case 'bold':
                    document.execCommand('bold', false, null);
                    break;
                case 'italic':
                    document.execCommand('italic', false, null);
                    break;
                case 'underline':
                    document.execCommand('underline', false, null);
                    break;
                case 'strikethrough':
                    document.execCommand('strikeThrough', false, null);
                    break;
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'p':
                    document.execCommand('formatBlock', false, `<${format}>`);
                    break;
                case 'ul':
                    document.execCommand('insertUnorderedList', false, null);
                    break;
                case 'ol':
                    document.execCommand('insertOrderedList', false, null);
                    break;
            }
            
            this.updateNote(noteId, 'content', noteContent.innerHTML);
        }
    }

    /**
     * Update word count display
     */
    updateWordCount() {
        let wordCount = 0;
        let noteCount = this.notes.length;
        
        // Count words in all notes
        this.notes.forEach(note => {
            const text = note.content.replace(/<[^>]*>/g, '').trim();
            const words = text.split(/\s+/).filter(word => word.length > 0);
            wordCount += words.length;
        });
        
        // Update UI
        this.wordCountElement.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
        this.statsCountElement.textContent = `${noteCount} note${noteCount !== 1 ? 's' : ''}`;
    }

    /**
     * Render projects in the sidebar
     */
    renderProjects() {
        this.projectsList.innerHTML = '';
        
        this.projects.forEach(project => {
            const projectElement = document.createElement('div');
            projectElement.className = 'project-item';
            projectElement.dataset.id = project.id;
            
            // Count notes in this project
            const projectNotes = this.notes.filter(note => note.projectId === project.id);
            
            projectElement.innerHTML = `
                <div class="project-header ${this.currentProject === project.id ? 'active' : ''}">
                    <div class="project-title">
                        <span class="project-color" style="background-color: ${project.color}"></span>
                        ${project.name}
                    </div>
                    <div class="project-controls">
                        <span class="project-note-count">${projectNotes.length}</span>
                        <button class="icon-button delete" title="Delete Project">
                            <svg class="icon" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="project-notes ${this.currentProject === project.id ? 'expanded' : ''}">
                    ${projectNotes.map(note => `
                        <div class="project-note" data-id="${note.id}">${note.title}</div>
                    `).join('')}
                    ${projectNotes.length === 0 ? `<div class="project-note empty">No notes</div>` : ''}
                </div>
            `;
            
            // Add event listeners
            projectElement.querySelector('.project-header').addEventListener('click', () => {
                const notesEl = projectElement.querySelector('.project-notes');
                notesEl.classList.toggle('expanded');
                
                if (this.currentProject !== project.id) {
                    this.currentProject = project.id;
                    this.renderNotes();
                    
                    // Update active state
                    document.querySelectorAll('.project-header').forEach(header => {
                        header.classList.remove('active');
                    });
                    projectElement.querySelector('.project-header').classList.add('active');
                    
                    this.showToast(`Switched to project: ${project.name}`, 'info');
                }
            });
            
            projectElement.querySelector('.icon-button.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                
                if (confirm(`Are you sure you want to delete project "${project.name}" and all its notes?`)) {
                    this.deleteProject(project.id);
                }
            });
            
            // Add click listeners for notes
            projectElement.querySelectorAll('.project-note:not(.empty)').forEach(noteEl => {
                noteEl.addEventListener('click', () => {
                    const noteId = parseInt(noteEl.dataset.id);
                    const noteElement = document.querySelector(`.note[data-id="${noteId}"]`);
                    
                    if (noteElement) {
                        noteElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        
                        // Highlight the note briefly
                        noteElement.classList.add('highlight');
                        setTimeout(() => {
                            noteElement.classList.remove('highlight');
                        }, 1500);
                    }
                });
            });
            
            this.projectsList.appendChild(projectElement);
        });
    }

    /**
     * Render tags in the sidebar
     */
    renderTags() {
        this.tagsContainer.innerHTML = '';
        
        Array.from(this.tags).sort().forEach(tag => {
            const tagElement = document.createElement('div');
            tagElement.className = `tag ${this.currentTag === tag ? 'active' : ''}`;
            tagElement.textContent = tag;
            
            tagElement.addEventListener('click', () => {
                this.eventEmitter.emit('tagSelected', tag);
            });
            
            this.tagsContainer.appendChild(tagElement);
        });
        
        // Add a "create tag" button if there are notes
        if (this.notes.length > 0) {
            const addTagEl = document.createElement('div');
            addTagEl.className = 'tag';
            addTagEl.innerHTML = '<svg class="icon" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg> Add';
            
            addTagEl.addEventListener('click', () => {
                this.showInputToast("Enter tag name:", (name) => {
                    if (name && !this.tags.has(name)) {
                        // Add the tag to a note
                        if (this.notes.length > 0) {
                            this.addTag(this.notes[0].id, name);
                        }
                    }
                });
            });
            
            this.tagsContainer.appendChild(addTagEl);
        }
    }

    /**
     * Render notes in the main container
     */
    renderNotes() {
        this.notesContainer.innerHTML = '';
        
        // Filter notes by project, tag, and search term
        let filteredNotes = this.notes;
        
        if (this.currentProject) {
            filteredNotes = filteredNotes.filter(note => note.projectId === this.currentProject);
        }
        
        if (this.currentTag) {
            filteredNotes = filteredNotes.filter(note => 
                note.tags && note.tags.includes(this.currentTag));
        }
        
        if (this.searchTerm) {
            filteredNotes = filteredNotes.filter(note => 
                note.title.toLowerCase().includes(this.searchTerm) || 
                note.content.toLowerCase().includes(this.searchTerm));
        }
        
        // Sort notes by date (newest first)
        filteredNotes.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        if (filteredNotes.length === 0) {
            this.notesContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No notes found</h3>
                    <p>Create a new note or change your filters</p>
                </div>
            `;
            return;
        }
        
        filteredNotes.forEach(note => {
            const noteElement = document.createElement('div');
            noteElement.className = 'note';
            noteElement.dataset.id = note.id;
            
            // Find project info
            const project = this.projects.find(p => p.id === note.projectId);
            const projectName = project ? project.name : 'No Project';
            const projectColor = project ? project.color : '#888';
            
            noteElement.innerHTML = `
                <div class="note-header">
                    <div class="note-title-container">
                        <div class="note-project">
                            <span class="project-color" style="background-color: ${projectColor}"></span>
                            ${projectName}
                        </div>
                        <input type="text" class="note-title" value="${note.title}">
                        ${note.tags && note.tags.length > 0 ? `
                            <div class="tags-container">
                                ${note.tags.map(tag => `
                                    <span class="tag">${tag}</span>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <div class="note-controls">
                        <button class="icon-button" title="Version History">
                            <svg class="icon" viewBox="0 0 16 16">
                                <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
                                <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
                            </svg>
                        </button>
                        <button class="icon-button" title="Add Tag">
                            <svg class="icon" viewBox="0 0 16 16">
                                <path d="M3 2v4.586l7 7L14.586 9l-7-7H3zM2 2a1 1 0 0 1 1-1h4.586a1 1 0 0 1 .707.293l7 7a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0l-7-7A1 1 0 0 1 2 6.586V2z"/>
                                <path d="M5.5 5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1zm0 1a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                            </svg>
                        </button>
                        <button class="icon-button delete" title="Delete Note">
                            <svg class="icon" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="formatting-menu">
                    <button data-format="bold">B</button>
                    <button data-format="italic">I</button>
                    <button data-format="underline">U</button>
                    <button data-format="strikethrough">S</button>
                    <button data-format="h1">H1</button>
                    <button data-format="h2">H2</button>
                    <button data-format="h3">H3</button>
                    <button data-format="p">P</button>
                    <button data-format="ul">• List</button>
                    <button data-format="ol">1. List</button>
                </div>
                
                <div class="note-content" contenteditable="true">${note.content}</div>
                
                <div class="note-footer">
                    <div class="note-meta">
                        <span>By ${note.author}</span>
                        <span>Last edited: ${note.date}</span>
                    </div>
                    <div class="note-versions" title="View version history">
                        ${note.versions.length} version${note.versions.length !== 1 ? 's' : ''}
                    </div>
                </div>
            `;
            
            // Add event listeners
            const titleInput = noteElement.querySelector('.note-title');
            titleInput.addEventListener('change', () => {
                this.updateNote(note.id, 'title', titleInput.value);
            });
            
            const contentElement = noteElement.querySelector('.note-content');
            let updateTimeout;
            contentElement.addEventListener('input', () => {
                clearTimeout(updateTimeout);
                updateTimeout = setTimeout(() => {
                    this.updateNote(note.id, 'content', contentElement.innerHTML);
                }, this.versioningInterval);
            });
            
            // Formatting buttons
            noteElement.querySelectorAll('.formatting-menu button').forEach(button => {
                button.addEventListener('click', () => {
                    this.applyFormatting(note.id, button.dataset.format);
                });
            });
            
            // Control buttons
            noteElement.querySelector('.icon-button[title="Version History"]').addEventListener('click', () => {
                this.showVersionHistory(note.id);
            });
            
            noteElement.querySelector('.note-versions').addEventListener('click', () => {
                this.showVersionHistory(note.id);
            });
            
            noteElement.querySelector('.icon-button[title="Add Tag"]').addEventListener('click', () => {
                this.showInputToast("Enter tag name:", (tagName) => {
                    if (tagName) {
                        this.addTag(note.id, tagName);
                    }
                });
            });
            
            noteElement.querySelector('.icon-button.delete').addEventListener('click', () => {
                if (confirm("Are you sure you want to delete this note?")) {
                    this.deleteNote(note.id);
                }
            });
            
            // Make tags clickable
            noteElement.querySelectorAll('.tag').forEach(tagEl => {
                tagEl.addEventListener('click', () => {
                    this.eventEmitter.emit('tagSelected', tagEl.textContent);
                });
            });
            
            this.notesContainer.appendChild(noteElement);
        });
        
        this.updateWordCount();
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Type of toast (success, error, info)
     * @param {number} duration - Duration in ms
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '!';
        if (type === 'success') icon = '✓';
        if (type === 'error') icon = '✗';
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(100px)';
            setTimeout(() => toast.remove(), 300);
        });
        
        this.toastContainer.appendChild(toast);
        
        // Trigger reflow to enable animation
        toast.offsetHeight;
        
        toast.classList.add('visible');
        
        if (duration > 0) {
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(100px)';
                setTimeout(() => toast.remove(), 300);
            }, duration);
        }
    }

    /**
     * Show a toast with an input field
     * @param {string} message - Message to display
     * @param {function} callback - Function to call with input value
     */
    showInputToast(message, callback) {
        const toast = document.createElement('div');
        toast.className = 'toast info';
        
        toast.innerHTML = `
            <div class="toast-icon">?</div>
            <div class="toast-content">
                <div class="toast-title">${message}</div>
                <input type="text" id="toast-input" placeholder="Type here...">
            </div>
            <button class="toast-close">&times;</button>
        `;
        
        const input = toast.querySelector('#toast-input');
        
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(100px)';
            setTimeout(() => toast.remove(), 300);
        });
        
        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const value = input.value.trim();
                if (value) {
                    callback(value);
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(100px)';
                    setTimeout(() => toast.remove(), 300);
                }
            }
        });
        
        this.toastContainer.appendChild(toast);
        
        // Trigger reflow to enable animation
        toast.offsetHeight;
        
        toast.classList.add('visible');
        
        // Focus the input after animation
        setTimeout(() => {
            input.focus();
        }, 300);
    }
}

/**
 * Add export HTML feature
 * @param {number} noteId - ID of the note to export
 */
NotesApp.prototype.exportNoteAsHTML = function(noteId) {
    const note = this.notes.find(n => n.id === noteId);
    if (!note) {
        this.showToast("Note not found", 'error');
        return;
    }
    
    // Find project info
    const project = this.projects.find(p => p.id === note.projectId);
    const projectName = project ? project.name : 'No Project';
    
    // Create HTML content
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${note.title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .note-header {
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .note-project {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 5px;
        }
        .note-title {
            font-size: 2rem;
            margin: 0 0 10px 0;
        }
        .note-meta {
            font-size: 0.8rem;
            color: #777;
            margin-top: 5px;
        }
        .note-content {
            margin-top: 20px;
        }
        .tags {
            margin-top: 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        .tag {
            background: #f0f0f0;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 0.8rem;
            color: #555;
        }
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 0.8rem;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="note-header">
        <div class="note-project">Project: ${projectName}</div>
        <h1 class="note-title">${note.title}</h1>
        <div class="note-meta">
            <div>By ${note.author}</div>
            <div>Last edited: ${note.date}</div>
        </div>
    </div>
    
    <div class="note-content">
        ${note.content}
    </div>
    
    ${note.tags && note.tags.length > 0 ? `
    <div class="tags">
        ${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
    </div>
    ` : ''}
    
    <div class="footer">
        Exported from Modern Notes - ${new Date().toLocaleString()}
    </div>
</body>
</html>`;
    
    // Create download link
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
    a.click();
    
    // Clean up
    URL.revokeObjectURL(url);
    this.showToast("Note exported successfully", 'success');
};

// Add export button to note rendering
const originalRenderNotes = NotesApp.prototype.renderNotes;
NotesApp.prototype.renderNotes = function() {
    originalRenderNotes.call(this);
    
    // Add export button to each note
    document.querySelectorAll('.note').forEach(noteEl => {
        const noteId = parseInt(noteEl.dataset.id);
        const controlsEl = noteEl.querySelector('.note-controls');
        
        if (controlsEl) {
            const exportBtn = document.createElement('button');
            exportBtn.className = 'icon-button';
            exportBtn.title = 'Export as HTML';
            exportBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 16 16">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
            `;
            
            exportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.exportNoteAsHTML(noteId);
            });
            
            // Insert before delete button
            const deleteBtn = controlsEl.querySelector('.delete');
            controlsEl.insertBefore(exportBtn, deleteBtn);
        }
    });
};

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.notesApp = new NotesApp();
}); /**
     * version of a note
     * @param {number} noteId - ID of the note
     * @param {number} versionIndex - Index of the version to restore
     */
    restoreVersion(noteId, versionIndex) {
        const note = this.notes.find(n => n.id === noteId);
        if (!note) return;

        const versionToRestore = note.versions[versionIndex];
        const newVersion = {
            content: note.content,
            note.date: new Date().toLocaleString()
        };
        
        // Add current content as a new version
        note.versions.push(newVersion);
        
        // Restore the selected version content
        note.content = versionToRestore.content;
        note.date = new Date().toLocaleString();
