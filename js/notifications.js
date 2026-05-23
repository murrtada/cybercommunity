let notifDropdown = null;

async function fetchNotifications(limit = 20) {
  const { data } = await supabaseClient
    .from('notifications')
    .select('*, actor:actor_id(username, avatar_url, full_name)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

async function getUnreadCount() {
  const { count } = await supabaseClient
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', currentUser.id)
    .eq('is_read', false);
  return count || 0;
}

async function loadNotifCount() {
  const badge = document.getElementById('notif-count');
  if (!badge) return;
  const count = await getUnreadCount();
  badge.textContent = count > 0 ? (count > 99 ? '99+' : count) : '';
  badge.style.display = count > 0 ? 'inline' : 'none';
}

async function markNotifRead(id) {
  await supabaseClient
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', currentUser.id);
  loadNotifCount();
}

async function markAllNotifRead() {
  await supabaseClient
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', currentUser.id)
    .eq('is_read', false);
  loadNotifCount();
  const items = document.querySelectorAll('.notif-item.unread');
  items.forEach(el => el.classList.remove('unread'));
}

function formatNotifTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function notifIcon(type) {
  const icons = { like: '❤️', comment: '💬', reply: '↩️', new_post: '📝', new_writeup: '📄' };
  return icons[type] || '🔔';
}

function notifLink(n) {
  if (n.content_type === 'post' && n.content_slug) return `post.html?slug=${n.content_slug}`;
  if (n.content_type === 'writeup' && n.content_slug) return `writeup.html?slug=${n.content_slug}`;
  if (n.content_type === 'post') return `post.html?slug=${n.content_id}`;
  if (n.content_type === 'writeup') return `writeup.html?slug=${n.content_id}`;
  return '#';
}

async function handleNotifClick(event, id, href) {
  event.preventDefault();
  await markNotifRead(id);
  window.location.href = href;
}

function renderNotifItem(n) {
  const actor = n.actor || {};
  return `
    <a href="${notifLink(n)}" class="notif-item ${n.is_read ? '' : 'unread'}"
       onclick="handleNotifClick(event, '${n.id}', '${notifLink(n)}')" data-id="${n.id}">
      <span class="notif-icon">${notifIcon(n.type)}</span>
      <div class="notif-body">
        <div class="notif-text">
          <strong>${escapeHtml(actor.username || 'Someone')}</strong>
          ${escapeHtml(n.message || n.type.replace('_', ' '))}
        </div>
        <div class="notif-title">${escapeHtml(n.title || '')}</div>
        <div class="notif-time">${formatNotifTime(n.created_at)}</div>
      </div>
    </a>
  `;
}

async function toggleNotifDropdown(event) {
  event.stopPropagation();

  if (notifDropdown) {
    notifDropdown.remove();
    notifDropdown = null;
    return;
  }

  if (!currentUser) return;

  const bell = document.getElementById('notif-bell');
  if (!bell) return;
  const rect = bell.getBoundingClientRect();

  const notifs = await fetchNotifications(8);
  const unread = await getUnreadCount();

  const dropdown = document.createElement('div');
  dropdown.className = 'notif-dropdown';
  dropdown.style.cssText = `
    position: fixed; top: ${rect.bottom + 8}px; right: ${Math.max(10, window.innerWidth - rect.right + 10)}px;
    width: 360px; max-height: 480px; background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); z-index: 1000; overflow: hidden; display: flex; flex-direction: column;
  `;

  dropdown.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1rem 0.5rem;border-bottom:1px solid var(--border);">
      <strong>Notifications</strong>
      ${unread > 0 ? `<button onclick="markAllNotifRead()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:0.8rem;">Mark all read</button>` : ''}
    </div>
    <div class="notif-list" style="overflow-y:auto;flex:1;">
      ${notifs.length === 0
        ? '<div style="padding:2rem;text-align:center;color:var(--text-secondary);">No notifications yet</div>'
        : notifs.map(renderNotifItem).join('')}
    </div>
    <a href="notifications.html" style="display:block;text-align:center;padding:0.75rem;color:var(--accent);text-decoration:none;border-top:1px solid var(--border);font-size:0.85rem;">
      View all notifications
    </a>
  `;

  document.body.appendChild(dropdown);
  notifDropdown = dropdown;

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', closeNotifDropdown, { once: true });
  }, 0);
}

function closeNotifDropdown() {
  if (notifDropdown) {
    notifDropdown.remove();
    notifDropdown = null;
  }
}

let notifCtx = null;

async function unlockAudio() {
  if (!notifCtx) {
    notifCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (notifCtx.state === 'suspended') {
    await notifCtx.resume();
  }
}
document.addEventListener('click', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

function playNotifSound() {
  if (notifCtx && notifCtx.state === 'running') {
    fetch('js/beeb.mp3')
      .then(r => r.arrayBuffer())
      .then(buf => notifCtx.decodeAudioData(buf))
      .then(buf => {
        const src = notifCtx.createBufferSource();
        src.buffer = buf;
        src.connect(notifCtx.destination);
        src.start();
      })
      .catch(() => {});
  } else {
    try {
      const a = new Audio('js/beeb.mp3');
      a.volume = 0.5;
      a.play().catch(() => {});
    } catch (e) { /* ignore */ }
  }
}

// Real-time notification count
function setupNotifRealtime() {
  if (!currentUser) return;
  const channel = supabaseClient.channel('notif-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${currentUser.id}`
    }, () => {
      loadNotifCount();
      playNotifSound();
    })
    .subscribe();
  return channel;
}
