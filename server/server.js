const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

let rooms = {};

io.on('connection', (socket) => {
    // 1. Create Room
    socket.on('create_room', ({ playerName }) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomId] = {
            id: roomId,
            hostId: socket.id,
            players: [{ id: socket.id, name: playerName, score: 0 }],
            round: 1,
            turnIndex: 0,
            gameStarted: false
        };
        socket.join(roomId);
        socket.emit('room_created', { roomId, isHost: true, players: rooms[roomId].players });
    });

    // 2. Join Room
    socket.on('join_room', ({ roomId, playerName }) => {
        if (rooms[roomId] && rooms[roomId].players.length < 2) {
            rooms[roomId].players.push({ id: socket.id, name: playerName, score: 0 });
            socket.join(roomId);
            io.to(roomId).emit('player_joined', { players: rooms[roomId].players });
        } else {
            socket.emit('error', 'Room full or not found');
        }
    });

    // 3. Admin Start Game
    socket.on('start_game', ({ roomId }) => {
        if (rooms[roomId] && socket.id === rooms[roomId].hostId) {
            rooms[roomId].gameStarted = true;
            // Notify everyone game started, Player 1 goes first
            io.to(roomId).emit('game_started', { 
                currentTurnId: rooms[roomId].players[0].id,
                round: 1 
            });
        }
    });

    // 4. Switch Turn
    socket.on('finish_turn', ({ roomId }) => {
        if (!rooms[roomId]) return;
        const r = rooms[roomId];
        
        // Toggle turn index (0 to 1, or 1 to 0)
        r.turnIndex = r.turnIndex === 0 ? 1 : 0;
        
        // If we are back to Player 0, increment round
        if (r.turnIndex === 0) r.round++;

        io.to(roomId).emit('turn_switched', { 
            currentTurnId: r.players[r.turnIndex].id,
            round: r.round
        });
    });

    // 5. Emojis & PeerID Exchange
    socket.on('send_emoji', (data) => socket.to(data.roomId).emit('receive_emoji', data));
    socket.on('send_peer_id', (data) => socket.to(data.roomId).emit('receive_peer_id', data));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));