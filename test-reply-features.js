/**
 * Test File untuk Testing Reply Features di WhatsApp
 * Jalankan dengan: node test-reply-features.js
 */

const { SupabaseService } = require('./dist/supabase/supabase.service');

// Mock user data for testing
const TEST_USER = 'farelrasyah | RPL A';
const TEST_USER_NUMBER = '+6281234567890@s.whatsapp.net';

async function testReplyFeatures() {
  console.log('🧪 TESTING REPLY FEATURES');
  console.log('==========================\n');

  try {
    // Test 1: Buat beberapa sample messages
    console.log('📝 Test 1: Creating sample messages...');
    
    const sampleMessages = [
      { role: 'user', content: 'Halo Lumine, bagaimana kabarmu?', metadata: { intent: 'greeting' } },
      { role: 'assistant', content: 'Halo! Saya baik-baik saja. Ada yang bisa saya bantu?', metadata: { intent: 'greeting_response' } },
      { role: 'user', content: 'Saya mau tanya tentang budget bulan ini', metadata: { intent: 'budget_inquiry' } },
      { role: 'assistant', content: 'Tentu! Saya bisa membantu analisis budget Anda.', metadata: { intent: 'budget_response' } },
      { role: 'user', content: 'Berapa total pengeluaran saya minggu ini?', metadata: { intent: 'expense_query' } }
    ];

    for (const msg of sampleMessages) {
      await SupabaseService.saveMessage(
        TEST_USER_NUMBER,
        msg.role,
        msg.content,
        null, // no reply_to_id
        null, // no conversation_id
        msg.metadata
      );
      console.log(`   ✅ Saved: ${msg.content.substring(0, 30)}...`);
    }

    console.log('\n📋 Test 2: Getting recent messages with IDs...');
    const recentMessages = await SupabaseService.getRecentMessagesWithIds(TEST_USER_NUMBER, 5);
    
    console.log(`   Found ${recentMessages.length} recent messages:`);
    recentMessages.forEach((msg, index) => {
      console.log(`   ${index}. [${msg.role}] ${msg.content.substring(0, 40)}...`);
      console.log(`      ID: ${msg.id}, Created: ${msg.created_at}`);
    });

    // Test 3: Reply to a message by index
    console.log('\n💬 Test 3: Reply to message by index...');
    if (recentMessages.length > 1) {
      await SupabaseService.replyToMessageByIndex(
        TEST_USER_NUMBER,
        1, // Reply to second message
        'Terima kasih atas responnya!',
        'user',
        { test_reply: true, reply_method: 'by_index' }
      );
      console.log('   ✅ Reply by index successful!');
    }

    // Test 4: Search for messages and reply
    console.log('\n🔍 Test 4: Search and reply to message...');
    try {
      await SupabaseService.searchAndReplyToMessage(
        TEST_USER_NUMBER,
        'budget',
        'Saya masih menunggu analisis budget tersebut',
        'user',
        { test_reply: true, reply_method: 'by_search' }
      );
      console.log('   ✅ Search and reply successful!');
    } catch (error) {
      console.log(`   ⚠️ Search and reply: ${error.message}`);
    }

    // Test 5: Create conversation thread
    console.log('\n🧵 Test 5: Create conversation thread...');
    const conversationId = await SupabaseService.createConversationThread(
      TEST_USER_NUMBER,
      'Mari kita diskusi tentang perencanaan keuangan',
      { topic: 'financial_planning', test: true }
    );
    console.log(`   ✅ Thread created with ID: ${conversationId.substring(0, 8)}...`);

    // Test 6: Add messages to the thread
    console.log('\n💬 Test 6: Add messages to thread...');
    await SupabaseService.saveMessage(
      TEST_USER_NUMBER,
      'assistant',
      'Baik, kita bisa mulai dengan melihat pola pengeluaran Anda.',
      null,
      conversationId,
      { thread_response: true }
    );

    await SupabaseService.saveMessage(
      TEST_USER_NUMBER,
      'user',
      'Oke, saya tertarik dengan analisis kategori pengeluaran',
      null,
      conversationId,
      { thread_continuation: true }
    );
    console.log('   ✅ Messages added to thread!');

    // Test 7: Get conversation messages
    console.log('\n📜 Test 7: Get conversation messages...');
    const threadMessages = await SupabaseService.getConversationMessages(conversationId, 10);
    console.log(`   Found ${threadMessages.length} messages in thread:`);
    threadMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. [${msg.role}] ${msg.content.substring(0, 50)}...`);
    });

    // Test 8: Get message with replies
    console.log('\n🔗 Test 8: Get message with all replies...');
    const messageWithReplies = await SupabaseService.getMessageWithReplies(recentMessages[1].id);
    console.log(`   Original message: ${messageWithReplies.original.content.substring(0, 40)}...`);
    console.log(`   Number of replies: ${messageWithReplies.replies.length}`);
    
    if (messageWithReplies.replies.length > 0) {
      messageWithReplies.replies.forEach((reply, index) => {
        console.log(`   Reply ${index + 1}: ${reply.content.substring(0, 40)}...`);
      });
    }

    // Test 9: Get thread summary
    console.log('\n📊 Test 9: Get thread summary...');
    const threadSummary = await SupabaseService.getThreadSummary(TEST_USER_NUMBER);
    const threadIds = Object.keys(threadSummary);
    console.log(`   Found ${threadIds.length} conversation threads:`);
    
    threadIds.forEach((threadId, index) => {
      const messages = threadSummary[threadId];
      console.log(`   Thread ${index + 1}: ${threadId.substring(0, 8)}... (${messages.length} messages)`);
    });

    // Test 10: Find old messages by content
    console.log('\n🔍 Test 10: Find old messages by content...');
    const foundMessages = await SupabaseService.findOldMessageByContent(TEST_USER_NUMBER, 'budget', 1);
    console.log(`   Found ${foundMessages.length} messages containing 'budget':`);
    foundMessages.forEach((msg, index) => {
      console.log(`   ${index + 1}. ${msg.content.substring(0, 50)}... (${msg.created_at})`);
    });

    console.log('\n✅ ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('\n🎯 CARA TESTING DI WHATSAPP:');
    console.log('=====================================');
    console.log('1. Kirim pesan: "@lumine lihat pesan terbaru"');
    console.log('2. Kirim pesan: "@lumine reply ke pesan 2 Ini reply test!"');
    console.log('3. Kirim pesan: "@lumine cari pesan budget"');
    console.log('4. Kirim pesan: "@lumine reply search budget Terima kasih infonya!"');
    console.log('5. Kirim pesan: "@lumine test thread baru"');
    console.log('6. Kirim pesan: "@lumine lihat thread"');
    console.log('7. Kirim pesan: "@lumine test reply" untuk melihat help');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Cleanup function untuk membersihkan test data
async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    // Note: Anda mungkin perlu menambahkan fungsi delete di SupabaseService
    // untuk membersihkan data testing
    console.log('   ⚠️ Manual cleanup required - check your Supabase dashboard');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Jalankan test
if (require.main === module) {
  testReplyFeatures()
    .then(() => {
      console.log('\n🏁 Test selesai!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test error:', error);
      process.exit(1);
    });
}

module.exports = { testReplyFeatures, cleanupTestData };
