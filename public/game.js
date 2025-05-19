import { createDeck, shuffleDeck, getCardDisplay, isTrio, isSequence } from './cards.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Game state
let gameId;
let playerId = "player_" + Math.random().toString(36).substring(2, 9);
let currentPlayerHand = [];
let selectedCards = [];
let gameState = {};

// DOM elements
const startGameBtn = document.getElementById('start-game');
const joinGameBtn = document.getElementById('join-game');
const gameIdInput = document.getElementById('game-id-input');
const playerHandEl = document.getElementById('player-hand');
const playerMeldsEl = document.getElementById('player-melds');
const discardPileEl = document.querySelector('#discard-pile .cards');
const drawPileEl = document.querySelector('#draw-pile .cards');
const roundEl = document.getElementById('round');
const contractEl = document.getElementById('contract');
const currentTurnEl = document.getElementById('current-turn');
const meldControlsEl = document.getElementById('meld-controls');
const selectedCardsEl = document.getElementById('selected-cards');
const confirmMeldBtn = document.getElementById('confirm-meld');
const cancelMeldBtn = document.getElementById('cancel-meld');

// Initialize game
initGame();

function initGame() {
  // Event listeners
  startGameBtn.addEventListener('click', startNewGame);
  joinGameBtn.addEventListener('click', joinExistingGame);
  gameIdInput.addEventListener('input', toggleJoinButton);
  confirmMeldBtn.addEventListener('click', confirmMeld);
  cancelMeldBtn.addEventListener('click', cancelMeld);
  
  // Enable join button if game ID is entered
  function toggleJoinButton() {
    joinGameBtn.disabled = gameIdInput.value.trim() === '';
  }
}

async function startNewGame() {
  try {
    // Create new game ID
    gameId = "game_" + Math.random().toString(36).substring(2, 9);
    gameIdInput.value = gameId;
    
    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());
    
    // Deal initial hands (2 players for demo)
    const player1Hand = deck.splice(0, 10);
    const player2Hand = deck.splice(0, 10);
    currentPlayerHand = player1Hand;
    
    // Set initial game state
    const initialGameState = {
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
      }
    };
    
    // Write to Firebase
    await database.ref('games/' + gameId).set(initialGameState);
    console.log("New game started with ID:", gameId);
    
    // Set up real-time listeners
    setupGameListeners();
    renderGame();
    
  } catch (error) {
    console.error("Error starting new game:", error);
    alert("Failed to start new game. Please check console for details.");
  }
}

async function joinExistingGame() {
  try {
    gameId = gameIdInput.value.trim();
    if (!gameId) {
      alert("Please enter a valid game ID");
      return;
    }
    
    // Check if game exists
    const snapshot = await database.ref('games/' + gameId).once('value');
    if (!snapshot.exists()) {
      alert("Game not found. Please check the ID and try again.");
      return;
    }
    
    const gameData = snapshot.val();
    
    // Add player to game if not already present
    if (!gameData.players[playerId]) {
      const deck = gameData.deck;
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
      currentPlayerHand = gameData.players[playerId].hand;
    }
    
    console.log("Joined game:", gameId);
    setupGameListeners();
    renderGame();
    
  } catch (error) {
    console.error("Error joining game:", error);
    alert("Failed to join game. Please check console for details.");
  }
}

function setupGameListeners() {
  // Listen for game state changes
  database.ref('games/' + gameId).on('value', (snapshot) => {
    gameState = snapshot.val() || {};
    console.log("Game state updated:", gameState);
    renderGame();
  });
}

function renderGame() {
  if (!gameState) return;
  
  // Update game info
  roundEl.textContent = gameState.currentRound;
  contractEl.textContent = gameState.contract;
  currentTurnEl.textContent = gameState.currentPlayer === playerId ? "You" : "Opponent";
  
  // Render player's hand
  renderHand();
  
  // Render melds
  renderMelds();
  
  // Render discard pile
  renderDiscardPile();
  
  // Render draw pile (show only top card or back)
  renderDrawPile();
}

function renderHand() {
  playerHandEl.innerHTML = '';
  currentPlayerHand = gameState.players[playerId]?.hand || [];
  
  currentPlayerHand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = getCardDisplay(card);
    cardEl.dataset.index = index;
    
    // Highlight if selected
    if (selectedCards.includes(index)) {
      cardEl.classList.add('selected');
    }
    
    // Add click handler
    cardEl.addEventListener('click', () => selectCard(index));
    
    playerHandEl.appendChild(cardEl);
  });
}

