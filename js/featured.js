async function loadFeaturedVideo() {
  const container = document.getElementById('featured-video');
  if (!container) return;

  const { data } = await supabaseClient
    .from('site_config')
    .select('value')
    .eq('key', 'featured_video_id')
    .single();

  const videoId = data?.value;
  if (!videoId) {
    container.innerHTML = '<div class="empty-state"><h3>No featured video</h3></div>';
    return;
  }

  container.innerHTML = `
    <div class="featured-video-embed">
      <div class="video-embed">
        <iframe src="https://www.youtube.com/embed/${escapeHtml(videoId)}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen loading="lazy">
        </iframe>
      </div>
    </div>
  `;
}
