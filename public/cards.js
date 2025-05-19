// cards.js - Updated for browser compatibility
function createDeck() {
  const suits = ['♥', '♦', '♣', '♠'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  let deck = [];
  
  // Add 2 standard decks
  for (let i = 0; i < 2; i++) {
    for (let suit of suits) {
      for (let rank of ranks) {
        deck.push({ rank, suit, id: `${rank}${suit}-${i}` });
      }
    }
  }
  
  // Add jokers
  deck.push({ rank: 'JOKER', suit: '', id: 'JOKER-1' });
  deck.push({ rank: 'JOKER', suit: '', id: 'JOKER-2' });
  
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
  if (card.rank === 'JOKER') return '🃏';
  return `${card.rank}${card.suit}`;
}

function isTrio(cards) {
  if (cards.length !== 3) return false;
  const ranks = cards.map(card => card.rank);
  return new Set(ranks).size === 1;
}

function isSequence(cards) {
  if (cards.length < 3) return false;
  
  // Check all same suit
  const suit = cards[0].suit;
  if (!cards.every(card => card.suit === suit)) return false;
  
  // Get numerical values for ranks
  const rankValues = cards.map(card => {
    if (card.rank === 'A') return 1;
    if (card.rank === 'J') return 11;
    if (card.rank === 'Q') return 12;
    if (card.rank === 'K') return 13;
    return parseInt(card.rank);
  });
  
  // Check for consecutive values
  rankValues.sort((a, b) => a - b);
  for (let i = 1; i < rankValues.length; i++) {
    if (rankValues[i] !== rankValues[i - 1] + 1) {
      return false;
    }
  }
  
  return true;
}