async function renderAdminDashboard() {
  const container = document.getElementById('admin-dashboard');
  if (!container) return;

  if (!currentUser || !currentProfile?.is_admin) {
    container.innerHTML = '<div class="empty-state"><h3>Access denied</h3><p>Admin privileges required.</p></div>';
    return;
  }

  // Stats
  const { count: userCount } = await supabaseClient.from('profiles').select('*', { count: 'exact', head: true });
  const { count: postCount } = await supabaseClient.from('posts').select('*', { count: 'exact', head: true });
  const { count: writeupCount } = await supabaseClient.from('writeups').select('*', { count: 'exact', head: true });
  const { count: commentCount } = await supabaseClient.from('comments').select('*', { count: 'exact', head: true });
  const { count: videoCount } = await supabaseClient.from('videos').select('*', { count: 'exact', head: true });

  container.innerHTML = `
    <div class="admin-stats-grid">
      <div class="admin-stat-card"><strong>${userCount || 0}</strong><span>Users</span></div>
      <div class="admin-stat-card"><strong>${postCount || 0}</strong><span>Posts</span></div>
      <div class="admin-stat-card"><strong>${writeupCount || 0}</strong><span>Writeups</span></div>
      <div class="admin-stat-card"><strong>${commentCount || 0}</strong><span>Comments</span></div>
      <div class="admin-stat-card"><strong>${videoCount || 0}</strong><span>Videos</span></div>
    </div>
  `;
}

// --- Users ---

