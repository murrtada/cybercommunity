let currentUser = null;
let currentProfile = null;
let authSettled = false;
let _authResolve = null;
const authReady = new Promise(resolve => { _authResolve = resolve; });

function waitForAuth(timeout = 4000) {
  if (authSettled) return Promise.resolve(true);
  return Promise.race([
    authReady.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), timeout))
  ]);
}

async function initAuth() {
  // 1. Try getUser first — server-verified, auto-refreshes token
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (user) {
    currentUser = user;
    await loadProfile();
  } else {
    // 2. Fallback to getSession
    const { data: { session } } = await supabaseClient.auth.getSession();
    currentUser = session?.user ?? null;
    if (currentUser) await loadProfile();
  }

  updateAuthUI();

  // Setup notification realtime if logged in
  if (currentUser && typeof setupNotifRealtime === 'function') {
    setupNotifRealtime();
  }

  authSettled = true;
  if (_authResolve) _authResolve();

  // 3. Listen for late session changes
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user ?? null;
    if (currentUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
      await loadProfile();
    } else if (!currentUser) {
      currentProfile = null;
    }
    updateAuthUI();

    // Re-run page functions if session arrived after render
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (typeof loadHomePage === 'function') await loadHomePage();
      if (typeof loadPostsPage === 'function') await loadPostsPage();
      if (typeof loadPostPage === 'function') await loadPostPage();
      if (typeof loadWriteupsPage === 'function') await loadWriteupsPage();
      if (typeof loadWriteupPage === 'function') await loadWriteupPage();
      if (typeof loadProfilePage === 'function') await loadProfilePage();
    }
  });
}

async function loadProfile() {
  if (!currentUser) return;
  const { data } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  currentProfile = data;
}

function updateAuthUI() {
  const el = document.getElementById('auth-state');
  if (!el) return;

  if (currentUser && currentProfile) {
    const notifBadge = '<span class="notif-bell" id="notif-bell" onclick="toggleNotifDropdown(event)">🔔<span class="notif-count" id="notif-count"></span></span>';
    const adminLink = currentProfile.is_admin
      ? `<a href="admin.html" style="color:var(--danger);font-size:0.85rem;text-decoration:none;margin-left:0.75rem;">Admin</a>`
      : '';
    el.innerHTML = `
      ${notifBadge}
      <a href="profile.html" style="color:var(--accent);font-size:0.85rem;text-decoration:none;">
        ${escapeHtml(currentProfile.username)}
      </a>
      ${adminLink}
      <a href="#" onclick="handleLogout(); return false;"
        style="color:var(--text-secondary);font-size:0.85rem;margin-left:0.75rem;text-decoration:none;">
        Logout
      </a>
    `;
  } else if (currentUser) {
    el.innerHTML = `
      <span style="color:var(--accent);font-size:0.85rem;">Logged in</span>
      <a href="#" onclick="handleLogout(); return false;"
        style="color:var(--text-secondary);font-size:0.85rem;margin-left:0.75rem;text-decoration:none;">
        Logout
      </a>
    `;
  } else {
    el.innerHTML = '<a href="login.html">Login</a>';
  }

  // Load notification count if logged in
  if (currentUser && typeof loadNotifCount === 'function') {
    loadNotifCount();
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value;
  const password = form.password.value;
  const username = form.username.value;
  const fullName = form.name.value;

  if (password.length < 6) {
    showToast('Error', 'Password must be at least 6 characters', 'error');
    return;
  }

  const { error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { username, full_name: fullName },
    },
  });

  if (error) {
    showToast('Error', error.message, 'error');
    return;
  }

  showToast('Success!', 'Account created! You can now log in.');
  setTimeout(() => window.location.href = 'login.html', 1000);
}

async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const email = form.email.value;
  const password = form.password.value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    showToast('Error', error.message, 'error');
    return;
  }

  showToast('Welcome back!', 'Redirecting...');
  setTimeout(() => window.location.href = 'index.html', 800);
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  showToast('Logged out', 'See you next time!');
  setTimeout(() => location.reload(), 600);
}

function getCurrentUserId() {
  return currentUser?.id;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
