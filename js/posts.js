async function createPost(post) {
  const { data, error } = await supabaseClient
    .from('posts')
    .insert([{ ...post, author_id: getCurrentUserId() }])
    .select()
    .single();

  if (error) {
    showToast('Error', error.message, 'error');
    return null;
  }
  return data;
}

async function getPublishedPosts() {
  const { data } = await supabaseClient
    .from('posts')
    .select('*, profiles!author_id(username, full_name, avatar_url)')
    .eq('published', true)
    .order('created_at', { ascending: false });
  return data || [];
}

async function getPostBySlug(slug) {
  const { data } = await supabaseClient
    .from('posts')
    .select('*, profiles!author_id(username, full_name, avatar_url, linkedin_url, github_url, twitter_url)')
    .eq('slug', slug)
    .single();
  return data;
}

async function getMyPosts() {
  const { data } = await supabaseClient
    .from('posts')
    .select('*')
    .eq('author_id', getCurrentUserId())
    .order('created_at', { ascending: false });
  return data || [];
}

async function updatePost(id, updates) {
  const { data, error } = await supabaseClient
    .from('posts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('author_id', getCurrentUserId())
    .select()
    .single();

  if (error) {
    showToast('Error', error.message, 'error');
    return null;
  }
  return data;
}

async function deletePost(id) {
  const { error } = await supabaseClient
    .from('posts')
    .delete()
    .eq('id', id)
    .eq('author_id', getCurrentUserId());

  if (error) {
    showToast('Error', error.message, 'error');
    return false;
  }
  return true;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}

function renderPostCard(post, showActions = false) {
  const author = post.profiles || {};
  const tags = post.tags || [];
  const isOwner = showActions && getCurrentUserId() === post.author_id;

  return `
    <div class="post-card">
      ${post.cover_image ? `<img src="${post.cover_image}" alt="" class="post-cover" loading="lazy">` : ''}
      <div class="post-card-body">
        <div class="post-meta">
          <span class="post-author">
            <a href="profile.html?user=${author.id || post.author_id}" style="color:var(--text-secondary);text-decoration:none;">
              ${escapeHtml(author.username || 'Unknown')}
            </a>
          </span>
          <span class="post-date">${new Date(post.created_at).toLocaleDateString()}</span>
          ${post.published ? '' : '<span class="badge badge-ctf">Draft</span>'}
        </div>
        <h3><a href="post.html?slug=${post.slug}">${escapeHtml(post.title)}</a></h3>
        ${post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ''}
        ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${isOwner ? `
          <div class="card-actions">
            <a href="create-post.html?edit=${post.slug}" class="btn-sm btn-edit">Edit</a>
            <button onclick="confirmDeletePost('${post.id}')" class="btn-sm btn-delete">Delete</button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

async function confirmDeletePost(id) {
  const confirmed = await showModal(
    'Delete post?',
    'This will permanently delete this post and all associated likes and comments.',
    'Delete'
  );
  if (!confirmed) return;
  const ok = await deletePost(id);
  if (ok) {
    showToast('Deleted', 'Post removed');
    location.reload();
  }
}
