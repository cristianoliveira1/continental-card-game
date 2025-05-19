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

// Global game variables
let database;
let gameId;
let playerId = "player_" + Math.random().toString(36).substring(2, 9);
let currentPlayerHand = [];
let selectedCards = [];
let gameState = {};
let isMyTurn = false;

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  try {
    // Initialize Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    database = firebase.database();
    console.log("Firebase initialized successfully");

    // Setup all event listeners
    setupEventListeners();

    // Test connection
    testFirebaseConnection();

    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Game failed to initialize. Check console for details.");
  }
});

function setupEventListeners() {
  // Start game button
  document.getElementById('start-game').addEventListener('click', function() {
    console.log("Start game button clicked");
    startNewGame().catch(error => {
      console.error("Game start failed:", error);
      alert("Failed to start game. See console for details.");
    });
  });

  // Join game button
  document.getElementById('join-game').addEventListener('click', function() {
    console.log("Join game button clicked");
    joinExistingGame().catch(error => {
      console.error("Join game failed:", error);
      alert("Failed to join game. See console for details.");
    });
  });

  // Game ID input
  document.getElementById('game-id-input').addEventListener('input', function() {
    document.getElementById('join-game').disabled = this.value.trim() === '';
  });

  // Meld controls
  document.getElementById('confirm-meld').addEventListener('click', confirmMeld);
  document.getElementById('cancel-meld').addEventListener('click', cancelMeld);
}

function testFirebaseConnection() {
  const connectedRef = database.ref('.info/connected');
  connectedRef.on('value', function(snap) {
    console.log(snap.val() ? "Connected to Firebase" : "Disconnected from Firebase");
  });
}

async function startNewGame() {
  const startGameBtn = document.getElementById('start-game');
  startGameBtn.disabled = true;
  
  try {
    console.log("Starting new game process...");
    
    // Generate game ID
    gameId = "game_" + Math.random().toString(36).substring(2, 9);
    document.getElementById('game-id-input').value = gameId;
    console.log("Game ID:", gameId);
    
    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());
    console.log("Deck created and shuffled");
    
    // Deal initial hands (2 players for demo)
    const player1Hand = deck.splice(0, 10);
    const player2Hand = deck.splice(0, 10);
    currentPlayerHand = player1Hand;
    
    // Create game data structure
    const gameData = {
      deck: deck,
      discardPile: [],
      currentRound: 1,
      currentPlayer: playerId,
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
    
    // Write to Firebase
    console.log("Writing to database...");
    await database.ref('games/' + gameId).set(gameData);
    console.log("Game data written successfully");
    
    // Set up real-time listeners
    setupGameListeners();
    
    // Initial render
    renderGame();
    
    alert("Game started successfully!\nShare this ID: " + gameId);
    
  } catch (error) {
    console.error("Error in startNewGame:", error);
    throw error; // Re-throw for caller to handle
  } finally {
    startGameBtn.disabled = false;
  }
}

async function joinExistingGame() {
  const joinGameBtn = document.getElementById('join-game');
  joinGameBtn.disabled = true;
  
  try {
    gameId = document.getElementById('game-id-input').value.trim();
    if (!gameId) {
      throw new Error("Please enter a game ID");
    }
    
    console.log("Attempting to join game:", gameId);
    
    // Check if game exists
    const snapshot = await database.ref('games/' + gameId).once('value');
    if (!snapshot.exists()) {
      throw new Error("Game not found. Please check the ID.");
    }
    
    gameState = snapshot.val();
    console.log("Game found:", gameState);
    
    // Add player if not already in game
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
    
    console.log("Player added to game successfully");
    
    // Set up real-time listeners
    setupGameListeners();
    
    // Initial render
    renderGame();
    
    alert("Successfully joined game: " + gameId);
    
  } catch (error) {
    console.error("Error in joinExistingGame:", error);
    throw error; // Re-throw for caller to handle
  } finally {
    joinGameBtn.disabled = false;
  }
}

function setupGameListeners() {
  console.log("Setting up game listeners for:", gameId);
  
  database.ref('games/' + gameId).on('value', function(snapshot) {
    gameState = snapshot.val() || {};
    console.log("Game state updated:", gameState);
    
    // Update local references
    if (gameState.players && gameState.players[playerId]) {
      currentPlayerHand = gameState.players[playerId].hand;
    }
    
    // Update turn status
    isMyTurn = gameState.currentPlayer === playerId;
    
    // Re-render the game
    renderGame();
  });
}

