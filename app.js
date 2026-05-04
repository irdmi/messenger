const API_URL = 'https://messenger.gigpino7.workers.dev';

let currentUser = null;
let currentChatId = null;
let currentChatSeed = null; // Seed для текущего чата
let authToken = localStorage.getItem('chat_token');

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  if (authToken) {
    checkAuth();
  } else {
    showAuthScreen();
  }
});

function setupEventListeners() {
  document.getElementById('menu-btn').addEventListener('click', openSidebar);
  document.getElementById('close-sidebar').addEventListener('click', closeSidebar);
  document.getElementById('overlay').addEventListener('click', closeSidebar);
  document.getElementById('reload-btn').addEventListener('click', loadMessages);
  
  document.getElementById('msg-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeSidebar();
    }
  });
}

// ===== AUTH =====
async function checkAuth() {
  try {
    const resp = await fetch(`${API_URL}/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (resp.ok) {
      const user = await resp.json();
      currentUser = user;
      showChatScreen();
      loadChats();
    } else {
      logout();
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    logout();
  }
}

async function login() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!username || !password) {
    showToast('Enter username and password', 'error');
    return;
  }
  
  try {
    const resp = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await resp.json();
    
    if (!resp.ok) {
      showToast(data.error || 'Login failed', 'error');
      return;
    }
    
    authToken = data.token;
    currentUser = { username: data.username };
    
    localStorage.setItem('chat_token', authToken);
    localStorage.setItem('chat_username', data.username);
    
    showToast('Welcome!', 'success');
    showChatScreen();
    loadChats();
  } catch (err) {
    showToast('Connection error: ' + err.message, 'error');
  }
}

function logout() {
  localStorage.removeItem('chat_token');
  localStorage.removeItem('chat_username');
  authToken = null;
  currentUser = null;
  currentChatId = null;
  currentChatSeed = null;
  showAuthScreen();
  showToast('Logged out', 'success');
}

// ===== UI =====
function showAuthScreen() {
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('chat-screen').classList.remove('active');
  document.getElementById('chat-screen').classList.add('hidden');
}

function showChatScreen() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('chat-screen').classList.remove('hidden');
  document.getElementById('chat-screen').classList.add('active');
  document.getElementById('current-username').textContent = `@${currentUser.username}`;
}

// ===== CHATS =====
async function loadChats() {
  try {
    const resp = await fetch(`${API_URL}/chats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!resp.ok) throw new Error('Failed to load chats');
    
    const chats = await resp.json();
    const list = document.getElementById('chat-list');
    list.innerHTML = '';
    
    if (chats.length === 0) {
      list.innerHTML = '<li style="color: var(--text-muted); text-align: center; cursor: default;">No chats yet</li>';
      return;
    }
    
    chats.forEach(chat => {
      const li = document.createElement('li');
      li.textContent = chat.name;
      if (chat.id === currentChatId) li.classList.add('active');
      li.onclick = () => openChat(chat.id, chat.name);
      list.appendChild(li);
    });
  } catch (err) {
    console.error('Load chats error:', err);
    showToast('Failed to load chats', 'error');
  }
}

async function createChat() {
  const name = document.getElementById('new-chat-name').value.trim();
  const seed = document.getElementById('new-chat-seed').value;
  
  if (!name) {
    showToast('Enter chat name', 'error');
    return;
  }
  
  if (!seed || seed.length < 4) {
    showToast('Encryption password must be at least 4 characters', 'error');
    return;
  }
  
  try {
    const resp = await fetch(`${API_URL}/chats`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });
    
    const data = await resp.json();
    
    if (!resp.ok) {
      showToast(data.error || 'Failed to create chat', 'error');
      return;
    }
    
    // Сохраняем seed для этого чата
    const chatSeeds = JSON.parse(localStorage.getItem('chat_seeds') || '{}');
    chatSeeds[data.id] = seed;
    localStorage.setItem('chat_seeds', JSON.stringify(chatSeeds));
    
    closeModal();
    document.getElementById('new-chat-name').value = '';
    document.getElementById('new-chat-seed').value = '';
    showToast('Chat created!', 'success');
    loadChats();
    openChat(data.id, data.name);
  } catch (err) {
    showToast('Connection error: ' + err.message, 'error');
  }
}

