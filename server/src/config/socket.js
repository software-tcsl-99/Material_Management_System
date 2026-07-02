const { Server } = require('socket.io');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const userId = socket.handshake.auth.userId;
    if (!userId) {
      return next(new Error('Authentication error'));
    }
    socket.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Join user's personal room
    socket.join(`user:${socket.userId}`);

    // Join transaction chat room
    socket.on('join_transaction', (transactionId) => {
      socket.join(`txn:${transactionId}`);
      console.log(`User ${socket.userId} joined txn:${transactionId}`);
    });

    socket.on('leave_transaction', (transactionId) => {
      socket.leave(`txn:${transactionId}`);
    });

    // Chat typing indicator
    socket.on('typing', ({ transactionId, userName }) => {
      socket.to(`txn:${transactionId}`).emit('user_typing', { userId: socket.userId, userName });
    });

    socket.on('stop_typing', ({ transactionId }) => {
      socket.to(`txn:${transactionId}`).emit('user_stop_typing', { userId: socket.userId });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

const emitToTransaction = (transactionId, event, data) => {
  if (io) {
    io.to(`txn:${transactionId}`).emit(event, data);
  }
};

const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = { initSocket, getIO, emitToUser, emitToTransaction, emitToAll };
