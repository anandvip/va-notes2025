// Modern Notes Application
// Feature-rich note-taking with project organization, rich text, version control, and more.

/**
 * EventEmitter - Simple pub/sub implementation
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
    // flags to delay listener binding
    this._listenersAdded = false;

    // App state
    this.db = null;
    this.notes = [];
    this.projects = [];
    this.tags = new Set();
    this.currentProject = null;
    this.currentTag = null;
    this.versioningInterval = 5000; // ms
    this._notesLoaded = false;
    this._projectsLoaded = false;

    this.eventEmitter = new EventEmitter();
    this.sidebarCollapsed = false;
    this.isDarkTheme = false;
    this.searchTerm = '';

    this.projectColors = [
      '#6366f1','#8b5cf6','#ec4899','#ef4444',
      '#f59e0b','#10b981','#06b6d4','#3b82f6'
    ];

    this.initElements();
    this.initDB();          // wait for DB
    this.loadSettings();    // apply UI prefs
  }

  initElements() {
    const map = {
      sidebar: 'sidebar',
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
      if (!el) throw new Error(`Missing element: #${id}`);
      this[prop] = el;
    }
    this.modalCloseButtons = document.querySelectorAll('.modal-close');
  }

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
    req.onsuccess = e => {
      this.db = e.target.result;
      this.loadDataFromDB();
    };
  }

  loadSettings() {
    this.isDarkTheme = localStorage.getItem('theme') === 'dark';
    document.body.classList.toggle('dark-theme', this.isDarkTheme);

    const author = localStorage.getItem('author');
    if (author) {
      this.authorInput.value = author;
      this.sidebarAuthor.textContent = author;
    }

    const sec = parseInt(localStorage.getItem('versioningInterval'),10);
    if (!isNaN(sec)) {
      this.versioningInterval = sec*1000;
      this.versionFrequency.value = sec;
    }

    this.sidebarCollapsed = localStorage.getItem('sidebarCollapsed')==='true';
    this.sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
    this.mainContent.classList.toggle('full-width', this.sidebarCollapsed);
  }

  addEventListeners() {
    this.sidebarToggle.addEventListener('click', ()=>this.toggleSidebar());
    this.addNoteBtn.addEventListener('click', ()=>this.createNote());
    this.addProjectBtn.addEventListener('click', ()=>
      this.showInputToast('Enter project name:', name=>this.addProject(name))
    );
    this.viewAllProjects.addEventListener('click', ()=>this.showProjectsModal());
    this.themeToggle.addEventListener('click', ()=>this.toggleTheme());
    this.versionFrequency.addEventListener('change', e=>this.updateVersioningInterval(e));

    this.modalCloseButtons.forEach(btn=>btn.addEventListener('click', ()=>this.closeModals()));
    this.searchInput.addEventListener('input', e=>{
      this.searchTerm = e.target.value.trim().toLowerCase();
      this.renderNotes();
    });
    this.authorInput.addEventListener('change', e=>{
      localStorage.setItem('author', e.target.value);
      this.sidebarAuthor.textContent = e.target.value;
    });
    window.addEventListener('click', e=>{
      if (e.target.classList.contains('modal')) this.closeModals();
    });
    document.addEventListener('keydown', e=>{
      if (e.key==='Escape') this.closeModals();
      if (e.ctrlKey && e.key.toLowerCase()==='n') { e.preventDefault(); this.createNote(); }
    });
  }

  setupObservers(){
    ['noteUpdated','noteAdded','noteDeleted'].forEach(ev=>
      this.eventEmitter.on(ev, ()=>{
        this.renderNotes();this.renderProjects();this.updateTags();
      })
    );
    ['projectAdded','projectDeleted'].forEach(ev=>
      this.eventEmitter.on(ev, ()=>this.renderProjects())
    );
    this.eventEmitter.on('tagSelected', tag=>this.filterByTag(tag));
  }

  toggleSidebar(){
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.sidebar.classList.toggle('collapsed', this.sidebarCollapsed);
    this.mainContent.classList.toggle('full-width', this.sidebarCollapsed);
    localStorage.setItem('sidebarCollapsed',this.sidebarCollapsed);
  }

  toggleTheme(){
    this.isDarkTheme = !this.isDarkTheme;
    document.body.classList.toggle('dark-theme', this.isDarkTheme);
    localStorage.setItem('theme', this.isDarkTheme?'dark':'light');
    this.showToast('Theme updated','success');
  }

  updateVersioningInterval(e){
    const sec = parseInt(e.target.value,10)||0;
    this.versioningInterval = sec*1000;
    localStorage.setItem('versioningInterval',sec);
    this.showToast(`Version interval ${sec}s`,'info');
  }

  loadDataFromDB(){
    const notesTx = this.db.transaction('notes','readonly').objectStore('notes');
    notesTx.getAll().onsuccess = e=>{
      this.notes = e.target.result.map(n=>({
        ...n,
        versions: Array.isArray(n.versions)?n.versions:[{content:n.content,date:n.date}]
      }));
      this.notes.forEach(n=> (n.tags||[]).forEach(t=>this.tags.add(t)));
      this._notesLoaded=true;this.checkInitial();
    };
    const projTx = this.db.transaction('projects','readonly').objectStore('projects');
    projTx.getAll().onsuccess = e=>{
      this.projects=e.target.result;
      this._projectsLoaded=true;this.checkInitial();
    };
  }

  // ► Bind listeners after both data sets have loaded
  checkInitial(){
    if(this._notesLoaded && this._projectsLoaded){
      this.renderProjects();this.renderNotes();this.updateTags();this.updateWordCount();
      if(!this._listenersAdded){
        this.addEventListeners();
        this.setupObservers();
        this._listenersAdded=true;
      }
    }
  }

  saveToIndexedDB(store,data){
    return new Promise((res,rej)=>{
      const tx=this.db.transaction(store,'readwrite');
      const req=tx.objectStore(store).put(data);
      req.onsuccess=()=>res(req.result);
      req.onerror=()=>rej(req.error);
    });
  }

  deleteFromIndexedDB(store,id){
    return new Promise((res,rej)=>{
      const tx=this.db.transaction(store,'readwrite');
      const req=tx.objectStore(store).delete(id);
      req.onsuccess=()=>res(req.result);
      req.onerror=()=>rej(req.error);
    });
  }

  createNote(title='New Note',content='',projectId=null){
    const now=new Date().toLocaleString();
    const note={id:Date.now(),title,content,author:this.authorInput.value||'Anonymous',projectId,date:now,tags:[],versions:[{content,date:now}]};
    this.notes.push(note);
    this.saveToIndexedDB('notes',note)
      .then(()=>{this.eventEmitter.emit('noteAdded',note);this.showToast('Note added','success');})
      .catch(err=>this.showToast(`Error:${err}`,'error'));  
  }

  updateNote(id,field,value){
    const note=this.notes.find(n=>n.id===id);if(!note)return;
    const old=note[field];note[field]=value;note.author=this.authorInput.value||note.author;note.date=new Date().toLocaleString();
    if(field==='content'&&value!==old&&this.versioningInterval>0){
      const last=note.versions[note.versions.length-1];
      if(new Date()-new Date(last.date)>=this.versioningInterval)
        note.versions.push({content:value,date:note.date});
      else{last.content=value;last.date=note.date;}
    }
    this.saveToIndexedDB('notes',note)
      .then(()=>this.eventEmitter.emit('noteUpdated',note))
      .catch(err=>this.showToast(`Error:${err}`,'error'));
  }

  deleteNote(id){
    this.deleteFromIndexedDB('notes',id)
      .then(()=>{this.notes=this.notes.filter(n=>n.id!==id);this.eventEmitter.emit('noteDeleted',id);this.showToast('Deleted','success');})
      .catch(err=>this.showToast(`Error:${err}`,'error'));
  }

  addProject(name){
    if(!name)return;
    const p={id:Date.now(),name,color:this.projectColors[Math.floor(Math.random()*this.projectColors.length)]};
    this.projects.push(p);
    this.saveToIndexedDB('projects',p)
      .then(()=>{this.eventEmitter.emit('projectAdded',p);this.showToast(`Project added: ${name}`,'success');})
      .catch(err=>this.showToast(`Error:${err}`,'error'));
  }

  filterByTag(tag){this.currentTag=this.currentTag===tag?null:tag;this.renderTags();this.renderNotes();}

  updateTags(){this.tags.clear();this.notes.forEach(n=>(n.tags||[]).forEach(t=>this.tags.add(t)));this.renderTags();}

  deleteProject(id){
    this.deleteFromIndexedDB('projects',id)
      .then(()=>{this.projects=this.projects.filter(p=>p.id!==id);
        return Promise.all(this.notes.filter(n=>n.projectId===id).map(n=>this.deleteFromIndexedDB('notes',n.id)));
      })
      .then(()=>{this.notes=this.notes.filter(n=>n.projectId!==id);if(this.currentProject===id)this.currentProject=null;
        this.eventEmitter.emit('projectDeleted',id);this.showToast('Deleted project & notes','success');
      })
      .catch(err=>this.showToast(`Error:${err}`,'error'));
  }

  showVersionHistory(noteId){const note=this.notes.find(n=>n.id===noteId);if(!note)return;this.versionList.innerHTML='';note.versions.forEach((v,i)=>{const d=document.createElement('div');d.className='version-item';d.innerHTML=`<div>${i+1}. ${v.date}</div><button class='preview'>Preview</button><button class='restore'>Restore</button>`;d.querySelector('.preview').addEventListener('click',()=>this.previewVersion(noteId,i));d.querySelector('.restore').addEventListener('click',()=>this.restoreVersion(noteId,i));this.versionList.appendChild(d);});this.versionModal.classList.add('active');}

  previewVersion(noteId,i){const note=this.notes.find(n=>n.id===noteId);if(!note||!note.versions[i])return;this.versionModal.classList.remove('active');const m=document.createElement('div');m.className='modal active';m.innerHTML=`<div class='modal-content'><button class='modal-close'>&times;</button><div>${note.versions[i].content}</div><button class='restore'>Restore</button></div>`;m.querySelector('.modal-close').addEventListener('click',()=>{document.body.removeChild(m);this.versionModal.classList.add('active');});m.querySelector('.restore').addEventListener('click',()=>{document.body.removeChild(m);this.restoreVersion(noteId,i);});document.body.appendChild(m);}

  restoreVersion(noteId,i){const note=this.notes.find(n=>n.id===noteId);if(!note||!note.versions[i])return;const now=new Date().toLocaleString();note.versions.push({content:note.content,date:now});note.content=note.versions[i].content;note.date=now;this.saveToIndexedDB('notes',note).then(()=>{this.eventEmitter.emit('noteUpdated',note);this.closeModals();this.showToast('Restored','success');}).catch(err=>this.showToast(`Error:${err}`,'error'));}

  showProjectsModal(){this.projectsGrid.innerHTML='';this.projects.forEach(p=>{const c=document.createElement('div');c.className='project-card';c.style.setProperty('--project-color',p.color);c.innerHTML=`<div>${p.name}</div><div>${this.notes.filter(n=>n.projectId===p.id).length} notes</div>`;c.addEventListener('click',()=>{this.currentProject=p.id;this.renderNotes();this.closeModals();this.showToast(`Switched to ${p.name}`,'info');});this.projectsGrid.appendChild(c);});this.projectsModal.classList.add('active');}

  closeModals(){document.querySelectorAll('.modal').forEach(m=>m.classList.remove('active'));}

  renderProjects(){this.projectsList.innerHTML='';this.projects.forEach(p=>{const el=document.createElement('div');el.className='project-item';el.dataset.id=p.id;el.textContent=p.name+` (${this.notes.filter(n=>n.projectId===p.id).length})`;el.addEventListener('click',()=>{this.currentProject=p.id;this.renderNotes();this.showToast(`Switched to ${p.name}`,'info');});this.projectsList.appendChild(el);});}

  renderNotes(){this.notesContainer.innerHTML='';let out=[...this.notes];if(this.currentProject)out=out.filter(n=>n.projectId===this.currentProject);if(this.currentTag)out=out.filter(n=>n.tags&&n.tags.includes(this.currentTag));if(this.searchTerm)out=out.filter(n=>n.title.toLowerCase().includes(this.searchTerm)||n.content.toLowerCase().includes(this.searchTerm));out.sort((a,b)=>new Date(b.date)-new Date(a.date));if(!out.length){this.notesContainer.innerHTML='<div class="empty-state"><h3>No notes</h3></div>';return;}out.forEach(n=>{const el=document.createElement('div');el.className='note';el.dataset.id=n.id;el.innerHTML=`<input class='note-title' value='${n.title}'><div class='controls'><button class='versions'>${n.versions.length}</button><button class='add-tag'>+Tag</button><button class='delete'>Del</button></div><div class='note-content' contenteditable>${n.content}</div><div class='footer'>By ${n.author} • ${n.date}</div>`;el.querySelector('.note-title').addEventListener('change',e=>this.updateNote(n.id,'title',e.target.value));let to;const ce=el.querySelector('.note-content');ce.addEventListener('input',()=>{clearTimeout(to);to=setTimeout(()=>this.updateNote(n.id,'content',ce.innerHTML),this.versioningInterval);});el.querySelector('.versions').addEventListener('click',()=>this.showVersionHistory(n.id));el.querySelector('.add-tag').addEventListener('click',()=>this.showInputToast('Tag:',t=>this.addTag(n.id,t)));el.querySelector('.delete').addEventListener('click',()=>this.deleteNote(n.id));this.notesContainer.appendChild(el);});this.updateWordCount();}

  updateWordCount(){const text=this.notes.map(n=>n.content.replace(/<[^>]*>/g,'')).join(' ');const cnt=text.split(/\s+/).filter(w=>w).length;this.wordCountElement.textContent=`${cnt} word${cnt!==1?'s':''}`;this.statsCountElement.textContent=`${this.notes.length} note${this.notes.length!==1?'s':''}`;}

  showToast(msg,type='info',dur=3000){const t=document.createElement('div');t.className=`toast ${type}`;t.textContent=msg;this.toastContainer.appendChild(t);setTimeout(()=>t.remove(),dur);}

  showInputToast(msg,cb){const t=document.createElement('div');t.className='toast info';t.innerHTML=`<div>${msg}</div><input><button>OK</button>`;const inp=t.querySelector('input');const btn=t.querySelector('button');btn.addEventListener('click',()=>{cb(inp.value);t.remove();});this.toastContainer.appendChild(t);}
}

// Export HTML feature attached to NotesApp
NotesApp.prototype.exportNoteAsHTML = function(noteId) {
  const note = this.notes.find(n=>n.id===noteId);
  if (!note) { this.showToast('Note not found','error'); return; }
  const proj = this.projects.find(p=>p.id===note.projectId);
  const projectName = proj ? proj.name : 'No Project';
  const html = `<!DOCTYPE html>...FULL TEMPLATE...`;
  const blob = new Blob([html],{type:'text/html'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${note.title.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.html`;
  a.click(); URL.revokeObjectURL(url);
  this.showToast('Exported','success');
};

// Initialize app
document.addEventListener('DOMContentLoaded', ()=> window.notesApp = new NotesApp());
