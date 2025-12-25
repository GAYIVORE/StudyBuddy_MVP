/**
 * StudyBuddy AI - Enhanced Frontend Application
 */

// Configuration
const DEFAULT_API_URL = 'http://localhost:8000';
const MAX_MESSAGE_LENGTH = 2000;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

// Application State
let appState = {
    apiUrl: DEFAULT_API_URL,
    currentMode: 'general',
    isRagEnabled: true,
    isProcessing: false,
    messageCount: 0,
    uploadedFiles: [],
    chatHistory: [],
    settings: {
        autoScroll: true,
        soundEffects: true,
        markdownRendering: true,
        theme: 'light',
        fontSize: 'medium',
        model: 'gemini-2.5-flash-lite'
    }
};

// DOM Elements
const elements = {
    // Input
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    charCount: document.getElementById('char-count'),
    
    // Chat
    messagesContainer: document.getElementById('messages-container'),
    messageCount: document.getElementById('message-count'),
    
    // Mode
    modeCards: document.querySelectorAll('.mode-card'),
    activeMode: document.getElementById('active-mode'),
    
    // RAG
    ragToggle: document.getElementById('rag-toggle'),
    ragStatus: document.getElementById('rag-status'),
    uploadArea: document.getElementById('upload-area'),
    fileUpload: document.getElementById('file-upload'),
    fileList: document.getElementById('file-list'),
    clearKbBtn: document.getElementById('clear-kb'),
    
    // Actions
    clearChatBtn: document.getElementById('clear-chat'),
    exportChatBtn: document.getElementById('export-chat'),
    settingsBtn: document.getElementById('settings-btn'),
    attachFileBtn: document.getElementById('attach-file'),
    voiceInputBtn: document.getElementById('voice-input'),
    
    // Quick Actions
    quickActions: document.querySelectorAll('.action-btn'),
    promptChips: document.querySelectorAll('.prompt-chip'),
    suggestionChips: document.querySelectorAll('.suggestion-chip'),
    
    // Status
    apiStatus: document.getElementById('api-status'),
    
    // UI Elements
    typingIndicator: document.getElementById('typing-indicator'),
    loadingOverlay: document.getElementById('global-loading'),
    
    // Modals
    settingsModal: document.getElementById('settings-modal'),
    closeSettings: document.getElementById('close-settings'),
    resetSettings: document.getElementById('reset-settings'),
    saveSettings: document.getElementById('save-settings')
};

// Sounds
const sounds = {
    sent: document.getElementById('message-sent-sound'),
    received: document.getElementById('message-received-sound')
};

// Initialize Application
async function init() {
    console.log('🎓 StudyBuddy AI - Initializing...');
    
    // Load settings from localStorage
    loadSettings();
    
    // Apply theme
    applyTheme(appState.settings.theme);
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize auto-resize for textarea
    initAutoResize();
    
    // Check API health
    await checkApiHealth();
    
    // Load any existing chat history from localStorage
    loadChatHistory();
    
    // Hide loading overlay
    setTimeout(() => {
        elements.loadingOverlay.style.opacity = '0';
        setTimeout(() => {
            elements.loadingOverlay.style.display = 'none';
        }, 300);
    }, 500);
    
    console.log('✅ StudyBuddy AI - Ready!');
}

