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

// Global variables
let database;
let gameId;
let playerId = "player_" + Math.random().toString(36).substring(2, 9);
let currentPlayerHand = [];
let selectedCards = [];
let gameState = {};
let isMyTurn = false;

// Initialize Firebase and game when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Initialize Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    database = firebase.database();
    console.log("Firebase initialized successfully");

    // Get DOM elements
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

    // Set up event listeners
    startGameBtn.addEventListener('click', async () => {
      startGameBtn.disabled = true;
      await startNewGame();
      startGameBtn.disabled = false;
    });

    joinGameBtn.addEventListener('click', async () => {
      joinGameBtn.disabled = true;
      await joinExistingGame();
      joinGameBtn.disabled = false;
    });

    gameIdInput.addEventListener('input', () => {
      joinGameBtn.disabled = gameIdInput.value.trim() === '';
    });

    confirmMeldBtn.addEventListener('click', confirmMeld);
    cancelMeldBtn.addEventListener('click', cancelMeld);

    console.log("Game initialized successfully");
  } catch (error) {
    console.error("Initialization error:", error);
    alert("Game failed to initialize. Check console for details.");
  }
});

async function startNewGame() {
  try {
    // Generate game ID
    gameId = "game_" + Math.random().toString(36).substring(2, 9);
    document.getElementById('game-id-input').value = gameId;
    
    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());
    
    // Deal initial hands (2 players for demo)
    const player1Hand = deck.splice(0, 10);
    const player2Hand = deck.splice(0, 10);
    currentPlayerHand = player1Hand;
    
    // Create game data
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
    await database.ref('games/' + gameId).set(gameData);
    console.log("Game created successfully!");
    
    // Set up listeners and render
    setupGameListeners();
    renderGame();
    
    alert(`Game started! Share this ID: ${gameId}`);
  } catch (error) {
    console.error("Error starting game:", error);
    alert("Failed to start game: " + error.message);
  }
}

async function joinExistingGame() {
  try {
    gameId = document.getElementById('game-id-input').value.trim();
    if (!gameId) {
      alert("Please enter a game ID");
      return;
    }
    
    // Check if game exists
    const snapshot = await database.ref('games/' + gameId).once('value');
    if (!snapshot.exists()) {
      alert("Game not found. Please check the ID.");
      return;
    }
    
    gameState = snapshot.val();
    
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
    
    console.log("Joined game successfully!");
    setupGameListeners();
    renderGame();
  } catch (error) {
    console.error("Error joining game:", error);
    alert("Failed to join game: " + error.message);
  }
}

function setupGameListeners() {
  database.ref('games/' + gameId).on('value', (snapshot) => {
    gameState = snapshot.val() || {};
    currentPlayerHand = gameState.players?.[playerId]?.hand || [];
    isMyTurn = gameState.currentPlayer === playerId;
    renderGame();
  });
}

function renderGame() {
  if (!gameState) return;

  // Update game info
  document.getElementById('round').textContent = gameState.currentRound || 1;
  document.getElementById('contract').textContent = gameState.contract || "2 Trios";
  document.getElementById('current-turn').textContent = isMyTurn ? "Your turn" : "Opponent's turn";
  document.getElementById('current-turn').style.color = isMyTurn ? "green" : "red";

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
  
  currentPlayerHand.forEach((card, index) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.textContent = getCardDisplay(card);
    cardEl.dataset.index = index;
    
    if (selectedCards.includes(index)) {
      cardEl.classList.add('selected');
    }
    
    if (isMyTurn) {
      cardEl.addEventListener('click', () => selectCard(index));
    }
    
    playerHandEl.appendChild(cardEl);
  });
}

function renderMelds() {
  const playerMeldsEl = document.getElementById('player-melds');
  playerMeldsEl.innerHTML = '';
  const melds = gameState.players?.[playerId]?.melds || [];
  
  melds.forEach((meld, i) => {
    const meldEl = document.createElement('div');
    meldEl.className = 'meld';
    meldEl.innerHTML = `<h4>Meld ${i + 1}</h4><div class="meld-cards"></div>`;
    
    const cardsContainer = meldEl.querySelector('.meld-cards');
    meld.forEach(card => {
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
    cardEl.textContent = '🂠';
    
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
  
  selectedCards.forEach(index => {
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
    const selectedCardsData = selectedCards.map(index => currentPlayerHand[index]);
    
    if (!validateMeld(selectedCardsData, gameState.contract)) {
      alert("This doesn't satisfy the current contract!");
      return;
    }
    
    const updates = {};
    const newHand = currentPlayerHand.filter((_, i) => !selectedCards.includes(i));
    updates[`games/${gameId}/players/${playerId}/hand`] = newHand;
    
    const newMelds = [...(gameState.players[playerId]?.melds || []), selectedCardsData];
    updates[`games/${gameId}/players/${playerId}/melds`] = newMelds;
    
    updates[`games/${gameId}/currentPlayer`] = 
      Object.keys(gameState.players).find(id => id !== playerId) || "player_2";
    
    await database.ref().update(updates);
    
    selectedCards = [];
    hideMeldControls();
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
      [`players/${playerId}/hand`] : newHand,
      currentPlayer: Object.keys(gameState.players).find(id => id !== playerId) || "player_2"
    });
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
      [`players/${playerId}/hand`] : newHand,
      currentPlayer: Object.keys(gameState.players).find(id => id !== playerId) || "player_2"
    });
  } catch (error) {
    console.error("Error picking up from discard:", error);
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