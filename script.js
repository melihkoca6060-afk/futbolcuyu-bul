const socket = io();


// =====================================================
// OYUN DEĞİŞKENLERİ
// =====================================================

let roomCode = null;
let myRole = null;

let selectedPlayer = null;
let selectedGuess = null;

let questionCount = 0;
let guessCount = 0;
let hintsUsed = 0;

let timerInterval = null;
let timeLeft = 30;

let player1Score = 0;
let player2Score = 0;


// =====================================================
// EKRAN
// =====================================================

function showScreen(id) {

    document
        .querySelectorAll(".screen")
        .forEach(screen => {
            screen.classList.remove("active");
        });

    const screen = document.getElementById(id);

    if (screen) {
        screen.classList.add("active");
    }
}


// =====================================================
// SKOR
// =====================================================

function updateScores() {

    document.getElementById("score1").textContent =
        `Oyuncu 1: ${player1Score}`;

    document.getElementById("score2").textContent =
        `Oyuncu 2: ${player2Score}`;
}


// =====================================================
// ANA MENÜ
// =====================================================

document
    .getElementById("howToPlay")
    .addEventListener("click", () => {

        showScreen("rules");

    });


document
    .getElementById("backMenu")
    .addEventListener("click", () => {

        showScreen("menu");

    });


// =====================================================
// ODA OLUŞTUR
// =====================================================

document
    .getElementById("createRoomButton")
    .addEventListener("click", () => {

        socket.emit("createRoom");

    });


socket.on("roomCreated", data => {

    roomCode = data.roomCode;
    myRole = "player1";

    document.getElementById("roomCode").textContent =
        roomCode;

    document.getElementById("roomStatus").textContent =
        "🟡 Oyuncu 2 bekleniyor...";

    document.getElementById("startMultiplayerGame").disabled =
        true;

    showScreen("roomScreen");

});


// =====================================================
// P2 ODAYA KATIL
// =====================================================

document
    .getElementById("joinRoomButton")
    .addEventListener("click", () => {

        document.getElementById("roomCodeInput").value = "";
        document.getElementById("joinError").textContent = "";

        showScreen("joinScreen");

    });


document
    .getElementById("joinButton")
    .addEventListener("click", () => {

        const code =
            document
                .getElementById("roomCodeInput")
                .value
                .trim()
                .toUpperCase();

        if (code.length !== 5) {

            document.getElementById("joinError").textContent =
                "❌ Oda kodu 5 karakter olmalı.";

            return;
        }

        socket.emit("joinRoom", code);

    });


socket.on("roomJoined", data => {

    roomCode = data.roomCode;
    myRole = "player2";

    document.getElementById("roomCode").textContent =
        roomCode;

    document.getElementById("roomStatus").textContent =
        "🟢 Odaya katıldın. Oyuncu 1 bekleniyor.";

    document.getElementById("startMultiplayerGame").style.display =
        "none";

    showScreen("roomScreen");

});


socket.on("joinError", message => {

    document.getElementById("joinError").textContent =
        "❌ " + message;

});


// =====================================================
// P1 — P2 ODAYA GELDİ
// =====================================================

socket.on("player2Joined", () => {

    document.getElementById("roomStatus").textContent =
        "🟢 Oyuncu 2 odaya katıldı!";

    document.getElementById("startMultiplayerGame").disabled =
        false;

});


// =====================================================
// P1 — OYUNU BAŞLAT
// =====================================================

document
    .getElementById("startMultiplayerGame")
    .addEventListener("click", () => {

        if (myRole !== "player1") {
            return;
        }

        resetRound();

        renderPlayerList();

        showScreen("selectPlayer");

    });


// =====================================================
// FUTBOLCU LİSTESİ
// =====================================================

