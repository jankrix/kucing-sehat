import { api } from '../api.js';
import { formatText, formatTime, resizeImage } from '../utils.js';
import { renderDashboard } from './cat-dashboard.js';

export async function render(container, params) {
  return renderDashboard(container, params.catId, renderChat);
}

async function renderChat(mainEl, cat) {
  // Load or create session
  let session = null;
  try {
    session = await api.get(`/api/chat/sessions/${cat.id}/latest`);
  } catch {
    // Non-fatal — fall back to sessionless mode
  }

  const savedMessages = session?.messages ?? [];
  let history = [];
  let pendingImage = null;

  mainEl.innerHTML = `
    <div class="chat-page">
      <div class="chat-header">
        <span style="font-size:13px;color:var(--text-secondary);">
          ${savedMessages.length > 0
            ? `${savedMessages.length} pesan tersimpan`
            : `Sesi baru`}
        </span>
        <button id="newChatBtn" class="btn-new-chat" title="Mulai percakapan baru">+ Baru</button>
      </div>

      <div class="chat-messages" id="chatMessages">
        ${savedMessages.length === 0 ? `
          <div class="chat-welcome" id="chatWelcome">
            <div class="big-emoji">🐱</div>
            <h2>Halo! Saya Dr. Meow</h2>
            <p>Ceritakan keluhan ${cat.name}, kirim foto, atau upload hasil lab!</p>
            <div class="suggestions">
              <button data-suggestion="Kucing saya muntah busa putih">Kucing saya muntah busa putih</button>
              <button data-suggestion="Kucing tidak mau makan 2 hari">Kucing tidak mau makan 2 hari</button>
              <button data-suggestion="Ada bercak botak di kulit kucing saya">Ada bercak botak di kulit kucing saya</button>
              <button data-suggestion="Kucing garuk telinga terus-terusan">Kucing garuk telinga terus-terusan</button>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="image-preview" id="imagePreview">
        <img id="previewImg" src="" alt="preview">
        <div class="preview-info">Foto siap dikirim</div>
        <button class="remove-img" id="removeImgBtn">✕</button>
      </div>

      <div class="chat-input-area">
        <button class="btn-icon-round" id="fileBtn" title="Upload foto / rekam medis">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
        </button>
        <textarea id="chatInput" placeholder="Ketik keluhan ${cat.name}... (Shift+Enter = baris baru)" rows="1"></textarea>
        <button class="btn-primary" style="width:40px;height:40px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;" id="sendBtn" title="Kirim">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <input type="file" id="chatFileInput" accept="image/*,.pdf" style="display:none;">
    </div>
  `;

  const messagesEl = mainEl.querySelector('#chatMessages');
  const inputEl = mainEl.querySelector('#chatInput');
  const sendBtn = mainEl.querySelector('#sendBtn');
  const previewEl = mainEl.querySelector('#imagePreview');
  const previewImg = mainEl.querySelector('#previewImg');
  const fileInput = mainEl.querySelector('#chatFileInput');

  // Restore saved messages
  if (savedMessages.length > 0) {
    for (const msg of savedMessages) {
      renderMessage(msg.content, msg.role === 'user' ? 'user' : 'bot', null, msg.timestamp);
    }
    // Rebuild history array for context (last 10 pairs = 20 messages max)
    const recent = savedMessages.slice(-20);
    history = recent.map(m => ({ role: m.role, content: m.content }));
    scrollToBottom();
  }

  // New chat button
  mainEl.querySelector('#newChatBtn').addEventListener('click', async () => {
    if (savedMessages.length > 0 && !confirm('Mulai percakapan baru? Riwayat yang lama tetap tersimpan.')) return;
    try {
      session = await api.post(`/api/chat/sessions/${cat.id}/new`, {});
      history = [];
      messagesEl.innerHTML = `
        <div class="chat-welcome" id="chatWelcome">
          <div class="big-emoji">🐱</div>
          <h2>Halo! Saya Dr. Meow</h2>
          <p>Ceritakan keluhan ${cat.name}, kirim foto, atau upload hasil lab!</p>
          <div class="suggestions">
            <button data-suggestion="Kucing saya muntah busa putih">Kucing saya muntah busa putih</button>
            <button data-suggestion="Kucing tidak mau makan 2 hari">Kucing tidak mau makan 2 hari</button>
            <button data-suggestion="Ada bercak botak di kulit kucing saya">Ada bercak botak di kulit kucing saya</button>
            <button data-suggestion="Kucing garuk telinga terus-terusan">Kucing garuk telinga terus-terusan</button>
          </div>
        </div>
      `;
      mainEl.querySelector('.chat-header span').textContent = 'Sesi baru';
      attachSuggestions();
    } catch {
      // ignore
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = '40px';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !sendBtn.disabled) {
      e.preventDefault();
      doSend();
    }
  });

  mainEl.querySelector('#fileBtn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingImage = await resizeImage(file);
    if (file.type === 'application/pdf') {
      previewImg.style.display = 'none';
      mainEl.querySelector('.preview-info').textContent = '📄 ' + file.name;
    } else {
      previewImg.src = pendingImage;
      previewImg.style.display = '';
      mainEl.querySelector('.preview-info').textContent = 'Foto siap dikirim';
    }
    previewEl.classList.add('active');
    inputEl.focus();
    e.target.value = '';
  });

  mainEl.querySelector('#removeImgBtn').addEventListener('click', removeImage);

  attachSuggestions();
  sendBtn.addEventListener('click', doSend);

  function attachSuggestions() {
    mainEl.querySelectorAll('[data-suggestion]').forEach(btn => {
      btn.addEventListener('click', () => {
        inputEl.value = btn.dataset.suggestion;
        doSend();
      });
    });
  }

  function removeImage() {
    pendingImage = null;
    previewEl.classList.remove('active');
    previewImg.style.display = '';
    mainEl.querySelector('.preview-info').textContent = 'Foto siap dikirim';
  }

  function renderMessage(text, role, imageUrl, timestamp) {
    const welcome = messagesEl.querySelector('#chatWelcome');
    if (welcome) welcome.remove();

    const row = document.createElement('div');
    row.className = `msg-row ${role === 'user' ? 'user' : 'bot'}`;

    let html = '<div class="msg-bubble">';
    if (imageUrl && role === 'user') {
      if (imageUrl.startsWith('data:application/pdf')) {
        html += `<div style="background:var(--bg-tertiary);padding:8px 12px;border-radius:8px;margin-bottom:6px;font-size:12px;color:var(--text-secondary);">📄 Dokumen rekam medis</div>`;
      } else {
        html += `<img class="chat-img" src="${imageUrl}" alt="foto">`;
      }
    }
    html += formatText(text);
    html += '</div>';

    const time = timestamp
      ? new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : formatTime();
    html += `<div class="msg-time">${time}</div>`;

    row.innerHTML = html;
    messagesEl.appendChild(row);
    scrollToBottom();
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const row = document.createElement('div');
    row.className = 'typing-row';
    row.id = 'typing';
    row.innerHTML = '<div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
    messagesEl.appendChild(row);
    scrollToBottom();
  }

  function hideTyping() {
    const el = messagesEl.querySelector('#typing');
    if (el) el.remove();
  }

  async function doSend() {
    const message = inputEl.value.trim();
    if (!message && !pendingImage) return;

    const isPdf = pendingImage?.startsWith('data:application/pdf');
    const text = message || (isPdf ? 'Tolong analisis rekam medis/hasil lab kucing saya ini' : 'Tolong analisis foto kucing saya ini');
    const image = pendingImage;

    inputEl.value = '';
    inputEl.style.height = '40px';
    removeImage();
    sendBtn.disabled = true;

    renderMessage(text, 'user', image);
    showTyping();

    try {
      const body = {
        message: text,
        history,
        cat_id: cat.id,
        ...(session?.id && { session_id: session.id }),
      };
      if (image) body.image = image;

      const data = await api.post('/api/chat', body);
      hideTyping();
      history = data.history ?? history;
      renderMessage(data.reply, 'bot');

      if (data.logged) {
        // Show a subtle toast-like indicator in the chat
        const note = document.createElement('div');
        note.className = 'msg-logged-note';
        note.textContent = '✓ Dicatat ke log pembelian';
        messagesEl.appendChild(note);
        scrollToBottom();
        setTimeout(() => note.remove(), 3000);
      }

      // Update session counter
      const counter = mainEl.querySelector('.chat-header span');
      if (counter && session) {
        const count = (session.messages?.length ?? 0) + 2;
        counter.textContent = `${count} pesan tersimpan`;
      }
    } catch (err) {
      hideTyping();
      renderMessage('Maaf, ada masalah koneksi. Coba lagi ya.', 'bot');
    }

    sendBtn.disabled = false;
    inputEl.focus();
  }
}
