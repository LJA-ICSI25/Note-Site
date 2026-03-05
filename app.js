document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        foldersList: document.getElementById('folders-list'),
        notesList: document.getElementById('notes-list'),
        newFolderBtn: document.getElementById('new-folder-btn'),
        newNoteBtn: document.getElementById('new-note-btn'),
        noteTitle: document.getElementById('note-title'),
        editor: document.getElementById('editor'),
        importFile: document.getElementById('import-file'),
        importBtn: document.getElementById('import-btn'),
        formatBtns: document.querySelectorAll('.format-btn[data-command]'),
        indentBtn: document.getElementById('indent-btn'),
        outdentBtn: document.getElementById('outdent-btn'),

        // Modal Elements
        folderModal: document.getElementById('folder-modal'),
        folderNameInput: document.getElementById('folder-name-input'),
        cancelFolderBtn: document.getElementById('cancel-folder-btn'),
        submitFolderBtn: document.getElementById('submit-folder-btn'),

        // Context Menu Elements
        contextMenu: document.getElementById('folder-context-menu'),
        contextRenameBtn: document.getElementById('context-rename'),
        contextColorBtn: document.getElementById('context-color'),
        contextDeleteBtn: document.getElementById('context-delete'),
        folderColorPicker: document.getElementById('folder-color-picker'),

        // Rename Modal Elements
        renameModal: document.getElementById('rename-modal'),
        renameFolderInput: document.getElementById('rename-folder-input'),
        cancelRenameBtn: document.getElementById('cancel-rename-btn'),
        submitRenameBtn: document.getElementById('submit-rename-btn'),

        // Note Context Menu Elements
        noteContextMenu: document.getElementById('note-context-menu'),
        noteContextMoveBtn: document.getElementById('note-context-move'),
        noteContextExportBtn: document.getElementById('note-context-export'),
        noteContextDeleteBtn: document.getElementById('note-context-delete'),

        // Move Note Modal Elements
        moveNoteModal: document.getElementById('move-note-modal'),
        moveNoteSelect: document.getElementById('move-note-select'),
        cancelMoveNoteBtn: document.getElementById('cancel-move-note-btn'),
        submitMoveNoteBtn: document.getElementById('submit-move-note-btn')
    };

    // State
    const ALL_NOTES_FOLDER_ID = 'all_notes';
    let data = {
        folders: [],
        notes: []
    };
    let activeFolderId = ALL_NOTES_FOLDER_ID;
    let activeNoteId = null;
    let isEditing = false; // Flag to prevent saving when just rendering
    let contextMenuTargetId = null; // ID of the folder currently being right-clicked
    let noteContextMenuTargetId = null; // ID of the note currently being right-clicked

    // Initialize
    init();

    function init() {
        loadData();
        setupEventListeners();

        renderFoldersList();

        // Ensure at least an 'All Notes' view exists visually
        setActiveFolder(ALL_NOTES_FOLDER_ID);

        if (data.notes.length > 0) {
            setActiveNote(data.notes[0].id);
        } else {
            createNewNote();
        }
    }

    // --- State Management ---

    function loadData() {
        const savedData = localStorage.getItem('notesApp_data_v2');
        if (savedData) {
            try {
                data = JSON.parse(savedData);
                // Schema migration if loading old v1 data
                if (Array.isArray(data)) {
                    data = {
                        folders: [],
                        notes: data.map(n => ({ ...n, folderId: ALL_NOTES_FOLDER_ID }))
                    };
                }
            } catch (e) {
                console.error("Error loading data", e);
                data = { folders: [], notes: [] };
            }
        }
    }

    function saveData() {
        localStorage.setItem('notesApp_data_v2', JSON.stringify(data));
    }

    function generateId() {
        return Math.random().toString(36).substring(2, 9);
    }

    // --- Folder Logic ---

    function createNewFolder() {
        elements.folderNameInput.value = '';
        elements.folderModal.classList.remove('hidden');
        elements.folderNameInput.focus();
    }

    function closeFolderModal() {
        elements.folderModal.classList.add('hidden');
    }

    function submitNewFolder() {
        const name = elements.folderNameInput.value;
        if (!name || !name.trim()) return;

        const newFolder = {
            id: generateId(),
            name: name.trim()
        };
        data.folders.push(newFolder);
        saveData();
        renderFoldersList();
        setActiveFolder(newFolder.id);
        closeFolderModal();
    }

    function getActiveFolder() {
        return data.folders.find(f => f.id === activeFolderId);
    }

    function setActiveFolder(id) {
        activeFolderId = id;
        renderFoldersList();
        renderNotesList(); // update notes based on folder

        // Select first note in folder if possible
        const folderNotes = getNotesForActiveFolder();
        if (folderNotes.length > 0) {
            setActiveNote(folderNotes[0].id);
        } else {
            // Clear editor if folder is empty
            activeNoteId = null;
            elements.noteTitle.value = '';
            elements.editor.innerHTML = '';
        }
    }

    function renderFoldersList() {
        elements.foldersList.innerHTML = '';

        // "All Notes" item
        const allNotesDiv = document.createElement('div');
        allNotesDiv.className = `folder-item ${activeFolderId === ALL_NOTES_FOLDER_ID ? 'active' : ''}`;
        allNotesDiv.innerHTML = `<i class="fas fa-inbox"></i> All Notes`;
        allNotesDiv.addEventListener('click', () => setActiveFolder(ALL_NOTES_FOLDER_ID));
        elements.foldersList.appendChild(allNotesDiv);

        // Custom Folders
        data.folders.forEach(folder => {
            const div = document.createElement('div');
            div.className = `folder-item ${folder.id === activeFolderId ? 'active' : ''}`;

            // Apply custom color if it exists
            const colorStyle = folder.color ? `style="color: ${folder.color};"` : '';
            div.innerHTML = `<i class="fas fa-folder" ${colorStyle}></i> ${escapeHTML(folder.name)}`;

            div.addEventListener('click', () => setActiveFolder(folder.id));

            // Add right-click context menu listener
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e.pageX, e.pageY, folder.id);
            });

            elements.foldersList.appendChild(div);
        });
    }

    // --- Context Menu Logic ---

    function showContextMenu(x, y, folderId) {
        contextMenuTargetId = folderId;
        elements.contextMenu.style.left = `${x}px`;
        elements.contextMenu.style.top = `${y}px`;
        elements.contextMenu.classList.remove('hidden');
    }

    function hideContextMenu() {
        elements.contextMenu.classList.add('hidden');
        // Do not clear target ID here, we might need it for the action
    }

    function handleRenameClick() {
        hideContextMenu();
        const folder = data.folders.find(f => f.id === contextMenuTargetId);
        if (!folder) return;

        elements.renameFolderInput.value = folder.name;
        elements.renameModal.classList.remove('hidden');
        elements.renameFolderInput.focus();
    }

    function closeRenameModal() {
        elements.renameModal.classList.add('hidden');
    }

    function submitRenameFolder() {
        const newName = elements.renameFolderInput.value;
        if (!newName || !newName.trim() || !contextMenuTargetId) return;

        const folder = data.folders.find(f => f.id === contextMenuTargetId);
        if (folder) {
            folder.name = newName.trim();
            saveData();
            renderFoldersList();

            // Re-render notes if this folder is active (in case title is used elsewhere later)
            if (activeFolderId === folder.id) {
                renderNotesList();
            }
        }
        closeRenameModal();
    }

    function handleColorChange(e) {
        const newColor = e.target.value;
        const folder = data.folders.find(f => f.id === contextMenuTargetId);
        if (folder) {
            folder.color = newColor;
            saveData();
            renderFoldersList();
        }
    }

    function handleDeleteFolderClick() {
        hideContextMenu();
        if (!contextMenuTargetId) return;

        const folder = data.folders.find(f => f.id === contextMenuTargetId);
        if (!folder) return;

        if (confirm(`Are you sure you want to delete the folder "${folder.name}"? Notes inside will be moved to "All Notes".`)) {
            // Reassign notes to All Notes
            data.notes.forEach(note => {
                if (note.folderId === contextMenuTargetId) {
                    note.folderId = ALL_NOTES_FOLDER_ID;
                }
            });

            // Remove folder
            data.folders = data.folders.filter(f => f.id !== contextMenuTargetId);
            saveData();

            // Handle active state
            if (activeFolderId === contextMenuTargetId) {
                setActiveFolder(ALL_NOTES_FOLDER_ID);
            } else {
                renderFoldersList();
                renderNotesList();
            }
        }
    }

    function getNotesForActiveFolder() {
        let notes = data.notes;
        notes.sort((a, b) => b.lastModified - a.lastModified);

        if (activeFolderId === ALL_NOTES_FOLDER_ID) {
            return notes;
        }
        return notes.filter(n => n.folderId === activeFolderId);
    }

    // --- Note Management ---

    function createNewNote() {
        const newNote = {
            id: generateId(),
            folderId: activeFolderId === ALL_NOTES_FOLDER_ID ? ALL_NOTES_FOLDER_ID : activeFolderId,
            title: '',
            content: '',
            lastModified: Date.now()
        };
        data.notes.unshift(newNote); // Add to beginning
        saveData();
        renderNotesList();
        setActiveNote(newNote.id);
        elements.noteTitle.focus();
    }

    function deleteNote(noteIdToDelete) {
        if (!noteIdToDelete) return;

        if (confirm("Are you sure you want to delete this note?")) {
            data.notes = data.notes.filter(n => n.id !== noteIdToDelete);
            saveData();

            // If we deleted the active note, we need to clear editor or pick another
            if (activeNoteId === noteIdToDelete) {
                const remainingNotes = getNotesForActiveFolder();
                if (remainingNotes.length > 0) {
                    setActiveNote(remainingNotes[0].id);
                } else {
                    activeNoteId = null;
                    elements.noteTitle.value = '';
                    elements.editor.innerHTML = '';
                    renderNotesList();
                }
            } else {
                renderNotesList();
            }
        }
    }

    function getActiveNote() {
        return data.notes.find(n => n.id === activeNoteId);
    }

    function setActiveNote(id) {
        activeNoteId = id;
        const note = getActiveNote();
        if (!note) return;

        isEditing = false; // Disable save trigger during population
        elements.noteTitle.value = note.title;
        elements.editor.innerHTML = note.content;
        isEditing = true;

        renderNotesList(); // Update active state in UI
    }

    // --- UI Updating logic ---
    function updateNoteData() {
        if (!isEditing || !activeNoteId) return;

        const note = getActiveNote();
        if (note) {
            note.title = elements.noteTitle.value;
            note.content = elements.editor.innerHTML;
            note.lastModified = Date.now();
            saveData();
            renderNotesList();
        }
    }

    function renderNotesList() {
        elements.notesList.innerHTML = '';
        const visibleNotes = getNotesForActiveFolder();

        visibleNotes.forEach(note => {
            const previewText = extractText(note.content).trim() || 'No additional text';
            const displayTitle = note.title.trim() || 'Untitled Note';
            const dateStr = new Date(note.lastModified).toLocaleDateString([], {
                month: 'short', day: 'numeric', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const div = document.createElement('div');
            div.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
            div.innerHTML = `
                <div class="note-item-title">${escapeHTML(displayTitle)}</div>
                <div class="note-item-preview">${escapeHTML(previewText.substring(0, 60))}</div>
                <div class="note-item-date">${dateStr}</div>
            `;

            div.addEventListener('click', () => {
                if (activeNoteId !== note.id) {
                    setActiveNote(note.id);
                }
            });

            // Add right-click context menu listener for notes
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showNoteContextMenu(e.pageX, e.pageY, note.id);
            });

            elements.notesList.appendChild(div);
        });
    }

    // --- Note Context Menu & Move Logic ---

    function showNoteContextMenu(x, y, noteId) {
        noteContextMenuTargetId = noteId;
        elements.noteContextMenu.style.left = `${x}px`;
        elements.noteContextMenu.style.top = `${y}px`;
        elements.noteContextMenu.classList.remove('hidden');
    }

    function hideNoteContextMenu() {
        elements.noteContextMenu.classList.add('hidden');
    }

    function handleNoteMoveClick() {
        hideNoteContextMenu();
        if (!noteContextMenuTargetId) return;

        // Populate select options
        elements.moveNoteSelect.innerHTML = `<option value="${ALL_NOTES_FOLDER_ID}">All Notes</option>`;
        data.folders.forEach(folder => {
            elements.moveNoteSelect.innerHTML += `<option value="${folder.id}">${escapeHTML(folder.name)}</option>`;
        });

        // Pre-select current folder if known
        const note = data.notes.find(n => n.id === noteContextMenuTargetId);
        if (note) {
            elements.moveNoteSelect.value = note.folderId;
        }

        elements.moveNoteModal.classList.remove('hidden');
    }

    function closeMoveNoteModal() {
        elements.moveNoteModal.classList.add('hidden');
    }

    function submitMoveNote() {
        const targetFolderId = elements.moveNoteSelect.value;
        if (!noteContextMenuTargetId || !targetFolderId) return;

        const note = data.notes.find(n => n.id === noteContextMenuTargetId);
        if (note) {
            note.folderId = targetFolderId;
            saveData();

            // If we moved it out of the currently viewed folder (and we aren't in 'All Notes'),
            // it should disappear from the list.
            if (activeFolderId !== ALL_NOTES_FOLDER_ID && targetFolderId !== activeFolderId) {
                // If it was the active note, we should probably clear the editor or pick another
                if (activeNoteId === note.id) {
                    const remainingNotes = getNotesForActiveFolder().filter(n => n.id !== note.id); // compute remaining without the moved one
                    if (remainingNotes.length > 0) {
                        setActiveNote(remainingNotes[0].id);
                    } else {
                        activeNoteId = null;
                        elements.noteTitle.value = '';
                        elements.editor.innerHTML = '';
                    }
                }
            }
            renderNotesList();
        }
        closeMoveNoteModal();
    }

    function extractText(html) {
        // Quick and robust way to extract plain text
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // --- Formatting and Actions ---

    function setupEventListeners() {
        // Input events for auto-saving
        elements.noteTitle.addEventListener('input', updateNoteData);
        elements.editor.addEventListener('input', updateNoteData);

        // Core buttons
        elements.newFolderBtn.addEventListener('click', createNewFolder);
        elements.newNoteBtn.addEventListener('click', createNewNote);
        if (elements.importBtn && elements.importFile) {
            elements.importBtn.addEventListener('click', () => elements.importFile.click());
            elements.importFile.addEventListener('change', handleImportFile);
        }

        // Folder Creation Events
        if (elements.cancelFolderBtn) elements.cancelFolderBtn.addEventListener('click', closeFolderModal);
        if (elements.submitFolderBtn) elements.submitFolderBtn.addEventListener('click', submitNewFolder);
        if (elements.folderNameInput) {
            elements.folderNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') submitNewFolder();
                if (e.key === 'Escape') closeFolderModal();
            });
        }

        // Context Menu Events (using mousedown to catch both left and right clicks)
        document.addEventListener('mousedown', (e) => {
            if (elements.contextMenu && !elements.contextMenu.classList.contains('hidden') && !elements.contextMenu.contains(e.target)) {
                hideContextMenu();
            }
            if (elements.noteContextMenu && !elements.noteContextMenu.classList.contains('hidden') && !elements.noteContextMenu.contains(e.target)) {
                hideNoteContextMenu();
            }
        });

        if (elements.contextMenu) {
            elements.contextMenu.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        }

        if (elements.noteContextMenu) {
            elements.noteContextMenu.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        }

        if (elements.contextRenameBtn) elements.contextRenameBtn.addEventListener('click', handleRenameClick);
        if (elements.contextColorBtn) elements.contextColorBtn.addEventListener('click', () => elements.folderColorPicker.click());
        // Wait for input to finish (change event) to update color
        if (elements.folderColorPicker) elements.folderColorPicker.addEventListener('input', handleColorChange);
        if (elements.contextDeleteBtn) elements.contextDeleteBtn.addEventListener('click', handleDeleteFolderClick);

        // Rename Modal Events
        if (elements.cancelRenameBtn) elements.cancelRenameBtn.addEventListener('click', closeRenameModal);
        if (elements.submitRenameBtn) elements.submitRenameBtn.addEventListener('click', submitRenameFolder);
        if (elements.renameFolderInput) {
            elements.renameFolderInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') submitRenameFolder();
                if (e.key === 'Escape') closeRenameModal();
            });
        }

        // Note Context Menu Events
        if (elements.noteContextMoveBtn) elements.noteContextMoveBtn.addEventListener('click', handleNoteMoveClick);
        if (elements.noteContextExportBtn) elements.noteContextExportBtn.addEventListener('click', () => {
            hideNoteContextMenu();
            exportNoteTXT(noteContextMenuTargetId);
        });
        if (elements.noteContextDeleteBtn) elements.noteContextDeleteBtn.addEventListener('click', () => {
            hideNoteContextMenu();
            deleteNote(noteContextMenuTargetId);
        });

        // Move Note Modal Events
        if (elements.cancelMoveNoteBtn) elements.cancelMoveNoteBtn.addEventListener('click', closeMoveNoteModal);
        if (elements.submitMoveNoteBtn) elements.submitMoveNoteBtn.addEventListener('click', submitMoveNote);

        // Formatting commands
        elements.formatBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent losing focus
                e.stopPropagation(); // Prevent editor auto-save click conflicts

                const command = btn.getAttribute('data-command');
                const value = btn.getAttribute('data-value') || null;

                document.execCommand(command, false, value);
                elements.editor.focus();
                updateNoteData();
            });
        });

        // Specialized indent commands
        if (elements.indentBtn) {
            elements.indentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
                elements.editor.focus();
                updateNoteData();
            });
        }

        if (elements.outdentBtn) {
            elements.outdentBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // We can't easily undo raw spaces via execCommand so this button behavior isn't well defined for inline spacing.
                // Doing nothing or a native outdent if applicable.
                document.execCommand('outdent', false, null);
                elements.editor.focus();
                updateNoteData();
            });
        }

        // Handle Tab key in editor
        elements.editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                // Insert 4 non-breaking spaces
                document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;');
                updateNoteData();
            }
        });
    }

    // --- Import / Export Logic ---

    function handleImportFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const content = e.target.result;
            // Title from filename without extension
            let title = file.name;
            if (title.toLowerCase().endsWith('.txt')) {
                title = title.slice(0, -4);
            }

            // Convert basic text formatting to HTML
            // Note: A simple replace of newlines to <br> to preserve structure
            let htmlContent = escapeHTML(content).replace(/\n/g, '<br>');

            // Create new note
            const newNote = {
                id: generateId(),
                folderId: activeFolderId === ALL_NOTES_FOLDER_ID ? ALL_NOTES_FOLDER_ID : activeFolderId,
                title: title,
                content: htmlContent,
                lastModified: Date.now()
            };

            data.notes.unshift(newNote); // Add to beginning
            saveData();
            renderNotesList();
            setActiveNote(newNote.id);
            elements.noteTitle.focus();

            // Reset input so the same file could be imported again if needed
            elements.importFile.value = '';
        };
        reader.readAsText(file);
    }

    function exportNoteTXT(targetNoteId) {
        let noteToExport = getActiveNote();

        if (targetNoteId) {
            noteToExport = data.notes.find(n => n.id === targetNoteId);
        }

        if (!noteToExport) return;

        const title = noteToExport.title.trim() || 'Untitled Note';
        const filename = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;

        // Extract plain text from the HTML content
        // Need a robust way that preserves some formatting (like sections)
        const tmp = document.createElement('div');
        tmp.innerHTML = noteToExport.content;

        // Convert block elements to new lines
        const blockElements = ['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BR'];
        const formatTextNode = (node) => {
            let text = '';
            for (let i = 0; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];
                if (child.nodeType === Node.TEXT_NODE) {
                    text += child.textContent;
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    text += formatTextNode(child);
                    if (blockElements.includes(child.nodeName.toUpperCase())) {
                        text += '\n';
                    }
                }
            }
            return text;
        };

        const bodyText = formatTextNode(tmp).replace(/\n\n+/g, '\n\n').trim();

        const txtContent = `${title}\n${'='.repeat(title.length)}\n\n${bodyText}`;

        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 0);
    }
});
