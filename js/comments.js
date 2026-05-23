const COMMENT_PAGE_SIZE = 20;
let commentRealtimeSub = null;
let commentPollTimer = null;
let pollContentType = null;
let pollContentId = null;

function commentMarkdown(text) {
  return escapeHtml(text)
    .replace(/#(\w+)/g, '<span class="hashtag">#$1</span>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/https?:\/\/[^\s<]+/g, '<a href="$&" target="_blank" rel="noopener">$&</a>')
    .replace(/\n/g, '<br>');
}

function formatCommentTime(dateStr) {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

async function addComment(contentType, contentId, body, parentId = null) {
  const userId = getCurrentUserId();
  if (!userId) { showToast('Login required', 'Sign in to comment', 'error'); return null; }
  if (!body.trim()) { showToast('Error', 'Comment cannot be empty', 'error'); return null; }
  if (body.trim().length > 1000) { showToast('Error', 'Comment is too long (max 1000 characters)', 'error'); return null; }

  const commentData = {
    user_id: userId,
    content_type: contentType,
    content_id: contentId,
    body: body.trim()
  };
  if (parentId) commentData.parent_id = parentId;

  const { data, error } = await supabaseClient
    .from('comments')
    .insert(commentData)
    .select('*, profiles!user_id(username, full_name, avatar_url)')
    .single();

  if (error) {
    if (error.message && error.message.includes('foreign key')) {
      showToast('Error', 'The comment you are replying to was deleted. Please refresh.', 'error');
    } else {
      showToast('Error', error.message, 'error');
    }
    return null;
  }
  return data;
}

async function updateComment(id, body) {
  const userId = getCurrentUserId();
  if (!userId) return null;
  if (!body.trim()) { showToast('Error', 'Comment cannot be empty', 'error'); return null; }
  if (body.trim().length > 1000) { showToast('Error', 'Comment is too long (max 1000)', 'error'); return null; }

  const { data, error } = await supabaseClient
    .from('comments')
    .update({ body: body.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) { showToast('Error', error.message, 'error'); return null; }
  return data;
}

async function deleteComment(id) {
  const { error } = await supabaseClient
    .from('comments')
    .delete()
    .eq('id', id)
    .eq('user_id', getCurrentUserId());

  if (error) { showToast('Error', error.message, 'error'); return false; }
  return true;
}

async function fetchComments(contentType, contentId, page = 0) {
  const from = page * COMMENT_PAGE_SIZE;
  const to = from + COMMENT_PAGE_SIZE - 1;

  const { data, error } = await supabaseClient
    .from('comments')
    .select('*, profiles!user_id(username, full_name, avatar_url)')
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) { console.error('fetchComments error:', error); return []; }
  return data || [];
}

async function fetchReplies(parentId) {
  const { data } = await supabaseClient
    .from('comments')
    .select('*, profiles!user_id(username, full_name, avatar_url)')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true });
  return data || [];
}

async function fetchCommentCount(contentType, contentId) {
  const { count } = await supabaseClient
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('content_type', contentType)
    .eq('content_id', contentId);
  return count || 0;
}