function renderMelds() {
  playerMeldsEl.innerHTML = '';
  const melds = gameState.players[playerId]?.melds || [];
  
  melds.forEach((meld, meldIndex) => {
    const meldEl = document.createElement('div');
    meldEl.className = 'meld';
    
    meld.forEach((card, cardIndex) => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.textContent = getCardDisplay(card);
      meldEl.appendChild(cardEl);
    });
    
    playerMeldsEl.appendChild(meldEl);
  });
}

function renderDiscardPile() {
  discardPileEl.innerHTML = '';
  const discardPile = gameState.discardPile || [];
  
  if (discardPile.length > 0) {
    const topCard = discardPile[discardPile.length - 1];
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = getCardDisplay(topCard);
    
    // Allow picking up from discard if it's player's turn
    if (gameState.currentPlayer === playerId) {
      cardEl.addEventListener('click', pickupFromDiscard);
    }
    
    discardPileEl.appendChild(cardEl);
  }
}

function renderDrawPile() {
  drawPileEl.innerHTML = '';
  const deck = gameState.deck || [];
  
  if (deck.length > 0) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = '🂠'; // Card back symbol
    
    // Allow drawing if it's player's turn
    if (gameState.currentPlayer === playerId) {
      cardEl.addEventListener('click', drawCard);
    }
    
    drawPileEl.appendChild(cardEl);
  }
}

function selectCard(index) {
  // Toggle selection
  const selectedIndex = selectedCards.indexOf(index);
  if (selectedIndex === -1) {
    selectedCards.push(index);
  } else {
    selectedCards.splice(selectedIndex, 1);
  }
  
  // Update UI
  renderHand();
  
  // Show meld controls if 3+ cards selected
  if (selectedCards.length >= 3) {
    showMeldControls();
  } else {
    hideMeldControls();
  }
}

function showMeldControls() {
  selectedCardsEl.innerHTML = '';
  
  selectedCards.forEach(index => {
    const card = currentPlayerHand[index];
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = getCardDisplay(card);
    selectedCardsEl.appendChild(cardEl);
  });
  
  meldControlsEl.classList.remove('hidden');
}

function hideMeldControls() {
  meldControlsEl.classList.add('hidden');
}

async function confirmMeld() {
  try {
    const selectedCardsData = selectedCards.map(index => currentPlayerHand[index]);
    
    // Validate meld against current contract
    const isValidMeld = validateMeld(selectedCardsData, gameState.contract);
    if (!isValidMeld) {
      alert("This doesn't satisfy the current contract!");
      return;
    }
    
    // Update game state
    const updates = {};
    
    // Remove cards from hand
    const newHand = currentPlayerHand.filter((_, index) => !selectedCards.includes(index));
    updates[`games/${gameId}/players/${playerId}/hand`] = newHand;
    
    // Add to melds
    const newMelds = [...(gameState.players[playerId]?.melds || []), selectedCardsData];
    updates[`games/${gameId}/players/${playerId}/melds`] = newMelds;
    
    // Switch turns
    updates[`games/${gameId}/currentPlayer`] = "player_2";
    
    await database.ref().update(updates);
    
    // Reset selection
    selectedCards = [];
    hideMeldControls();
    
  } catch (error) {
    console.error("Error confirming meld:", error);
    alert("Failed to create meld. Please check console for details.");
  }
}

function cancelMeld() {
  selectedCards = [];
  hideMeldControls();
  renderHand();
}

async function drawCard() {
  if (gameState.currentPlayer !== playerId) {
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
      currentPlayer: "player_2" // Switch turns after drawing
    });
    
  } catch (error) {
    console.error("Error drawing card:", error);
    alert("Failed to draw card. Please check console for details.");
  }
}

async function pickupFromDiscard() {
  if (gameState.currentPlayer !== playerId) {
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
      currentPlayer: "player_2" // Switch turns after picking up
    });
    
  } catch (error) {
    console.error("Error picking up from discard:", error);
    alert("Failed to pick up card. Please check console for details.");
  }
}

function validateMeld(cards, contract) {
  switch (contract) {
    case "2 Trios":
      return isTrio(cards.slice(0, 3)) && isTrio(cards.slice(3, 6));
    case "1 Trio + 1 Sequence of 4":
      return (isTrio(cards.slice(0, 3)) && isSequence(cards.slice(3, 7))) ||
             (isSequence(cards.slice(0, 4)) && isTrio(cards.slice(4, 7)));
    // Add other contract validations
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