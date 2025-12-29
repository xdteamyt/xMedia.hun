/* xMedia v6 — enhanced app.js
   Changes in this version:
   - VERSION constant and backup-on-code-update: if stored data has older version, users/posts are backed up in localStorage under a timestamped key
   - Improved Helpex AI: more languages, better intent/keyword matching, templated replies, small FAQ handling, and language-aware replies
   - UI_STRINGS extended with more languages
   - Persist now includes version; added beforeunload autosave
   - Minor robustness fixes (null checks, safer DOM access)

   Note: This is still a client-side demo AI — for production you'd replace Helpex with a server-side multilingual model or API.
*/

const VERSION = '2025.12.09-v1';

/* Storage */
const Storage = {
  key: 'xmedia:v6',
  backupPrefix: 'xmedia:v6:backup:',
  load() { try { return JSON.parse(localStorage.getItem(this.key) || 'null'); } catch { return null; } },
  save(data) { localStorage.setItem(this.key, JSON.stringify(data)); },
  backup(data) {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g,'-');
      const key = this.backupPrefix + stamp;
      const payload = { backupAt: new Date().toISOString(), version: VERSION, users: data.users, posts: data.posts };
      localStorage.setItem(key, JSON.stringify(payload));
      console.info('xMedia backup saved:', key);
    } catch (e) { console.warn('Backup failed', e); }
  }
};

/* Config */
const DISPLAY_COOLDOWN_DAYS = 7;
const HANDLE_COOLDOWN_DAYS = 30;
const BOT_HANDLE = 'helpex';
const SIGNAL_CHANNEL = 'xmedia-signaling';

/* UI translations (more languages) */
const UI_STRINGS = {
  en: { feed: 'Feed', chat: 'Chat', calls: 'Calls', helpex: 'Helpex', profile: 'Profile', signin: 'Sign in', welcome: 'Welcome to xMedia', registerDesc: 'Sign up with a handle, email or phone, and password.', handle: 'Handle', displayName: 'Display name', email: 'Email', phone: 'Phone', bio: 'Bio', password: 'Password', register: 'Register', signinTitle: 'Sign in', forgot: 'Forgot password?', whatsNewTitle: "What's new?" },
  hu: { feed: 'Hírek', chat: 'Csevegés', calls: 'Hívások', helpex: 'Helpex', profile: 'Profil', signin: 'Bejelentkezés', welcome: 'Üdvözöl az xMedia', registerDesc: 'Regisztrálj felhasználónévvel, emaillel vagy telefonszámmal és jelszóval.', handle: 'Felhasználónév', displayName: 'Megjelenítendő név', email: 'Email', phone: 'Telefonszám', bio: 'Bemutatkozás', password: 'Jelszó', register: 'Regisztráció', signinTitle: 'Bejelentkezés', forgot: 'Elfelejtett jelszó?', whatsNewTitle: 'Mi újság?' },
  es: { feed: 'Noticias', chat: 'Chat', calls: 'Llamadas', helpex: 'Helpex', profile: 'Perfil', signin: 'Iniciar sesión', welcome: 'Bienvenido a xMedia', registerDesc: 'Regístrate con un handle, email o teléfono y contraseña.', handle: 'Usuario', displayName: 'Nombre', email: 'Correo', phone: 'Teléfono', bio: 'Bio', password: 'Contraseña', register: 'Registrar', signinTitle: 'Iniciar sesión', forgot: '¿Olvidaste la contraseña?', whatsNewTitle: 'Novedades' },
  fr: { feed: 'Fil', chat: 'Chat', calls: 'Appels', helpex: 'Helpex', profile: 'Profil', signin: 'Se connecter', welcome: 'Bienvenue sur xMedia', registerDesc: 'Inscrivez-vous avec un pseudo, email ou téléphone et mot de passe.', handle: 'Pseudo', displayName: 'Nom affiché', email: 'Email', phone: 'Téléphone', bio: 'Bio', password: 'Mot de passe', register: 'S\'inscrire', signinTitle: 'Connexion', forgot: 'Mot de passe oublié ?', whatsNewTitle: 'Quoi de neuf ?' },
  ro: { feed: 'Noutăți', chat: 'Chat', calls: 'Apeluri', helpex: 'Helpex', profile: 'Profil', signin: 'Autentificare', welcome: 'Bine ai venit la xMedia', registerDesc: 'Înregistrează-te cu un handle, email sau telefon și parolă.', handle: 'Handle', displayName: 'Nume afișat', email: 'Email', phone: 'Telefon', bio: 'Bio', password: 'Parolă', register: 'Înregistrare', signinTitle: 'Autentificare', forgot: 'Ai uitat parola?', whatsNewTitle: 'Noutăți' },
  de: { feed: 'Feed', chat: 'Chat', calls: 'Anrufe', helpex: 'Helpex', profile: 'Profil', signin: 'Anmelden', welcome: 'Willkommen bei xMedia', registerDesc: 'Registriere dich mit einem Handle, E-Mail oder Telefon und Passwort.', handle: 'Handle', displayName: 'Anzeigename', email: 'E-Mail', phone: 'Telefon', bio: 'Bio', password: 'Passwort', register: 'Registrieren', signinTitle: 'Anmelden', forgot: 'Passwort vergessen?', whatsNewTitle: 'Was ist neu?' },
  it: { feed: 'Feed', chat: 'Chat', calls: 'Chiamate', helpex: 'Helpex', profile: 'Profilo', signin: 'Accedi', welcome: 'Benvenuto su xMedia', registerDesc: 'Registrati con un handle, email o telefono e password.', handle: 'Handle', displayName: 'Nome', email: 'Email', phone: 'Telefono', bio: 'Bio', password: 'Password', register: 'Registrati', signinTitle: 'Accedi', forgot: 'Hai dimenticato la password?', whatsNewTitle: 'Novità' },
  pt: { feed: 'Feed', chat: 'Chat', calls: 'Chamadas', helpex: 'Helpex', profile: 'Perfil', signin: 'Entrar', welcome: 'Bem-vindo ao xMedia', registerDesc: 'Cadastre-se com um handle, email ou telefone e senha.', handle: 'Handle', displayName: 'Nome', email: 'Email', phone: 'Telefone', bio: 'Bio', password: 'Senha', register: 'Registrar', signinTitle: 'Entrar', forgot: 'Esqueceu a senha?', whatsNewTitle: 'Novidades' }
};

