@echo off
echo 🚀 WAZIPER V2 Database Clear Script
echo ===================================
echo.

if "%1"=="" (
    echo 📖 Usage:
    echo   clear-db.bat all                    - Clear all collections
    echo   clear-db.bat collection ^<name^>      - Clear specific collection  
    echo   clear-db.bat list                   - Show all collections
    echo.
    echo 📋 Examples:
    echo   clear-db.bat all
    echo   clear-db.bat collection users
    echo   clear-db.bat collection contacts
    echo   clear-db.bat list
    goto :end
)

if "%1"=="all" (
    echo 🗑️  Clearing ALL collections...
    node scripts/clear-database.js all
) else if "%1"=="collection" (
    if "%2"=="" (
        echo ❌ Please specify collection name
        echo Usage: clear-db.bat collection ^<collection_name^>
        goto :end
    )
    echo 🗑️  Clearing collection: %2
    node scripts/clear-database.js collection %2
) else if "%1"=="list" (
    echo 📋 Showing all collections...
    node scripts/clear-database.js list
) else (
    echo ❌ Invalid command: %1
    echo.
    echo 📖 Usage:
    echo   clear-db.bat all                    - Clear all collections
    echo   clear-db.bat collection ^<name^>      - Clear specific collection
    echo   clear-db.bat list                   - Show all collections
)

:end
pause
