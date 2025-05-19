// Firebase configuration - REPLACE WITH YOUR ACTUAL CONFIG
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

// Game state variables
let database;
let gameId;
let playerId = "player_" + Math.random().toString(36).substring(2, 9);
let currentPlayerHand = [];
let selectedCards = [];
let gameState = {};
let isMyTurn = false;
let hasDrawnCard = false;
let mustDiscard = false;

// Initialize game when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  try {
    // Initialize Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    database = firebase.database();
    console.log("Firebase initialized");

    // Setup event listeners
    setupEventListeners();

    console.log("Game ready");
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Game failed to initialize. Check console.");
  }
});

function setupEventListeners() {
  // Game control buttons
  document.getElementById('start-game').addEventListener('click', startNewGame);
  document.getElementById('join-game').addEventListener('click', joinExistingGame);
  
  // Game ID input
  document.getElementById('game-id-input').addEventListener('input', function() {
    document.getElementById('join-game').disabled = this.value.trim() === '';
  });

  // Card actions
  document.querySelector('#draw-pile').addEventListener('click', handleDraw);
  document.querySelector('#discard-pile').addEventListener('click', handlePickupDiscard);
  document.getElementById('discard-btn').addEventListener('click', discardCard);

  // Meld controls
  document.getElementById('confirm-meld').addEventListener('click', confirmMeld);
  document.getElementById('cancel-meld').addEventListener('click', cancelMeld);
}

async function startNewGame() {
  const startGameBtn = document.getElementById('start-game');
  startGameBtn.disabled = true;
  
  try {
    // Create game ID
    gameId = "game_" + Math.random().toString(36).substring(2, 9);
    document.getElementById('game-id-input').value = gameId;
    
    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());
    
    // Deal initial hands (2 players)
    const player1Hand = deck.splice(0, 10);
    const player2Hand = deck.splice(0, 10);
    currentPlayerHand = player1Hand;
    
    // Start discard pile with one card
    const initialDiscard = deck.pop();
    
    // Create game data
    const gameData = {
      deck: deck,
      discardPile: [initialDiscard],
      currentRound: 1,
      currentPlayer: playerId, // First player starts
      currentPhase: "draw",   // Start in draw phase
      contract: getContractForRound(1),
      players: {
        [playerId]: {
          hand: player1Hand,
          melds: []
        },
        "player_2": {
          hand: player2Hand,
          melds: []
        }
      },
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    
    // Save to Firebase
    await database.ref('games/' + gameId).set(gameData);
    
    // Setup real-time updates
    setupGameListeners();
    
    alert(`Game started! Share ID: ${gameId}`);
    
  } catch (error) {
    console.error("Error starting game:", error);
    alert("Failed to start game. See console.");
  } finally {
    startGameBtn.disabled = false;
  }
}

async function joinExistingGame() {
  const joinGameBtn = document.getElementById('join-game');
  joinGameBtn.disabled = true;
  
  try {
    gameId = document.getElementById('game-id-input').value.trim();
    if (!gameId) throw new Error("Please enter game ID");
    
    // Check if game exists
    const snapshot = await database.ref('games/' + gameId).once('value');
    if (!snapshot.exists()) throw new Error("Game not found");
    
    gameState = snapshot.val();
    
    // Add player if new
    if (!gameState.players[playerId]) {
      const deck = gameState.deck;
      const newPlayerHand = deck.splice(0, 10);
      currentPlayerHand = newPlayerHand;
      
      await database.ref('games/' + gameId).update({
        deck: deck,
        [`players/${playerId}`]: {
          hand: newPlayerHand,
          melds: []
        }
      });
    } else {
      currentPlayerHand = gameState.players[playerId].hand;
    }
    
    // Setup real-time updates
    setupGameListeners();
    
  } catch (error) {
    console.error("Error joining game:", error);
    alert(error.message);
  } finally {
    joinGameBtn.disabled = false;
  }
}