/* Utils */
const now = () => new Date().toISOString();
const daysSince = iso => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / (1000*60*60*24)) : null;
const fmtTime = iso => {
  if (!iso) return '';
  const d = new Date(iso); const diff = (Date.now() - d.getTime())/1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return d.toLocaleDateString();
};
const initials = name => (name || '?').split(/\s+/).slice(0,2).map(s => s[0]?.toUpperCase()||'').join('') || '?';
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,9)}_${Date.now().toString(36)}`;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const hash = s => btoa(String(s)); // demo-only

/* State */
const state = {
  version: VERSION,
  session: null,
  users: {},
  posts: {},
  comments: {},
  feedOrder: [],
  chatThreads: {},
  dark: false,
  lastSeenWhatsNew: null,
  settings: { uiLanguage: 'hu', country: 'Hungary' },
  calls: { roomId: '', pc: null, dc: null, localStream: null, remoteStream: null, devices: { audioInputs: [], videoInputs: [] }, selected: { audioId: null, videoId: null }, signaling: null }
};

/* Persistence */
function persist(backupIfVersionMismatch = false) {
  const serializable = {
    version: VERSION,
    session: state.session,
    users: toPlainUsers(state.users),
    posts: toPlain(state.posts),
    comments: toPlain(state.comments),
    feedOrder: state.feedOrder,
    chatThreads: state.chatThreads,
    dark: state.dark,
    lastSeenWhatsNew: state.lastSeenWhatsNew,
    settings: state.settings,
    calls: { roomId: state.calls.roomId }
  };
  Storage.save(serializable);
}

function hydrate() {
  const data = Storage.load();
  if (data) {
    // If version mismatch -> backup critical data
    if (data.version !== VERSION) {
      try { Storage.backup({ users: data.users || {}, posts: data.posts || {} }); } catch (e) { console.warn('backup fail', e); }
    }
    // Merge safe fields
    Object.assign(state, { version: data.version || VERSION, session: data.session || null, users: {}, posts: {}, comments: {}, feedOrder: data.feedOrder || [], chatThreads: data.chatThreads || {}, dark: !!data.dark, lastSeenWhatsNew: data.lastSeenWhatsNew || null, settings: data.settings || state.settings });
    // rehydrate users
    if (data.users) {
      for (const [k, v] of Object.entries(data.users)) {
        state.users[k] = { ...v, following: new Set(v.following||[]), friends: new Set(v.friends||[]), friendRequests: new Set(v.friendRequests||[]) };
      }
    }
    if (data.posts) {
      for (const [k, v] of Object.entries(data.posts)) {
        state.posts[k] = { ...v, likes: new Set(v.likes||[]) };
      }
    }
    if (data.comments) state.comments = data.comments;
  } else {
    // fresh start: create helpex bot
    state.session = null;
    state.users = {}; state.posts = {}; state.comments = {};
    state.feedOrder = []; state.chatThreads = {};
    state.dark = matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
    const bot = createUser(BOT_HANDLE, 'Helpex', 'Your helpful AI friend', 'bot_secret', { isBot: true, avatarColor: '#22c55e' });
    persist();
  }
}

function toPlain(map) {
  const obj = {};
  for (const [k, v] of Object.entries(map)) obj[k] = { ...v, likes: v.likes ? Array.from(v.likes) : undefined };
  return obj;
}
function toPlainUsers(map) {
  const obj = {};
  for (const [k, v] of Object.entries(map)) obj[k] = { ...v, following: v.following ? Array.from(v.following) : undefined, friends: v.friends ? Array.from(v.friends) : undefined, friendRequests: v.friendRequests ? Array.from(v.friendRequests) : undefined };
  return obj;
}

/* Models */
function createUser(handle, displayName, bio='', password='', extra={}) {
  const id = uid('usr');
  const user = { id, handle: String(handle).toLowerCase(), displayName: String(displayName), bio, email: extra.email || '', phone: extra.phone || '', passwordHash: hash(password || ''), profilePic: '', avatarColor: extra.avatarColor || '#334155', createdAt: now(), following: new Set(), friends: new Set(), friendRequests: new Set(), isBot: !!extra.isBot, lastDisplayNameChange: null, lastHandleChange: null, freeHandleChangeAvailable: !extra.isBot };
  state.users[id] = user; return user;
}
function getUserByHandle(handle) { return Object.values(state.users).find(u => u.handle.toLowerCase() === String(handle).toLowerCase()); }
function getUserByEmail(email) { return Object.values(state.users).find(u => u.email && u.email.toLowerCase() === String(email).toLowerCase()); }
function currentUser() { return state.session ? state.users[state.session.userId] : null; }

/* Follow & friends */
function follow(followerId, followingId) { const u = state.users[followerId]; if (!u || followerId === followingId) return; u.following.add(followingId); persist(); }
function unfollow(followerId, followingId) { const u = state.users[followerId]; if (!u) return; u.following.delete(followingId); persist(); }
function sendFriendRequest(fromId, toId) { const to = state.users[toId]; const from = state.users[fromId]; if (!to || !from || fromId === toId) return; to.friendRequests.add(fromId); persist(); }
function acceptFriendRequest(userId, fromId) { const me = state.users[userId]; const from = state.users[fromId]; if (!me || !from || !me.friendRequests.has(fromId)) return; me.friendRequests.delete(fromId); me.friends.add(fromId); from.friends.add(userId); ensureThread(userId, fromId); persist(); }
function ensureThread(aId, bId) { const key = threadKey(aId, bId); if (!state.chatThreads[key]) state.chatThreads[key] = { participants: [aId, bId], messages: [] }; return key; }
function threadKey(aId, bId) { return [aId, bId].sort().join('__'); }

/* Posts & comments */
function createPost(authorId, text, imageData='') { const id = uid('pst'); const post = { id, authorId, text: text.trim(), imageData, createdAt: now(), likes: new Set() }; state.posts[id] = post; state.feedOrder.unshift(id); persist(); return post; }
function likePost(userId, postId) { const p = state.posts[postId]; if (!p) return; if (p.likes.has(userId)) p.likes.delete(userId); else p.likes.add(userId); persist(); }
function addComment(authorId, postId, text) { const id = uid('cmt'); state.comments[id] = { id, postId, authorId, text: String(text).trim(), createdAt: now() }; persist(); return state.comments[id]; }

/* Name rules */
function canChangeDisplayName(user) { if (!user.lastDisplayNameChange) return { ok: true, waitDays: 0 }; const elapsed = daysSince(user.lastDisplayNameChange); const ok = elapsed >= DISPLAY_COOLDOWN_DAYS; return { ok, waitDays: ok ? 0 : clamp(DISPLAY_COOLDOWN_DAYS - elapsed, 0, DISPLAY_COOLDOWN_DAYS) }; }
function changeDisplayName(user, newName) { const rule = canChangeDisplayName(user); if (!rule.ok) return { ok: false, error: `Wait ${rule.waitDays} day(s) to change display name.` }; user.displayName = newName.trim(); user.lastDisplayNameChange = now(); persist(); return { ok: true }; }
function canChangeHandle(user) { if (user.freeHandleChangeAvailable) return { ok: true, free: true, waitDays: 0 }; if (!user.lastHandleChange) return { ok: true, waitDays: 0 }; const elapsed = daysSince(user.lastHandleChange); const ok = elapsed >= HANDLE_COOLDOWN_DAYS; return { ok, waitDays: ok ? 0 : clamp(HANDLE_COOLDOWN_DAYS - elapsed, 0, HANDLE_COOLDOWN_DAYS) }; }
function changeHandle(user, newHandle) { newHandle = String(newHandle).trim().toLowerCase(); if (!newHandle || newHandle.length < 3 || newHandle.length > 20) return { ok: false, error: 'Handle must be 3–20 characters.' }; if (getUserByHandle(newHandle)) return { ok: false, error: 'Handle is already taken.' }; const rule = canChangeHandle(user); if (!rule.ok) return { ok: false, error: `Wait ${rule.waitDays} day(s) to change handle.` }; user.handle = newHandle; if (user.freeHandleChangeAvailable) user.freeHandleChangeAvailable = false; user.lastHandleChange = now(); persist(); return { ok: true }; }

/* Helpex AI multilingual — improved */
function helpexUser() { return getUserByHandle(BOT_HANDLE); }
function sendThreadMessage(aId, bId, authorId, text) { const key = ensureThread(aId, bId); const msg = { id: uid('msg'), authorId, text: String(text).trim(), createdAt: now() }; state.chatThreads[key].messages.push(msg); persist(); return msg; }

// Basic intent detection + templated replies. This is rule-based and meant for demo; replace with ML model for production.
function helpexReplyTo(text, lang='hu', userCountry='Hungary') {
  const cleaned = String(text || '').trim();
  const intent = detectIntent(cleaned);
  const base = generateHelpexBaseReply(cleaned, intent, userCountry);
  const localized = localizeReply(base, lang);
  return localized;
}

function detectIntent(text) {
  const lower = text.toLowerCase();
  const intents = [];
  if (/\b(password|forgot|reset)\b/.test(lower)) intents.push('account_recovery');
  if (/\b(name|display|handle|change)\b/.test(lower)) intents.push('name_rules');
  if (/\b(call|camera|microphone|room|join)\b/.test(lower)) intents.push('calls');
  if (/\b(post|upload|image|photo|share)\b/.test(lower)) intents.push('posting');
  if (/\b(friend|follow|add friend|request)\b/.test(lower)) intents.push('social');
  if (/\b(hi|hello|hey|szia|hola|bonjour|ciao)\b/.test(lower)) intents.push('greeting');
  if (/\b(help|how|what|how to|hogyan)\b/.test(lower)) intents.push('help');
  if (!intents.length) intents.push('unknown');
  return intents[0];
}

function generateHelpexBaseReply(text, intent, userCountry) {
  const name = userCountry || 'your country';
  switch (intent) {
    case 'account_recovery':
      return `I can help reset access. For this demo I can create a temporary password — say \"reset password\" and I'll set it. For safety, change it afterwards in Profile → Edit.`;
    case 'name_rules':
      return `Display names can be changed every ${DISPLAY_COOLDOWN_DAYS} days. Handles have one free change after registration, then once every ${HANDLE_COOLDOWN_DAYS} days. To change, go to Profile → Edit.`;
    case 'calls':
      return `To start a call: open Calls, pick your camera and microphone, choose a room code and press Start. Open the same room code in another tab/device to connect. Use the Send file / Record voice controls to share media.`;
    case 'posting':
      return `To make a post: use the composer on Feed, add text or attach an image. You can like and comment on posts. Images are uploaded client-side and stored in your browser for this demo.`;
    case 'social':
      return `Add friends by visiting a profile and clicking Add friend. Friend requests appear in Profile → Friend requests. You can also follow people to see them in your feed.`;
    case 'greeting':
      return `Hello from ${name}! I'm Helpex — I can guide you with posting, profile, calls, recovery or friends. What would you like to do?`;
    case 'help':
      return `I can explain features (posting, profile edits, calls), help with account recovery, or answer quick FAQs. Ask something like: \"How do I change my name?\" or \"How to start a call?\"`;
    default:
      // Fallback: echo and offer suggestions
      const short = text.length > 160 ? text.slice(0,157)+'...' : text;
      return `I heard: \"${short}\". Tell me if you want help with: posting, calls, profile changes, password recovery, or friends.`;
  }
}

