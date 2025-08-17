// Debug Conversation Flow Issues
console.log('🔍 DEBUGGING CONVERSATION FLOW ISSUES\n');

// Test 1: End Keywords Detection
console.log('🧪 TEST 1: End Keywords Detection');

const testEndKeywords = (message, endKeywords) => {
    console.log(`\nTesting message: "${message}"`);
    console.log(`End keywords: "${endKeywords}"`);
    
    if (!endKeywords || !message) {
        console.log('❌ Missing endKeywords or message');
        return false;
    }
    
    const keywords = endKeywords.split(',').map(k => k.trim().toLowerCase());
    const lowerMessage = message.toLowerCase();
    
    console.log(`Parsed keywords: [${keywords.join(', ')}]`);
    console.log(`Lowercase message: "${lowerMessage}"`);
    
    const result = keywords.some(keyword => {
        const match = lowerMessage.includes(keyword);
        console.log(`  "${keyword}" in "${lowerMessage}": ${match}`);
        return match;
    });
    
    console.log(`Final result: ${result ? '✅ SHOULD END' : '❌ CONTINUE'}`);
    return result;
};

// Test various end keyword scenarios
const endKeywordTests = [
    { message: 'stop', keywords: 'stop,bye,end,quit,selesai' },
    { message: 'Stop please', keywords: 'stop,bye,end,quit,selesai' },
    { message: 'STOP', keywords: 'stop,bye,end,quit,selesai' },
    { message: 'bye bye', keywords: 'stop,bye,end,quit,selesai' },
    { message: 'selesai', keywords: 'stop,bye,end,quit,selesai' },
    { message: 'hello world', keywords: 'stop,bye,end,quit,selesai' },
    { message: 'I want to stop', keywords: 'stop,bye,end,quit,selesai' }
];

endKeywordTests.forEach((test, index) => {
    console.log(`\n--- Test ${index + 1} ---`);
    testEndKeywords(test.message, test.keywords);
});

console.log('\n\n🧪 TEST 2: Bubble Selection');

const testBubbleSelection = (campaign) => {
    console.log('\nTesting bubble selection...');
    console.log('Campaign bubbleOptions:', JSON.stringify(campaign.bubbleOptions, null, 2));
    
    if (!campaign.bubbleOptions || campaign.bubbleOptions.length === 0) {
        console.log('❌ No bubbleOptions found, using captionAi');
        return campaign.captionAi || 'Hello! How can I help you?';
    }

    const activeBubbles = campaign.bubbleOptions.filter(bubble => {
        const isValid = bubble.active && bubble.text && bubble.text.trim();
        console.log(`Bubble ${bubble.id}: active=${bubble.active}, text="${bubble.text}", valid=${isValid}`);
        return isValid;
    });
    
    console.log(`Active bubbles found: ${activeBubbles.length}`);
    
    if (activeBubbles.length === 0) {
        console.log('❌ No active bubbles found, using captionAi');
        return campaign.captionAi || 'Hello! How can I help you?';
    }

    // Simulate multiple selections to test randomness
    console.log('\nTesting 10 random selections:');
    const selections = [];
    for (let i = 0; i < 10; i++) {
        const randomIndex = Math.floor(Math.random() * activeBubbles.length);
        const selectedBubble = activeBubbles[randomIndex];
        selections.push(`Bubble ${selectedBubble.id}`);
        console.log(`  ${i + 1}. Selected bubble ${selectedBubble.id}: "${selectedBubble.text}"`);
    }
    
    // Check variety
    const uniqueSelections = [...new Set(selections)];
    console.log(`\nVariety check: ${uniqueSelections.length} unique selections out of ${activeBubbles.length} possible bubbles`);
    if (activeBubbles.length > 1 && uniqueSelections.length === 1) {
        console.log('⚠️  WARNING: No variety in selections, might be an issue!');
    } else if (activeBubbles.length > 1) {
        console.log('✅ Good variety in bubble selections');
    }
    
    return activeBubbles[0].text; // Return first for demo
};

// Test different bubble configurations
const bubbleTests = [
    {
        name: 'No bubbles',
        campaign: {
            captionAi: 'Default caption',
            bubbleOptions: []
        }
    },
    {
        name: 'Only inactive bubbles',
        campaign: {
            captionAi: 'Default caption',
            bubbleOptions: [
                { id: 1, text: 'Hello', active: false },
                { id: 2, text: 'Hi there', active: false }
            ]
        }
    },
    {
        name: 'Mixed active/inactive bubbles',
        campaign: {
            captionAi: 'Default caption',
            bubbleOptions: [
                { id: 1, text: 'Hello! How can I help?', active: true },
                { id: 2, text: 'Hi there! What can I do?', active: true },
                { id: 3, text: 'Welcome!', active: false },
                { id: 4, text: '', active: true }, // Empty text
                { id: 5, text: 'Greetings!', active: true }
            ]
        }
    },
    {
        name: 'Single active bubble',
        campaign: {
            captionAi: 'Default caption',
            bubbleOptions: [
                { id: 1, text: 'Only this bubble is active', active: true },
                { id: 2, text: 'This is inactive', active: false }
            ]
        }
    }
];

bubbleTests.forEach((test, index) => {
    console.log(`\n--- Bubble Test ${index + 1}: ${test.name} ---`);
    testBubbleSelection(test.campaign);
});

console.log('\n\n🎯 POTENTIAL ISSUES TO CHECK:');
console.log('1. ✅ End keyword detection logic looks correct');
console.log('2. ✅ Bubble selection logic looks correct');
console.log('3. ❓ Check if campaign data is properly loaded with bubbleOptions');
console.log('4. ❓ Check if endConversationKeywords field is properly saved');
console.log('5. ❓ Verify conversation service is being called correctly');
console.log('6. ❓ Check if conversation mode is set to continuous_chat');

console.log('\n📝 DEBUGGING STEPS:');
console.log('1. Check browser console for conversation service logs');
console.log('2. Verify campaign data contains correct bubbleOptions and endConversationKeywords');
console.log('3. Check if conversation is actually started (continuous_chat mode)');
console.log('4. Verify hasEndKeyword function is being called');
console.log('5. Check if multiple active bubbles exist in the campaign');