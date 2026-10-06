const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const {
    rooms,
    createRoom,
    getRoom,
    deleteRoom
} = require("./rooms");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// =====================================================
// DOSYALARI YAYINLA
// =====================================================

app.use(
    express.static(
        path.join(__dirname, "..")
    )
);

// =====================================================
// SOCKET
// =====================================================

io.on("connection", socket => {

    console.log("🟢 Bağlandı:", socket.id);

    // =================================================
    // ODA OLUŞTUR
    // =================================================

    socket.on("createRoom", () => {

        const roomCode = createRoom(socket.id);

        socket.join(roomCode);

        socket.emit("roomCreated", {
            roomCode
        });

        console.log("Oda oluşturuldu:", roomCode);
    });

    // =================================================
    // ODAYA KATIL
    // =================================================

    socket.on("joinRoom", roomCode => {

        roomCode = roomCode
            .toUpperCase()
            .trim();

        const room = getRoom(roomCode);

        if (!room) {
            socket.emit(
                "joinError",
                "Bu oda bulunamadı."
            );
            return;
        }

        if (room.player2) {
            socket.emit(
                "joinError",
                "Bu oda zaten dolu."
            );
            return;
        }

        room.player2 = socket.id;

        socket.join(roomCode);

        socket.emit("roomJoined", {
            roomCode
        });

        io.to(room.player1)
            .emit("player2Joined");

        console.log(
            "P2 katıldı:",
            roomCode
        );
    });

    // =================================================
    // P1 GİZLİ FUTBOLCU SEÇİYOR
    // =================================================

    socket.on(
        "selectSecretPlayer",
        ({ roomCode, player }) => {

            const room = getRoom(roomCode);

            if (!room) return;

            if (socket.id !== room.player1) {
                return;
            }

            if (!room.player2) {
                return;
            }

            room.secretPlayer = player;
            room.questionCount = 0;
            room.guessCount = 0;
            room.hintsUsed = 0;

            // P1'e
            io.to(room.player1)
                .emit("secretPlayerSelected");

            // P2'ye
            io.to(room.player2)
                .emit("gameStarted", {
                    questionCount: 0
                });

            console.log(
                "Gizli futbolcu seçildi:",
                player.name
            );
        }
    );

    // =================================================
    // P2 SORU SORUYOR
    // =================================================

    socket.on(
        "askQuestion",
        ({ roomCode, question }) => {

            const room = getRoom(roomCode);

            if (!room) return;

            if (socket.id !== room.player2) {
                return;
            }

            if (!question || !question.trim()) {
                return;
            }

            if (room.questionCount >= 15) {
                return;
            }

            room.currentQuestion = question.trim();

            io.to(room.player1)
                .emit("questionReceived", {
                    question: room.currentQuestion
                });
        }
    );

    // =================================================
    // P1 CEVAP VERİYOR
    // =================================================

    socket.on(
        "answerQuestion",
        ({ roomCode, answer }) => {

            const room = getRoom(roomCode);

            if (!room) return;

            if (socket.id !== room.player1) {
                return;
            }

            if (room.questionCount >= 15) {
                return;
            }

            room.questionCount++;

            io.to(room.player2)
                .emit("questionAnswered", {
                    answer,
                    questionCount:
                        room.questionCount
                });
        }
    );

    // =================================================
    // SÜRE DOLDU
    // =================================================

    socket.on(
        "questionTimeout",
        ({ roomCode }) => {

            const room = getRoom(roomCode);

            if (!room) return;

            if (socket.id !== room.player2) {
                return;
            }

            if (room.questionCount >= 15) {
                return;
            }

            room.questionCount++;

            io.to(room.player2)
                .emit("questionTimedOut", {
                    questionCount:
                        room.questionCount
                });

            // 15. soru da bittiyse sonuç ekranına geç
            if (room.questionCount >= 15) {

                io.to(roomCode)
                    .emit("roundResult", {
                        correct: false,
                        questionCount:
                            room.questionCount,
                        guessCount:
                            room.guessCount,
                        hintsUsed:
                            room.hintsUsed,
                        roundScore: 0,
                        player1Score:
                            room.player1Score,
                        player2Score:
                            room.player2Score
                    });
            }
        }
    );

    // =================================================
    // TAHMİN
    // =================================================

    socket.on(
        "makeGuess",
        ({ roomCode, player }) => {

            const room = getRoom(roomCode);

            if (!room) return;

            if (socket.id !== room.player2) {
                return;
            }

            if (!room.secretPlayer) {
                return;
            }

            // En az 1 soru sorulmuş olmalı
            if (room.questionCount < 1) {
                socket.emit(
                    "guessError",
                    "Önce en az 1 soru sormalısın."
                );
                return;
            }

            if (room.guessCount >= 2) {
                return;
            }

            room.guessCount++;

            const correct =
                room.secretPlayer.name ===
                player.name;

            let roundScore = 0;

            if (correct) {

                const baseScore =
                    Math.max(
                        300,
                        1000 -
                        ((room.questionCount - 1) * 50)
                    );

                const firstGuessBonus =
                    room.guessCount === 1
                        ? 100
                        : 0;

                roundScore =
                    baseScore +
                    firstGuessBonus;

                // İlk 5 soruda P1 cezası
                if (
                    room.questionCount >= 1 &&
                    room.questionCount <= 5
                ) {

                    const penalty =
                        60 -
                        (room.questionCount * 10);

                    room.player1Score =
                        Math.max(
                            0,
                            room.player1Score -
                            penalty
                        );
                }

                room.player2Score +=
                    roundScore;
            }

            io.to(roomCode)
                .emit("guessResult", {
                    correct,
                    player,
                    guessCount:
                        room.guessCount,
                    questionCount:
                        room.questionCount,
                    roundScore,
                    player1Score:
                        room.player1Score,
                    player2Score:
                        room.player2Score,
                    hintsUsed:
                        room.hintsUsed
                });
        }
    );

    // =================================================
    // İPUCU
    // =================================================

    socket.on(
        "useHint",
        ({ roomCode }) => {

            const room = getRoom(roomCode);

            if (!room) return;

            if (socket.id !== room.player2) {
                return;
            }

            if (!room.secretPlayer) {
                return;
            }

            if (room.player2Score < 250) {

                socket.emit(
                    "hintResult",
                    {
                        success: false,
                        message:
                            "Yeterli puanın yok."
                    }
                );

                return;
            }

            const secret =
                room.secretPlayer;

            const hints = [
                `🌍 Ülkesi: ${secret.country}`,
                `🏆 Ligi: ${secret.league}`,
                `⚽ Mevkisi: ${secret.position}`
            ];

            const index =
                Math.min(
                    room.hintsUsed,
                    hints.length - 1
                );

            room.hintsUsed++;

            room.player2Score -= 250;

            socket.emit(
                "hintResult",
                {
                    success: true,
                    hint: hints[index],
                    player2Score:
                        room.player2Score
                }
            );
        }
    );

    // =================================================
    // 15 SORU BİTTİ
    // =================================================

    socket.on(
        "questionsFinished",
        ({ roomCode }) => {

            const room = getRoom(roomCode);

            if (!room) return;

            if (room.questionCount < 15) {
                return;
            }

            io.to(roomCode)
                .emit("roundResult", {
                    correct: false,
                    questionCount:
                        room.questionCount,
                    guessCount:
                        room.guessCount,
                    hintsUsed:
                        room.hintsUsed,
                    roundScore: 0,
                    player1Score:
                        room.player1Score,
                    player2Score:
                        room.player2Score
                });
        }
    );

    // =================================================
    // TEKRAR OYNA
    // =================================================

    socket.on(
        "playAgain",
        ({ roomCode }) => {

            const room = getRoom(roomCode);

            if (!room) return;

            room.secretPlayer = null;
            room.currentQuestion = "";
            room.questionCount = 0;
            room.guessCount = 0;
            room.hintsUsed = 0;

            // Roller değişiyor
            const oldPlayer1 =
                room.player1;

            room.player1 =
                room.player2;

            room.player2 =
                oldPlayer1;

            // Yeni rolleri ayrı ayrı gönder
            io.to(room.player1)
                .emit("newRound", {
                    role: "player1",
                    player1Score:
                        room.player1Score,
                    player2Score:
                        room.player2Score
                });

            io.to(room.player2)
                .emit("newRound", {
                    role: "player2",
                    player1Score:
                        room.player1Score,
                    player2Score:
                        room.player2Score
                });

            console.log(
                "Yeni tur başladı:",
                roomCode
            );
        }
    );

    // =================================================
    // YENİ OYUN
    // =================================================

    socket.on(
        "newGame",
        ({ roomCode }) => {

            const room = getRoom(roomCode);

            if (!room) return;

            room.player1Score = 0;
            room.player2Score = 0;

            room.secretPlayer = null;
            room.currentQuestion = "";
            room.questionCount = 0;
            room.guessCount = 0;
            room.hintsUsed = 0;

            io.to(roomCode)
                .emit("gameReset");

            console.log(
                "Yeni oyun:",
                roomCode
            );
        }
    );

    // =================================================
    // BAĞLANTI KESİLDİ
    // =================================================

    socket.on("disconnect", () => {

        console.log(
            "🔴 Ayrıldı:",
            socket.id
        );

        for (
            const [code, room]
            of rooms
        ) {

            if (
                room.player1 === socket.id ||
                room.player2 === socket.id
            ) {

                io.to(code)
                    .emit(
                        "playerDisconnected"
                    );

                deleteRoom(code);

                console.log(
                    "Oda silindi:",
                    code
                );
            }
        }
    });

});

// =====================================================
// SERVER
// =====================================================

const PORT =
    process.env.PORT || 3000;

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "================================"
        );
        console.log(
            "⚽ FUTBOLCUYU BUL SERVER"
        );
        console.log(
            "================================"
        );
        console.log(
            `🌐 http://localhost:${PORT}`
        );
        console.log("");
    }
);
