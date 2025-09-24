// Simple script to generate sample data structure locally
// This creates the JSON structure without needing Firebase

const fs = require('fs');
const path = require('path');

function generateSampleData() {
  console.log('🎯 Generating sample data structure...');
  
  const sampleUserId = "sample-user-123";
  const now = new Date();
  
  // Generate sample chat sessions
  const sampleSessions = [
    {
      id: `session_${Date.now()}_1`,
      title: "Photosynthesis Discussion",
      messages: [
        {
          id: "msg_1",
          role: "user",
          content: "Can you explain photosynthesis?",
          timestamp: new Date(now.getTime() - 300000).toISOString(),
          type: "text"
        },
        {
          id: "msg_2",
          role: "assistant",
          content: "Photosynthesis is the process by which plants convert light energy into chemical energy. Here's how it works:\n\n1. **Light Absorption**: Chlorophyll in plant leaves absorbs sunlight\n2. **Water Splitting**: Water molecules are split into hydrogen and oxygen\n3. **Carbon Fixation**: CO2 from the atmosphere combines with hydrogen\n4. **Glucose Production**: The result is glucose (sugar) and oxygen\n\nThe chemical equation is: 6CO2 + 6H2O + light energy → C6H12O6 + 6O2",
          timestamp: new Date(now.getTime() - 240000).toISOString(),
          type: "text"
        }
      ],
      createdAt: new Date(now.getTime() - 600000).toISOString(),
      updatedAt: new Date(now.getTime() - 240000).toISOString(),
      lastActivityAt: new Date(now.getTime() - 240000).toISOString(),
      documentIds: [],
      userId: sampleUserId
    },
    {
      id: `session_${Date.now()}_2`,
      title: "Math Problem Solving",
      messages: [
        {
          id: "msg_3",
          role: "user",
          content: "How do I solve quadratic equations?",
          timestamp: new Date(now.getTime() - 900000).toISOString(),
          type: "text"
        },
        {
          id: "msg_4",
          role: "assistant",
          content: "To solve quadratic equations, you can use several methods:\n\n1. **Factoring**: Express as (x-a)(x-b) = 0\n2. **Quadratic Formula**: x = (-b ± √(b²-4ac)) / 2a\n3. **Completing the Square**: Transform to (x-h)² = k\n\nLet me show you an example with the quadratic formula...",
          timestamp: new Date(now.getTime() - 840000).toISOString(),
          type: "text"
        }
      ],
      createdAt: new Date(now.getTime() - 1200000).toISOString(),
      updatedAt: new Date(now.getTime() - 840000).toISOString(),
      lastActivityAt: new Date(now.getTime() - 840000).toISOString(),
      documentIds: [],
      userId: sampleUserId
    }
  ];

  // Generate sample flashcard sets
  const sampleFlashcardSets = [
    {
      id: `flashcard_${Date.now()}_1`,
      title: "Photosynthesis Flashcards",
      flashcards: [
        {
          id: "card_1",
          question: "What is the main purpose of photosynthesis?",
          answer: "To convert light energy into chemical energy (glucose) for plant growth and development.",
          category: "Biology",
          difficulty: "medium",
          masteryLevel: 0,
          lastReviewed: null,
          reviewCount: 0
        },
        {
          id: "card_2",
          question: "What are the two main stages of photosynthesis?",
          answer: "Light-dependent reactions and light-independent reactions (Calvin cycle).",
          category: "Biology",
          difficulty: "medium",
          masteryLevel: 0,
          lastReviewed: null,
          reviewCount: 0
        },
        {
          id: "card_3",
          question: "What gas is released as a byproduct of photosynthesis?",
          answer: "Oxygen (O2) is released as a byproduct when water molecules are split.",
          category: "Biology",
          difficulty: "easy",
          masteryLevel: 0,
          lastReviewed: null,
          reviewCount: 0
        }
      ],
      documentId: "sample-doc-1",
      sourceType: "document",
      createdAt: new Date(now.getTime() - 1800000).toISOString(),
      updatedAt: new Date(now.getTime() - 1800000).toISOString(),
      userId: sampleUserId,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    },
    {
      id: `flashcard_${Date.now()}_2`,
      title: "Quadratic Equations",
      flashcards: [
        {
          id: "card_4",
          question: "What is the quadratic formula?",
          answer: "x = (-b ± √(b²-4ac)) / 2a",
          category: "Mathematics",
          difficulty: "hard",
          masteryLevel: 0,
          lastReviewed: null,
          reviewCount: 0
        },
        {
          id: "card_5",
          question: "How do you find the discriminant of a quadratic equation?",
          answer: "The discriminant is b²-4ac, which determines the nature of the roots.",
          category: "Mathematics",
          difficulty: "medium",
          masteryLevel: 0,
          lastReviewed: null,
          reviewCount: 0
        }
      ],
      documentId: "sample-doc-2",
      sourceType: "text",
      createdAt: new Date(now.getTime() - 2400000).toISOString(),
      updatedAt: new Date(now.getTime() - 2400000).toISOString(),
      userId: sampleUserId,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
    }
  ];

  // Create output directory
  const outputDir = path.join(__dirname, 'sample-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Write individual files
  fs.writeFileSync(
    path.join(outputDir, 'chat-sessions.json'),
    JSON.stringify(sampleSessions, null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'flashcard-sets.json'),
    JSON.stringify(sampleFlashcardSets, null, 2)
  );

  // Write combined data
  const combinedData = {
    chatSessions: sampleSessions,
    flashcardSets: sampleFlashcardSets,
    metadata: {
      generatedAt: now.toISOString(),
      userId: sampleUserId,
      totalSessions: sampleSessions.length,
      totalFlashcards: sampleFlashcardSets.reduce((sum, set) => sum + set.flashcards.length, 0),
      totalMessages: sampleSessions.reduce((sum, session) => sum + session.messages.length, 0)
    }
  };

  fs.writeFileSync(
    path.join(outputDir, 'sample-data.json'),
    JSON.stringify(combinedData, null, 2)
  );

  console.log('✅ Sample data generated successfully!');
  console.log(`📁 Output directory: ${outputDir}`);
  console.log(`📊 Generated:`);
  console.log(`  📝 Chat Sessions: ${sampleSessions.length}`);
  console.log(`  🎴 Flashcard Sets: ${sampleFlashcardSets.length}`);
  console.log(`  💬 Total Messages: ${combinedData.metadata.totalMessages}`);
  console.log(`  🎯 Total Flashcards: ${combinedData.metadata.totalFlashcards}`);
  console.log(`\n📄 Files created:`);
  console.log(`  - chat-sessions.json`);
  console.log(`  - flashcard-sets.json`);
  console.log(`  - sample-data.json (combined)`);
  
  console.log(`\n🔍 You can now:`);
  console.log(`  1. View the JSON structure in the sample-data/ folder`);
  console.log(`  2. Import this data into Firebase manually`);
  console.log(`  3. Use this as a reference for your app's data structure`);
  console.log(`  4. Test your duplicate prevention with this data`);

  return combinedData;
}

// Run the generator
generateSampleData();
