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
    console.log("User connected:", socket.id);

    // --- SECTION 1: LOBBY & GAME STATE (Restored from your code) ---

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
            
            // Send existing Peer IDs if game is already running (Reconnection handling)
            socket.to(roomId).emit('user_joined', { id: socket.id }); 
        } else {
            socket.emit('error', 'Room full or not found');
        }
    });

    // 3. Admin Start Game
    socket.on('start_game', ({ roomId }) => {
        if (rooms[roomId] && socket.id === rooms[roomId].hostId) {
            rooms[roomId].gameStarted = true;
            io.to(roomId).emit('game_started', { 
                currentTurnId: rooms[roomId].players[0].id,
                round: 1 
            });
        }
    });

    // 4. Switch Turn (Logic to count rounds)
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

    // --- SECTION 2: REMOTE CONTROL (The new Touch Mirroring) ---

    // 5. Touch / Mouse Mirroring
    // This allows Player 2 to control Player 1's screen during their turn
    socket.on('remote_input', (data) => {
        // Broadcast the touch data to everyone else in the room (The Host)
        socket.broadcast.to(data.roomId).emit('mimic_input', data);
    });

    // 6. WebRTC Video Signaling
    socket.on('send_peer_id', (data) => {
        socket.to(data.roomId).emit('receive_peer_id', data);
    });

    // 7. Emojis
    socket.on('send_emoji', (data) => {
        socket.to(data.roomId).emit('receive_emoji', data);
    });

    // Cleanup when user disconnects
    socket.on('disconnect', () => {
        // Optional: Logic to remove player from room
        console.log("User disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));