function renderPlayerList(search = "") {

    const list =
        document.getElementById("playerList");

    list.innerHTML = "";

    const text =
        search.toLowerCase().trim();

    players
        .filter(player =>
            player.name
                .toLowerCase()
                .includes(text)
        )
        .forEach(player => {

            const card =
                document.createElement("div");

            card.className = "player-card";

            card.innerHTML = `
                <div class="player-name">
                    ${player.name}
                </div>

                <div class="player-info">
                    ${player.club} • ${player.position}
                </div>
            `;

            card.addEventListener("click", () => {

                document
                    .querySelectorAll("#playerList .player-card")
                    .forEach(item => {
                        item.classList.remove("selected");
                    });

                card.classList.add("selected");

                selectedPlayer = player;

                document.getElementById("selectedPlayer").innerHTML =
                    `<p>Seçilen futbolcu:</p>
                     <strong>${player.name}</strong>`;

                document.getElementById("confirmPlayer").disabled =
                    false;

            });

            list.appendChild(card);

        });

}


document
    .getElementById("playerSearch")
    .addEventListener("input", event => {

        renderPlayerList(event.target.value);

    });


// =====================================================
// P1 — GİZLİ FUTBOLCUYU SEÇ
// =====================================================

document
    .getElementById("confirmPlayer")
    .addEventListener("click", () => {

        if (!selectedPlayer) {
            return;
        }

        if (myRole !== "player1") {
            return;
        }

        document.getElementById("confirmPlayer").disabled =
            true;

        socket.emit("selectSecretPlayer", {
            roomCode,
            player: selectedPlayer
        });

    });


// =====================================================
// P1 — FUTBOLCU SEÇİLDİ
// =====================================================

socket.on("secretPlayerSelected", () => {

    document.getElementById("askedQuestion").textContent =
        "Oyuncu 2'nin sorusu bekleniyor...";

    showScreen("roomScreen");

    document.getElementById("roomStatus").textContent =
        "🔐 Futbolcu seçildi. Oyuncu 2 soru soruyor.";

});


// =====================================================
// P2 — OYUN BAŞLADI
// =====================================================

socket.on("gameStarted", data => {

    questionCount = 0;
    guessCount = 0;
    hintsUsed = 0;

    updateQuestionUI();

    document.getElementById("lastAnswer").innerHTML =
        "";

    showScreen("questionScreen");

    startTimer();

});


// =====================================================
// SORU UI
// =====================================================

function updateQuestionUI() {

    document.getElementById("questionNumber").textContent =
        `Soru ${questionCount + 1} / 15`;

}


// =====================================================
// TIMER
// =====================================================

function startTimer() {

    stopTimer();

    timeLeft = 30;

    document.getElementById("timer").textContent =
        timeLeft;

    timerInterval =
        setInterval(() => {

            timeLeft--;

            document.getElementById("timer").textContent =
                timeLeft;

            if (timeLeft <= 0) {

                stopTimer();

                timeoutQuestion();

            }

        }, 1000);

}


function stopTimer() {

    if (timerInterval) {

        clearInterval(timerInterval);

        timerInterval = null;

    }

}


// =====================================================
// P2 — SORU GÖNDER
// =====================================================

document
    .getElementById("askQuestion")
    .addEventListener("click", () => {

        const input =
            document.getElementById("questionInput");

        const question =
            input.value.trim();

        if (!question) {

            alert("❌ Önce bir soru yaz.");

            return;
        }

        stopTimer();

        document.getElementById("askQuestion").disabled =
            true;

        input.disabled = true;

        socket.emit("askQuestion", {
            roomCode,
            question
        });

    });


// =====================================================
// P1 — SORU GELDİ
// =====================================================

socket.on("questionReceived", data => {

    document.getElementById("askedQuestion").textContent =
        data.question;

    showScreen("answerScreen");

});


// =====================================================
// P1 — EVET
// =====================================================

document
    .getElementById("yesButton")
    .addEventListener("click", () => {

        sendAnswer("EVET");

    });


// =====================================================
// P1 — HAYIR
// =====================================================

document
    .getElementById("noButton")
    .addEventListener("click", () => {

        sendAnswer("HAYIR");

    });


function sendAnswer(answer) {

    socket.emit("answerQuestion", {
        roomCode,
        answer
    });

    document.getElementById("yesButton").disabled =
        true;

    document.getElementById("noButton").disabled =
        true;

}