function setupGameListeners() {
  database.ref('games/' + gameId).on('value', function(snapshot) {
    gameState = snapshot.val() || {};
    
    // Update player hand
    if (gameState.players && gameState.players[playerId]) {
      currentPlayerHand = gameState.players[playerId].hand;
    }
    
    // Update turn status
    isMyTurn = gameState.currentPlayer === playerId;
    
    // Update phase tracking
    if (isMyTurn) {
      hasDrawnCard = gameState.currentPhase === "discard";
      mustDiscard = gameState.currentPhase === "discard";
    } else {
      hasDrawnCard = false;
      mustDiscard = false;
    }
    
    // Update UI
    renderGame();
  });
}

function renderGame() {
  if (!gameState) return;
  
  // Update game info
  document.getElementById('round').textContent = gameState.currentRound || 1;
  document.getElementById('contract').textContent = gameState.contract || "2 Trios";
  
  // Update turn indicator
  const turnEl = document.getElementById('current-turn');
  turnEl.textContent = isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN";
  turnEl.className = isMyTurn ? "your-turn" : "opponent-turn";
  
  // Update phase indicator
  const phaseEl = document.getElementById('current-phase');
  if (isMyTurn) {
    phaseEl.textContent = mustDiscard ? "DISCARD A CARD" : "DRAW A CARD";
    phaseEl.className = mustDiscard ? "discard-phase" : "draw-phase";
  } else {
    phaseEl.textContent = "WAITING...";
    phaseEl.className = "wait-phase";
  }
  
  // Render player's hand
  renderHand();
  
  // Render melds
  renderMelds();
  
  // Render discard pile
  renderDiscardPile();
  
  // Render draw pile
  renderDrawPile();
  
  // Update button states
  updateButtonStates();
}

function renderHand() {
  const handEl = document.getElementById('player-hand');
  handEl.innerHTML = '';
  
  currentPlayerHand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card' + (selectedCards.includes(index) ? ' selected' : '');
    cardEl.textContent = getCardDisplay(card);
    
    if (isMyTurn) {
      cardEl.addEventListener('click', () => selectCard(index));
    }
    
    handEl.appendChild(cardEl);
  });
}

function renderMelds() {
  const meldsEl = document.getElementById('player-melds');
  meldsEl.innerHTML = '';
  
  const melds = gameState.players?.[playerId]?.melds || [];
  melds.forEach((meld, i) => {
    const meldGroup = document.createElement('div');
    meldGroup.className = 'meld-group';
    meldGroup.innerHTML = `<div class="meld-title">Meld ${i+1}</div>`;
    
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'meld-cards';
    
    meld.forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.textContent = getCardDisplay(card);
      cardsContainer.appendChild(cardEl);
    });
    
    meldGroup.appendChild(cardsContainer);
    meldsEl.appendChild(meldGroup);
  });
}

function renderDiscardPile() {
  const pileEl = document.querySelector('#discard-pile .cards');
  pileEl.innerHTML = '';
  
  if (gameState.discardPile?.length > 0) {
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = getCardDisplay(topCard);
    pileEl.appendChild(cardEl);
  }
}

function renderDrawPile() {
  const pileEl = document.querySelector('#draw-pile .cards');
  pileEl.innerHTML = '';
  
  if (gameState.deck?.length > 0) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-back';
    cardEl.textContent = '🂠';
    pileEl.appendChild(cardEl);
  }
}

function updateButtonStates() {
  // Discard button
  const discardBtn = document.getElementById('discard-btn');
  discardBtn.disabled = !(isMyTurn && mustDiscard && selectedCards.length === 1);
  
  // Pile interactivity
  const drawPile = document.querySelector('#draw-pile');
  const discardPile = document.querySelector('#discard-pile');
  
  if (isMyTurn && !hasDrawnCard) {
    drawPile.classList.add('clickable');
    discardPile.classList.add('clickable');
  } else {
    drawPile.classList.remove('clickable');
    discardPile.classList.remove('clickable');
  }
}

