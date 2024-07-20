let socket = io();
let token = '';
let unreadMessages = 0;

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        token = localStorage.getItem('token');
        showChat();
        socket.emit('login', { token });
    } else {
        showLogin();
    }
    
    const messageInput = document.getElementById('message-input');
    let typing = false;
    let timeout = undefined;

    messageInput.addEventListener('input', function(event) {
        if (!typing) {
            typing = true;
            socket.emit('typing', { token });
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            typing = false;
        }, 2000);
    });

    messageInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendMessage();
        }
    });
});

window.addEventListener('focus', () => {
    unreadMessages = 0;
    updateTitle();
});

window.addEventListener('blur', () => {
    // Window lost focus, do nothing for now.
});

function updateTitle() {
    const unreadMessages = getUnreadMessagesCount(); // Assuming this function exists to get the unread messages count

    if (unreadMessages > 0) {
        document.title = `(${unreadMessages}) Hotel Lobby`;
    } else {
        document.title = 'Hotel Lobby';
    }
}

const getUnreadMessagesCount = () => {
    // Implement logic to get the count of unread messages
    return unreadMessagesCount;
};

function showLogin() {
    document.getElementById('login-container').classList.add('active');
    document.getElementById('register-container').classList.remove('active');
    document.getElementById('chat-container').classList.remove('active');
}

function showRegister() {
    document.getElementById('login-container').classList.remove('active');
    document.getElementById('register-container').classList.add('active');
    document.getElementById('chat-container').classList.remove('active');
}

function showChat() {
    document.getElementById('login-container').classList.remove('active');
    document.getElementById('register-container').classList.remove('active');
    document.getElementById('chat-container').classList.add('active');
}

function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.token) {
            token = data.token;
            localStorage.setItem('token', token);
            showChat();
            socket.emit('login', { token });
        } else {
            alert(data.message);
        }
    });
}

function register() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message === 'User registered successfully') {
            alert(data.message);
            showLogin();
        } else {
            alert(data.message);
        }
    });
}

function logout() {
    token = '';
    localStorage.removeItem('token');
    showLogin();
}

function triggerFileInput() {
    document.getElementById('file-input').click();
}

function sendFiles(files) {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
    }
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        socket.emit('files', { token, fileUrls: data.fileUrls });
        document.getElementById('file-input').value = '';
    });
}

document.getElementById('file-input').addEventListener('change', function() {
    if (this.files) {
        sendFiles(this.files);
    }
});

function sendMessage() {
    const text = document.getElementById('message-input').value;
    if (text.trim() !== '') {
        socket.emit('message', { token, text });
        document.getElementById('message-input').value = '';
    }
}

document.getElementById('message-input').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        const text = event.target.value;
        if (text.trim() !== '') {
            if (text === '/help' || text === '/whoami') {
                socket.emit('message', { token, text });
            } else if (text === '/tableflip') {
                socket.emit('message', { token, text: '(╯°□°）╯︵ ┻━┻' });
            }
            else if (text === '/lenny') {
                socket.emit('message', { token, text: '( ͡° ͜ʖ ͡°)' });
            }
                else if (text === '/darkmode') {
                    socket.emit('message', { token, text: 'please use darkmode for the best experience' });
             } else {
                sendMessage();
            }
            document.getElementById('message-input').value = '';
        }
    }
});

function isImage(fileUrl) {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const extension = fileUrl.split('.').pop().toLowerCase();
    return imageExtensions.includes(`.${extension}`);
}

// Function to convert URLs in text to hyperlinks
function linkify(text) {
    const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return text.replace(urlPattern, '<a href="$1" target="_blank">$1</a>');
}

socket.on('message', (message) => {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message other';
    messageElement.innerHTML = `
        <span class="username">${message.username}</span>: 
        <span class="text">${linkify(message.text)}</span>
        <span class="time">${new Date(message.time).toLocaleTimeString()}</span>
    `;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (!document.hasFocus()) {
        unreadMessages++;
        updateTitle();
    }
});

socket.on('file', (message) => {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message other';

    if (isImage(message.fileUrl)) {
        messageElement.innerHTML = `
            <span class="username">${message.username}</span>: 
            <span class="time">${new Date(message.time).toLocaleTimeString()}</span>
            <button class="spoiler-btn" onclick="toggleSpoiler(this)">Spoiler</button>
            <div class="spoiler-content" style="display: none;">
                <img src="${message.fileUrl}" alt="Image" class="message-image">
                <button onclick="downloadFile('${message.fileUrl}')" class="spoiler-btn">Download</button>
            </div>
        `;
    } else {
        messageElement.innerHTML = `
            <span class="username">${message.username}</span>: 
            <a href="${message.fileUrl}" target="_blank">File</a> 
            <button onclick="downloadFile('${message.fileUrl}')" class="spoiler-btn">Download</button>
            <span class="time">${new Date(message.time).toLocaleTimeString()}</span>
        `;
    }
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (!document.hasFocus()) {
        unreadMessages++;
        updateTitle();
    }
});

