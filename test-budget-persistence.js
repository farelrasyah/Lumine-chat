const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module').AppModule;

async function testBudgetDeletePersistence() {
    console.log('🔍 Testing Budget Delete Persistence Issue...\n');

    try {
        const app = await NestFactory.create(AppModule, { logger: false });
        const { SupabaseService } = require('./dist/supabase/supabase.service');

        const testPengirim = 'farelrasyah | RPL A';
        const currentDate = new Date();
        const bulan = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

        console.log(`Testing for pengirim: ${testPengirim}`);
        console.log(`Current month: ${bulan}\n`);

        // Step 1: Check existing budgets
        console.log('📊 Step 1: Check existing budgets...');
        const existingBudgets = await SupabaseService.getBudget(testPengirim, undefined, bulan);
        console.log(`Found ${existingBudgets.length} existing budgets:`);
        existingBudgets.forEach((budget, index) => {
            console.log(`  ${index + 1}. ID: ${budget.id}, Kategori: ${budget.kategori}, Limit: ${budget.limit}`);
        });

        if (existingBudgets.length === 0) {
            console.log('❌ No existing budgets found. Creating test budget first...\n');
            
            // Create a test budget
            await SupabaseService.saveBudget(testPengirim, 'Makanan', 500000, bulan);
            console.log('✅ Test budget created: Makanan - 500,000\n');
        }

        // Step 2: Delete all budgets for current month
        console.log('🗑️ Step 2: Delete all budgets...');
        await SupabaseService.deleteBudget(testPengirim, undefined, bulan);
        console.log('✅ Delete command executed\n');

        // Step 3: Immediate check - should return empty
        console.log('⏱️ Step 3: Immediate check after delete...');
        const budgetsAfterDelete = await SupabaseService.getBudget(testPengirim, undefined, bulan);
        console.log(`Found ${budgetsAfterDelete.length} budgets after delete:`);
        budgetsAfterDelete.forEach((budget, index) => {
            console.log(`  ${index + 1}. ID: ${budget.id}, Kategori: ${budget.kategori}, Limit: ${budget.limit}`);
        });

        if (budgetsAfterDelete.length === 0) {
            console.log('✅ DELETE SUCCESS: No budgets found after delete');
        } else {
            console.log('❌ DELETE FAILED: Budgets still exist after delete');
        }

        // Step 4: Wait and check again (simulate delay)
        console.log('\n⏳ Step 4: Wait 2 seconds and check again...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const budgetsAfterWait = await SupabaseService.getBudget(testPengirim, undefined, bulan);
        console.log(`Found ${budgetsAfterWait.length} budgets after wait:`);
        budgetsAfterWait.forEach((budget, index) => {
            console.log(`  ${index + 1}. ID: ${budget.id}, Kategori: ${budget.kategori}, Limit: ${budget.limit}`);
        });

        // Step 5: Test specific category check (like in checkBudgetAlert)
        console.log('\n🎯 Step 5: Test specific category check (like checkBudgetAlert does)...');
        const makananBudgets = await SupabaseService.getBudget(testPengirim, 'Makanan', bulan);
        console.log(`Found ${makananBudgets.length} Makanan budgets:`);
        makananBudgets.forEach((budget, index) => {
            console.log(`  ${index + 1}. ID: ${budget.id}, Kategori: ${budget.kategori}, Limit: ${budget.limit}`);
        });

        // Summary
        console.log('\n📋 SUMMARY:');
        console.log(`- Budgets before delete: ${existingBudgets.length}`);
        console.log(`- Budgets after delete (immediate): ${budgetsAfterDelete.length}`);
        console.log(`- Budgets after delete (2sec delay): ${budgetsAfterWait.length}`);
        console.log(`- Makanan budgets after delete: ${makananBudgets.length}`);

        if (budgetsAfterDelete.length === 0 && budgetsAfterWait.length === 0 && makananBudgets.length === 0) {
            console.log('🎉 DELETE WORKS CORRECTLY: All checks show no remaining budgets');
        } else {
            console.log('❌ DELETE ISSUE CONFIRMED: Some budgets still exist after delete');
            console.log('🔧 SUGGESTED FIX: Check deleteBudget implementation and database constraints');
        }

        await app.close();
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testBudgetDeletePersistence();
