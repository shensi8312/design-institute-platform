/**
 * Simple Tarot Engine
 * A simpler version without complex template strings
 */

const simpleTarotEngineDefinition = {
    metadata: {
        id: 'simple-tarot-v1',
        name: 'Simple Tarot Engine',
        version: '1.0.0',
        domain: 'divination',
        author: 'AI',
        description: 'Simple tarot reading engine for demonstration',
        icon: '🎴',
        tags: ['tarot', 'divination', 'demo']
    },
    
    schema: {
        inputs: {
            question: {
                type: 'string',
                required: true,
                description: 'Your question',
                example: 'What about my career?'
            },
            spread: {
                type: 'string',
                required: false,
                description: 'Card spread type',
                default: 'three-card'
            }
        },
        outputs: {
            cards: {
                type: 'array',
                description: 'Cards drawn'
            },
            interpretation: {
                type: 'string',
                description: 'Reading interpretation'
            },
            advice: {
                type: 'string',
                description: 'Advice'
            }
        }
    },
    
    config: {
        timeout: 5000,
        cache: false
    }
};

// Simple processing function
const tarotProcess = async (input) => {
    const majorArcana = [
        { name: 'The Fool', meaning: 'New beginnings' },
        { name: 'The Magician', meaning: 'Manifestation' },
        { name: 'The High Priestess', meaning: 'Intuition' },
        { name: 'The Empress', meaning: 'Abundance' },
        { name: 'The Emperor', meaning: 'Authority' },
        { name: 'The Lovers', meaning: 'Relationships' },
        { name: 'The Chariot', meaning: 'Victory' },
        { name: 'Strength', meaning: 'Inner strength' },
        { name: 'The Hermit', meaning: 'Soul searching' },
        { name: 'Wheel of Fortune', meaning: 'Change' },
        { name: 'Justice', meaning: 'Balance' },
        { name: 'The World', meaning: 'Completion' }
    ];
    
    // Shuffle and draw cards
    const shuffled = [...majorArcana].sort(() => Math.random() - 0.5);
    const drawnCards = [];
    
    const positions = ['Past', 'Present', 'Future'];
    for (let i = 0; i < 3; i++) {
        drawnCards.push({
            position: positions[i],
            card: shuffled[i].name,
            meaning: shuffled[i].meaning
        });
    }
    
    // Generate interpretation
    const interpretation = `Based on your question about "${input.question}", 
        the cards reveal: ${drawnCards[0].card} in the past shows ${drawnCards[0].meaning}, 
        ${drawnCards[1].card} in the present indicates ${drawnCards[1].meaning}, 
        and ${drawnCards[2].card} in the future suggests ${drawnCards[2].meaning}.`;
    
    const advice = 'Trust your intuition and remain open to the universe\'s guidance.';
    
    return {
        cards: drawnCards,
        interpretation: interpretation,
        advice: advice
    };
};

module.exports = {
    simpleTarotEngineDefinition,
    tarotProcess,
    
    // Register function
    registerSimpleTarotEngine: async (engineCore) => {
        // Add the process function as a string
        const engineDef = {
            ...simpleTarotEngineDefinition,
            processFunction: tarotProcess
        };
        return await engineCore.registerEngine(engineDef);
    }
};