function renderGame() {
  if (!gameState) {
    console.warn("No game state to render");
    return;
  }
  
  console.log("Rendering game state...");
  
  // Update game info
  document.getElementById('round').textContent = gameState.currentRound || 1;
  document.getElementById('contract').textContent = gameState.contract || "2 Trios";
  
  const currentTurnEl = document.getElementById('current-turn');
  currentTurnEl.textContent = isMyTurn ? "Your turn" : "Opponent's turn";
  currentTurnEl.style.color = isMyTurn ? "green" : "red";
  
  // Render player's hand
  renderHand();
  
  // Render melds
  renderMelds();
  
  // Render discard pile
  renderDiscardPile();
  
  // Render draw pile
  renderDrawPile();
}

function renderHand() {
  const playerHandEl = document.getElementById('player-hand');
  playerHandEl.innerHTML = '';
  
  currentPlayerHand.forEach(function(card, index) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = getCardDisplay(card);
    cardEl.dataset.index = index;
    
    if (selectedCards.includes(index)) {
      cardEl.classList.add('selected');
    }
    
    if (isMyTurn) {
      cardEl.addEventListener('click', function() {
        selectCard(index);
      });
    }
    
    playerHandEl.appendChild(cardEl);
  });
}

function renderMelds() {
  const playerMeldsEl = document.getElementById('player-melds');
  playerMeldsEl.innerHTML = '';
  const melds = gameState.players?.[playerId]?.melds || [];
  
  melds.forEach(function(meld, i) {
    const meldEl = document.createElement('div');
    meldEl.className = 'meld';
    meldEl.innerHTML = `<h4>Meld ${i + 1}</h4><div class="meld-cards"></div>`;
    
    const cardsContainer = meldEl.querySelector('.meld-cards');
    meld.forEach(function(card) {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.textContent = getCardDisplay(card);
      cardsContainer.appendChild(cardEl);
    });
    
    playerMeldsEl.appendChild(meldEl);
  });
}

function renderDiscardPile() {
  const discardPileEl = document.querySelector('#discard-pile .cards');
  discardPileEl.innerHTML = '';
  const discardPile = gameState.discardPile || [];
  
  if (discardPile.length > 0) {
    const topCard = discardPile[discardPile.length - 1];
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = getCardDisplay(topCard);
    
    if (isMyTurn) {
      cardEl.addEventListener('click', pickupFromDiscard);
    }
    
    discardPileEl.appendChild(cardEl);
  }
}

function renderDrawPile() {
  const drawPileEl = document.querySelector('#draw-pile .cards');
  drawPileEl.innerHTML = '';
  const deck = gameState.deck || [];
  
  if (deck.length > 0) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = '🂠'; // Card back
    
    if (isMyTurn) {
      cardEl.addEventListener('click', drawCard);
    }
    
    drawPileEl.appendChild(cardEl);
  }
}

function selectCard(index) {
  if (!isMyTurn) return;
  
  const cardIndex = selectedCards.indexOf(index);
  if (cardIndex === -1) {
    selectedCards.push(index);
  } else {
    selectedCards.splice(cardIndex, 1);
  }
  
  renderHand();
  
  if (selectedCards.length >= 3) {
    showMeldControls();
  } else {
    hideMeldControls();
  }
}

function showMeldControls() {
  const selectedCardsEl = document.getElementById('selected-cards');
  selectedCardsEl.innerHTML = '';
  
  selectedCards.forEach(function(index) {
    const card = currentPlayerHand[index];
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = getCardDisplay(card);
    selectedCardsEl.appendChild(cardEl);
  });
  
  document.getElementById('meld-controls').classList.remove('hidden');
}

function hideMeldControls() {
  document.getElementById('meld-controls').classList.add('hidden');
}

