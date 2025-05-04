// Import required modules
require('dotenv').config();  // Load environment variables from .env file
const express = require('express');
const cors = require('cors'); // Import cors
const http = require('http');
const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const reelRoutes = require('./routes/reelRoutes');
const friendRoutes = require('./routes/friendRoutes');
const postRoutes = require('./routes/postRoutes');
const profileRoutes = require('./routes/profileRoutes');
const FriendRequest = require('./models/FriendRequest');
const ChatMessage = require('./models/ChatMessage');
// const passport = require('passport');
// require('./config/passport');
// Connect to the database
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: '*',
  }
});

// Middleware to parse JSON
app.use(express.json());

// Set up CORS policy
app.use(cors({
  origin: 'https://dating-frontend-delta.vercel.app', // Allow requests from this origin
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
  credentials: true // Allow cookies and credentials
}));
// Middleware for parsing URL-encoded data
// app.use(passport.initialize());
// Routes
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/profile', profileRoutes);
app.use('/uploads', express.static('uploads'));

// Socket.io middleware for authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Helper function to check if two users are friends
const areFriends = async (userId1, userId2) => {
  const friendship = await FriendRequest.findOne({
    $or: [
      { requester: userId1, recipient: userId2, status: 'accepted' },
      { requester: userId2, recipient: userId1, status: 'accepted' }
    ]
  });
  return !!friendship;
};

// Handling socket.io events
io.on('connection', (socket) => {
  console.log('New client connected:', socket.userId);

  socket.on('join', async ({ friendId }) => {
    if (!friendId) return;
    const isFriend = await areFriends(socket.userId, friendId);
    if (!isFriend) {
      socket.emit('error', 'You can only chat with friends');
      return;
    }
    const roomName = [socket.userId, friendId].sort().join('_');
    socket.join(roomName);
    socket.roomName = roomName;
    socket.friendId = friendId;
    socket.emit('joined', roomName);
  });

  socket.on('sendMessage', async ({ message }) => {
    if (!socket.roomName) {
      socket.emit('error', 'You must join a room first');
      return;
    }
    const chatMessage = new ChatMessage({
      sender: socket.userId,
      recipient: socket.friendId,
      message
    });
    await chatMessage.save();
    io.to(socket.roomName).emit('receiveMessage', {
      sender: socket.userId,
      message,
      createdAt: chatMessage.createdAt
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.userId);
  });
});

// Set up server port and start the server
const PORT = process.env.PORT || 7000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Example URL for profile pictures
const profilePicUrl = 'http://localhost:7000/uploads/profile-pics/<filename>';
console.log(`Profile pictures can be accessed at: ${profilePicUrl}`);