async function loadAdminUsers() {
  const container = document.getElementById('admin-users-list');
  if (!container) return;

  const { data: users } = await supabaseClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!users || users.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No users found.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Joined</th>
            <th>Posts</th>
            <th>Writeups</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${escapeHtml(u.username || 'N/A')}</td>
              <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</td>
              <td>0</td>
              <td>0</td>
              <td>${u.is_admin ? '<span style="color:var(--danger);">Admin</span>' : 'User'}</td>
              <td>
                <button class="btn btn-sm btn-outline" onclick="adminDeleteUserContent('${u.id}', '${escapeHtml(u.username || 'this user')}')">
                  Delete Content
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function adminDeleteUserContent(userId, username) {
  const confirmed = await showModal('Delete Content',
    `Delete ALL posts, writeups, comments, and videos by ${escapeHtml(username)}? This cannot be undone.`,
    'Delete Everything');
  if (!confirmed) return;

  await supabaseClient.from('posts').delete().eq('author_id', userId);
  await supabaseClient.from('writeups').delete().eq('author_id', userId);
  await supabaseClient.from('comments').delete().eq('user_id', userId);
  await supabaseClient.from('videos').delete().eq('user_id', userId);
  await supabaseClient.from('likes').delete().eq('user_id', userId);

  showToast('Deleted', `All content by ${escapeHtml(username)} removed`);
  loadAdminUsers();
  renderAdminDashboard();
}

// --- Content management ---

async function loadAdminPosts() {
  const container = document.getElementById('admin-posts-list');
  if (!container) return;

  const { data: posts } = await supabaseClient
    .from('posts')
    .select('*, author:author_id(username)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!posts || posts.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No posts yet.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Title</th><th>Author</th><th>Published</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          ${posts.map(p => `
            <tr>
              <td>${escapeHtml(p.title || 'Untitled')}</td>
              <td>${escapeHtml(p.author?.username || 'Unknown')}</td>
              <td>${p.published ? '✓' : '✗'}</td>
              <td>${new Date(p.created_at).toLocaleDateString()}</td>
              <td><button class="btn btn-sm btn-danger" onclick="adminDeletePost('${p.id}', '${escapeHtml(p.title || 'this post')}')">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function adminDeletePost(id, title) {
  const confirmed = await showModal('Delete Post', `Delete "${escapeHtml(title)}"?`, 'Delete');
  if (!confirmed) return;
  await supabaseClient.from('posts').delete().eq('id', id);
  showToast('Deleted', 'Post removed');
  loadAdminPosts();
  renderAdminDashboard();
}

async function loadAdminWriteups() {
  const container = document.getElementById('admin-writeups-list');
  if (!container) return;

  const { data: writeups } = await supabaseClient
    .from('writeups')
    .select('*, author:author_id(username)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!writeups || writeups.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No writeups yet.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Title</th><th>Author</th><th>Published</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          ${writeups.map(w => `
            <tr>
              <td>${escapeHtml(w.title || 'Untitled')}</td>
              <td>${escapeHtml(w.author?.username || 'Unknown')}</td>
              <td>${w.published ? '✓' : '✗'}</td>
              <td>${new Date(w.created_at).toLocaleDateString()}</td>
              <td><button class="btn btn-sm btn-danger" onclick="adminDeleteWriteup('${w.id}', '${escapeHtml(w.title || 'this writeup')}')">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function adminDeleteWriteup(id, title) {
  const confirmed = await showModal('Delete Writeup', `Delete "${escapeHtml(title)}"?`, 'Delete');
  if (!confirmed) return;
  await supabaseClient.from('writeups').delete().eq('id', id);
  showToast('Deleted', 'Writeup removed');
  loadAdminWriteups();
  renderAdminDashboard();
}

async function loadAdminComments() {
  const container = document.getElementById('admin-comments-list');
  if (!container) return;

  const { data: comments } = await supabaseClient
    .from('comments')
    .select('*, author:user_id(username)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!comments || comments.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No comments yet.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>Comment</th><th>Author</th><th>On</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>
          ${comments.map(c => `
            <tr>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.body || '').substring(0, 80)}</td>
              <td>${escapeHtml(c.author?.username || 'Unknown')}</td>
              <td>${c.content_type || '?'}</td>
              <td>${new Date(c.created_at).toLocaleDateString()}</td>
              <td><button class="btn btn-sm btn-danger" onclick="adminDeleteComment('${c.id}')">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function adminDeleteComment(id) {
  const confirmed = await showModal('Delete Comment', 'Delete this comment?', 'Delete');
  if (!confirmed) return;
  await supabaseClient.from('comments').delete().eq('id', id);
  showToast('Deleted', 'Comment removed');
  loadAdminComments();
  renderAdminDashboard();
}

// --- Featured Video ---

async function loadAdminFeaturedVideo() {
  const container = document.getElementById('admin-featured-video');
  if (!container) return;

  const { data } = await supabaseClient
    .from('site_config')
    .select('value')
    .eq('key', 'featured_video_id')
    .single();

  const currentId = data?.value || '';
  const embedHtml = currentId ? `
    <div class="video-embed" style="max-width:480px;margin-top:0.75rem;">
      <iframe src="https://www.youtube.com/embed/${escapeHtml(currentId)}" allowfullscreen loading="lazy"></iframe>
    </div>
  ` : '';

  container.innerHTML = `
    <h3>Current Featured Video</h3>
    ${embedHtml || '<p style="color:var(--text-secondary);">No video set.</p>'}
    <form onsubmit="adminSetFeaturedVideo(event)" style="margin-top:1rem;display:flex;gap:0.75rem;flex-wrap:wrap;">
      <input type="text" id="featured-url-input" placeholder="YouTube URL or ID" value="${currentId ? `https://youtube.com/watch?v=${escapeHtml(currentId)}` : ''}"
        style="flex:1;min-width:200px;padding:0.6rem 1rem;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;color:var(--text-primary);">
      <button type="submit" class="btn btn-primary">Save</button>
    </form>
  `;
}

async function adminSetFeaturedVideo(event) {
  event.preventDefault();
  const input = document.getElementById('featured-url-input');
  if (!input) return;

  let videoId = input.value.trim();
  if (!videoId) return;

  // Extract ID from URL if needed
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = videoId.match(p);
    if (m) { videoId = m[1]; break; }
  }

  if (videoId.length !== 11) {
    showToast('Error', 'Invalid YouTube URL or ID', 'error');
    return;
  }

  // Upsert into site_config
  const { error } = await supabaseClient
    .from('site_config')
    .upsert({ key: 'featured_video_id', value: videoId });

  if (error) {
    showToast('Error', error.message, 'error');
    return;
  }

  showToast('Saved!', 'Featured video updated');
  loadAdminFeaturedVideo();
}