function toggleSpoiler(button) {
    const spoilerContent = button.nextElementSibling;
    if (spoilerContent.style.display === 'none' || spoilerContent.style.display === '') {
        spoilerContent.style.display = 'block';
    } else {
        spoilerContent.style.display = 'none';
    }
}

function downloadFile(fileUrl) {
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

socket.on('onlineUsers', (data) => {
    document.getElementById('user-count').textContent = `Online Users: ${data.count}`;
    const userList = document.getElementById('user-list');
    userList.innerHTML = '';
    data.users.forEach(user => {
        const userElement = document.createElement('li');
        userElement.textContent = user;
        userList.appendChild(userElement);
    });
});

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

// Handle the 'kicked' event
socket.on('kicked', () => {
    alert('You have been kicked from the server');
    token = '';
    localStorage.removeItem('token');
    window.location.href = '/'; // Redirect to the root page or login page
});

// Handle the 'typing' event
socket.on('typing', (data) => {
    const typingIndicator = document.getElementById('typing-indicator');
    if (!typingIndicator) {
        const messagesContainer = document.getElementById('messages');
        const typingElement = document.createElement('div');
        typingElement.id = 'typing-indicator';
        typingElement.className = 'message typing';
        typingElement.innerHTML = `<span class="text">Someone is typing...</span>`;
        messagesContainer.appendChild(typingElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        setTimeout(() => {
            if (messagesContainer.contains(typingElement)) {
                messagesContainer.removeChild(typingElement);
            }
        }, 2000); // Remove the typing indicator after 2 seconds
    }
});

// Handle the 'lockStatus' event
socket.on('lockStatus', (data) => {
    if (data.locked) {
        alert('Chat room locked');
        logout();
    }
});

// Obfuscate Canvas Fingerprinting
HTMLCanvasElement.prototype.toDataURL = (function (orig) {
    return function (type, ...args) {
        if (type === 'image/png') {
            return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...';
        }
        return orig.apply(this, arguments);
    };
})();

// Show Changelog modal
function showChangelog() {
    fetch('/changelog')
        .then(response => response.json())
        .then(data => {
            const changelogContent = document.getElementById('changelog-content');
            changelogContent.innerHTML = data.map(item => `
                <div class="changelog-item">
                    <h3>${item.version} - ${item.date}</h3>
                    <p>${item.description}</p>
                </div>
            `).join('');
            document.getElementById('changelog-modal').style.display = 'block';
        });
}A

// Close Changelog modal
function closeChangelog() {
    document.getElementById('changelog-modal').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    let clickCount = 0;
    const maxClicks = 7;
    const redirectUrl = 'https://youtu.be/Om0rYw6qzb8?si=NEGuK8bi24lZvKrZ&t=9'; // Replace with your desired URL

    const txtElement = document.querySelector('.txt');
    if (txtElement) {
        txtElement.addEventListener('click', () => {
            clickCount++;
            if (clickCount >= maxClicks) {
                window.open(redirectUrl, '_blank');
                clickCount = 0; // Reset the count if you want multiple 5-click redirects
            }
        });
    }
});

let inputSequence = '';
const targetSequence = '3301';
const targetSequence1 = 'doggod';
const targetUrl = 'https://youtu.be/KbsKUM4n204?si=mSE_x-HQG_o_2gSr';
const targetUrl1 = 'https://rentry.org/oifv7i8p'; // Replace with your desired URL for "holdinon"

document.addEventListener('keydown', (event) => {
    if (event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        inputSequence += event.key.toLowerCase();

        const maxLength = Math.max(targetSequence.length, targetSequence1.length);

        if (inputSequence.length > maxLength) {
            inputSequence = inputSequence.slice(-targetSequence.length);
        }

        if (inputSequence === targetSequence) {
            window.open(targetUrl, '_blank');
            inputSequence = ''; // Reset the sequence if you want multiple triggers
        }
        else if(inputSequence === targetSequence1) {
            window.open(targetUrl1, '_blank');
            inputSequence = '';
        }
    }
});