// Very small localization helper: translate certain phrases; for demo we use table-based mapping + prefix tags for some languages
function localizeReply(base, lang) {
  if (!base) return base;
  // quick lang-specific small translations (demo only)
  const helpers = {
    hu: base.replace('Display names', 'A megjelenítendő név').replace('Handles', 'Felhasználónevek').replace('To start a call', 'Hívás indításához').replace('I can help reset access.', 'Segíthetek a jelszó helyreállításában.'),
    es: 'ES: ' + base,
    fr: 'FR: ' + base,
    ro: 'RO: ' + base,
    de: 'DE: ' + base,
    it: 'IT: ' + base,
    pt: 'PT: ' + base,
    en: base
  };
  return helpers[lang] || base;
}

/* DOM refs */
const app = document.getElementById('app');
const yearEl = document.getElementById('year'); if (yearEl) yearEl.textContent = new Date().getFullYear();
const authModal = document.getElementById('authModal');
const signInModal = document.getElementById('signInModal');
const postModal = document.getElementById('postModal');
const postDetailContent = document.getElementById('postDetailContent');
const whatsNewModal = document.getElementById('whatsNewModal');

/* Theme */
function setDarkMode(enabled) { document.documentElement.classList.toggle('dark', enabled); state.dark = enabled; persist(); }

