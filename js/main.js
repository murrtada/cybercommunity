const _readyCallbacks = [];

function onReady(callback) {
  _readyCallbacks.push(callback);
}

function showToast(title, message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-title">${escapeHtml(title)}</div>
    <div class="toast-msg">${escapeHtml(message)}</div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => toast.classList.remove('show'), 4000);
}

document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();

  // Run ready callbacks after auth is settled
  await waitForAuth();

  for (const cb of _readyCallbacks) {
    try { await cb(); } catch (e) { console.error(e); }
  }

  if (typeof renderSavedVideos === 'function') {
    await renderSavedVideos();
    const input = document.getElementById('youtube-url');
    if (input) {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') loadYoutubeVideo();
      });
    }
  }

  if (typeof loadProfilePage === 'function') await loadProfilePage();
  if (typeof loadPostsPage === 'function') await loadPostsPage();
  if (typeof loadPostPage === 'function') await loadPostPage();
  if (typeof loadWriteupsPage === 'function') await loadWriteupsPage();
  if (typeof loadWriteupPage === 'function') await loadWriteupPage();
  if (typeof loadHomePage === 'function') await loadHomePage();
  if (typeof loadFeaturedVideo === 'function') await loadFeaturedVideo();
  if (typeof renderAdminDashboard === 'function') await renderAdminDashboard();
});

// Clean up realtime on page unload
window.addEventListener('beforeunload', () => {
  if (typeof destroyCommentRealtime === 'function') {
    destroyCommentRealtime();
  }
});
