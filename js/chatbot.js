const faqData = [
  {
    q: 'How do I post a writeup?',
    a: 'Go to <b>Writeups</b> in the navbar, click <b>Submit Writeup</b>. You need to be logged in first.'
  },
  {
    q: 'How do I join the community?',
    a: 'Click <b>Register</b> in the navbar and create an account with your email. It takes 30 seconds.'
  },
  {
    q: 'How can I contact you?',
    a: 'Visit our <b>Contact</b> page or email us directly at <a href="mailto:murrtada-_-ahmmed@outlook.com" style="color:var(--accent);">murrtada-_-ahmmed@outlook.com</a>.'
  },
  {
    q: 'What kind of content can I share?',
    a: 'You can share <b>Posts</b> (tutorials/articles), <b>Writeups</b> (bug bounty, CTF solutions, security research), and <b>YouTube videos</b>.'
  },
  {
    q: 'Is this site free?',
    a: 'Yes! The Cyber Security Community is completely free for everyone.'
  },
  {
    q: 'How do I edit or delete my content?',
    a: 'Only you can edit/delete your own posts and writeups. Look for the <b>Edit</b> and <b>Delete</b> buttons on your content.'
  },
];

let chatbotOpen = false;

function toggleChatbot() {
  chatbotOpen = !chatbotOpen;
  const el = document.getElementById('chatbot-window');
  if (chatbotOpen) {
    el.classList.add('open');
    if (!el.querySelector('.chat-messages').children.length) {
      addBotMessage('Hi! How can I help you today? Select a question below:');
      renderFaqButtons();
    }
  } else {
    el.classList.remove('open');
  }
}

function addBotMessage(text) {
  const msgs = document.querySelector('.chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg bot';
  div.innerHTML = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function addUserMessage(text) {
  const msgs = document.querySelector('.chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg user';
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function renderFaqButtons() {
  const faqEl = document.getElementById('chat-faq');
  faqEl.innerHTML = faqData.map((item, i) =>
    `<button class="chat-faq-btn" onclick="askFaq(${i})">${item.q}</button>`
  ).join('');
}

function askFaq(index) {
  const item = faqData[index];
  addUserMessage(item.q);
  setTimeout(() => addBotMessage(item.a), 300);
}