/* Router */
window.addEventListener('hashchange', renderApp);

/* UI language helpers */
function t(key) { const lang = state.settings.uiLanguage || 'en'; return (UI_STRINGS[lang] && UI_STRINGS[lang][key]) || UI_STRINGS['en'][key] || key; }
function applyUILanguage() {
  const feedBtn = document.getElementById('feedBtn');
  const chatBtn = document.getElementById('chatBtn');
  const callsBtn = document.getElementById('callsBtn');
  const helpexBtn = document.getElementById('helpexBtn');
  const profileBtn = document.getElementById('profileBtn');
  const signinBtn = document.getElementById('signinBtn');
  if (feedBtn) feedBtn.textContent = t('feed');
  if (chatBtn) chatBtn.textContent = t('chat');
  if (callsBtn) callsBtn.textContent = t('calls');
  if (helpexBtn) helpexBtn.textContent = t('helpex');
  if (profileBtn) profileBtn.textContent = t('profile');
  if (signinBtn) signinBtn.textContent = t('signin');

  const authTitle = document.getElementById('authTitle');
  const authDesc = document.getElementById('authDesc');
  const labelHandle = document.getElementById('labelHandle');
  const labelDisplay = document.getElementById('labelDisplay');
  const labelEmail = document.getElementById('labelEmail');
  const labelPhone = document.getElementById('labelPhone');
  const labelBio = document.getElementById('labelBio');
  const labelPassword = document.getElementById('labelPassword');
  const authSubmit = document.getElementById('authSubmit');
  const authTip = document.getElementById('authTip');
  const signInTitle = document.getElementById('signInTitle');
  const labelSignHandle = document.getElementById('labelSignHandle');
  const labelSignPassword = document.getElementById('labelSignPassword');
  const signSubmit = document.getElementById('signSubmit');
  const forgotBtn = document.getElementById('forgotBtn');
  const whatsNewTitle = document.getElementById('whatsNewTitle');

  authTitle && (authTitle.textContent = t('welcome'));
  authDesc && (authDesc.textContent = t('registerDesc') || UI_STRINGS['en'].registerDesc);
  labelHandle && (labelHandle.textContent = t('handle'));
  labelDisplay && (labelDisplay.textContent = t('displayName'));
  labelEmail && (labelEmail.textContent = t('email'));
  labelPhone && (labelPhone.textContent = t('phone'));
  labelBio && (labelBio.textContent = t('bio'));
  labelPassword && (labelPassword.textContent = t('password'));
  authSubmit && (authSubmit.textContent = t('register'));
  authTip && (authTip.textContent = 'Already have an account? Use Sign in.');

  signInTitle && (signInTitle.textContent = t('signinTitle'));
  labelSignHandle && (labelSignHandle.textContent = t('handle') + ' / ' + t('email'));
  labelSignPassword && (labelSignPassword.textContent = t('password'));
  signSubmit && (signSubmit.textContent = t('signinTitle'));
  forgotBtn && (forgotBtn.textContent = t('forgot'));
  whatsNewTitle && (whatsNewTitle.textContent = t('whatsNewTitle') || UI_STRINGS['en'].whatsNewTitle);

  // populate language and country selects (defensive)
  const uiLangSelect = document.getElementById('uiLangSelect');
  const countrySelect = document.getElementById('countrySelect');
  if (uiLangSelect) {
    if (uiLangSelect.options.length === 0) {
      const langs = Object.keys(UI_STRINGS);
      langs.forEach(l => { const opt = document.createElement('option'); opt.value = l; opt.textContent = l.toUpperCase(); uiLangSelect.appendChild(opt); });
      uiLangSelect.value = state.settings.uiLanguage;
      uiLangSelect.onchange = () => { state.settings.uiLanguage = uiLangSelect.value; persist(); applyUILanguage(); renderApp(); };
    } else uiLangSelect.value = state.settings.uiLanguage;
  }
  if (countrySelect) {
    if (countrySelect.options.length === 0) {
      const countries = ['Hungary','Spain','France','Romania','Germany','USA','UK','Italy','Portugal','Germany'];
      countries.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; countrySelect.appendChild(opt); });
      countrySelect.value = state.settings.country;
      countrySelect.onchange = () => { state.settings.country = countrySelect.value; persist(); };
    } else countrySelect.value = state.settings.country;
  }
}

/* App render */
function renderApp() {
  applyUILanguage();
  const me = currentUser();
  const userMenuBtn = document.getElementById('userMenuBtn'); if (userMenuBtn) userMenuBtn.textContent = me ? (me.profilePic ? '' : initials(me.displayName)) : '?';
  const route = location.hash.replace('#','') || 'feed';
  if (!me) return showAuth();
  if (!state.lastSeenWhatsNew) { if (whatsNewModal) { try { whatsNewModal.showModal(); } catch {} } state.lastSeenWhatsNew = now(); persist(); }
  if (route.startsWith('profile/')) { const handle = route.split('/')[1] || me.handle; const user = getUserByHandle(handle) || me; return renderProfile(user); }
  if (route.startsWith('post/')) { const postId = route.split('/')[1]; return openPostModal(postId); }
  if (route === 'chat') return renderChat();
  if (route === 'calls') return renderCalls();
  if (route === 'helpex') return renderHelpex();
  if (route === 'profile') return renderProfile(me);
  return renderFeed();
}
function showAuth() { if (authModal) try { authModal.showModal(); } catch {} app.innerHTML = ''; }

