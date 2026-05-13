async function getProfile(userId) {
  const { data } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

async function getProfileByUsername(username) {
  const { data } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();
  return data;
}

async function updateProfile(updates) {
  const userId = getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    showToast('Error', error.message, 'error');
    return null;
  }

  currentProfile = data;
  showToast('Saved!', 'Profile updated successfully');
  return data;
}

async function uploadAvatar(file) {
  const userId = getCurrentUserId();
  if (!userId) return null;

  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/avatar.${fileExt}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (uploadError) {
    if (uploadError.message.includes('row-level security')) {
      showToast('Storage Error', 'Run migration_v4.sql in Supabase SQL Editor to fix upload permissions', 'error');
    } else {
      showToast('Error', uploadError.message, 'error');
    }
    return null;
  }

  const { data: { publicUrl } } = supabaseClient.storage
    .from('avatars')
    .getPublicUrl(filePath);

  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
  await updateProfile({ avatar_url: cacheBustedUrl });
  return cacheBustedUrl;
}

function renderSocialLinks(profile) {
  const links = [
    { url: profile.linkedin_url, label: 'LinkedIn' },
    { url: profile.github_url, label: 'GitHub' },
    { url: profile.twitter_url, label: 'Twitter' },
    { url: profile.facebook_url, label: 'Facebook' },
    { url: profile.website_url, label: 'Website' },
  ];
  return links
    .filter(l => l.url)
    .map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="social-link">${l.label}</a>`)
    .join('');
}