// Load settings from localStorage
function loadSettings() {
    const savedSettings = localStorage.getItem('studybuddy_settings');
    if (savedSettings) {
        try {
            appState.settings = { ...appState.settings, ...JSON.parse(savedSettings) };
            applySettings();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('studybuddy_settings', JSON.stringify(appState.settings));
    applySettings();
    showToast('Settings saved successfully!', 'success');
}

// Apply current settings
function applySettings() {
    // Apply theme
    applyTheme(appState.settings.theme);
    
    // Apply font size
    document.documentElement.style.fontSize = {
        small: '14px',
        medium: '16px',
        large: '18px'
    }[appState.settings.fontSize];
    
    // Update settings modal
    if (elements.settingsModal) {
        document.getElementById('api-url').value = appState.apiUrl;
        document.getElementById('model-select').value = appState.settings.model;
        document.getElementById('auto-scroll').checked = appState.settings.autoScroll;
        document.getElementById('sound-effects').checked = appState.settings.soundEffects;
        document.getElementById('markdown-rendering').checked = appState.settings.markdownRendering;
        document.getElementById('theme-select').value = appState.settings.theme;
        document.getElementById('font-size').value = appState.settings.fontSize;
    }
}

// Apply theme
function applyTheme(theme) {
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        theme = prefersDark ? 'dark' : 'light';
    }
    
    document.body.classList.toggle('dark-theme', theme === 'dark');
    appState.settings.theme = theme;
}

// Setup all event listeners
function setupEventListeners() {
    // Message sending
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Character count
    elements.messageInput.addEventListener('input', updateCharacterCount);
    
    // Mode selection
    elements.modeCards.forEach(card => {
        card.addEventListener('click', () => selectMode(card.dataset.mode));
    });
    
    // RAG toggle
    elements.ragToggle.addEventListener('click', toggleRag);
    
    // File upload
    elements.uploadArea.addEventListener('click', () => elements.fileUpload.click());
    elements.fileUpload.addEventListener('change', handleFileUpload);
    elements.attachFileBtn.addEventListener('click', () => elements.fileUpload.click());
    
    // Clear knowledge base
    elements.clearKbBtn.addEventListener('click', clearKnowledgeBase);
    
    // Chat actions
    elements.clearChatBtn.addEventListener('click', clearChat);
    elements.exportChatBtn.addEventListener('click', exportChat);
    
    // Settings
    elements.settingsBtn.addEventListener('click', () => showModal('settings-modal'));
    elements.closeSettings.addEventListener('click', () => hideModal('settings-modal'));
    elements.saveSettings.addEventListener('click', saveSettings);
    elements.resetSettings.addEventListener('click', resetSettings);
    
    // Quick actions
    elements.quickActions.forEach(btn => {
        btn.addEventListener('click', () => handleQuickAction(btn.dataset.action));
    });
    
    // Prompt chips
    document.querySelectorAll('.prompt-chip, .suggestion-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            const prompt = e.target.dataset.prompt || e.target.dataset.suggestion;
            if (prompt) {
                elements.messageInput.value = prompt;
                updateCharacterCount();
                elements.messageInput.focus();
                elements.messageInput.style.height = 'auto';
                elements.messageInput.style.height = elements.messageInput.scrollHeight + 'px';
            }
        });
    });
    
    // Voice input (placeholder)
    elements.voiceInputBtn.addEventListener('click', () => {
        showToast('Voice input coming soon!', 'info');
    });
    
    // Close modal on overlay click
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            hideModal('settings-modal');
        }
    });
    
    // Handle drag and drop for file upload
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        elements.uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        elements.uploadArea.addEventListener(eventName, highlightUploadArea, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        elements.uploadArea.addEventListener(eventName, unhighlightUploadArea, false);
    });
    
    elements.uploadArea.addEventListener('drop', handleDrop, false);
}

// Prevent default drag and drop behavior
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// Highlight upload area on drag
function highlightUploadArea() {
    elements.uploadArea.style.borderColor = 'var(--primary)';
    elements.uploadArea.style.background = 'var(--bg-tertiary)';
}

// Unhighlight upload area
function unhighlightUploadArea() {
    elements.uploadArea.style.borderColor = '';
    elements.uploadArea.style.background = '';
}

// Handle dropped files
function handleDrop(e) {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileUpload({ target: { files } });
    }
}

// Initialize auto-resize for textarea
function initAutoResize() {
    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });
}

// Update character count
function updateCharacterCount() {
    const length = elements.messageInput.value.length;
    elements.charCount.textContent = length;
    
    if (length > MAX_MESSAGE_LENGTH * 0.9) {
        elements.charCount.style.color = 'var(--warning)';
    } else if (length > MAX_MESSAGE_LENGTH) {
        elements.charCount.style.color = 'var(--danger)';
    } else {
        elements.charCount.style.color = '';
    }
}