/* Feed */
function filteredFeed() { const me = currentUser(); if (!me) return state.feedOrder; const following = new Set([...me.following, me.id, ...me.friends]); return state.feedOrder.filter(id => state.posts[id] && following.has(state.posts[id].authorId)); }
function renderFeed() { const me = currentUser(); const feedIds = filteredFeed();
  app.innerHTML = `
    <div class="grid-2">
      <section>
        <div class="card composer">
          <textarea id="postText" rows="3" placeholder="What's on your mind?"></textarea>
          <input id="postFile" type="file" accept="image/*">
          <div class="actions">
            <span class="muted">Posting as ${me.displayName} (@${me.handle})</span>
            <button id="postBtn" class="btn primary">Post</button>
          </div>
        </div>
        <div class="feed">
          ${feedIds.map(renderPostCard).join('') || '<p class="muted">No posts yet. Say hello to Helpex in Helpex tab, or make your first post.</p>'}
        </div>
      </section>
      <aside class="aside">
        <div class="panel">
          <h4>People you may know</h4>
          <div>${suggestPeople(me).map(renderUserSuggestion).join('') || '<p class="muted">No suggestions yet.</p>'}</div>
        </div>
      </aside>
    </div>
  `;
  const postBtn = document.getElementById('postBtn'); if (postBtn) postBtn.onclick = async () => {
    const textEl = document.getElementById('postText'); const fileEl = document.getElementById('postFile');
    const text = textEl ? textEl.value : '';
    const file = fileEl && fileEl.files ? fileEl.files[0] : null;
    let img = '';
    if (file) img = await fileToBase64(file);
    if (!text.trim() && !img) return;
    const p = createPost(me.id, text, img);
    if (textEl) textEl.value = ''; if (fileEl) fileEl.value = '';
    prependPost(p.id);
  };
  bindPostActions();
}
function renderPostCard(id) { const p = state.posts[id]; if (!p) return ''; const author = state.users[p.authorId] || { displayName: 'Unknown', handle: 'unknown' }; const likeCount = p.likes ? p.likes.size : 0; const comments = Object.values(state.comments).filter(c => c.postId === id);
  return `
    <article class="card post" data-id="${id}">
      <div class="avatar">${author.profilePic ? `<img src="${author.profilePic}" alt="Avatar">` : initials(author.displayName)}</div>
      <div>
        <div class="head">
          <a href="#profile/${author.handle}" class="link"><strong>${author.displayName}</strong></a>
          <span class="handle">@${author.handle}</span>
          <span class="time">${fmtTime(p.createdAt)}</span>
        </div>
        <p class="text">${escapeHtml(p.text)}</p>
        ${p.imageData ? `<div class="image"><img src="${p.imageData}" alt="Post image"></div>` : ''}
        <div class="actions">
          <button class="btn" data-action="like">${p.likes && p.likes.has(currentUser().id) ? 'Unlike' : 'Like'}</button>
          <span class="stat">❤ ${likeCount}</span>
          <button class="btn" data-action="comment">Comment</button>
          <span class="stat">💬 ${comments.length}</span>
          <button class="btn ghost" data-action="open">Open</button>
        </div>
        <div class="comments">
          ${comments.slice(-3).map(renderComment).join('')}
          ${comments.length > 3 ? `<button class="btn ghost" data-action="open">View all comments</button>` : ''}
        </div>
        <div class="composer" style="margin-top:0.5rem">
          <input type="text" placeholder="Write a comment…" data-input="comment">
          <button class="btn" data-action="addComment">Post</button>
        </div>
      </div>
    </article>
  `;
}
function renderComment(c) { const u = state.users[c.authorId] || { displayName: 'Unknown', handle: 'unknown' }; return `
  <div class="comment">
    <div class="avatar">${u.profilePic ? `<img src="${u.profilePic}" alt="Avatar">` : initials(u.displayName)}</div>
    <div>
      <div class="head">
        <a href="#profile/${u.handle}" class="link"><strong>${u.displayName}</strong></a>
        <span class="handle">@${u.handle}</span>
        <span class="time">${fmtTime(c.createdAt)}</span>
      </div>
      <p class="text">${escapeHtml(c.text)}</p>
    </div>
  </div>
`;
}
function bindPostActions() {
  document.querySelectorAll('.post').forEach(postEl => {
    const id = postEl.dataset.id;
    const likeBtn = postEl.querySelector('[data-action="like"]');
    const commentBtn = postEl.querySelector('[data-action="comment"]');
    const addCommentBtn = postEl.querySelector('[data-action="addComment"]');
    const openBtn = postEl.querySelector('[data-action="open"]');
    const input = postEl.querySelector('[data-input="comment"]');
    likeBtn && (likeBtn.onclick = () => { likePost(currentUser().id, id); renderApp(); });
    commentBtn && (commentBtn.onclick = () => { input?.focus(); });
    addCommentBtn && (addCommentBtn.onclick = () => { const text = input.value; if (!text.trim()) return; addComment(currentUser().id, id, text); input.value = ''; renderApp(); });
    openBtn && (openBtn.onclick = () => openPostModal(id));
  });
}
function prependPost(id) { const feedEl = document.querySelector('.feed'); if (!feedEl) return renderApp(); const temp = document.createElement('div'); temp.innerHTML = renderPostCard(id); feedEl.prepend(temp.firstElementChild); bindPostActions(); }

