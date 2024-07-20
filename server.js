const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const ngrok = require('ngrok');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const USERS_FILE = 'users.json';
const LOGS_DIR = 'logs';
const sessionID = new Date().toISOString().replace(/:/g, '-');
const sessionLogDir = path.join(LOGS_DIR, sessionID);

let onlineUsers = new Set();
let activeUsers = {}; // To keep track of active users

let isLocked = false; // Variable to track if the chat room is locked

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR);
}

// Ensure session log directory exists
if (!fs.existsSync(sessionLogDir)) {
  fs.mkdirSync(sessionLogDir);
}

// Load users from the file
let users = [];
if (fs.existsSync(USERS_FILE)) {
  const usersData = fs.readFileSync(USERS_FILE);
  users = JSON.parse(usersData);
}

// Save users to the file
const saveUsersToFile = () => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Log to file function
const logToFile = (message) => {
  const logStream = fs.createWriteStream(path.join(sessionLogDir, 'server.log'), { flags: 'a' });
  logStream.write(`${new Date().toISOString()} - ${message}\n`);
  logStream.end();
};

// Configure Multer storage to retain original file names and extensions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const messages = [];
const SECRET_KEY = 'your_secret_key';

// Load previous chat logs
const loadPreviousLogs = () => {
  const logFiles = fs.readdirSync(LOGS_DIR);
  logFiles.forEach(file => {
    const filePath = path.join(LOGS_DIR, file, 'server.log');
    if (fs.existsSync(filePath)) {
      const logData = fs.readFileSync(filePath, 'utf8');
      const logLines = logData.split('\n');
      logLines.forEach(line => {
        if (line) {
          const [timestamp, message] = line.split(' - ');
          messages.push({ timestamp, message });
        }
      });
    }
  });
};

loadPreviousLogs();

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Middleware for parsing JSON requests
app.use(express.json());

// User authentication routes
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  
  if (users.find(user => user.username === username)) {
    const message = 'User already exists';
    console.log(message);
    logToFile(message);
    return res.status(400).json({ message });
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  users.push({ username, password: hashedPassword });
  saveUsersToFile();
  const message = 'User registered successfully';
  console.log(message);
  logToFile(message);
  res.status(201).json({ message });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(user => user.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    const message = 'Invalid credentials';
    console.log(message);
    logToFile(message);
    return res.status(400).json({ message });
  }
  const token = jwt.sign({ username }, SECRET_KEY);
  res.json({ token });
});

// File upload route
app.post('/upload', upload.array('files', 12), (req, res) => {
  const fileUrls = req.files.map(file => `/uploads/${file.filename}`);
  const message = `Files uploaded: ${fileUrls.join(', ')}`;
  console.log(message);
  logToFile(message);
  res.json({ fileUrls });
});

// Changelog route
app.get('/changelog', (req, res) => {
  fs.readFile(path.join(__dirname, 'changelog.json'), 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: 'Failed to load changelog' });
      return;
    }
    res.json(JSON.parse(data));
  });
});



