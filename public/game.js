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

    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Game failed to initialize. Please check console for details.");
  }
});

function setupEventListeners() {
  // Safe element checking
  const getElement = (id) => {
    const el = document.getElementById(id);
    if (!el) console.warn(`Element with ID '${id}' not found`);
    return el;
  };

  // Start game button
  const startGameBtn = getElement('start-game');
  if (startGameBtn) {
    startGameBtn.addEventListener('click', function() {
      startNewGame().catch(error => {
        console.error("Game start failed:", error);
        alert("Failed to start game. See console for details.");
      });
    });
  }

  // Join game button
  const joinGameBtn = getElement('join-game');
  if (joinGameBtn) {
    joinGameBtn.addEventListener('click', function() {
      joinExistingGame().catch(error => {
        console.error("Join game failed:", error);
        alert("Failed to join game. See console for details.");
      });
    });
  }

  // Game ID input
  const gameIdInput = getElement('game-id-input');
  if (gameIdInput && joinGameBtn) {
    gameIdInput.addEventListener('input', function() {
      joinGameBtn.disabled = this.value.trim() === '';
    });
  }

  // Draw pile
  const drawPile = document.querySelector('#draw-pile .cards');
  if (drawPile) {
    drawPile.addEventListener('click', handleDraw);
  }

  // Discard pile
  const discardPile = document.querySelector('#discard-pile .cards');
  if (discardPile) {
    discardPile.addEventListener('click', handlePickupDiscard);
  }

  // Discard button
  const discardBtn = getElement('discard-btn');
  if (discardBtn) {
    discardBtn.addEventListener('click', discardCard);
  } else {
    console.warn("Discard button not found - creating fallback");
    createFallbackDiscardButton();
  }

  // Meld controls
  const confirmMeldBtn = getElement('confirm-meld');
  if (confirmMeldBtn) {
    confirmMeldBtn.addEventListener('click', confirmMeld);
  }

  const cancelMeldBtn = getElement('cancel-meld');
  if (cancelMeldBtn) {
    cancelMeldBtn.addEventListener('click', cancelMeld);
  }
}

function createFallbackDiscardButton() {
  const discardBtn = document.createElement('button');
  discardBtn.id = 'discard-btn';
  discardBtn.className = 'btn-discard';
  discardBtn.textContent = 'Discard Selected';
  discardBtn.disabled = true;
  
  const controlsDiv = document.getElementById('game-controls') || document.body;
  controlsDiv.appendChild(discardBtn);
  
  discardBtn.addEventListener('click', discardCard);
  console.log("Created fallback discard button");
}

function validateGameState(state) {
  if (!state) return false;
  return (
    Array.isArray(state.deck) &&
    (Array.isArray(state.discardPile) || state.discardPile === undefined) &&
    typeof state.players === 'object' &&
    typeof state.currentPlayer === 'string' &&
    typeof state.currentPhase === 'string'
  );
}

async function startNewGame() {
  const startGameBtn = document.getElementById('start-game');
  if (!startGameBtn) return;
  
  startGameBtn.disabled = true;
  
  try {
    // Generate game ID
    gameId = "game_" + Math.random().toString(36).substring(2, 9);
    const gameIdInput = document.getElementById('game-id-input');
    if (gameIdInput) gameIdInput.value = gameId;
    
    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());
    
    // Deal initial hands (2 players)
    const player1Hand = deck.splice(0, 10);
    const player2Hand = deck.splice(0, 10);
    currentPlayerHand = player1Hand;
    
    // Start discard pile with one card
    const initialDiscard = deck.pop();
    
    // Create game data with guaranteed array for discardPile
    const gameData = {
      deck: deck,
      discardPile: initialDiscard ? [initialDiscard] : [],
      currentRound: 1,
      currentPlayer: playerId,
      currentPhase: "draw",
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
    alert("Failed to start game. See console for details.");
  } finally {
    startGameBtn.disabled = false;
  }
}