// =====================================================
// P2 — CEVAP GELDİ
// =====================================================

socket.on("questionAnswered", data => {

    questionCount = data.questionCount;

    document.getElementById("lastAnswer").innerHTML =
        `<div class="rules-box">
            <strong>Oyuncu 1:</strong> ${data.answer}
        </div>`;

    document.getElementById("questionInput").value = "";
    document.getElementById("questionInput").disabled = false;

    document.getElementById("askQuestion").disabled = false;

    document.getElementById("yesButton").disabled = false;
    document.getElementById("noButton").disabled = false;

    if (questionCount >= 15) {

        stopTimer();

        socket.emit("questionsFinished", {
            roomCode
        });

        return;
    }

    updateQuestionUI();

    showScreen("questionScreen");

    startTimer();

});


// =====================================================
// 30 SANİYE DOLUNCA
// =====================================================

function timeoutQuestion() {

    document.getElementById("questionInput").disabled =
        true;

    document.getElementById("askQuestion").disabled =
        true;

    socket.emit("questionTimeout", {
        roomCode
    });

}


socket.on("questionTimedOut", data => {

    questionCount = data.questionCount;

    document.getElementById("lastAnswer").innerHTML =
        `<div class="rules-box">
            ⏰ Süre doldu! Bu soru cevaplanmadı.
        </div>`;

    document.getElementById("questionInput").value = "";
    document.getElementById("questionInput").disabled = false;

    document.getElementById("askQuestion").disabled = false;

    if (questionCount >= 15) {

        socket.emit("questionsFinished", {
            roomCode
        });

        return;
    }

    updateQuestionUI();

    showScreen("questionScreen");

    startTimer();

});


// =====================================================
// TAHMİN LİSTESİ
// =====================================================

function renderGuessList(search = "") {

    const list =
        document.getElementById("guessList");

    list.innerHTML = "";

    const text =
        search.toLowerCase().trim();

    players
        .filter(player =>
            player.name
                .toLowerCase()
                .includes(text)
        )
        .forEach(player => {

            const card =
                document.createElement("div");

            card.className = "player-card";

            card.innerHTML = `
                <div class="player-name">
                    ${player.name}
                </div>

                <div class="player-info">
                    ${player.club} • ${player.position}
                </div>
            `;

            card.addEventListener("click", () => {

                document
                    .querySelectorAll("#guessList .player-card")
                    .forEach(item => {
                        item.classList.remove("selected");
                    });

                card.classList.add("selected");

                selectedGuess = player;

                document.getElementById("guessButton").disabled =
                    false;

            });

            list.appendChild(card);

        });

}


document
    .getElementById("guessSearch")
    .addEventListener("input", event => {

        renderGuessList(event.target.value);

    });


// OYUN BAŞLADIĞINDA TAHMİN LİSTESİ
renderGuessList();


// =====================================================
// P2 — TAHMİN
// =====================================================

document
    .getElementById("guessButton")
    .addEventListener("click", () => {

        if (!selectedGuess) {
            return;
        }

        if (guessCount >= 2) {
            return;
        }

        socket.emit("makeGuess", {
            roomCode,
            player: selectedGuess
        });

    });


// =====================================================
// TAHMİN SONUCU
// =====================================================

socket.on("guessResult", data => {

    guessCount = data.guessCount;

    if (data.correct) {

        stopTimer();

        showResult(data);

        return;
    }

    if (guessCount >= 2) {

        stopTimer();

        showResult(data);

        return;
    }

    alert(
        `❌ Yanlış tahmin!\nKalan tahmin: ${2 - guessCount}`
    );

    selectedGuess = null;

    document.getElementById("guessButton").disabled =
        true;

});


// =====================================================
// İPUCU
// =====================================================

document
    .getElementById("hintButton")
    .addEventListener("click", () => {

        socket.emit("useHint", {
            roomCode
        });

    });