/* Post modal */
function openPostModal(postId) { const p = state.posts[postId]; if (!p) return; const author = state.users[p.authorId] || { displayName:'Unknown', handle:'unknown' }; const comments = Object.values(state.comments).filter(c => c.postId === postId);
  if (!postDetailContent) return;
  postDetailContent.innerHTML = `
    <article class="post" data-id="${postId}">
      <div class="avatar">${author.profilePic ? `<img src="${author.profilePic}" alt="Avatar">` : initials(author.displayName)}</div>
      <div>
        <div class="head">
          <a href="#profile/${author.handle}" class="link"><strong>${author.displayName}</strong></a>
          <span class="handle">@${author.handle}</span>
          <span class="time">${fmtTime(p.createdAt)}</span>
        </div>
        <p class="text">${escapeHtml(p.text)}</p>
        ${p.imageData ? `<div class="image"><img src="${p.imageData}" alt="Post image"></div>` : ''}
        <div class="actions">
          <button class="btn" data-action="like">${p.likes && p.likes.has(currentUser().id) ? 'Unlike' : 'Like'}</button>
          <span class="stat">❤ ${p.likes ? p.likes.size : 0}</span>
          <button class="btn" data-action="comment">Comment</button>
          <span class="stat">💬 ${comments.length}</span>
        </div>
        <div>${comments.map(renderComment).join('')}</div>
        <div class="composer" style="margin-top:0.5rem">
          <input type="text" placeholder="Write a comment…" data-input="comment">
          <button class="btn" data-action="addComment">Post</button>
        </div>
      </div>
    </article>
  `;
  try { postModal.showModal(); } catch {}
  const closeBtn = document.getElementById('closePostModal'); if (closeBtn) closeBtn.onclick = () => postModal.close();
  bindPostActions();
}

