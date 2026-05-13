async function handleServiceInquiry(e) {
  e.preventDefault();
  const form = e.target;

  const formData = new FormData();
  formData.append('access_key', 'd40dab78-ae50-4bfe-af7b-4a4dd7a8f78d');
  formData.append('name', form.name.value);
  formData.append('email', form.email.value);
  formData.append('message', form.message.value);
  formData.append('subject', `New message from ${form.name.value}`);

  try {
    const response = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: formData });
    const result = await response.json();

    if (result.success) {
      showToast('Message sent!', 'We will get back to you within 24 hours.');
      form.reset();
    } else {
      showToast('Error', result.message || 'Something went wrong', 'error');
    }
  } catch {
    showToast('Error', 'Network error. Please try again.', 'error');
  }
}