// Select study mode
function selectMode(mode) {
    appState.currentMode = mode;
    
    // Update UI
    elements.modeCards.forEach(card => {
        const isActive = card.dataset.mode === mode;
        card.classList.toggle('active', isActive);
        card.querySelector('.mode-badge').innerHTML = isActive ? 
            '<i class="fas fa-check"></i>' : 
            `<i class="fas fa-${getModeIcon(mode)}"></i>`;
    });
    
    // Update active mode display
    const modeNames = {
        'general': 'General Tutor',
        'study': 'Study Assistant',
        'research': 'Research Aid'
    };
    
    elements.activeMode.innerHTML = `
        <i class="fas fa-${getModeIcon(mode)}"></i>
        <span>${modeNames[mode]} Mode</span>
    `;
    
    // Play sound if enabled
    if (appState.settings.soundEffects) {
        sounds.sent.currentTime = 0;
        sounds.sent.play().catch(() => {});
    }
    
    showToast(`Switched to ${modeNames[mode]} mode`, 'info');
}

// Get icon for mode
function getModeIcon(mode) {
    const icons = {
        'general': 'robot',
        'study': 'book-open',
        'research': 'search'
    };
    return icons[mode] || 'robot';
}

// Toggle RAG
function toggleRag() {
    appState.isRagEnabled = !appState.isRagEnabled;
    
    elements.ragToggle.innerHTML = `
        <i class="fas fa-brain"></i>
        <span>RAG: ${appState.isRagEnabled ? 'ON' : 'OFF'}</span>
    `;
    
    elements.ragStatus.style.display = appState.isRagEnabled ? 'flex' : 'none';
    elements.ragToggle.classList.toggle('btn-primary', appState.isRagEnabled);
    elements.ragToggle.classList.toggle('btn-secondary', !appState.isRagEnabled);
    
    showToast(
        `Knowledge Base ${appState.isRagEnabled ? 'enabled' : 'disabled'}`,
        appState.isRagEnabled ? 'success' : 'warning'
    );
}

// Check API health
async function checkApiHealth() {
    try {
        elements.apiStatus.innerHTML = '<i class="fas fa-circle"></i><span>Checking...</span>';
        
        const response = await fetch(`${appState.apiUrl}/health`);
        if (response.ok) {
            elements.apiStatus.innerHTML = '<i class="fas fa-circle"></i><span>API Connected</span>';
            elements.apiStatus.classList.add('connected');
            showToast('Connected to StudyBuddy API', 'success', 3000);
            return true;
        } else {
            throw new Error('API not responding');
        }
    } catch (error) {
        console.error('API health check failed:', error);
        elements.apiStatus.innerHTML = '<i class="fas fa-circle"></i><span>API Disconnected</span>';
        elements.apiStatus.classList.remove('connected');
        elements.apiStatus.classList.add('disconnected');
        showToast('Cannot connect to StudyBuddy API. Please ensure backend is running.', 'error', 5000);
        return false;
    }
}

