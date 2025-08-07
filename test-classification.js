import { CategoryClassificationService } from '../src/classification/category-classification.service';

async function testClassification() {
  const service = new CategoryClassificationService();
  
  const testCases = [
    'cilok 5 ribu',
    'kursi kantor 500 ribu', 
    'grab ke mall 15k',
    'nonton di bioskop 50k',
    'beli obat 25 ribu',
    'bayar listrik 200k',
    'beli buku programming 150k',
    'es teh manis 5k',
    'parkir motor 2k',
    'skincare wajah 75k',
    'top up game 100k',
    'konsultasi dokter 300k',
    'kursus online 500k',
    'token listrik 100k',
    'sesuatu yang aneh 10k'
  ];

  console.log('🧪 Testing AI Classification System\n');
  console.log('='.repeat(80));
  
  for (const testCase of testCases) {
    try {
      console.log(`\n📝 Testing: "${testCase}"`);
      
      const result = await service.classifyTransaction(testCase);
      
      console.log(`🎯 Result: ${result.kategori}`);
      console.log(`📊 Confidence: ${result.confidence}%`);
      console.log(`💭 Reason: ${result.reason}`);
      
      // Add color coding for confidence levels
      if (result.confidence >= 80) {
        console.log('✅ HIGH CONFIDENCE');
      } else if (result.confidence >= 60) {
        console.log('⚠️  MEDIUM CONFIDENCE');
      } else {
        console.log('❌ LOW CONFIDENCE');
      }
      
      console.log('-'.repeat(50));
      
    } catch (error) {
      console.error(`❌ Error testing "${testCase}":`, error.message);
    }
  }
  
  console.log('\n🏁 Classification testing completed!');
}

// Run the test
testClassification().catch(console.error);
