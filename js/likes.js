async function toggleLike(contentType, contentId) {
  const userId = getCurrentUserId();
  if (!userId) {
    showToast('Login required', 'Sign in to like content', 'error');
    return null;
  }

  const { data: existing } = await supabaseClient
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .maybeSingle();

  if (existing) {
    await supabaseClient.from('likes').delete().eq('id', existing.id);
    return 'unliked';
  } else {
    await supabaseClient.from('likes').insert({
      user_id: userId, content_type: contentType, content_id: contentId
    });
    return 'liked';
  }
}

async function getLikeCount(contentType, contentId) {
  const { count } = await supabaseClient
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('content_type', contentType)
    .eq('content_id', contentId);
  return count || 0;
}

async function hasUserLiked(contentType, contentId) {
  const userId = getCurrentUserId();
  if (!userId) return false;

  const { data } = await supabaseClient
    .from('likes')
    .select('id')
    .eq('user_id', userId)
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .maybeSingle();
  return !!data;
}

async function getLikersTooltip(contentType, contentId) {
  const userId = getCurrentUserId();
  const { data } = await supabaseClient
    .from('likes')
    .select('user_id, profiles!user_id(username)')
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .order('created_at', { ascending: false })
    .limit(3);

  if (!data || data.length === 0) return '';

  const names = data.map(l => l.profiles?.username || 'Unknown');
  const total = await getLikeCount(contentType, contentId);

  if (data.length === 1) {
    return `Liked by ${names[0]}`;
  } else if (data.length === 2) {
    return `Liked by ${names[0]} and ${names[1]}`;
  } else {
    const remaining = total - 3;
    if (remaining > 0) {
      return `Liked by ${names[0]}, ${names[1]} and ${remaining} others`;
    }
    return `Liked by ${names[0]}, ${names[1]} and ${names[2]}`;
  }
}

async function loadLikeState(contentType, contentId) {
  const btn = document.querySelector('.action-btn.like-btn');
  const countEl = document.querySelector('.stat-item.likes-stat .stat-count');
  const likersTip = document.querySelector('.likers-tooltip');

  const count = await getLikeCount(contentType, contentId);
  if (countEl) countEl.textContent = count;

  const liked = await hasUserLiked(contentType, contentId);
  if (btn) {
    btn.classList.toggle('liked', liked);
    const icon = btn.querySelector('.action-icon');
    if (icon) {
      icon.textContent = liked ? '❤' : '♡';
    }
  }

  if (likersTip) {
    const text = await getLikersTooltip(contentType, contentId);
    likersTip.textContent = text;
  }
}

async function handleLike(contentType, contentId) {
  const btn = document.querySelector('.action-btn.like-btn');
  const countEl = document.querySelector('.stat-item.likes-stat .stat-count');
  const icon = btn?.querySelector('.action-icon');
  const likersTip = document.querySelector('.likers-tooltip');

  const wasLiked = btn?.classList.contains('liked');

  // Optimistic update
  if (btn) {
    btn.classList.toggle('liked');
    if (icon) icon.textContent = wasLiked ? '♡' : '❤';
  }
  if (countEl) {
    const current = parseInt(countEl.textContent) || 0;
    countEl.textContent = wasLiked ? Math.max(0, current - 1) : current + 1;
  }

  const result = await toggleLike(contentType, contentId);

  if (result === null) {
    // Rollback on error
    if (btn) {
      btn.classList.toggle('liked');
      if (icon) icon.textContent = wasLiked ? '❤' : '♡';
    }
    if (countEl) {
      const current = parseInt(countEl.textContent) || 0;
      countEl.textContent = wasLiked ? current + 1 : Math.max(0, current - 1);
    }
    return;
  }

  const count = await getLikeCount(contentType, contentId);
  if (countEl) countEl.textContent = count;

  if (likersTip) {
    likersTip.textContent = await getLikersTooltip(contentType, contentId);
  }
}