// Send message
async function sendMessage() {
    const message = elements.messageInput.value.trim();
    
    if (!message || appState.isProcessing || message.length > MAX_MESSAGE_LENGTH) {
        if (message.length > MAX_MESSAGE_LENGTH) {
            showToast(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`, 'error');
        }
        return;
    }
    
    // Add user message to chat
    addMessageToChat(message, 'user');
    
    // Clear input
    elements.messageInput.value = '';
    elements.messageInput.style.height = 'auto';
    updateCharacterCount();
    
    // Show typing indicator
    elements.typingIndicator.style.display = 'flex';
    appState.isProcessing = true;
    elements.sendBtn.disabled = true;
    
    try {
        // Prepare request data
        const requestData = {
            message: message,
            mode: appState.currentMode,
            use_rag: appState.isRagEnabled
        };
        
        // Send to API
        const response = await fetch(`${appState.apiUrl}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // Hide typing indicator
        elements.typingIndicator.style.display = 'none';
        
        // Add AI response to chat
        addMessageToChat(data.response, 'ai', {
            mode: data.mode,
            model: data.model,
            ragUsed: data.rag_used
        });
        
        // Update message count
        appState.messageCount += 2;
        updateMessageCount();
        
        // Play sound if enabled
        if (appState.settings.soundEffects) {
            sounds.received.currentTime = 0;
            sounds.received.play().catch(() => {});
        }
        
        // Auto-scroll if enabled
        if (appState.settings.autoScroll) {
            scrollToBottom();
        }
        
        // Show RAG usage notification
        if (data.rag_used) {
            showToast('Using knowledge base for context', 'success', 3000);
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        
        // Hide typing indicator
        elements.typingIndicator.style.display = 'none';
        
        // Add error message
        addMessageToChat(
            "I apologize, but I'm having trouble connecting to the AI service. " +
            "Please check your internet connection and ensure the backend server is running.",
            'ai'
        );
        
        showToast('Failed to get response from AI', 'error');
        
    } finally {
        appState.isProcessing = false;
        elements.sendBtn.disabled = false;
        elements.messageInput.focus();
    }
}

// Add message to chat
function addMessageToChat(content, sender, metadata = {}) {
    const messageId = Date.now();
    const timestamp = new Date();
    
    const message = {
        id: messageId,
        content: content,
        sender: sender,
        timestamp: timestamp.toISOString(),
        metadata: metadata
    };
    
    // Add to state
    appState.chatHistory.push(message);
    
    // Save to localStorage
    saveChatHistory();
    
    // Create message element
    const messageElement = createMessageElement(message);
    
    // Add to chat
    elements.messagesContainer.appendChild(messageElement);
    
    // Auto-scroll if enabled
    if (appState.settings.autoScroll && sender === 'ai') {
        setTimeout(() => scrollToBottom(), 100);
    }
}

// Create message element
function createMessageElement(message) {
    const isUser = message.sender === 'user';
    const time = new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'} fade-in`;
    messageDiv.dataset.messageId = message.id;
    
    const avatarIcon = isUser ? 'fas fa-user' : 'fas fa-graduation-cap';
    const avatarClass = isUser ? 'user-avatar' : 'ai-avatar';
    const senderName = isUser ? 'You' : 'StudyBuddy';
    
    let content = message.content;
    if (appState.settings.markdownRendering && !isUser) {
        content = renderMarkdown(content);
    }
    
    messageDiv.innerHTML = `
        <div class="message-avatar">
            <div class="avatar-icon ${avatarClass}">
                <i class="${avatarIcon}"></i>
            </div>
        </div>
        <div class="message-content">
            <div class="message-header">
                <span class="sender">${senderName}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-body">
                ${content}
            </div>
        </div>
    `;
    
    return messageDiv;
}

// Render markdown
function renderMarkdown(text) {
    // Convert headers
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Convert bold
    text = text.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    
    // Convert italic
    text = text.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    
    // Convert code blocks
    text = text.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
    
    // Convert inline code
    text = text.replace(/`(.*?)`/gim, '<code>$1</code>');
    
    // Convert blockquotes
    text = text.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
    
    // Convert lists
    text = text.replace(/^\s*[-*]\s+(.+)/gim, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>');
    
    // Convert numbered lists
    text = text.replace(/^\s*\d+\.\s+(.+)/gim, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/gims, '<ol>$1</ol>');
    
    // Convert links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Convert line breaks
    text = text.replace(/\n/g, '<br>');
    
    // Convert tables (basic support)
    text = text.replace(/^\|(.+)\|$/gm, (match, row) => {
        const cells = row.split('|').map(cell => `<td>${cell.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
    });
    
    return text;
}

// Scroll to bottom of chat
function scrollToBottom() {
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// Update message count
function updateMessageCount() {
    elements.messageCount.innerHTML = `<i class="fas fa-comment"></i><span>${appState.messageCount} messages</span>`;
}

// Handle file upload
async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // Validate files
    const validFiles = files.filter(file => {
        const isValidType = file.name.match(/\.(pdf|txt|md)$/i);
        const isValidSize = file.size <= MAX_UPLOAD_SIZE;
        
        if (!isValidType) {
            showToast(`Invalid file type: ${file.name}. Only PDF, TXT, and MD files are allowed.`, 'error');
        }
        if (!isValidSize) {
            showToast(`File too large: ${file.name}. Maximum size is 10MB.`, 'error');
        }
        
        return isValidType && isValidSize;
    });
    
    if (validFiles.length === 0) return;
    
    // Upload each file
    for (const file of validFiles) {
        await uploadFile(file);
    }
    
    // Clear file input
    event.target.value = '';
}

// Upload single file
async function uploadFile(file) {
    // Show uploading state
    const fileItem = createFileListItem(file, 'uploading');
    elements.fileList.insertBefore(fileItem, elements.fileList.firstChild);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', `Uploaded via StudyBuddy AI - ${new Date().toLocaleString()}`);
    
    try {
        const response = await fetch(`${appState.apiUrl}/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Update file item to show success
        updateFileListItem(fileItem, file, 'success', data);
        
        // Add to state
        appState.uploadedFiles.push({
            name: file.name,
            size: file.size,
            chunks: data.chunks_added,
            timestamp: new Date().toISOString()
        });
        
        showToast(`✅ ${file.name} uploaded successfully (${data.chunks_added} chunks)`, 'success');
        
        // Auto-enable RAG if it was disabled
        if (!appState.isRagEnabled) {
            toggleRag();
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        updateFileListItem(fileItem, file, 'error');
        showToast(`❌ Failed to upload ${file.name}: ${error.message}`, 'error');
    }
}

// Create file list item
function createFileListItem(file, status = 'pending') {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.filename = file.name;
    
    const icon = file.name.endsWith('.pdf') ? 'file-pdf' : 
                 file.name.endsWith('.txt') ? 'file-alt' : 'file-code';
    
    const statusIcons = {
        uploading: 'fas fa-spinner fa-spin',
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle'
    };
    
    fileItem.innerHTML = `
        <div class="file-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="file-info">
            <div class="file-name">${file.name}</div>
            <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
        <div class="file-status">
            <i class="${statusIcons[status]}"></i>
        </div>
    `;
    
    return fileItem;
}

// Update file list item
function updateFileListItem(fileItem, file, status, data = null) {
    const statusElement = fileItem.querySelector('.file-status i');
    const sizeElement = fileItem.querySelector('.file-size');
    
    const statusIcons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle'
    };
    
    const statusColors = {
        success: 'var(--success)',
        error: 'var(--danger)'
    };
    
    statusElement.className = statusIcons[status];
    statusElement.style.color = statusColors[status];
    
    if (status === 'success' && data) {
        sizeElement.textContent = `${formatFileSize(file.size)} • ${data.chunks_added} chunks`;
        
        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-remove';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.title = 'Remove from knowledge base';
        removeBtn.addEventListener('click', () => removeFileFromKB(file.name));
        
        fileItem.querySelector('.file-status').appendChild(removeBtn);
    }
}

// Remove file from knowledge base
async function removeFileFromKB(filename) {
    if (!confirm(`Remove "${filename}" from knowledge base?`)) return;
    
    showToast(`Removing ${filename}...`, 'info');
    
    // Note: This would require a DELETE endpoint on the backend
    // For now, we'll just remove from UI and show a message
    const fileItem = document.querySelector(`.file-item[data-filename="${filename}"]`);
    if (fileItem) {
        fileItem.remove();
    }
    
    appState.uploadedFiles = appState.uploadedFiles.filter(f => f.name !== filename);
    showToast(`${filename} removed from local list`, 'warning');
}

// Clear knowledge base
async function clearKnowledgeBase() {
    if (!confirm('Clear all documents from the knowledge base? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Note: This would require a DELETE endpoint on the backend
        // For now, we'll just clear the UI
        elements.fileList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-import"></i>
                <p>No documents uploaded</p>
            </div>
        `;
        
        appState.uploadedFiles = [];
        showToast('Knowledge base cleared', 'success');
        
    } catch (error) {
        console.error('Clear KB error:', error);
        showToast('Failed to clear knowledge base', 'error');
    }
}

// Clear chat
function clearChat() {
    if (!confirm('Clear the chat history? This action cannot be undone.')) {
        return;
    }
    
    // Clear UI
    elements.messagesContainer.innerHTML = `
        <div class="message ai-message welcome-message">
            <div class="message-avatar">
                <div class="avatar-icon ai-avatar">
                    <i class="fas fa-graduation-cap"></i>
                </div>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="sender">StudyBuddy AI</span>
                    <span class="message-time">Just now</span>
                </div>
                <div class="message-body">
                    <h3>🎯 Chat Cleared!</h3>
                    <p>Ready to start a new learning session? Ask me anything about your studies!</p>
                </div>
            </div>
        </div>
    `;
    
    // Clear state
    appState.chatHistory = [];
    appState.messageCount = 0;
    updateMessageCount();
    
    // Clear localStorage
    localStorage.removeItem('studybuddy_chat');
    
    showToast('Chat history cleared', 'success');
}

// Export chat
function exportChat() {
    if (appState.chatHistory.length === 0) {
        showToast('No chat history to export', 'warning');
        return;
    }
    
    const exportData = {
        exportedAt: new Date().toISOString(),
        totalMessages: appState.chatHistory.length,
        messages: appState.chatHistory
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `studybuddy-chat-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Chat exported successfully', 'success');
}

// Load chat history from localStorage
function loadChatHistory() {
    const savedChat = localStorage.getItem('studybuddy_chat');
    if (savedChat) {
        try {
            const data = JSON.parse(savedChat);
            appState.chatHistory = data.messages || [];
            appState.messageCount = appState.chatHistory.length;
            updateMessageCount();
            
            // Render loaded messages (except welcome message)
            const nonWelcomeMessages = appState.chatHistory.filter(msg => 
                !msg.content.includes('Welcome to StudyBuddy AI')
            );
            
            if (nonWelcomeMessages.length > 0) {
                elements.messagesContainer.innerHTML = '';
                nonWelcomeMessages.forEach(msg => {
                    const element = createMessageElement(msg);
                    elements.messagesContainer.appendChild(element);
                });
                
                showToast(`Loaded ${nonWelcomeMessages.length} previous messages`, 'info');
                
                if (appState.settings.autoScroll) {
                    scrollToBottom();
                }
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }
}

// Save chat history to localStorage
function saveChatHistory() {
    try {
        localStorage.setItem('studybuddy_chat', JSON.stringify({
            savedAt: new Date().toISOString(),
            messages: appState.chatHistory
        }));
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

// Handle quick actions
function handleQuickAction(action) {
    const prompts = {
        explain: 'Can you explain this concept in simple terms: ',
        example: 'Can you provide an example of: ',
        quiz: 'Create a short quiz about: ',
        summary: 'Please summarize: '
    };
    
    const prompt = prompts[action] || '';
    elements.messageInput.value = prompt;
    elements.messageInput.focus();
    elements.messageInput.style.height = 'auto';
    elements.messageInput.style.height = elements.messageInput.scrollHeight + 'px';
    updateCharacterCount();
    
    showToast(`Type your topic after "${prompt}"`, 'info');
}

// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }
}

// Hide modal
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
}

// Reset settings
function resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
        appState.settings = {
            autoScroll: true,
            soundEffects: true,
            markdownRendering: true,
            theme: 'light',
            fontSize: 'medium',
            model: 'gemini-2.5-flash-lite'
        };
        saveSettings();
        showToast('Settings reset to defaults', 'success');
    }
}

// Show toast notification
function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${getToastIcon(type)}"></i>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    });
}

// Get toast icon
function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Service Worker registration (for PWA)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(error => {
            console.log('ServiceWorker registration failed:', error);
        });
    });
}