socket.on("hintResult", data => {

    if (!data.success) {

        alert("❌ " + data.message);

        return;
    }

    hintsUsed++;

    player2Score = data.player2Score;

    updateScores();

    alert(
        `💡 İpucu:\n\n${data.hint}`
    );

});


// =====================================================
// SONUÇ
// =====================================================

socket.on("roundResult", data => {

    player1Score = data.player1Score;
    player2Score = data.player2Score;

    updateScores();

    showResult(data);

});


function showResult(data) {

    stopTimer();

    player1Score = data.player1Score;
    player2Score = data.player2Score;

    updateScores();

    const title =
        document.getElementById("resultTitle");

    if (data.correct) {

        title.textContent =
            "🏆 Oyuncu 2 Futbolcuyu Buldu!";

    } else {

        title.textContent =
            "❌ Oyuncu 2 Futbolcuyu Bulamadı!";

    }

    document.getElementById("stats").innerHTML = `

        <div class="stat-row">
            ❓ Sorular:
            <strong>${data.questionCount}</strong>
        </div>

        <div class="stat-row">
            🎯 Tahminler:
            <strong>${data.guessCount}</strong>
        </div>

        <div class="stat-row">
            💡 İpuçları:
            <strong>${data.hintsUsed}</strong>
        </div>

        <div class="stat-row">
            ⭐ Tur puanı:
            <strong>${data.roundScore}</strong>
        </div>

        <div class="stat-row">
            🟢 Oyuncu 1:
            <strong>${data.player1Score}</strong>
        </div>

        <div class="stat-row">
            🔵 Oyuncu 2:
            <strong>${data.player2Score}</strong>
        </div>

    `;

    showScreen("resultScreen");

}


// =====================================================
// TEKRAR OYNA
// =====================================================

document
    .getElementById("playAgain")
    .addEventListener("click", () => {

        socket.emit("playAgain", {
            roomCode
        });

    });


socket.on("newRound", data => {

    selectedPlayer = null;
    selectedGuess = null;

    questionCount = 0;
    guessCount = 0;
    hintsUsed = 0;

    player1Score = data.player1Score;
    player2Score = data.player2Score;

    updateScores();

    if (data.role === "player1") {

        document.getElementById("playerSearch").value = "";

        document.getElementById("selectedPlayer").innerHTML = "";

        document.getElementById("confirmPlayer").disabled =
            true;

        renderPlayerList();

        showScreen("selectPlayer");

    } else {

        renderGuessList();

        showScreen("questionScreen");

        startTimer();

    }

});


// =====================================================
// YENİ OYUN
// =====================================================

document
    .getElementById("newGame")
    .addEventListener("click", () => {

        socket.emit("newGame", {
            roomCode
        });

    });


socket.on("gameReset", () => {

    player1Score = 0;
    player2Score = 0;

    updateScores();

    selectedPlayer = null;
    selectedGuess = null;

    showScreen("menu");

});


// =====================================================
// ODA KODU KOPYALA
// =====================================================

document
    .getElementById("copyRoomCode")
    .addEventListener("click", async () => {

        if (!roomCode) {
            return;
        }

        try {

            await navigator.clipboard.writeText(roomCode);

            alert("📋 Oda kodu kopyalandı!");

        } catch {

            alert(
                `Oda kodun: ${roomCode}`
            );

        }

    });


// =====================================================
// GERİ
// =====================================================

document
    .getElementById("cancelRoom")
    .addEventListener("click", () => {

        showScreen("menu");

    });


document
    .getElementById("backFromJoin")
    .addEventListener("click", () => {

        showScreen("menu");

    });


// =====================================================
// SERVER BAĞLANTISI
// =====================================================

socket.on("connect", () => {

    console.log("🟢 Server bağlantısı başarılı.");

});

socket.on("disconnect", () => {

    console.log("🔴 Server bağlantısı kesildi.");

});


// =====================================================
// TUR RESET
// =====================================================

function resetRound() {

    selectedPlayer = null;
    selectedGuess = null;

    questionCount = 0;
    guessCount = 0;
    hintsUsed = 0;

    stopTimer();

}