function selectCard(index) {
  if (!isMyTurn) return;
  
  // For discarding, only allow selecting one card
  if (mustDiscard) {
    selectedCards = [index];
  } 
  // For melds, allow selecting multiple cards
  else {
    const cardIndex = selectedCards.indexOf(index);
    if (cardIndex === -1) {
      selectedCards.push(index);
    } else {
      selectedCards.splice(cardIndex, 1);
    }
  }
  
  renderHand();
  updateButtonStates();
}

async function handleDraw() {
  if (!isMyTurn || hasDrawnCard || gameState.currentPhase !== "draw") return;
  
  try {
    const deck = [...gameState.deck];
    if (deck.length === 0) {
      alert("No cards left to draw!");
      return;
    }
    
    const drawnCard = deck.pop();
    const newHand = [...currentPlayerHand, drawnCard];
    
    await database.ref('games/' + gameId).update({
      deck: deck,
      [`players/${playerId}/hand`]: newHand,
      currentPhase: "discard"
    });
    
    hasDrawnCard = true;
    mustDiscard = true;
    
  } catch (error) {
    console.error("Error drawing card:", error);
    alert("Failed to draw card");
  }
}

async function handlePickupDiscard() {
  if (!isMyTurn || hasDrawnCard || gameState.currentPhase !== "draw" || !gameState.discardPile?.length) return;
  
  try {
    const discardPile = [...gameState.discardPile];
    const pickedCard = discardPile.pop();
    const newHand = [...currentPlayerHand, pickedCard];
    
    await database.ref('games/' + gameId).update({
      discardPile: discardPile,
      [`players/${playerId}/hand`]: newHand,
      currentPhase: "discard"
    });
    
    hasDrawnCard = true;
    mustDiscard = true;
    
  } catch (error) {
    console.error("Error picking from discard:", error);
    alert("Failed to pick up card");
  }
}

async function discardCard() {
  if (!isMyTurn || !mustDiscard || selectedCards.length !== 1) return;
  
  try {
    const discardIndex = selectedCards[0];
    const cardToDiscard = currentPlayerHand[discardIndex];
    const newHand = currentPlayerHand.filter((_, i) => i !== discardIndex);
    
    const updates = {
      [`players/${playerId}/hand`]: newHand,
      discardPile: [...gameState.discardPile, cardToDiscard],
      currentPhase: "draw",
      currentPlayer: getNextPlayerId()
    };
    
    await database.ref('games/' + gameId).update(updates);
    
    // Reset selection
    selectedCards = [];
    hasDrawnCard = false;
    mustDiscard = false;
    
  } catch (error) {
    console.error("Error discarding card:", error);
    alert("Failed to discard card");
  }
}

function getNextPlayerId() {
  const playerIds = Object.keys(gameState.players);
  const currentIndex = playerIds.indexOf(gameState.currentPlayer);
  return playerIds[(currentIndex + 1) % playerIds.length];
}

async function confirmMeld() {
  if (!isMyTurn || selectedCards.length < 3) return;
  
  try {
    const selectedCardsData = selectedCards.map(i => currentPlayerHand[i]);
    
    if (!validateMeld(selectedCardsData, gameState.contract)) {
      alert("This doesn't satisfy the current contract!");
      return;
    }
    
    const newHand = currentPlayerHand.filter((_, i) => !selectedCards.includes(i));
    const newMelds = [...(gameState.players[playerId]?.melds || []), selectedCardsData];
    
    await database.ref('games/' + gameId).update({
      [`players/${playerId}/hand`]: newHand,
      [`players/${playerId}/melds`]: newMelds
    });
    
    selectedCards = [];
    
  } catch (error) {
    console.error("Error confirming meld:", error);
    alert("Failed to create meld");
  }
}

function cancelMeld() {
  selectedCards = [];
  renderHand();
}

function validateMeld(cards, contract) {
  // ... (same validation logic as before) ...
}

function getContractForRound(round) {
  const contracts = [
    "2 Trios",
    "1 Trio + 1 Sequence of 4",
    "2 Sequences of 4",
    "3 Trios",
    "2 Trios + 1 Sequence of 4",
    "2 Sequences of 4 + 1 Trio",
    "3 Sequences of 4"
  ];
  return contracts[round - 1] || "Unknown Contract";
}