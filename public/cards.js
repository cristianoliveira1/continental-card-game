// Generate a deck (2 decks + 2 jokers)
function createDeck() {
    const suits = ['♥', '♦', '♣', '♠'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    let deck = [];
    
    // Add 2 standard decks
    for (let i = 0; i < 2; i++) {
      for (let suit of suits) {
        for (let rank of ranks) {
          deck.push(`${rank}${suit}`);
        }
      }
    }
    
    // Add jokers
    deck.push('🃏', '🃏');
    return deck;
  }
  
  // Shuffle deck (Fisher-Yates algorithm)
  function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }