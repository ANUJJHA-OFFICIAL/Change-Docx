import { auth, db, analytics } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { logEvent } from "firebase/analytics";
import { showToast, formatBytes, resetProgress } from './utils.js';

// Tool Definitions
const TOOLS = [
    { id: 'merge', name: 'Merge PDF', icon: '📄', desc: 'Combine multiple PDFs into one', accept: '.pdf', multiple: true },
    { id: 'split', name: 'Split PDF', icon: '✂️', desc: 'Extract pages or ranges', accept: '.pdf', multiple: false },
    { id: 'compress', name: 'Compress PDF', icon: '📉', desc: 'Reduce file size', accept: '.pdf', multiple: false },
    { id: 'pdf-to-word', name: 'PDF to Word', icon: '📝', desc: 'Convert PDF to editable DOCX', accept: '.pdf', multiple: false },
    { id: 'word-to-pdf', name: 'Word to PDF', icon: '📄', desc: 'Convert DOCX to PDF', accept: '.docx', multiple: false },
    { id: 'pdf-to-jpg', name: 'PDF to JPG', icon: '🖼️', desc: 'Convert pages to images', accept: '.pdf', multiple: false },
    { id: 'jpg-to-pdf', name: 'JPG to PDF', icon: '📷', desc: 'Convert images to PDF', accept: 'image/*', multiple: true },
    { id: 'rotate', name: 'Rotate PDF', icon: '🔄', desc: 'Rotate pages 90/180/270°', accept: '.pdf', multiple: false },
    { id: 'watermark', name: 'Add Watermark', icon: '🏷️', desc: 'Add text watermark to all pages', accept: '.pdf', multiple: false },
    { id: 'page-numbers', name: 'Add Page Numbers', icon: '🔢', desc: 'Number pages automatically', accept: '.pdf', multiple: false },
    { id: 'protect', name: 'Protect PDF', icon: '🔒', desc: 'Lock PDF with a password', accept: '.pdf', multiple: false },
    { id: 'unlock', name: 'Unlock PDF', icon: '🔓', desc: 'Remove PDF password', accept: '.pdf', multiple: false },
    { id: 'ocr', name: 'OCR PDF', icon: '🔍', desc: 'Make scanned PDF searchable', accept: '.pdf', multiple: false },
    { id: 'excel-to-pdf', name: 'Excel to PDF', icon: '📊', desc: 'Convert spreadsheet to PDF', accept: '.xlsx,.xls', multiple: false },
    { id: 'pdf-to-excel', name: 'PDF to Excel', icon: '📈', desc: 'Extract PDF tables to XLSX', accept: '.pdf', multiple: false }
];

// DOM Elements
const toolGrid = document.getElementById('tool-grid');
const megaDropdown = document.getElementById('mega-dropdown');
const toolSearch = document.getElementById('tool-search');
const toolsNavBtn = document.getElementById('tools-nav-btn');
const userProfileBtn = document.getElementById('user-profile-btn');
const userDropdown = document.getElementById('user-dropdown');
const logoutBtn = document.getElementById('logout-btn');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');

// Profile & Settings Elements
const openProfileBtn = document.getElementById('open-profile-btn');
const openSettingsBtn = document.getElementById('open-settings-btn');
const profileModalOverlay = document.getElementById('profile-modal-overlay');
const settingsModalOverlay = document.getElementById('settings-modal-overlay');
const closeProfileBtn = document.getElementById('close-profile');
const closeSettingsBtn = document.getElementById('close-settings');
const saveProfileBtn = document.getElementById('save-profile-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');

const profileNameInput = document.getElementById('profile-name');
const profileBioInput = document.getElementById('profile-bio');
const settingDefaultFormat = document.getElementById('setting-default-format');
const settingAutoDownload = document.getElementById('setting-auto-download');
const settingNotifications = document.getElementById('setting-notifications');

const toolPanelOverlay = document.getElementById('tool-panel-overlay');
const closePanelBtn = document.getElementById('close-panel');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const activeFilesList = document.getElementById('active-files');
const optionsPanel = document.getElementById('options-panel');
const toolOptionsContainer = document.getElementById('tool-options-container');
const processActions = document.getElementById('process-actions');
const processBtn = document.getElementById('process-btn');
const resultPanel = document.getElementById('result-panel');
const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');

const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

// State
let currentTool = null;
let uploadedFiles = [];
let processedBlob = null;
let outputFileName = '';

// Auth State Observer
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = '/auth.html';
    } else {
        if (!user.emailVerified && !user.providerData.some(p => p.providerId === 'google.com')) {
            window.location.href = '/auth.html';
        }
        
        // Load user data from Firestore to get custom display name
        loadUserData();
    }
});

// Firestore Error Handler
function handleFirestoreError(error, operationType, path) {
    const errInfo = {
        error: error instanceof Error ? error.message : String(error),
        authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified,
            isAnonymous: auth.currentUser?.isAnonymous,
            tenantId: auth.currentUser?.tenantId,
            providerInfo: auth.currentUser?.providerData.map(provider => ({
                providerId: provider.providerId,
                displayName: provider.displayName,
                email: provider.email,
                photoUrl: provider.photoURL
            })) || []
        },
        operationType,
        path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
}

// Load User Data
async function loadUserData() {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
        const docSnap = await getDoc(userRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            userName.textContent = data.displayName || auth.currentUser.displayName || auth.currentUser.email;
            userAvatar.textContent = (data.displayName || auth.currentUser.displayName || auth.currentUser.email).charAt(0).toUpperCase();
            
            if (profileNameInput) profileNameInput.value = data.displayName || auth.currentUser.displayName || '';
            if (profileBioInput) profileBioInput.value = data.bio || '';
            
            if (data.settings) {
                if (settingDefaultFormat) settingDefaultFormat.value = data.settings.defaultFormat || 'pdf';
                if (settingAutoDownload) settingAutoDownload.checked = data.settings.autoDownload || false;
                if (settingNotifications) settingNotifications.checked = data.settings.notifications || false;
            }
        } else {
            userName.textContent = auth.currentUser.displayName || auth.currentUser.email;
            userAvatar.textContent = (auth.currentUser.displayName || auth.currentUser.email).charAt(0).toUpperCase();
            if (profileNameInput) profileNameInput.value = auth.currentUser.displayName || '';
        }
    } catch (error) {
        handleFirestoreError(error, 'get', `users/${auth.currentUser.uid}`);
    }
}

// Save Profile
saveProfileBtn.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    saveProfileBtn.disabled = true;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
        await setDoc(userRef, {
            displayName: profileNameInput.value,
            bio: profileBioInput.value,
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
        userName.textContent = profileNameInput.value || auth.currentUser.email;
        userAvatar.textContent = (profileNameInput.value || auth.currentUser.email).charAt(0).toUpperCase();
        
        showToast('Profile saved successfully!', 'success');
        profileModalOverlay.classList.remove('active');
    } catch (error) {
        handleFirestoreError(error, 'write', `users/${auth.currentUser.uid}`);
    } finally {
        saveProfileBtn.disabled = false;
    }
});

// Save Settings
saveSettingsBtn.addEventListener('click', async () => {
    if (!auth.currentUser) return;
    saveSettingsBtn.disabled = true;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
        await setDoc(userRef, {
            settings: {
                defaultFormat: settingDefaultFormat.value,
                autoDownload: settingAutoDownload.checked,
                notifications: settingNotifications.checked
            },
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
        showToast('Settings saved successfully!', 'success');
        settingsModalOverlay.classList.remove('active');
    } catch (error) {
        handleFirestoreError(error, 'write', `users/${auth.currentUser.uid}`);
    } finally {
        saveSettingsBtn.disabled = false;
    }
});

// Modal Controls
openProfileBtn.addEventListener('click', () => {
    profileModalOverlay.classList.add('active');
    userDropdown.classList.remove('active');
    loadUserData();
});

openSettingsBtn.addEventListener('click', () => {
    settingsModalOverlay.classList.add('active');
    userDropdown.classList.remove('active');
    loadUserData();
});

closeProfileBtn.addEventListener('click', () => profileModalOverlay.classList.remove('active'));
closeSettingsBtn.addEventListener('click', () => settingsModalOverlay.classList.remove('active'));

profileModalOverlay.addEventListener('click', (e) => {
    if (e.target === profileModalOverlay) profileModalOverlay.classList.remove('active');
});
settingsModalOverlay.addEventListener('click', (e) => {
    if (e.target === settingsModalOverlay) settingsModalOverlay.classList.remove('active');
});

// Logout
logoutBtn.addEventListener('click', () => signOut(auth));

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcons(savedTheme);
}