async function confirmMeld() {
  if (!isMyTurn) return;
  
  try {
    const selectedCardsData = selectedCards.map(function(index) {
      return currentPlayerHand[index];
    });
    
    if (!validateMeld(selectedCardsData, gameState.contract)) {
      alert("This combination doesn't satisfy the current contract!");
      return;
    }
    
    const updates = {};
    
    // Remove cards from hand
    const newHand = currentPlayerHand.filter(function(_, i) {
      return !selectedCards.includes(i);
    });
    updates[`games/${gameId}/players/${playerId}/hand`] = newHand;
    
    // Add to melds
    const newMelds = [...(gameState.players[playerId]?.melds || []), selectedCardsData];
    updates[`games/${gameId}/players/${playerId}/melds`] = newMelds;
    
    // Switch turns
    updates[`games/${gameId}/currentPlayer`] = 
      Object.keys(gameState.players).find(function(id) {
        return id !== playerId;
      }) || "player_2";
    
    // Update Firebase
    await database.ref().update(updates);
    
    // Reset selection
    selectedCards = [];
    hideMeldControls();
    
    console.log("Meld confirmed successfully");
    
  } catch (error) {
    console.error("Error confirming meld:", error);
    alert("Failed to create meld. See console for details.");
  }
}

function cancelMeld() {
  selectedCards = [];
  hideMeldControls();
  renderHand();
}

async function drawCard() {
  if (!isMyTurn) {
    alert("It's not your turn!");
    return;
  }
  
  try {
    const deck = [...gameState.deck];
    if (deck.length === 0) {
      alert("No cards left in the draw pile!");
      return;
    }
    
    const drawnCard = deck.pop();
    const newHand = [...currentPlayerHand, drawnCard];
    
    await database.ref('games/' + gameId).update({
      deck: deck,
      [`players/${playerId}/hand`]: newHand,
      currentPlayer: Object.keys(gameState.players).find(function(id) {
        return id !== playerId;
      }) || "player_2"
    });
    
    console.log("Card drawn successfully");
    
  } catch (error) {
    console.error("Error drawing card:", error);
    alert("Failed to draw card. See console for details.");
  }
}

async function pickupFromDiscard() {
  if (!isMyTurn) {
    alert("It's not your turn!");
    return;
  }
  
  try {
    const discardPile = [...gameState.discardPile];
    if (discardPile.length === 0) {
      alert("No cards in discard pile!");
      return;
    }
    
    const pickedCard = discardPile.pop();
    const newHand = [...currentPlayerHand, pickedCard];
    
    await database.ref('games/' + gameId).update({
      discardPile: discardPile,
      [`players/${playerId}/hand`]: newHand,
      currentPlayer: Object.keys(gameState.players).find(function(id) {
        return id !== playerId;
      }) || "player_2"
    });
    
    console.log("Card picked from discard successfully");
    
  } catch (error) {
    console.error("Error picking from discard:", error);
    alert("Failed to pick up card. See console for details.");
  }
}

function validateMeld(cards, contract) {
  if (!cards || cards.length < 3) return false;
  
  switch (contract) {
    case "2 Trios":
      return cards.length >= 6 && 
             isTrio(cards.slice(0, 3)) && 
             isTrio(cards.slice(3, 6));
    case "1 Trio + 1 Sequence of 4":
      return (isTrio(cards.slice(0, 3)) && isSequence(cards.slice(3, 7))) ||
             (isSequence(cards.slice(0, 4)) && isTrio(cards.slice(4, 7)));
    case "2 Sequences of 4":
      return cards.length >= 8 && 
             isSequence(cards.slice(0, 4)) && 
             isSequence(cards.slice(4, 8));
    case "3 Trios":
      return cards.length >= 9 && 
             isTrio(cards.slice(0, 3)) && 
             isTrio(cards.slice(3, 6)) && 
             isTrio(cards.slice(6, 9));
    case "2 Trios + 1 Sequence of 4":
      return cards.length >= 10 &&
             isTrio(cards.slice(0, 3)) &&
             isTrio(cards.slice(3, 6)) &&
             isSequence(cards.slice(6, 10));
    case "2 Sequences of 4 + 1 Trio":
      return cards.length >= 11 &&
             isSequence(cards.slice(0, 4)) &&
             isSequence(cards.slice(4, 8)) &&
             isTrio(cards.slice(8, 11));
    case "3 Sequences of 4":
      return cards.length >= 12 &&
             isSequence(cards.slice(0, 4)) &&
             isSequence(cards.slice(4, 8)) &&
             isSequence(cards.slice(8, 12));
    default:
      return false;
  }
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