function openChat(chatId, chatName) {
  currentChatId = chatId;
  
  // Загружаем seed для этого чата
  const chatSeeds = JSON.parse(localStorage.getItem('chat_seeds') || '{}');
  currentChatSeed = chatSeeds[chatId];
  
  if (!currentChatSeed) {
    showToast('Error: No encryption key for this chat', 'error');
    return;
  }
  
  document.getElementById('chat-title').textContent = chatName;
  closeSidebar();
  loadMessages();
}

// ===== MESSAGES =====
async function loadMessages() {
  if (!currentChatId) return;
  if (!currentChatSeed) {
    showToast('Error: No encryption key', 'error');
    return;
  }
  
  try {
    const resp = await fetch(`${API_URL}/chats/${currentChatId}/messages`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (!resp.ok) throw new Error('Failed to load messages');
    
    const messages = await resp.json();
    const container = document.getElementById('messages');
    container.innerHTML = '';
    
    if (messages.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: var(--text-muted); margin-top: 40px;">No messages yet. Start the conversation!</div>';
      return;
    }
    
    // Расшифровываем каждое сообщение
    for (const msg of messages) {
      try {
        const decrypted = decryptMessage(msg.ciphertext, currentChatSeed);
        const div = document.createElement('div');
        div.className = 'msg-item';
        div.textContent = decrypted;
        container.appendChild(div);
      } catch (e) {
        console.error('Decrypt failed:', e);
        const div = document.createElement('div');
        div.className = 'msg-item';
        div.style.color = 'var(--error-color)';
        div.textContent = '⚠️ Failed to decrypt';
        container.appendChild(div);
      }
    }
    
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    console.error('Load messages error:', err);
    showToast('Failed to load messages', 'error');
  }
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  
  if (!text) return;
  if (!currentChatId) {
    showToast('Select a chat first', 'error');
    return;
  }
  if (!currentChatSeed) {
    showToast('Error: No encryption key', 'error');
    return;
  }
  
  // Шифруем сообщение
  const encryptedData = encryptMessage(text, currentChatSeed);
  
  try {
    const resp = await fetch(`${API_URL}/chats/${currentChatId}/messages`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ciphertext: encryptedData })
    });
    
    if (!resp.ok) {
      const data = await resp.json();
      throw new Error(data.error || 'Failed to send');
    }
    
    input.value = '';
    loadMessages();
  } catch (err) {
    showToast('Failed to send: ' + err.message, 'error');
    input.value = text;
  }
}

// ===== CRYPTO (CryptoJS) =====
function encryptMessage(text, seed) {
  // Шифруем с помощью CryptoJS AES
  const encrypted = CryptoJS.AES.encrypt(text, seed).toString();
  return encrypted;
}

function decryptMessage(ciphertext, seed) {
  // Расшифровываем с помощью CryptoJS AES
  const bytes = CryptoJS.AES.decrypt(ciphertext, seed);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  
  if (!decrypted) {
    throw new Error('Decryption failed');
  }
  
  return decrypted;
}

// ===== SIDEBAR & MODAL =====
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('overlay').classList.add('show');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('overlay').classList.remove('show');
}

function showCreateChat() {
  document.getElementById('create-chat-modal').classList.remove('hidden');
  document.getElementById('create-chat-modal').classList.add('show');
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('overlay').classList.add('show');
  document.getElementById('new-chat-name').focus();
}

function closeModal() {
  document.getElementById('create-chat-modal').classList.add('hidden');
  document.getElementById('create-chat-modal').classList.remove('show');
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('overlay').classList.remove('show');
  document.getElementById('new-chat-name').value = '';
  document.getElementById('new-chat-seed').value = '';
}

// ===== UTILS =====
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