function updateThemeIcons(theme) {
    if (theme === 'dark') {
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }
}

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcons(newTheme);
});

// Tool Rendering
function renderTools(filter = '') {
    const filtered = TOOLS.filter(t => 
        t.name.toLowerCase().includes(filter.toLowerCase()) || 
        t.desc.toLowerCase().includes(filter.toLowerCase())
    );
    
    toolGrid.innerHTML = '';
    filtered.forEach(tool => {
        const card = document.createElement('div');
        card.className = 'tool-card';
        card.innerHTML = `
            <div class="icon">${tool.icon}</div>
            <h3>${tool.name}</h3>
            <p>${tool.desc}</p>
        `;
        card.addEventListener('click', () => openTool(tool));
        toolGrid.appendChild(card);
    });
}

function renderMegaDropdown() {
    megaDropdown.innerHTML = '';
    TOOLS.forEach(tool => {
        const item = document.createElement('div');
        item.className = 'mega-item';
        item.innerHTML = `
            <div class="mega-icon">${tool.icon}</div>
            <div class="mega-content">
                <h4>${tool.name}</h4>
                <p>${tool.desc}</p>
            </div>
        `;
        item.addEventListener('click', () => {
            openTool(tool);
            megaDropdown.classList.remove('active');
        });
        megaDropdown.appendChild(item);
    });
}

// Search
toolSearch.addEventListener('input', (e) => renderTools(e.target.value));

// Dropdowns
toolsNavBtn.addEventListener('click', () => megaDropdown.classList.toggle('active'));
userProfileBtn.addEventListener('click', () => userDropdown.classList.toggle('active'));

window.addEventListener('click', (e) => {
    if (!toolsNavBtn.contains(e.target) && !megaDropdown.contains(e.target)) {
        megaDropdown.classList.remove('active');
    }
    if (!userProfileBtn.contains(e.target) && !userDropdown.contains(e.target)) {
        userDropdown.classList.remove('active');
    }
});

// Tool Panel Logic
function openTool(tool) {
    currentTool = tool;
    if (analytics) {
        logEvent(analytics, 'select_content', {
            content_type: 'tool',
            item_id: tool.id
        });
    }
    
    document.getElementById('panel-icon').textContent = tool.icon;
    document.getElementById('panel-name').textContent = tool.name;
    fileInput.accept = tool.accept;
    fileInput.multiple = tool.multiple;
    resetToolState();
    toolPanelOverlay.classList.add('active');
}

function resetToolState() {
    uploadedFiles = [];
    processedBlob = null;
    outputFileName = '';
    activeFilesList.innerHTML = '';
    activeFilesList.style.display = 'flex';
    toolOptionsContainer.innerHTML = '';
    optionsPanel.classList.add('hidden');
    optionsPanel.style.display = 'block';
    processActions.classList.add('hidden');
    processActions.style.display = 'flex';
    resultPanel.style.display = 'none';
    uploadZone.style.display = 'block';
    resetProgress();
    
    // Load tool-specific options
    loadToolOptions();
}

function loadToolOptions() {
    // This will be expanded as we implement each tool
    if (currentTool.id === 'protect') {
        toolOptionsContainer.innerHTML = `
            <div class="form-group">
                <label>Password to protect PDF</label>
                <input type="password" id="protect-password" placeholder="Enter password" class="search-input" style="padding: 0.75rem 1rem;">
            </div>
        `;
        optionsPanel.classList.remove('hidden');
    } else if (currentTool.id === 'watermark') {
        toolOptionsContainer.innerHTML = `
            <div class="form-group">
                <label>Watermark Text</label>
                <input type="text" id="watermark-text" placeholder="CONFIDENTIAL" class="search-input" style="padding: 0.75rem 1rem; margin-bottom: 1rem;">
                <label>Opacity (0.1 - 1.0)</label>
                <input type="number" id="watermark-opacity" value="0.5" step="0.1" min="0.1" max="1.0" class="search-input" style="padding: 0.75rem 1rem;">
            </div>
        `;
        optionsPanel.classList.remove('hidden');
    }
}

