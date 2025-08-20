#!/usr/bin/env node

const mongoose = require('mongoose');
const Campaign = require('./backend/models/Campaign.js');

// Database connection
const connectDB = async () => {
  try {
    // Use your production MongoDB connection string
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/chatbotkuasaplusdb', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// Migration function
const migrateAllContactsCampaigns = async () => {
  console.log('Starting migration for all_contacts campaigns...');
  
  try {
    // Find all bulk campaigns
    const campaigns = await Campaign.find({
      campaignType: 'bulk'
    });
    
    console.log(`Found ${campaigns.length} bulk campaigns to check`);
    
    let fixedCount = 0;
    const fixes = [];
    const issues = [];
    
    for (const campaign of campaigns) {
      if (campaign.contactGroupId) {
        const contactGroupIdStr = campaign.contactGroupId.toString();
        
        // Check if this ObjectId represents 'all_contacts' in hex
        // 'all_contacts' = 616c6c5f636f6e7461637473 in hex
        if (contactGroupIdStr === '616c6c5f636f6e7461637473') {
          console.log(`[FIXING] Campaign: ${campaign.campaignName || campaign._id}`);
          console.log(`         Before: ${contactGroupIdStr} (ObjectId)`);
          console.log(`         After:  'all_contacts' (String)`);
          
          try {
            // Update the campaign with string literal 'all_contacts'
            await Campaign.findByIdAndUpdate(campaign._id, {
              contactGroupId: 'all_contacts'
            });
            
            fixedCount++;
            fixes.push({
              campaignId: campaign._id,
              campaignName: campaign.campaignName,
              userId: campaign.userId,
              deviceId: campaign.deviceId,
              before: contactGroupIdStr,
              after: 'all_contacts'
            });
            
            console.log(`         ✅ FIXED`);
            
          } catch (updateError) {
            console.error(`         ❌ ERROR updating campaign ${campaign._id}:`, updateError);
            issues.push({
              campaignId: campaign._id,
              campaignName: campaign.campaignName,
              error: updateError.message
            });
          }
          
        } else {
          // Try to decode hex to ASCII and check if it represents 'all_contacts'
          try {
            const decoded = Buffer.from(contactGroupIdStr, 'hex').toString('ascii');
            if (decoded === 'all_contacts') {
              console.log(`[FIXING] Campaign: ${campaign.campaignName || campaign._id}`);
              console.log(`         Before: ${contactGroupIdStr} (decoded: ${decoded})`);
              console.log(`         After:  'all_contacts' (String)`);
              
              await Campaign.findByIdAndUpdate(campaign._id, {
                contactGroupId: 'all_contacts'
              });
              
              fixedCount++;
              fixes.push({
                campaignId: campaign._id,
                campaignName: campaign.campaignName,
                userId: campaign.userId,
                deviceId: campaign.deviceId,
                before: `${contactGroupIdStr} (decoded: ${decoded})`,
                after: 'all_contacts'
              });
              
              console.log(`         ✅ FIXED`);
            }
          } catch (decodeError) {
            // Not a hex-encoded 'all_contacts', skip
            console.log(`[SKIP] Campaign ${campaign.campaignName || campaign._id}: Valid contact group ObjectId`);
          }
        }
      } else {
        console.log(`[SKIP] Campaign ${campaign.campaignName || campaign._id}: No contactGroupId`);
      }
    }
    
    // Summary report
    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total campaigns checked: ${campaigns.length}`);
    console.log(`Campaigns fixed: ${fixedCount}`);
    console.log(`Campaigns with issues: ${issues.length}`);
    
    if (fixes.length > 0) {
      console.log('\nFIXED CAMPAIGNS:');
      fixes.forEach((fix, index) => {
        console.log(`${index + 1}. Campaign: ${fix.campaignName || fix.campaignId}`);
        console.log(`   User ID: ${fix.userId}`);
        console.log(`   Device ID: ${fix.deviceId}`);
        console.log(`   Fixed: ${fix.before} → ${fix.after}`);
        console.log('');
      });
    }
    
    if (issues.length > 0) {
      console.log('\nISSUES ENCOUNTERED:');
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. Campaign: ${issue.campaignName || issue.campaignId}`);
        console.log(`   Error: ${issue.error}`);
        console.log('');
      });
    }
    
    console.log('✅ Migration completed successfully!');
    
    return {
      success: true,
      totalChecked: campaigns.length,
      fixedCount,
      fixes,
      issues
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Main execution
const runMigration = async () => {
  try {
    await connectDB();
    const result = await migrateAllContactsCampaigns();
    
    if (result.success) {
      console.log('\n🎉 Migration completed successfully!');
      process.exit(0);
    } else {
      console.error('\n💥 Migration failed:', result.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
};

// Run the migration if this script is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { migrateAllContactsCampaigns };