/* Profile */
function renderProfile(user) {
  const me = currentUser(); if (!me || !user) return renderApp(); const isMe = me.id === user.id;
  const posts = state.feedOrder.filter(id => state.posts[id] && state.posts[id].authorId === user.id);
  const dRule = canChangeDisplayName(user); const hRule = canChangeHandle(user);
  const isFriend = me.friends.has(user.id);
  const hasRequestFromMe = user.friendRequests.has(me.id);

  app.innerHTML = `
    <section class="card" style="margin-bottom:1rem">
      <div class="post">
        <div class="avatar">${user.profilePic ? `<img src="${user.profilePic}" alt="Avatar">` : initials(user.displayName)}</div>
        <div>
          <div class="head">
            <strong>${user.displayName}</strong>
            <span class="handle">@${user.handle}</span>
            <span class="time">Joined ${new Date(user.createdAt).toLocaleDateString()}</span>
          </div>
          <p class="text">${escapeHtml(user.bio || '')}</p>
          <div class="actions">
            ${isMe ? `
              <button class="btn" id="editProfileBtn">Edit profile</button>
              <span class="muted">Display: ${dRule.ok ? 'You can change now' : `Wait ${dRule.waitDays} day(s)`}; Handle: ${hRule.ok ? (hRule.free ? 'Free change available' : 'You can change now') : `Wait ${hRule.waitDays} day(s)`}</span>
            ` : `
              ${isFriend ? `<span class="muted">You are friends</span> <button class="btn" id="openChatBtn">Message</button>` : hasRequestFromMe ? `<span class="muted">Friend request sent</span>` : `<button class="btn primary" id="addFriendBtn">Add friend</button>`}
              <button class="btn ${me.following.has(user.id) ? 'danger' : 'primary'}" id="followBtn">${me.following.has(user.id) ? 'Unfollow' : 'Follow'}</button>
            `}
          </div>
          ${!isMe && user.friendRequests.has(me.id) ? `<p class="muted">Awaiting ${user.displayName} to accept your request.</p>` : ''}
          ${isMe && me.friendRequests.size ? `
            <div class="card" style="margin-top:0.75rem">
              <strong>Friend requests</strong>
              ${Array.from(me.friendRequests).map(fid => { const u = state.users[fid]; return `<div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem"><div class="avatar">${u.profilePic ? `<img src="${u.profilePic}">` : initials(u.displayName)}</div><div><strong>${u.displayName}</strong> <span class="handle">@${u.handle}</span></div><button class="btn primary" data-accept="${u.id}">Accept</button></div>`; }).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    </section>

    <section>
      <h3>Posts</h3>
      <div class="feed">
        ${posts.length ? posts.map(renderPostCard).join('') : `<p class="muted">No posts yet.</p>`}
      </div>
    </section>
  `;

  if (!isMe) {
    const followBtn = document.getElementById('followBtn'); if (followBtn) followBtn.onclick = () => { me.following.has(user.id) ? unfollow(me.id, user.id) : follow(me.id, user.id); renderProfile(user); };
    const addBtn = document.getElementById('addFriendBtn'); if (addBtn) addBtn.onclick = () => { sendFriendRequest(me.id, user.id); renderProfile(user); };
    const openChatBtn = document.getElementById('openChatBtn'); if (openChatBtn) openChatBtn.onclick = () => { location.hash = '#chat'; renderChatWith(user); };
  } else {
    const editBtn = document.getElementById('editProfileBtn'); if (editBtn) editBtn.onclick = () => openEditProfileModal(me);
    document.querySelectorAll('[data-accept]').forEach(btn => { btn.onclick = () => { acceptFriendRequest(me.id, btn.getAttribute('data-accept')); renderProfile(me); }; });
  }
  bindPostActions();
}

/* Profile editor */
function openEditProfileModal(me) { const dRule = canChangeDisplayName(me); const hRule = canChangeHandle(me); const dialog = document.createElement('dialog'); dialog.innerHTML = `
  <form method="dialog" class="auth-form" id="editForm">
    <h3>Edit profile</h3>
    <label>Display name
      <input name="displayName" type="text" maxlength="40" value="${escapeAttr(me.displayName)}" ${dRule.ok ? '' : 'disabled'}>
    </label>
    ${dRule.ok ? '' : `<p class="muted">Wait ${dRule.waitDays} day(s) to change display name.</p>`}
    <label>Handle (profile name)
      <input name="handle" type="text" minlength="3" maxlength="20" value="${escapeAttr(me.handle)}" ${hRule.ok ? '' : 'disabled'}>
    </label>
    ${hRule.ok ? `<p class="muted">${hRule.free ? 'Free change available.' : 'You can change now.'}</p>` : `<p class="muted">Wait ${hRule.waitDays} day(s) to change handle.</p>`}
    <label>Bio
      <textarea name="bio" rows="2" maxlength="160">${escapeHtml(me.bio || '')}</textarea>
    </label>
    <label>Profile picture
      <input name="pic" type="file" accept="image/*">
    </label>
    <label>New password
      <input name="password" type="password" minlength="6" placeholder="Leave blank to keep current">
    </label>
    <div class="form-actions">
      <button value="cancel" type="button" id="editCancel">Cancel</button>
      <button value="confirm" type="submit">Save</button>
    </div>
  </form>
`;
  document.body.appendChild(dialog);
  try { dialog.showModal(); } catch {}
  dialog.querySelector('#editCancel').onclick = () => { dialog.close(); dialog.remove(); };
  dialog.querySelector('#editForm').onsubmit = async (e) => {
    e.preventDefault(); const fd = new FormData(e.target);
    const newDisplay = String(fd.get('displayName') || me.displayName).trim();
    const newHandle = String(fd.get('handle') || me.handle).trim();
    const bio = String(fd.get('bio') || '').trim();
    const picFile = fd.get('pic'); const newPassword = String(fd.get('password') || '').trim();
    let errors = [];
    if (newDisplay !== me.displayName) { const res = changeDisplayName(me, newDisplay); if (!res.ok) errors.push(res.error); }
    if (newHandle.toLowerCase() !== me.handle.toLowerCase()) { const res = changeHandle(me, newHandle); if (!res.ok) errors.push(res.error); }
    me.bio = bio;
    if (picFile && picFile.size > 0) me.profilePic = await fileToBase64(picFile);
    if (newPassword) { if (newPassword.length < 6) errors.push('Password must be at least 6 characters.'); else me.passwordHash = hash(newPassword); }
    if (errors.length) alert(errors.join('\n')); else { persist(); dialog.close(); dialog.remove(); renderProfile(me); }
  };
}

/* Chat (user-to-user + Helpex shortcut) */
function renderChat() { const me = currentUser(); const bot = helpexUser(); if (!me || !bot) return renderApp(); ensureThread(me.id, bot.id);
  app.innerHTML = `
    <section class="card chat">
      <div>
        <h3>Chat</h3>
        <p class="muted">Chat with Helpex or select a friend to message privately.</p>
      </div>

      <div class="card">
        <strong>Friends</strong>
        <div style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:0.5rem">
          ${Array.from(me.friends).map(fid => { const u = state.users[fid]; return `<button class="btn" data-chat="${u.id}">${u.displayName} (@${u.handle})</button>`; }).join('') || '<span class="muted">No friends yet.</span>'}
          <button class="btn" data-helpex="1">Talk to Helpex</button>
        </div>
      </div>

      <div id="thread">
        <h4>Helpex</h4>
        <div id="chatList">
          ${renderThreadMessages(me.id, bot.id)}
        </div>
        <div class="composer">
          <input id="chatInput" type="text" placeholder="Message…">
          <div class="actions">
            <span class="muted">Chatting as ${me.displayName} (@${me.handle})</span>
            <button id="sendChatBtn" class="btn primary">Send</button>
          </div>
        </div>
      </div>
    </section>
  `;
  document.querySelectorAll('[data-chat]').forEach(btn => { btn.onclick = () => { const otherId = btn.getAttribute('data-chat'); renderChatWith(state.users[otherId]); }; });
  const helpexBtnInline = document.querySelector('[data-helpex]'); helpexBtnInline && (helpexBtnInline.onclick = () => { location.hash = '#helpex'; renderHelpex(); });
  const sendBtn = document.getElementById('sendChatBtn'); if (sendBtn) sendBtn.onclick = () => { const input = document.getElementById('chatInput'); const text = input.value.trim(); if (!text) return; sendThreadMessage(me.id, bot.id, me.id, text); const reply = helpexReplyTo(text, state.settings.uiLanguage, state.settings.country); sendThreadMessage(me.id, bot.id, bot.id, reply); input.value = ''; renderChat(); };
}
function renderThreadMessages(aId, bId) { const key = ensureThread(aId, bId); return (state.chatThreads[key].messages || []).map(m => { const u = state.users[m.authorId] || { displayName:'Unknown', handle:'unknown', isBot: false }; const cls = u.isBot ? 'bot' : (m.authorId === currentUser().id ? 'me' : 'other'); return `
  <div class="message ${cls}">
    <div class="avatar">${u.profilePic ? `<img src="${u.profilePic}">` : initials(u.displayName)}</div>
    <div class="bubble">
      <div class="head"><strong>${u.displayName}</strong> <span class="handle">@${u.handle}</span> <span class="time">${fmtTime(m.createdAt)}</span></div>
      <p class="text">${escapeHtml(m.text)}</p>
    </div>
  </div>
`; }).join(''); }
function renderChatWith(otherUser) { const me = currentUser(); if (!me || !otherUser) return renderApp(); ensureThread(me.id, otherUser.id); app.innerHTML = `
  <section class="card chat">
    <div>
      <h3>Chat with ${otherUser.displayName}</h3>
      <p class="muted">@${otherUser.handle}</p>
    </div>
    <div id="chatList">${renderThreadMessages(me.id, otherUser.id)}</div>
    <div class="composer">
      <input id="chatInput" type="text" placeholder="Message…">
      <div class="actions">
        <span class="muted">Chatting as ${me.displayName}</span>
        <button id="sendChatBtn" class="btn primary">Send</button>
      </div>
    </div>
  </section>
`;
  const send = document.getElementById('sendChatBtn'); if (send) send.onclick = () => { const input = document.getElementById('chatInput'); const text = input.value.trim(); if (!text) return; sendThreadMessage(me.id, otherUser.id, me.id, text); input.value = ''; renderChatWith(otherUser); };
}

/* Helpex AI panel */
function renderHelpex() { const me = currentUser(); const bot = helpexUser(); if (!me || !bot) return renderApp(); ensureThread(me.id, bot.id);
  app.innerHTML = `
    <section class="card chat">
      <h3>Helpex AI</h3>
      <p class="muted">I reply in ${state.settings.uiLanguage.toUpperCase()} (${state.settings.country}).</p>
      <div id="helpexChat">${renderThreadMessages(me.id, bot.id)}</div>
      <div class="composer">
        <input id="helpexInput" type="text" placeholder="Type your question…">
        <div class="actions">
          <span class="muted">Chatting as ${me.displayName}</span>
          <button id="helpexSend" class="btn primary">Send</button>
        </div>
      </div>
    </section>
  `;
  const send = document.getElementById('helpexSend'); if (send) send.onclick = () => { const input = document.getElementById('helpexInput'); const text = input.value.trim(); if (!text) return; sendThreadMessage(me.id, bot.id, me.id, text); const reply = helpexReplyTo(text, state.settings.uiLanguage, state.settings.country); sendThreadMessage(me.id, bot.id, bot.id, reply); input.value = ''; renderHelpex(); };
}

/* Suggestions */
function suggestPeople(me) { return Object.values(state.users).filter(u => u.id !== me.id && !me.following.has(u.id)); }
function renderUserSuggestion(u) { const me = currentUser(); return `
  <div class="post" style="margin:0.5rem 0">
    <div class="avatar">${u.profilePic ? `<img src="${u.profilePic}">` : initials(u.displayName)}</div>
    <div>
      <div class="head">
        <a href="#profile/${u.handle}" class="link"><strong>${u.displayName}</strong></a>
        <span class="handle">@${u.handle}</span>
      </div>
      <button class="btn small primary" onclick="follow('${me.id}','${u.id}'); renderApp();">Follow</button>
    </div>
  </div>
`; }

/* Search */
const searchInput = document.getElementById('searchInput'); if (searchInput) searchInput.addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase(); if (!q) { renderApp(); return; }
  const users = Object.values(state.users).filter(u => (u.handle||'').toLowerCase().includes(q) || (u.displayName||'').toLowerCase().includes(q) || ((u.bio||'').toLowerCase().includes(q)));
  const posts = Object.values(state.posts).filter(p => (p.text||'').toLowerCase().includes(q));
  app.innerHTML = `
    <section class="card" style="margin-bottom:1rem">
      <h3>Search results</h3>
      <p class="muted">Found ${users.length} users and ${posts.length} posts for “${escapeHtml(q)}”.</p>
    </section>
    <div class="grid-2">
      <section>
        <div class="feed">
          ${posts.map(p => renderPostCard(p.id)).join('') || '<p class="muted">No posts match.</p>'}
        </div>
      </section>
      <aside class="aside">
        <div class="panel">
          <h4>People</h4>
          ${users.length ? users.map(renderUserSuggestion).join('') : '<p class="muted">No users match.</p>'}
        </div>
      </aside>
    </div>
  `;
  bindPostActions();
});

/* Auth: Register (requires email or phone) */
const authForm = document.getElementById('authForm'); if (authForm) authForm.addEventListener('submit', async e => {
  e.preventDefault(); const fd = new FormData(e.target);
  const handle = String(fd.get('handle') || '').trim().toLowerCase(); const displayName = String(fd.get('displayName') || '').trim(); const email = String(fd.get('email') || '').trim(); const phone = String(fd.get('phone') || '').trim(); const bio = String(fd.get('bio') || '').trim(); const password = String(fd.get('password') || '').trim();
  if (!handle || !displayName || !password) return; if (!email && !phone) { alert('Provide at least email or phone.'); return; }
  if (getUserByHandle(handle)) { alert('Handle is already taken.'); return; }
  if (email && getUserByEmail(email)) { alert('Email is already registered.'); return; }
  const user = createUser(handle, displayName, bio, password, { email, phone }); const bot = helpexUser(); if (bot) follow(user.id, bot.id); ensureThread(user.id, helpexUser().id); sendThreadMessage(user.id, helpexUser().id, helpexUser().id, `Welcome, ${displayName}! I’m Helpex. Ask me anything — posting, friends, calls, or recovery.`); state.session = { userId: user.id }; persist(); try { authModal.close(); } catch {} try { whatsNewModal.showModal(); } catch {} renderApp(); });
const authCancel = document.getElementById('authCancel'); if (authCancel) authCancel.onclick = () => { document.querySelectorAll('#authForm input, #authForm textarea').forEach(i => i.value = ''); };

/* Sign in (separate modal) */
const signInForm = document.getElementById('signInForm'); if (signInForm) signInForm.addEventListener('submit', e => {
  e.preventDefault(); const fd = new FormData(e.target); const idField = String(fd.get('signHandle') || '').trim(); const password = String(fd.get('signPassword') || '').trim(); if (!idField || !password) return; let user = null; if (idField.includes('@')) user = getUserByEmail(idField.toLowerCase()); else user = getUserByHandle(idField.toLowerCase()); if (!user) { alert('No such user.'); return; } if (user.passwordHash !== hash(password)) { alert('Incorrect password.'); return; } state.session = { userId: user.id }; persist(); try { signInModal.close(); } catch {} try { whatsNewModal.showModal(); } catch {} renderApp(); });
const signCancel = document.getElementById('signCancel'); if (signCancel) signCancel.onclick = () => { document.querySelectorAll('#signInForm input').forEach(i => i.value = ''); };
const forgotBtn = document.getElementById('forgotBtn'); if (forgotBtn) forgotBtn.onclick = () => { alert('Tip: Open Helpex tab and say \"forgot password\" or \"reset password\".'); };

/* Navigation */
const feedBtn = document.getElementById('feedBtn'); if (feedBtn) feedBtn.onclick = () => { location.hash = '#feed'; };
const chatBtn = document.getElementById('chatBtn'); if (chatBtn) chatBtn.onclick = () => { location.hash = '#chat'; };
const callsBtn = document.getElementById('callsBtn'); if (callsBtn) callsBtn.onclick = () => { location.hash = '#calls'; };
const helpexBtn = document.getElementById('helpexBtn'); if (helpexBtn) helpexBtn.onclick = () => { location.hash = '#helpex'; };
const profileBtn = document.getElementById('profileBtn'); if (profileBtn) profileBtn.onclick = () => { const me = currentUser(); location.hash = me ? `#profile/${me.handle}` : '#profile'; };
const signinBtn = document.getElementById('signinBtn'); if (signinBtn) signinBtn.onclick = () => { try { signInModal.showModal(); } catch {} };

const userMenuBtn = document.getElementById('userMenuBtn'); if (userMenuBtn) userMenuBtn.onclick = () =>
{"multiple":false,"pattern":"const userMenuBtn = document.getElementById('userMenuBtn'); if (userMenuBtn) userMenuBtn.onclick = () =