// Route to check the access code
app.get('/check-code', (req, res) => {
  const accessCode = req.query.code;
  const correctCode = '9898'; // Set your desired four-digit code here

  if (accessCode === correctCode) {
    res.redirect('/eyyyeoriorioasdhksadjkas');
  } else {
    res.status(401).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Access Denied</title>
      </head>
      <body>
        <h1>Access Denied</h1>
        <p>Work in progress , log error codes here please</p>
        <form action="/check-code" method="get">
          <input type="text" name="code" placeholder="Enter error code" required>
          <button type="submit">Submit</button>
        </form>
      </body>
      </html>
    `);
  }
});

// Route to display images
app.get('/eyyyeoriorioasdhksadjkas', (req, res) => {
  fs.readdir('uploads/', (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to load images' });
    }
    const imageFiles = files.filter(file => /\.(jpg|jpeg|png|gif|bmp|webp)$/.test(file));
    const videoFiles = files.filter(file => /\.(mp4)$/.test(file));
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <link rel="stylesheet" href="/styleimg.css">
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Uploaded Images</title>
      </head>
      <body>
        <h1>Uploaded Images</h1>
        <button id="viewimg" onclick="window.location.href='/'">home</button>
        <div class="media-container">
          ${imageFiles.map(file => `<img src="/uploads/${file}" alt="${file}" onclick="openModal('image', '/uploads/${file}')">`).join('')}
          ${videoFiles.map(file => `<video src="/uploads/${file}" controls onclick="openModal('video', '/uploads/${file}')"></video>`).join('')}
        </div>

        <div id="myModal" class="modal">
          <span class="close" onclick="closeModal()">&times;</span>
          <img id="modalImage" class="modal-content">
          <video id="modalVideo" class="modal-content" controls></video>
          <div id="caption"></div>
          <a id="downloadButton" href="#" download>
            <button id="dl">Download</button>
          </a>
        </div>

        <script>
          function openModal(type, src) {
            const modalImage = document.getElementById('modalImage');
            const modalVideo = document.getElementById('modalVideo');
            const downloadButton = document.getElementById('downloadButton');

            if (type === 'image') {
              modalImage.style.display = 'block';
              modalVideo.style.display = 'none';
              modalImage.src = src;
              modalVideo.pause(); // Ensure video is paused
              downloadButton.href = src;
              downloadButton.download = src.split('/').pop(); // Set download filename
            } else if (type === 'video') {
              modalImage.style.display = 'none';
              modalVideo.style.display = 'block';
              modalVideo.src = src;
              modalVideo.pause(); // Ensure video is paused
              downloadButton.href = src;
              downloadButton.download = src.split('/').pop(); // Set download filename
            }
            document.getElementById('myModal').style.display = "block";
            document.getElementById('caption').innerHTML = src;
          }

          function closeModal() {
            document.getElementById('myModal').style.display = "none";
            document.getElementById('modalVideo').pause(); // Pause video when closing modal
          }
        </script>
      </body>
      </html>
    `);
  });
});

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
// Socket.io events
io.on('connection', (socket) => {
  const message = 'New client connected';
  console.log(message);
  logToFile(message);

  // Send previous messages to the new client
  messages.forEach(msg => {
    socket.emit('message', msg);
  });

  socket.on('login', (data) => {
    if (isLocked) {
      socket.emit('lockStatus', { locked: true });
      const lockMessage = 'Login attempt while chat room is locked';
      console.log(lockMessage);
      logToFile(lockMessage);
      return;
    }

    try {
      const decoded = jwt.verify(data.token, SECRET_KEY);
      activeUsers[socket.id] = decoded.username;
      onlineUsers.add(socket.id);
      io.emit('onlineUsers', {
        count: onlineUsers.size,
        users: Object.values(activeUsers)
      });
      const loginMessage = `${decoded.username} joined the Party`;
      io.emit('message', { username: 'Server', text: loginMessage, time: new Date() }); // Notify other users
      console.log(loginMessage);
      logToFile(loginMessage);
    } catch (error) {
      const errorMessage = 'Invalid token';
      socket.emit('error', errorMessage);
      console.log(errorMessage);
      logToFile(errorMessage);
    }
  });

  const commands = {
    '/help': 'Displays a list of available commands and their descriptions.',
    '/whoami': 'Displays the username of the current user.',
    '/tableflip': 'Sends a tableflip emoticon.',
    '/kick [username]': 'Kicks a user from the chatroom.',
    '/lock': 'Locks the chatroom.',
    '/unlock': 'Unlocks the chatroom.',
    '/lenny' : 'lennyface.',
    '/darkmode': 'darkmoe helper',
    // Add more commands and their descriptions here as needed
};

  socket.on('message', (data) => {
     const token = data.token;
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const username = decoded.username;
        const text = data.text;

        if (text === '/help') {
            const commandList = Object.keys(commands)
                .map(command => `${command}: ${commands[command]}`)
                .join('\n');
            socket.emit('message', { username: 'Server', text: commandList, time: new Date() });
        } else if (text === '/whoami') {
            socket.emit('message', { username: 'Server', text: `You are logged in as ${username}`, time: new Date() });
        } else if (text.startsWith('/kick ')) {
            const usernameToKick = text.split(' ')[1];
            const socketIdToKick = Object.keys(activeUsers).find(key => activeUsers[key] === usernameToKick);
            if (socketIdToKick) {
                io.sockets.sockets.get(socketIdToKick).disconnect(true);
                io.emit('message', { username: 'Server', text: `${usernameToKick} has been kicked by ${username}`, time: new Date() });
                logToFile(`${usernameToKick} has been kicked by ${username}`);
            } else {
                socket.emit('message', { username: 'Server', text: `User ${usernameToKick} not found`, time: new Date() });
            }
        } else if (text === '/lock') {
            isLocked = true;
            io.emit('message', { username: 'Server', text: `${username} has locked the chat`, time: new Date() });
            logToFile(`${username} has locked the chat`);
        } else if (text === '/unlock') {
            isLocked = false;
            io.emit('message', { username: 'Server', text: `${username} has unlocked the chat`, time: new Date() });
            logToFile(`${username} has unlocked the chat`);
        } else {
            const message = { username, text, time: new Date() };
            messages.push(message);
            io.emit('message', message);
            logToFile(`Message from ${username}: ${text}`);
        }
    } catch (error) {
        const errorMessage = 'Invalid token';
        socket.emit('error', errorMessage);
        logToFile(errorMessage);
    }
});

  socket.on('files', (data) => {
    const token = data.token;
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      const fileMessages = data.fileUrls.map(fileUrl => ({ username: decoded.username, fileUrl, time: new Date() }));
      fileMessages.forEach(fileMessage => {
        messages.push(fileMessage);
        io.emit('file', fileMessage);
        const logMessage = `File from ${fileMessage.username}: ${fileMessage.fileUrl}`;
        console.log(logMessage);
        logToFile(logMessage);
      });
    } catch (error) {
      const errorMessage = 'Invalid token';
      socket.emit('error', errorMessage);
      console.log(errorMessage);
      logToFile(errorMessage);
    }
  });

  socket.on('disconnect', () => {
    const username = activeUsers[socket.id];
    onlineUsers.delete(socket.id);
    delete activeUsers[socket.id];
    io.emit('onlineUsers', {
      count: onlineUsers.size,
      users: Object.values(activeUsers)
    });
    const message = `${username} left the Party`;
    io.emit('message', { username: 'Server', text: message, time: new Date() }); // Notify other users
    console.log(message);
    logToFile(message);
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data);
  });

  socket.on('kicked', () => {
    const message = 'You have been kicked from the server';
    logToFile(message);
    socket.disconnect(true);
  });
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Start server
const PORT = process.env.PORT || 3001;  // Ensure this port matches the one in ngrok.yml
server.listen(PORT, async () => {
  const message = `Server is running on port ${PORT}`;
  console.log(message);
  logToFile(message);
  const url = await ngrok.connect({
    proto: 'http',
    addr: PORT,
    onStatusChange: status => console.log(`ngrok status: ${status}`),
    onLogEvent: data => console.log(`ngrok log: ${data}`),
    hostname: '',  // ******PUT YOUR CUSTOM DOMAIN HERE *********************************
    web_addr: `127.0.0.1:4040`,
    web_skip_browser_warning: true
  });
  const ngrokMessage = `Ngrok tunnel URL(anon link): ${url}`;
  console.log(ngrokMessage);
  logToFile(ngrokMessage);
  console.log("running servers locally");
});

// CLI for server commands
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  const [command, ...args] = input.split(' ');
  if (command === 'kick') {
    const usernameToKick = args[0];
    if (usernameToKick) {
      const socketId = Object.keys(activeUsers).find(key => activeUsers[key] === usernameToKick);
      if (socketId) {
        io.sockets.sockets.get(socketId).disconnect(true);
        const kickMessage = `${usernameToKick} has been kicked from the server`;
        console.log(kickMessage);
        logToFile(kickMessage);
      } else {
        console.log(`User ${usernameToKick} not found`);
      }
    } else {
      console.log('Please provide a username to kick');
    }
  } else if (command === 'lock') {
    isLocked = true;
    console.log('Chat room locked');
    logToFile('Chat room locked');
  } else if (command === 'unlock') {
    isLocked = false;
    console.log('Chat room unlocked');
    logToFile('Chat room unlocked');
  } else {
    console.log('Unknown command');
  }
});
