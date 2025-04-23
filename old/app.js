    class EventEmitter {
            constructor() {
                this.events = {};
            }

            on(eventName, callback) {
                if (!this.events[eventName]) {
                    this.events[eventName] = [];
                }
                this.events[eventName].push(callback);
            }

            emit(eventName, data) {
                const event = this.events[eventName];
                if (event) {
                    event.forEach(callback => callback(data));
                }
            }
        }

        class NotesApp {
            constructor() {
                this.db = null;
                this.notes = [];
                this.projects = [];
                this.currentProject = null;
                this.versioningInterval = 5000; // Default to 5 seconds
                this.eventEmitter = new EventEmitter();
                this.sidebarCollapsed = false;

                this.initElements();
                this.initDB();
                this.addEventListeners();
                this.setupObservers();
            }

            initElements() {
                this.sidebar = document.getElementById('sidebar');
                this.sidebarToggle = document.getElementById('sidebar-toggle');
                this.mainContent = document.getElementById('main-content');
                this.addNoteBtn = document.getElementById('add-note-btn');
                this.notesContainer = document.getElementById('notes-container');
                this.wordCountElement = document.getElementById('word-count');
                this.authorInput = document.getElementById('author-input');
                this.projectsList = document.getElementById('projects-list');
                this.addProjectBtn = document.getElementById('add-project-btn');
                this.themeToggle = document.getElementById('theme-toggle');
                this.toastContainer = document.getElementById('toast-container');
                this.versionFrequency = document.getElementById('version-frequency');
            }

            initDB() {
                const dbName = 'NotesAppDB';
                const dbVersion = 1;
                const request = indexedDB.open(dbName, dbVersion);

                request.onerror = (event) => this.showToast("Database error: " + event.target.error);

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

            addEventListeners() {
                this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
                this.addNoteBtn.addEventListener('click', () => this.createNote());
                this.addProjectBtn.addEventListener('click', () => this.showInputToast("Enter project name:", (name) => this.addProject(name)));
                this.themeToggle.addEventListener('click', () => this.toggleTheme());
                this.versionFrequency.addEventListener('change', (e) => {
                    this.versioningInterval = parseInt(e.target.value);
                    this.showToast(`Version control interval set to ${this.versioningInterval / 1000} seconds`);
                });

                document.addEventListener('DOMContentLoaded', () => {
                    const savedTheme = localStorage.getItem('theme');
                    if (savedTheme === 'dark') {
                        document.body.classList.add('dark-theme');
                    }

                    const savedAuthor = localStorage.getItem('author');
                    if (savedAuthor) {
                        this.authorInput.value = savedAuthor;
                    }

                    this.authorInput.addEventListener('change', (e) => {
                        localStorage.setItem('author', e.target.value);
                    });
                });
            }

            setupObservers() {
                this.eventEmitter.on('noteUpdated', () => this.updateWordCount());
                this.eventEmitter.on('noteUpdated', () => this.renderProjects());
                this.eventEmitter.on('noteAdded', () => this.renderNotes());
                this.eventEmitter.on('noteAdded', () => this.renderProjects());
                this.eventEmitter.on('noteDeleted', () => this.renderNotes());
                this.eventEmitter.on('noteDeleted', () => this.renderProjects());
                this.eventEmitter.on('projectAdded', () => this.renderProjects());
                this.eventEmitter.on('projectDeleted', () => this.renderProjects());
                this.eventEmitter.on('projectDeleted', () => this.renderNotes());
            }

            toggleSidebar() {
                this.sidebarCollapsed = !this.sidebarCollapsed;
                this.sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
                this.mainContent.classList.toggle('full-width', this.sidebarCollapsed);
                this.sidebarToggle.textContent = this.sidebarCollapsed ? '☰' : '⌘';
            }

            loadDataFromDB() {
                const notesStore = this.db.transaction('notes', 'readonly').objectStore('notes');
                notesStore.getAll().onsuccess = (event) => {
                    this.notes = event.target.result;
                    this.notes.forEach(note => {
                        if (!Array.isArray(note.versions)) {
                            note.versions = [{
                                content: note.content,
                                date: note.date
                            }];
                            this.saveToIndexedDB('notes', note);
                        }
                    });
                    this.eventEmitter.emit('noteUpdated');
                };
              const projectsStore = this.db.transaction('projects', 'readonly').objectStore('projects');
                projectsStore.getAll().onsuccess = (event) => {
                    this.projects = event.target.result;
                    this.eventEmitter.emit('projectAdded');
                };
            }

            saveToIndexedDB(storeName, data) {
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(storeName, 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.put(data);
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => resolve(request.result);
                });
            }

            deleteFromIndexedDB(storeName, id) {
                return new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(storeName, 'readwrite');
                    const store = transaction.objectStore(storeName);
                    const request = store.delete(id);
                    request.onerror = () => reject(request.error);
                    request.onsuccess = () => resolve(request.result);
                });
            }

            createNote(title = 'New Note', content = '', projectId = this.currentProject) {
                const note = {
                    id: Date.now(),
                    title: title,
                    content: content,
                    author: this.authorInput.value || 'Anonymous',
                    projectId: projectId,
                    date: new Date().toLocaleString(),
                    versions: [{
                        content: content,
                        date: new Date().toLocaleString()
                    }]
                };
                this.notes.push(note);
                this.saveToIndexedDB('notes', note)
                    .then(() => {
                        this.eventEmitter.emit('noteAdded', note);
                        this.showToast("New note added");
                    })
                    .catch(error => this.showToast("Error adding note: " + error));
            }

            updateNote(id, field, value) {
                const note = this.notes.find(n => n.id === id);
                if (note) {
                    const oldContent = note.content;
                    note[field] = value;
                    note.author = this.authorInput.value || note.author;
                    note.date = new Date().toLocaleString();

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
                        .catch(error => this.showToast("Error updating note: " + error));
                }
            }

            deleteNote(id) {
                this.deleteFromIndexedDB('notes', id)
                    .then(() => {
                        this.notes = this.notes.filter(note => note.id !== id);
                        this.eventEmitter.emit('noteDeleted', id);
                        this.showToast("Note deleted");
                    })
                    .catch(error => this.showToast("Error deleting note: " + error));
            }

            renderNotes() {
                this.notesContainer.innerHTML = '';
                const filteredNotes = this.currentProject ? this.notes.filter(note => note.projectId === this.currentProject) : this.notes;
                filteredNotes.forEach(note => {
                    const noteElement = document.createElement('div');
                    noteElement.className = 'note';
                    noteElement.dataset.id = note.id;
                    noteElement.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <input type="text" class="note-title" value="${note.title}">
                            <button class="version-history-btn">History</button>
                            <button class="delete-btn"><svg viewBox="0 0 448 512" width="10" title="trash-alt">
                        <path d="M32 464a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128H32zm272-256a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zM432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16z"></path>
                    </svg></button>
                        </div>
                        <div class="formatting-menu">
                            <button data-format="bold">B</button>
                            <button data-format="italic">I</button>
                            <button data-format="underline">U</button>
                            <button data-format="strikethrough">S</button>
                            <button data-format="h1">H1</button>
                            <button data-format="h2">H2</button>
                            <button data-format="h3">H3</button>
                            <button data-format="h4">H4</button>
                            <button data-format="paragraph">P</button>
                            <button data-format="unordered-list">UL</button>
                            <button data-format="ordered-list">OL</button>
                        </div>
                        <div class="note-content" contenteditable="true">${note.content}</div>
                        <div>Author: ${note.author}</div>
                        <div>Date: ${note.date}</div>
                        <div>Versions: ${note.versions.length}</div>
                    `;
                    noteElement.querySelector('.note-title').addEventListener('input', (e) => this.updateNote(note.id, 'title', e.target.value));
                    
                    const contentElement = noteElement.querySelector('.note-content');
                    let updateTimeout;
                    contentElement.addEventListener('input', () => {
                        clearTimeout(updateTimeout);
                        updateTimeout = setTimeout(() => {
                            this.updateNote(note.id, 'content', contentElement.innerHTML);
                        }, this.versioningInterval);
                    });
                    
                    noteElement.querySelectorAll('.formatting-menu button').forEach(button => {
                        button.addEventListener('click', () => this.applyFormatting(note.id, button.dataset.format));
                    });
                    
                    noteElement.querySelector('.delete-btn').addEventListener('click', () => this.deleteNote(note.id));
                    noteElement.querySelector('.version-history-btn').addEventListener('click', () => this.showVersionHistory(note.id));
                    
                    this.notesContainer.appendChild(noteElement);
                });
                this.updateWordCount();
            }

            applyFormatting(noteId, format) {
                const noteContent = document.querySelector(`.note[data-id="${noteId}"] .note-content`);
                const selection = window.getSelection();
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
                        case 'paragraph':
                            document.execCommand('formatBlock', false, `<${format}>`);
                            break;
                        case 'unordered-list':
                            document.execCommand('insertUnorderedList', false, null);
                            break;
                        case 'ordered-list':
                            document.execCommand('insertOrderedList', false, null);
                            break;
                    }
                    this.updateNote(noteId, 'content', noteContent.innerHTML);
                }
            }

            updateWordCount() {
                const wordCount = this.notes.reduce((count, note) => {
                    return count + note.content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(word => word.length > 0).length;
                }, 0);
                this.wordCountElement.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
            }

            addProject(projectName) {
                if (projectName) {
                    const project = {
                        id: Date.now(),
                        name: projectName
                    };
                    this.projects.push(project);
                    this.saveToIndexedDB('projects', project)
                        .then(() => {
                            this.eventEmitter.emit('projectAdded', project);
                            this.showToast("New project added: " + projectName);
                        })
                        .catch(error => this.showToast("Error adding project: " + error));
                }
            }

            renderProjects() {
                this.projectsList.innerHTML = '';
                this.projects.forEach(project => {
                    const projectElement = document.createElement('div');
                    projectElement.className = 'project-item';
                    projectElement.innerHTML = `
                        <div class="project-title">${project.name}</div>
                        <button class="delete-btn"><svg viewBox="0 0 448 512" width="10" title="trash-alt">
                        <path d="M32 464a48 48 0 0 0 48 48h288a48 48 0 0 0 48-48V128H32zm272-256a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zm-96 0a16 16 0 0 1 32 0v224a16 16 0 0 1-32 0zM432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16z"></path>
                    </svg></button>
                    `;
                    projectElement.querySelector('.project-title').addEventListener('click', () => {
                        this.currentProject = project.id;
                        this.renderNotes();
                        this.showToast("Switched to project: " + project.name);
                    });

                    projectElement.querySelector('.delete-btn').addEventListener('click', () => this.deleteProject(project.id));

                    const projectNotes = document.createElement('div');
                    projectNotes.className = 'project-notes';
                    this.notes.filter(note => note.projectId === project.id).forEach(note => {
                        const noteElement = document.createElement('div');
                        noteElement.className = 'project-note';
                        noteElement.textContent = note.title;
                        noteElement.addEventListener('click', () => {
                            this.currentProject = project.id;
                            this.renderNotes();
                            const noteInMain = document.querySelector(`.note[data-id="${note.id}"]`);
                            if (noteInMain) noteInMain.scrollIntoView({ behavior: 'smooth' });
                        });
                        projectNotes.appendChild(noteElement);
                    });

                    projectElement.appendChild(projectNotes);
                    this.projectsList.appendChild(projectElement);
                });
            }

            deleteProject(id) {
                this.deleteFromIndexedDB('projects', id)
                    .then(() => {
                        this.projects = this.projects.filter(project => project.id !== id);
                        const notesToDelete = this.notes.filter(note => note.projectId === id);
                        Promise.all(notesToDelete.map(note => this.deleteFromIndexedDB('notes', note.id)))
                            .then(() => {
                                this.notes = this.notes.filter(note => note.projectId !== id);
                                if (this.currentProject === id) {
                                    this.currentProject = null;
                                }
                                this.eventEmitter.emit('projectDeleted', id);
                                this.showToast("Project and associated notes deleted");
                            })
                            .catch(error => this.showToast("Error deleting project notes: " + error));
                    })
                    .catch(error => this.showToast("Error deleting project: " + error));
            }

            showVersionHistory(noteId) {
                const note = this.notes.find(n => n.id === noteId);
                if (!note) return;

                const versionList = note.versions.map((version, index) => `
                    <div class="version-item">
                        <span>Version ${index + 1} - ${version.date}</span>
                        <button onclick="notesApp.previewVersion(${noteId}, ${index})">Preview</button>
                    </div>
                `).join('');

                this.showModal(`
                    <h3>Version History for "${note.title}"</h3>
                    ${versionList}
                `);
            }

            previewVersion(noteId, versionIndex) {
                const note = this.notes.find(n => n.id === noteId);
                if (!note) return;

                const versionToPreview = note.versions[versionIndex];
                this.showModal(`
                    <h3>Preview of Version ${versionIndex + 1} - ${versionToPreview.date}</h3>
                    <div>${versionToPreview.content}</div>
                    <button onclick="notesApp.restoreVersion(${noteId}, ${versionIndex})">Restore This Version</button>
                `);
            }

            restoreVersion(noteId, versionIndex) {
                const note = this.notes.find(n => n.id === noteId);
                if (!note) return;

                const versionToRestore = note.versions[versionIndex];
                const newVersion = {
                    content: note.content,
                    date: new Date().toLocaleString()
                };
                note.versions.push(newVersion);
                note.content = versionToRestore.content;
                note.date = new Date().toLocaleString();

                this.saveToIndexedDB('notes', note)
                    .then(() => {
                        this.eventEmitter.emit('noteUpdated', note);
                        this.closeModal();
                        this.showToast("Version restored");
                    })
                    .catch(error => this.showToast("Error restoring version: " + error));
            }

            showModal(content) {
                const modal = document.createElement('div');
                modal.className = 'modal';
                modal.innerHTML = `
                    <div class="modal-content">
                        ${content}
                        <button onclick="notesApp.closeModal()">Close</button>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            closeModal() {
                const modal = document.querySelector('.modal');
                if (modal) {
                    modal.remove();
                }
            }

            toggleTheme() {
                document.body.classList.toggle('dark-theme');
                localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
                this.showToast("Theme toggled");
            }

            showToast(message, duration = 3000) {
                const toast = document.createElement('div');
                toast.className = 'toast';
                toast.textContent = message;
                this.toastContainer.appendChild(toast);
                setTimeout(() => toast.style.opacity = '1', 10);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    setTimeout(() => toast.remove(), 300);
                }, duration);
            }

            showInputToast(message, callback) {
                const toast = document.createElement('div');
                toast.className = 'toast';
                toast.innerHTML = `
                    ${message}
                    <input type="text" id="toast-input">
                    <button onclick="notesApp.closeToast(this.parentNode)">Cancel</button>
                `;
                this.toastContainer.appendChild(toast);
                setTimeout(() => toast.style.opacity = '1', 10);

                const input = toast.querySelector('#toast-input');
                input.focus();
                input.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') {
                        const value = input.value.trim();
                        if (value) {
                            callback(value);
                            this.closeToast(toast);
                        }
                    }
                });
            }

            closeToast(toast) {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }
        }

        // Initialize the application
        const notesApp = new NotesApp();
