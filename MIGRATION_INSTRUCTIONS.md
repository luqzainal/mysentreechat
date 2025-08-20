# Database Migration: Fix All Contacts Issue

## Problem Description

Some bulk campaigns in the database have `contactGroupId` stored as ObjectId representing the string "all_contacts" instead of the literal string `"all_contacts"`. This causes issues when the system tries to match campaigns that should use all user contacts.

The problematic ObjectId is `616c6c5f636f6e7461637473` which is the hex representation of the ASCII string "all_contacts".

## Files Created

1. **migrate_all_contacts.js** - Main migration script
2. **test_migration.js** - Test script to verify migration works correctly
3. **MIGRATION_INSTRUCTIONS.md** - This documentation file

## Pre-Migration Steps

### 1. Backup Your Database
```bash
# MongoDB backup
mongodump --uri="your-production-mongodb-uri" --out=/path/to/backup/$(date +%Y%m%d_%H%M%S)
```

### 2. Test on Development/Staging Environment
```bash
# Set test database URI (optional)
export MONGO_URI_TEST="mongodb://localhost:27017/waziper_test"

# Run test suite
node test_migration.js
```

Expected output should show:
- ✅ All tests passed! Migration script is ready for production.

## Production Migration

### Step 1: Upload Files to Server
Upload these files to your production server:
- `migrate_all_contacts.js`
- `test_migration.js` (optional, for testing)

### Step 2: Install Dependencies
Make sure your server has the required Node.js modules:
```bash
npm install mongoose
```

### Step 3: Set Environment Variable
```bash
# Set your production MongoDB URI
export MONGO_URI="your-production-mongodb-connection-string"

# Example:
export MONGO_URI="mongodb://username:password@localhost:27017/waziper"
# or for MongoDB Atlas:
export MONGO_URI="mongodb+srv://username:password@cluster.mongodb.net/waziper"
```

### Step 4: Run Migration
```bash
# Run the migration script
node migrate_all_contacts.js
```

### Step 5: Verify Results
The migration script will output:
- Number of campaigns checked
- Number of campaigns fixed
- Details of all fixes applied
- Any errors encountered

Example successful output:
```
Starting migration for all_contacts campaigns...
Found 15 bulk campaigns to check

[FIXING] Campaign: My Bulk Campaign
         Before: 616c6c5f636f6e7461637473 (ObjectId)
         After:  'all_contacts' (String)
         ✅ FIXED

============================================================
MIGRATION SUMMARY
============================================================
Total campaigns checked: 15
Campaigns fixed: 3
Campaigns with issues: 0

FIXED CAMPAIGNS:
1. Campaign: My Bulk Campaign
   User ID: 507f1f77bcf86cd799439011
   Device ID: device-123
   Fixed: 616c6c5f636f6e7461637473 → 'all_contacts'

✅ Migration completed successfully!
```

## What the Migration Does

1. **Scans** all campaigns with `campaignType: 'bulk'`
2. **Identifies** campaigns where `contactGroupId` is the ObjectId `616c6c5f636f6e7461637473`
3. **Updates** those campaigns to set `contactGroupId: 'all_contacts'` (string)
4. **Reports** all changes made and any issues encountered
5. **Preserves** all other campaign data unchanged

## Safety Features

- ✅ **Read-only scanning** - checks all campaigns before making changes
- ✅ **Targeted updates** - only affects campaigns with the specific problematic ObjectId
- ✅ **Detailed logging** - shows exactly what was changed
- ✅ **Error handling** - continues processing even if individual updates fail
- ✅ **Rollback information** - provides details of all changes made

## Rollback Instructions (If Needed)

If you need to rollback the migration, you can restore from your backup or manually update the affected campaigns:

```javascript
// Example rollback for a specific campaign
db.campaigns.updateOne(
  { _id: ObjectId("campaign-id-here") },
  { $set: { contactGroupId: ObjectId("616c6c5f636f6e7461637473") } }
)
```

However, **rollback is not recommended** as the migration fixes a bug that prevents "Send to All Contacts" functionality from working properly.

## Post-Migration Verification

After running the migration:

1. **Check the migration output** for any errors
2. **Test the "Send to All Contacts" feature** in your application
3. **Monitor application logs** for any related errors
4. **Verify bulk campaigns** are working as expected

## Troubleshooting

### Common Issues:

**1. Database Connection Failed**
```
Solution: Check your MONGO_URI environment variable
```

**2. Permission Denied**
```
Solution: Ensure the database user has write permissions
```

**3. Some Campaigns Not Fixed**
```
Solution: Check the migration output for specific error messages
```

### Getting Help:

If you encounter any issues:
1. Check the detailed error messages in the migration output
2. Ensure your database connection string is correct
3. Verify you have sufficient database permissions
4. Check that all campaign records are accessible

## Technical Details

- **Affected Field**: `Campaign.contactGroupId`
- **Problem Value**: ObjectId(`616c6c5f636f6e7461637473`)
- **Fixed Value**: String(`"all_contacts"`)
- **Hex Explanation**: `616c6c5f636f6e7461637473` = "all_contacts" in ASCII hex

This migration is safe to run multiple times - it will only update campaigns that still have the problematic ObjectId value.