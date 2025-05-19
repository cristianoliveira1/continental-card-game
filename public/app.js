// Firebase Config (Replace with yours!)
const firebaseConfig = {
    apiKey: "AIzaSyCtBNQnfdPYZ_i97hR4lOAeAjaFUfcVM9I",
    authDomain: "continental-7bd16.firebaseapp.com",
    databaseURL: "https://continental-7bd16-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "continental-7bd16",
    storageBucket: "continental-7bd16.firebasestorage.app",
    messagingSenderId: "1061494214330",
    appId: "1:1061494214330:web:cd45115d82bb7ba4f2fc83",
    measurementId: "G-82PMRG5B0S"
  };
  
// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// ======================
// Game State Variables
// ======================
let gameId;
let playerId = "player_" + Math.random().toString(36).substring(2, 9);
let currentPlayerHand = [];

// ======================
// DOM Event Listeners
// ======================
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded"); // Debug
  
  document.getElementById('startGame').addEventListener('click', startNewGame);
  
  // Debug: Test Firebase connection
  testFirebaseConnection();
});

// ======================
// Core Game Functions
// ======================
function startNewGame() {
  console.log("Start Game button clicked"); // Debug
  
  // 1. Generate game ID
  gameId = "game_" + Math.random().toString(36).substring(2, 9);
  
  // 2. Create and shuffle deck
  const deck = shuffleDeck(createDeck());
  
  // 3. Deal initial hands (example: 2 players)
  const player1Hand = deck.splice(0, 10);
  const player2Hand = deck.splice(0, 10);
  currentPlayerHand = player1Hand; // Store our hand
  
  // 4. Create game data structure
  const gameData = {
    deck: deck,
    discardPile: [],
    currentRound: 1,
    currentPlayer: playerId,
    contract: "2 Trios",
    players: {
      [playerId]: {
        hand: player1Hand,
        melds: []
      },
      "player_2": {
        hand: player2Hand,
        melds: []
      }
    }
  };
  
  // 5. Write to Firebase
  database.ref('games/' + gameId).set(gameData)
    .then(() => {
      console.log("Game created successfully!");
      renderHand();
      setupGameListeners();
    })
    .catch((error) => {
      console.error("Error creating game:", error);
    });
}

function renderHand() {
  const handContainer = document.getElementById('hand');
  handContainer.innerHTML = '';
  
  currentPlayerHand.forEach((card, index) => {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    cardElement.textContent = card;
    cardElement.dataset.index = index;
    cardElement.addEventListener('click', () => playCard(index));
    handContainer.appendChild(cardElement);
  });
}

function playCard(cardIndex) {
  const card = currentPlayerHand[cardIndex];
  console.log("Playing card:", card); // Debug
  
  // 1. Remove from hand
  currentPlayerHand.splice(cardIndex, 1);
  
  // 2. Add to discard pile
  const updates = {};
  updates[`games/${gameId}/players/${playerId}/hand`] = currentPlayerHand;
  updates[`games/${gameId}/discardPile`] = firebase.database.ServerValue.arrayUnion(card);
  
  // 3. Switch turns
  updates[`games/${gameId}/currentPlayer`] = "player_2";
  
  // 4. Update Firebase
  database.ref().update(updates)
    .then(() => {
      console.log("Card played successfully");
      renderHand();
    })
    .catch((error) => {
      console.error("Error playing card:", error);
    });
}

// ======================
// Helper Functions
// ======================
function testFirebaseConnection() {
  const testRef = database.ref('.info/connected');
  testRef.on('value', (snap) => {
    if (snap.val() === true) {
      console.log("Firebase connected successfully");
    } else {
      console.warn("Firebase not connected");
    }
  });
}

function setupGameListeners() {
  // Listen for game state changes
  database.ref('games/' + gameId).on('value', (snapshot) => {
    const gameData = snapshot.val();
    if (gameData) {
      console.log("Game update received:", gameData);
      updateGameUI(gameData);
    }
  });
}

function updateGameUI(gameData) {
  // Update round and contract info
  document.getElementById('round').textContent = gameData.currentRound;
  document.getElementById('contract').textContent = gameData.contract;
  
  // Update discard pile
  const discardPile = document.getElementById('discard-pile');
  discardPile.innerHTML = gameData.discardPile.map(card => 
    `<div class="card">${card}</div>`
  ).join('');
  
  // Highlight current player
  if (gameData.currentPlayer === playerId) {
    document.body.style.backgroundColor = "#f0fff0"; // Light green
  } else {
    document.body.style.backgroundColor = "#fff0f0"; // Light red
  }
}