async function joinExistingGame() {
  const joinGameBtn = document.getElementById('join-game');
  if (!joinGameBtn) return;
  
  joinGameBtn.disabled = true;
  
  try {
    const gameIdInput = document.getElementById('game-id-input');
    if (!gameIdInput) throw new Error("Game ID input not found");
    
    gameId = gameIdInput.value.trim();
    if (!gameId) throw new Error("Please enter game ID");
    
    // Check if game exists
    const snapshot = await database.ref('games/' + gameId).once('value');
    if (!snapshot.exists()) throw new Error("Game not found");
    
    gameState = snapshot.val();
    
    // Validate game state
    if (!validateGameState(gameState)) {
      throw new Error("Invalid game state found");
    }
    
    // Initialize discardPile if missing
    if (!Array.isArray(gameState.discardPile)) {
      gameState.discardPile = [];
    }
    
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
  if (!gameId) return;
  
  database.ref('games/' + gameId).on('value', function(snapshot) {
    const newState = snapshot.val();
    
    if (!validateGameState(newState)) {
      console.error("Invalid game state received:", newState);
      return;
    }
    
    gameState = newState;
    
    // Initialize discardPile if missing
    if (!Array.isArray(gameState.discardPile)) {
      gameState.discardPile = [];
    }
    
    // Update player hand
    if (gameState.players && gameState.players[playerId]) {
      currentPlayerHand = gameState.players[playerId].hand || [];
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
  const roundEl = document.getElementById('round');
  if (roundEl) roundEl.textContent = gameState.currentRound || 1;
  
  const contractEl = document.getElementById('contract');
  if (contractEl) contractEl.textContent = gameState.contract || "2 Trios";
  
  // Update turn indicator
  const turnEl = document.getElementById('current-turn');
  if (turnEl) {
    turnEl.textContent = isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN";
    turnEl.className = isMyTurn ? "your-turn" : "opponent-turn";
  }
  
  // Update phase indicator
  const phaseEl = document.getElementById('current-phase');
  if (phaseEl) {
    if (isMyTurn) {
      phaseEl.textContent = mustDiscard ? "DISCARD A CARD" : "DRAW A CARD";
      phaseEl.className = mustDiscard ? "discard-phase" : "draw-phase";
    } else {
      phaseEl.textContent = "WAITING...";
      phaseEl.className = "wait-phase";
    }
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
  if (!handEl) return;
  
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
  if (!meldsEl) return;
  
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
  if (!pileEl) return;
  
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
  if (!pileEl) return;
  
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
  if (discardBtn) {
    discardBtn.disabled = !(isMyTurn && mustDiscard && selectedCards.length === 1);
  }
  
  // Pile interactivity
  const drawPile = document.querySelector('#draw-pile');
  const discardPile = document.querySelector('#discard-pile');
  
  if (drawPile) {
    drawPile.style.cursor = isMyTurn && !hasDrawnCard ? "pointer" : "default";
    drawPile.style.opacity = isMyTurn && !hasDrawnCard ? "1" : "0.7";
  }
  
  if (discardPile) {
    discardPile.style.cursor = isMyTurn && !hasDrawnCard ? "pointer" : "default";
    discardPile.style.opacity = isMyTurn && !hasDrawnCard ? "1" : "0.7";
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
    // Use transaction to prevent race conditions
    await database.ref('games/' + gameId).transaction((currentData) => {
      if (!currentData) return null;
      
      // Verify game state is still valid for drawing
      if (currentData.currentPlayer !== playerId || 
          currentData.currentPhase !== "draw" ||
          !Array.isArray(currentData.deck) ||
          currentData.deck.length === 0) {
        return currentData;
      }
      
      // Perform draw
      const newDeck = [...currentData.deck];
      const drawnCard = newDeck.pop();
      
      currentData.deck = newDeck;
      currentData.players[playerId].hand = [...currentData.players[playerId].hand, drawnCard];
      currentData.currentPhase = "discard";
      
      return currentData;
    });
    
  } catch (error) {
    console.error("Error drawing card:", error);
    alert("Failed to draw card. Please try again.");
  }
}

async function handlePickupDiscard() {
  if (!isMyTurn || hasDrawnCard || gameState.currentPhase !== "draw") return;
  
  try {
    // Use transaction for discard pickup
    await database.ref('games/' + gameId).transaction((currentData) => {
      if (!currentData) return null;
      
      // Verify valid state
      if (currentData.currentPlayer !== playerId || 
          currentData.currentPhase !== "draw" ||
          !Array.isArray(currentData.discardPile) ||
          currentData.discardPile.length === 0) {
        return currentData;
      }
      
      // Perform pickup
      const newDiscardPile = [...currentData.discardPile];
      const pickedCard = newDiscardPile.pop();
      
      currentData.discardPile = newDiscardPile;
      currentData.players[playerId].hand = [...currentData.players[playerId].hand, pickedCard];
      currentData.currentPhase = "discard";
      
      return currentData;
    });
    
  } catch (error) {
    console.error("Error picking from discard:", error);
    alert("Failed to pick up card. Please try again.");
  }
}

async function discardCard() {
  if (!isMyTurn || !mustDiscard || selectedCards.length !== 1) return;
  
  try {
    const discardIndex = selectedCards[0];
    const cardToDiscard = currentPlayerHand[discardIndex];
    const newHand = currentPlayerHand.filter((_, i) => i !== discardIndex);
    
    // Use transaction for atomic turn change
    await database.ref('games/' + gameId).transaction((currentData) => {
      if (!currentData) return null;
      
      // Verify it's still our turn and we have valid data
      if (currentData.currentPlayer !== playerId || 
          currentData.currentPhase !== "discard" ||
          !currentData.players?.[playerId]?.hand) {
        return currentData;
      }
      
      // Initialize discardPile if it doesn't exist
      if (!Array.isArray(currentData.discardPile)) {
        currentData.discardPile = [];
      }
      
      // Update game state
      currentData.players[playerId].hand = newHand;
      currentData.discardPile = [...currentData.discardPile, cardToDiscard];
      currentData.currentPhase = "draw";
      currentData.currentPlayer = getNextPlayerId(currentData);
      
      return currentData;
    });
    
    // Reset UI state
    selectedCards = [];
    
  } catch (error) {
    console.error("Error discarding card:", error);
    alert("Failed to discard card. Please try again.");
  }
}

function getNextPlayerId(gameState = null) {
  const state = gameState || window.gameState;
  const playerIds = Object.keys(state.players);
  const currentIndex = playerIds.indexOf(state.currentPlayer);
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

// Deck utilities
function createDeck() {
  const suits = ['H', 'D', 'C', 'S'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  
  for (let suit of suits) {
    for (let value of values) {
      deck.push(value + suit);
    }
  }
  
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function getCardDisplay(card) {
  if (!card) return '';
  const suit = card.slice(-1);
  const value = card.slice(0, -1);
  
  const suitSymbols = {
    'H': '♥',
    'D': '♦',
    'C': '♣',
    'S': '♠'
  };
  
  return value + suitSymbols[suit];
}

function isTrio(cards) {
  if (cards.length < 3) return false;
  const values = cards.map(card => card.slice(0, -1));
  return new Set(values).size === 1;
}

function isSequence(cards) {
  if (cards.length < 3) return false;
  
  const valueOrder = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const suits = cards.map(card => card.slice(-1));
  const values = cards.map(card => card.slice(0, -1));
  
  // All cards must be same suit
  if (new Set(suits).size !== 1) return false;
  
  // Get numerical indices of values
  const indices = values.map(val => valueOrder.indexOf(val)).sort((a, b) => a - b);
  
  // Check for consecutive values
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i-1] + 1) {
      return false;
    }
  }
  
  return true;
}