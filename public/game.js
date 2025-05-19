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
let gameId;
let playerId = "player_" + Math.random().toString(36).substring(2, 9);
let currentPlayerHand = [];
let selectedCards = [];
let gameState = {};
let isMyTurn = false;

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

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');
  
  try {
    // Initialize Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully');
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Test Firebase connection
    testFirebaseConnection();
    
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Game failed to initialize. Please check console for details.');
  }
});

function setupEventListeners() {
  // Start game button
  startGameBtn.addEventListener('click', async () => {
    console.log('Start game button clicked');
    startGameBtn.disabled = true;
    await startNewGame();
    startGameBtn.disabled = false;
  });
  
  // Join game button
  joinGameBtn.addEventListener('click', async () => {
    console.log('Join game button clicked');
    joinGameBtn.disabled = true;
    await joinExistingGame();
    joinGameBtn.disabled = false;
  });
  
  // Game ID input
  gameIdInput.addEventListener('input', () => {
    joinGameBtn.disabled = gameIdInput.value.trim() === '';
  });
  
  // Meld controls
  confirmMeldBtn.addEventListener('click', confirmMeld);
  cancelMeldBtn.addEventListener('click', cancelMeld);
}

async function startNewGame() {
  console.log('Starting new game...');
  
  try {
    // Generate game ID
    gameId = "game_" + Math.random().toString(36).substring(2, 9);
    gameIdInput.value = gameId;
    console.log('Generated game ID:', gameId);
    
    // Create and shuffle deck
    const deck = shuffleDeck(createDeck());
    console.log('Deck created and shuffled');
    
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
    console.log('Writing game data to Firebase...');
    await database.ref('games/' + gameId).set(gameData);
    console.log('Game created successfully!');
    
    // Set up listeners and render
    setupGameListeners();
    renderGame();
    
    alert(`Game started! Share this ID: ${gameId}`);
    
  } catch (error) {
    console.error('Error starting new game:', error);
    alert('Failed to start new game. See console for details.');
  }
}

async function joinExistingGame() {
  const joinGameId = gameIdInput.value.trim();
  console.log('Attempting to join game:', joinGameId);
  
  if (!joinGameId) {
    alert('Please enter a game ID');
    return;
  }
  
  try {
    // Check if game exists
    const snapshot = await database.ref('games/' + joinGameId).once('value');
    if (!snapshot.exists()) {
      alert('Game not found. Please check the ID.');
      return;
    }
    
    gameId = joinGameId;
    gameState = snapshot.val();
    console.log('Successfully joined game:', gameId);
    
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
    
    // Set up listeners and render
    setupGameListeners();
    renderGame();
    
    alert(`Joined game ${gameId} successfully!`);
    
  } catch (error) {
    console.error('Error joining game:', error);
    alert('Failed to join game. See console for details.');
  }
}

function setupGameListeners() {
  console.log('Setting up game listeners for game:', gameId);
  
  // Listen for game state changes
  database.ref('games/' + gameId).on('value', (snapshot) => {
    gameState = snapshot.val() || {};
    console.log('Game state updated:', gameState);
    
    // Update local hand reference
    if (gameState.players && gameState.players[playerId]) {
      currentPlayerHand = gameState.players[playerId].hand;
    }
    
    // Update turn status
    isMyTurn = gameState.currentPlayer === playerId;
    
    renderGame();
  });
}

function renderGame() {
  if (!gameState) return;
  
  console.log('Rendering game state...');
  
  // Update game info
  roundEl.textContent = gameState.currentRound || 1;
  contractEl.textContent = gameState.contract || "2 Trios";
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
  console.log('Rendering hand with', currentPlayerHand.length, 'cards');
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
  playerMeldsEl.innerHTML = '';
  const melds = gameState.players?.[playerId]?.melds || [];
  console.log('Rendering', melds.length, 'melds');
  
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
  discardPileEl.innerHTML = '';
  const discardPile = gameState.discardPile || [];
  console.log('Rendering discard pile with', discardPile.length, 'cards');
  
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
  drawPileEl.innerHTML = '';
  const deck = gameState.deck || [];
  console.log('Rendering draw pile with', deck.length, 'cards remaining');
  
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
  if (!isMyTurn) return;
  
  try {
    const selectedCardsData = selectedCards.map(index => currentPlayerHand[index]);
    
    // Validate meld
    if (!validateMeld(selectedCardsData, gameState.contract)) {
      alert("This combination doesn't satisfy the current contract!");
      return;
    }
    
    // Prepare updates
    const updates = {};
    
    // Remove cards from hand
    const newHand = currentPlayerHand.filter((_, i) => !selectedCards.includes(i));
    updates[`games/${gameId}/players/${playerId}/hand`] = newHand;
    
    // Add to melds
    const newMelds = [...(gameState.players[playerId]?.melds || []), selectedCardsData];
    updates[`games/${gameId}/players/${playerId}/melds`] = newMelds;
    
    // Switch turns
    updates[`games/${gameId}/currentPlayer`] = 
      Object.keys(gameState.players).find(id => id !== playerId) || "player_2";
    
    // Update Firebase
    await database.ref().update(updates);
    console.log('Meld confirmed successfully');
    
    // Reset selection
    selectedCards = [];
    hideMeldControls();
    
  } catch (error) {
    console.error('Error confirming meld:', error);
    alert('Failed to create meld. See console for details.');
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
      currentPlayer: Object.keys(gameState.players).find(id => id !== playerId) || "player_2"
    });
    
    console.log('Drew a card successfully');
    
  } catch (error) {
    console.error('Error drawing card:', error);
    alert('Failed to draw card. See console for details.');
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
      currentPlayer: Object.keys(gameState.players).find(id => id !== playerId) || "player_2"
    });
    
    console.log('Picked up from discard successfully');
    
  } catch (error) {
    console.error('Error picking up from discard:', error);
    alert('Failed to pick up card. See console for details.');
  }
}

function testFirebaseConnection() {
  const connectedRef = database.ref('.info/connected');
  connectedRef.on('value', (snap) => {
    if (snap.val() === true) {
      console.log('Connected to Firebase');
    } else {
      console.log('Not connected to Firebase');
    }
  });
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