closePanelBtn.addEventListener('click', () => {
    toolPanelOverlay.classList.remove('active');
});

uploadZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
});

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

function handleFiles(files) {
    if (!files.length) return;
    
    if (currentTool.multiple) {
        uploadedFiles = [...uploadedFiles, ...Array.from(files)];
    } else {
        uploadedFiles = [files[0]];
    }
    
    activeFilesList.style.display = 'flex';
    renderFileList();
    processActions.classList.remove('hidden');
}

function renderFileList() {
    activeFilesList.innerHTML = '';
    
    if (uploadedFiles.length > 1) {
        const clearAllContainer = document.createElement('div');
        clearAllContainer.style.display = 'flex';
        clearAllContainer.style.justifyContent = 'flex-end';
        clearAllContainer.style.marginBottom = '1rem';
        
        const clearAllBtn = document.createElement('button');
        clearAllBtn.className = 'btn btn-secondary';
        clearAllBtn.style.fontSize = '0.8rem';
        clearAllBtn.style.padding = '0.4rem 0.8rem';
        clearAllBtn.textContent = '🗑️ Clear All';
        clearAllBtn.onclick = () => {
            uploadedFiles = [];
            renderFileList();
            processActions.classList.add('hidden');
        };
        
        clearAllContainer.appendChild(clearAllBtn);
        activeFilesList.appendChild(clearAllContainer);
    }

    uploadedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${formatBytes(file.size)}</span>
            </div>
            <span class="remove-file" data-index="${index}">Remove</span>
        `;
        activeFilesList.appendChild(item);
    });
    
    document.querySelectorAll('.remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            uploadedFiles.splice(index, 1);
            renderFileList();
            if (uploadedFiles.length === 0) {
                processActions.classList.add('hidden');
            }
        });
    });
}

// Tool Processing Dispatcher
processBtn.addEventListener('click', async () => {
    if (uploadedFiles.length === 0) return;
    
    processBtn.disabled = true;
    document.getElementById('processing-bar').style.display = 'block';
    
    try {
        if (analytics) {
            logEvent(analytics, 'generate_lead', {
                tool_id: currentTool.id,
                file_count: uploadedFiles.length
            });
        }
        
        // Dynamic import of tool logic
        const toolModule = await import(`./tools/${currentTool.id}.js`);
        const result = await toolModule.process(uploadedFiles, getOptions());
        
        processedBlob = result.blob;
        outputFileName = result.fileName;
        
        showResult();
    } catch (error) {
        showToast(error.message, 'error');
        console.error(error);
    } finally {
        processBtn.disabled = false;
    }
});

function getOptions() {
    const options = {};
    if (currentTool.id === 'protect') {
        options.password = document.getElementById('protect-password').value;
    } else if (currentTool.id === 'watermark') {
        options.text = document.getElementById('watermark-text').value;
        options.opacity = parseFloat(document.getElementById('watermark-opacity').value);
    }
    return options;
}

function showResult() {
    uploadZone.style.display = 'none';
    activeFilesList.style.display = 'none';
    optionsPanel.style.display = 'none';
    processActions.style.display = 'none';
    resultPanel.style.display = 'block';
    
    document.getElementById('result-text').textContent = `Your file "${outputFileName}" (${formatBytes(processedBlob.size)}) is ready.`;
}

downloadBtn.addEventListener('click', () => {
    const url = URL.createObjectURL(processedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

resetBtn.addEventListener('click', () => {
    resetToolState();
    activeFilesList.style.display = 'flex';
    optionsPanel.style.display = 'block';
});

// Initialize
initTheme();
renderTools();
renderMegaDropdown();

// Set PDF.js worker source
if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
