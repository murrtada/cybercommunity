async function createWriteup(writeup) {
  const { data, error } = await supabaseClient
    .from('writeups')
    .insert([{ ...writeup, author_id: getCurrentUserId() }])
    .select()
    .single();

  if (error) {
    showToast('Error', error.message, 'error');
    return null;
  }
  return data;
}

async function getPublishedWriteups() {
  const { data } = await supabaseClient
    .from('writeups')
    .select('*, profiles!author_id(username, full_name, avatar_url)')
    .eq('published', true)
    .order('created_at', { ascending: false });
  return data || [];
}

async function getWriteupBySlug(slug) {
  const { data } = await supabaseClient
    .from('writeups')
    .select('*, profiles!author_id(username, full_name, avatar_url, linkedin_url, github_url, twitter_url)')
    .eq('slug', slug)
    .single();
  return data;
}

async function getMyWriteups() {
  const { data } = await supabaseClient
    .from('writeups')
    .select('*')
    .eq('author_id', getCurrentUserId())
    .order('created_at', { ascending: false });
  return data || [];
}

async function updateWriteup(id, updates) {
  const { data, error } = await supabaseClient
    .from('writeups')
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

async function deleteWriteup(id) {
  const { error } = await supabaseClient
    .from('writeups')
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

function renderWriteupCard(writeup, showActions = false) {
  const author = writeup.profiles || {};
  const tags = writeup.tags || [];
  const isOwner = showActions && getCurrentUserId() === writeup.author_id;

  return `
    <div class="writeup-card">
      ${writeup.cover_image ? `<img src="${writeup.cover_image}" alt="" class="writeup-cover" loading="lazy">` : ''}
      <div class="writeup-card-body">
        <div class="writeup-meta">
          <span class="writeup-author">
            <a href="profile.html?user=${author.id || writeup.author_id}" style="color:var(--text-secondary);text-decoration:none;">
              ${escapeHtml(author.username || 'Unknown')}
            </a>
          </span>
          <span class="writeup-date">${new Date(writeup.created_at).toLocaleDateString()}</span>
          ${writeup.published ? '' : '<span class="badge badge-ctf">Draft</span>'}
        </div>
        <h3><a href="writeup.html?slug=${writeup.slug}">${escapeHtml(writeup.title)}</a></h3>
        ${writeup.excerpt ? `<p>${escapeHtml(writeup.excerpt)}</p>` : ''}
        <div class="writeup-badges">
          ${writeup.platform ? `<span class="badge badge-platform">${escapeHtml(writeup.platform)}</span>` : ''}
          ${writeup.category ? `<span class="badge badge-cat">${escapeHtml(writeup.category)}</span>` : ''}
        </div>
        ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        ${isOwner ? `
          <div class="card-actions">
            <a href="create-writeup.html?edit=${writeup.slug}" class="btn-sm btn-edit">Edit</a>
            <button onclick="confirmDeleteWriteup('${writeup.id}')" class="btn-sm btn-delete">Delete</button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

async function confirmDeleteWriteup(id) {
  const confirmed = await showModal(
    'Delete writeup?',
    'This will permanently delete this writeup and all associated likes and comments.',
    'Delete'
  );
  if (!confirmed) return;
  const ok = await deleteWriteup(id);
  if (ok) {
    showToast('Deleted', 'Writeup removed');
    location.reload();
  }
}
