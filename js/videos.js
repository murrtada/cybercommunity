function getYoutubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

async function loadYoutubeVideo() {
  const input = document.getElementById('youtube-url');
  const container = document.getElementById('player-container');
  const url = input.value.trim();

  if (!url) {
    showToast('Error', 'Please enter a YouTube URL', 'error');
    return;
  }

  const id = getYoutubeId(url);
  if (!id) {
    showToast('Error', 'Invalid YouTube URL. Use youtube.com/watch?v=... or youtu.be/...', 'error');
    return;
  }

  if (getCurrentUserId()) {
    const { error } = await supabaseClient
      .from('videos')
      .insert([{
        user_id: getCurrentUserId(),
        youtube_id: id,
        title: input.value,
        url: `https://www.youtube.com/watch?v=${id}`,
      }]);

    if (error) {
      showToast('Error', error.message, 'error');
      return;
    }
  }

  container.innerHTML = `
    <div class="video-embed">
      <iframe src="https://www.youtube.com/embed/${id}?autoplay=1"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
      </iframe>
    </div>
  `;
  input.value = '';
  showToast('Success', 'Video loaded successfully!');
  renderSavedVideos();
}

async function renderSavedVideos() {
  const grid = document.getElementById('saved-videos');
  const loading = document.getElementById('loading');
  if (!grid) return;

  if (loading) loading.style.display = 'none';

  const { data: saved } = await supabaseClient
    .from('videos')
    .select('*')
    .order('added_at', { ascending: false });

  const videos = saved || [];

  if (videos.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
        </svg>
        <h3>No videos yet</h3>
        <p>Paste a YouTube URL above to add your first video.</p>
      </div>
    `;
    return;
  }

  const userId = getCurrentUserId();

  grid.innerHTML = videos.map(v => {
    const isOwner = userId && v.user_id === userId;
    return `
    <div class="video-card">
      <div class="thumbnail" onclick="playVideo('${v.youtube_id}')">
        <img src="https://img.youtube.com/vi/${v.youtube_id}/hqdefault.jpg" alt="Video thumbnail"
          loading="lazy">
        <div class="play-overlay">
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
      </div>
      <div class="video-info">
        <h3>${v.title || 'YouTube Video'}</h3>
        <p>Added ${new Date(v.added_at).toLocaleDateString()}</p>
        ${isOwner ? `<button class="video-delete-btn" onclick="deleteVideo('${v.id}')" title="Delete video">&times;</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function deleteVideo(id) {
  const confirmed = await showModal('Delete video?', 'Remove this video from your collection?', 'Delete');
  if (!confirmed) return;
  const { error } = await supabaseClient
    .from('videos')
    .delete()
    .eq('id', id)
    .eq('user_id', getCurrentUserId());

  if (error) {
    showToast('Error', error.message, 'error');
    return;
  }

  showToast('Deleted', 'Video removed');
  renderSavedVideos();
}

function playVideo(id) {
  const container = document.getElementById('player-container');
  if (!container) return;

  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
  container.innerHTML = `
    <div class="video-embed">
      <iframe src="https://www.youtube.com/embed/${id}?autoplay=1"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
      </iframe>
    </div>
  `;
}