function renderCommentBubble(comment, isReply = false) {
  const author = comment.profiles || {};
  const initial = (author.full_name || author.username || '?')[0].toUpperCase();
  const isOwner = getCurrentUserId() === comment.user_id;
  const isEdited = comment.updated_at && new Date(comment.updated_at).getTime() > new Date(comment.created_at).getTime() + 1000;

  return `
    <div class="comment ${isReply ? 'reply' : ''}" data-comment-id="${comment.id}">
      <div class="comment-avatar">${initial}</div>
      <div class="comment-content">
        <div class="comment-bubble">
          <a href="profile.html?user=${comment.user_id}" class="comment-author">${escapeHtml(author.username || 'Unknown')}</a>
          <div class="comment-text">${commentMarkdown(comment.body)}</div>
        </div>
        <div class="comment-footer">
          <span class="comment-time">${formatCommentTime(comment.created_at)}${isEdited ? ' (edited)' : ''}</span>
          <button class="comment-action" onclick="replyToComment('${comment.id}', '${escapeHtml(author.username || 'Unknown')}')">Reply</button>
          ${isOwner ? `
            <button class="comment-action" onclick="editComment('${comment.id}')">Edit</button>
            <button class="comment-action danger" onclick="confirmDeleteComment('${comment.id}')">Delete</button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderCommentWithReplies(comment, replies) {
  let html = renderCommentBubble(comment);
  if (replies && replies.length > 0) {
    html += `<div class="replies-container" id="replies-${comment.id}">`;
    html += replies.map(r => renderCommentBubble(r, true)).join('');
    html += `</div>`;
  }
  return html;
}

async function loadComments(contentType, contentId, page = 0, append = false) {
  const container = document.getElementById('comments-container');
  if (!container) return;

  const list = container.querySelector('.comment-thread');
  if (!list) return;

  if (!append) {
    list.innerHTML = '<div class="loading" style="padding:1rem 0;">Loading comments...</div>';
  }

  const comments = await fetchComments(contentType, contentId, page);

  if (!append) list.innerHTML = '';

  if (comments.length === 0 && page === 0) {
    list.innerHTML = `
      <div class="comments-empty">
        <span class="empty-icon">💬</span>
        No comments yet. Be the first to share your thoughts!
      </div>`;
    updateCommentCount(contentType, contentId);
    return;
  }

  for (const comment of comments) {
    const replies = await fetchReplies(comment.id);
    list.insertAdjacentHTML('beforeend', renderCommentWithReplies(comment, replies));
  }

  const total = await fetchCommentCount(contentType, contentId);
  const loaded = (page + 1) * COMMENT_PAGE_SIZE;
  const existingLoadMore = container.querySelector('.load-more-comments');
  if (existingLoadMore) existingLoadMore.remove();

  if (loaded < total) {
    const loadMore = document.createElement('button');
    loadMore.className = 'load-more-comments';
    loadMore.textContent = `Load more comments (${total - loaded} remaining)`;
    loadMore.onclick = () => loadComments(contentType, contentId, page + 1, true);
    container.appendChild(loadMore);
  }

  updateCommentCount(contentType, contentId);
}

function updateCommentCount(contentType, contentId) {
  const stat = document.querySelector('.stat-item.comments-stat .stat-count');
  if (!stat) return;
  fetchCommentCount(contentType, contentId).then(count => {
    stat.textContent = count;
  });
}

async function handleCommentSubmit(contentType, contentId) {
  const input = document.getElementById('comment-text-input');
  if (!input) return;
  const body = input.value;
  if (!body.trim()) return;

  input.disabled = true;
  try {
    const comment = await addComment(contentType, contentId, body);
    if (comment) {
      input.value = '';
      updateCharCounter();
      const list = document.querySelector('.comment-thread');
      if (list) {
        const empty = list.querySelector('.comments-empty');
        if (empty) list.innerHTML = '';
        const replies = await fetchReplies(comment.id);
        list.insertAdjacentHTML('afterbegin', renderCommentWithReplies(comment, replies));
      }
      updateCommentCount(contentType, contentId);
    }
  } catch (e) {
    console.error(e);
    showToast('Error', 'Failed to post comment', 'error');
  } finally {
    input.disabled = false;
  }
}

async function handleReplySubmit(contentType, contentId, parentId) {
  const input = document.getElementById('reply-input-' + parentId);
  if (!input) return;
  const body = input.value;
  if (!body.trim()) return;

  input.disabled = true;
  try {
    const comment = await addComment(contentType, contentId, body, parentId);
    if (comment) {
      input.value = '';
      const replyContainer = document.getElementById('replies-' + parentId);
      if (replyContainer) {
        replyContainer.insertAdjacentHTML('beforeend', renderCommentBubble(comment, true));
      }
      const replyForm = document.getElementById('reply-form-' + parentId);
      if (replyForm) replyForm.remove();
      updateCommentCount(contentType, contentId);
    }
  } catch (e) {
    console.error(e);
    showToast('Error', 'Failed to post reply', 'error');
  } finally {
    input.disabled = false;
  }
}

function replyToComment(commentId, username) {
  const existing = document.getElementById('reply-form-' + commentId);
  if (existing) { existing.remove(); return; }

  const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
  if (!commentEl) return;

  const form = document.createElement('div');
  form.className = 'comment-input-area';
  form.id = 'reply-form-' + commentId;
  form.style.marginLeft = '2.5rem';
  form.style.marginTop = '0.25rem';
  form.style.marginBottom = '0.5rem';
  form.innerHTML = `
    <div class="comment-input-avatar">${(currentProfile?.username || '?')[0].toUpperCase()}</div>
    <div class="comment-input-wrapper">
      <textarea class="comment-input" id="reply-input-${commentId}" placeholder="Reply to ${escapeHtml(username)}..." rows="1" maxlength="1000"></textarea>
      <div class="comment-submit-row">
        <button class="comment-submit-btn" onclick="handleReplySubmit('${commentEl.closest('[data-content-type]')?.dataset.contentType || 'post'}', '${commentEl.closest('[data-content-id]')?.dataset.contentId || ''}', '${commentId}')">Reply</button>
      </div>
    </div>
  `;

  commentEl.after(form);
  const textarea = form.querySelector('textarea');
  if (textarea) {
    textarea.focus();
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
  }
}

function editComment(commentId) {
  const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
  if (!commentEl) return;

  const bubble = commentEl.querySelector('.comment-bubble');
  const textEl = bubble?.querySelector('.comment-text');
  if (!bubble || !textEl) return;

  const currentText = commentEl.dataset.editingText || textEl.textContent;
  if (commentEl.dataset.editing) return;
  commentEl.dataset.editing = 'true';

  bubble.innerHTML = `
    <textarea class="edit-comment-textarea" id="edit-text-${commentId}" rows="2" maxlength="1000">${escapeHtml(currentText)}</textarea>
    <div class="edit-comment-actions">
      <button class="edit-comment-save" onclick="saveEditComment('${commentId}')">Save</button>
      <button class="edit-comment-cancel" onclick="cancelEditComment('${commentId}')">Cancel</button>
    </div>
  `;
}

async function saveEditComment(commentId) {
  const textarea = document.getElementById('edit-text-' + commentId);
  if (!textarea) return;
  const body = textarea.value;
  if (!body.trim()) return;

  const result = await updateComment(commentId, body);
  if (result) {
    const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
    if (commentEl) {
      delete commentEl.dataset.editing;
      const bubble = commentEl.querySelector('.comment-bubble');
      if (bubble) {
        bubble.innerHTML = `
          <a href="profile.html?user=${result.user_id}" class="comment-author">${escapeHtml(result.profiles?.username || 'Unknown')}</a>
          <div class="comment-text">${commentMarkdown(result.body)}</div>
        `;
      }
      const footer = commentEl.querySelector('.comment-footer');
      if (footer) {
        const timeSpan = footer.querySelector('.comment-time');
        if (timeSpan) timeSpan.textContent = formatCommentTime(result.created_at) + ' (edited)';
      }
    }
    showToast('Saved', 'Comment updated');
  }
}

function cancelEditComment(commentId) {
  const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
  if (!commentEl) return;
  delete commentEl.dataset.editing;
  delete commentEl.dataset.editingText;

  loadSingleComment(commentId);
}

async function loadSingleComment(commentId) {
  const { data } = await supabaseClient
    .from('comments')
    .select('*, profiles!user_id(username, full_name, avatar_url)')
    .eq('id', commentId)
    .single();

  if (!data) return;
  const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
  if (!commentEl) return;

  const bubble = commentEl.querySelector('.comment-bubble');
  if (bubble) {
    const author = data.profiles || {};
    bubble.innerHTML = `
      <a href="profile.html?user=${data.user_id}" class="comment-author">${escapeHtml(author.username || 'Unknown')}</a>
      <div class="comment-text">${commentMarkdown(data.body)}</div>
    `;
  }
}

async function confirmDeleteComment(commentId) {
  const confirmed = await showModal(
    'Delete comment?',
    'This will permanently delete this comment and any replies.',
    'Delete'
  );
  if (!confirmed) return;

  const ok = await deleteComment(commentId);
  if (ok) {
    const commentEl = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
    if (commentEl) {
      commentEl.remove();
    }
    showToast('Deleted', 'Comment removed');
    const section = document.getElementById('comment-section');
    if (section) {
      updateCommentCount(section.dataset.contentType, section.dataset.contentId);
    }
  }
}

function updateCharCounter() {
  const input = document.getElementById('comment-text-input');
  const counter = document.getElementById('char-counter');
  if (!input || !counter) return;
  const len = input.value.length;
  counter.textContent = `${len}/1000`;
  counter.className = 'char-counter' + (len > 900 ? ' limit-near' : '') + (len >= 1000 ? ' limit-reached' : '');
}

function setupCommentInput() {
  const input = document.getElementById('comment-text-input');
  if (!input) return;
  input.addEventListener('input', () => {
    updateCharCounter();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
  });
  const counter = document.getElementById('char-counter');
  if (counter) updateCharCounter();
}

async function pollComments() {
  if (!pollContentType || !pollContentId) return;
  const list = document.querySelector('.comment-thread');
  if (!list) return;

  const { data } = await supabaseClient
    .from('comments')
    .select('*, profiles!user_id(username, full_name, avatar_url)')
    .eq('content_type', pollContentType)
    .eq('content_id', pollContentId)
    .is('parent_id', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!data) return;

  for (const comment of data) {
    if (comment.user_id === getCurrentUserId()) continue;
    const existing = list.querySelector(`[data-comment-id="${comment.id}"]`);
    if (existing) continue;
    const empty = list.querySelector('.comments-empty');
    if (empty) list.innerHTML = '';
    list.insertAdjacentHTML('afterbegin', renderCommentWithReplies(comment, []));
  }
  updateCommentCount(pollContentType, pollContentId);
}

function startCommentPolling() {
  stopCommentPolling();
  commentPollTimer = setInterval(pollComments, 15000);
}

function stopCommentPolling() {
  if (commentPollTimer) {
    clearInterval(commentPollTimer);
    commentPollTimer = null;
  }
}

function setupCommentRealtime(contentType, contentId) {
  if (commentRealtimeSub) {
    supabaseClient.removeChannel(commentRealtimeSub);
  }

  pollContentType = contentType;
  pollContentId = contentId;
  startCommentPolling();

  commentRealtimeSub = supabaseClient.channel('comments-realtime')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'comments',
      filter: `content_type=eq.${contentType} AND content_id=eq.${contentId}`
    }, async (payload) => {
      const newComment = payload.new;
      if (newComment.parent_id) return;
      if (newComment.user_id === getCurrentUserId()) return;

      const list = document.querySelector('.comment-thread');
      if (!list) return;

      const existing = list.querySelector(`[data-comment-id="${newComment.id}"]`);
      if (existing) return;

      const { data } = await supabaseClient
        .from('comments')
        .select('*, profiles!user_id(username, full_name, avatar_url)')
        .eq('id', newComment.id)
        .single();

      if (data) {
        const empty = list.querySelector('.comments-empty');
        if (empty) list.innerHTML = '';
        list.insertAdjacentHTML('afterbegin', renderCommentWithReplies(data, []));
        updateCommentCount(contentType, contentId);
      }
    })
    .subscribe();
}

function destroyCommentRealtime() {
  stopCommentPolling();
  if (commentRealtimeSub) {
    supabaseClient.removeChannel(commentRealtimeSub);
    commentRealtimeSub = null;
  }
}
