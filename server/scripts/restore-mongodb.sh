#!/bin/bash

# MongoDB Restore Script
# Restores MongoDB database from backup

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/orbitai}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backup file is provided
if [ -z "$1" ]; then
    echo -e "${RED}Usage: $0 <backup-file.tar.gz>${NC}"
    echo -e "Available backups:"
    ls -lh "${BACKUP_DIR}"/*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

echo -e "${YELLOW}WARNING: This will restore the database from backup.${NC}"
echo -e "${YELLOW}This may overwrite existing data.${NC}"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo -e "${RED}Restore cancelled${NC}"
    exit 1
fi

echo -e "${GREEN}Extracting backup...${NC}"
TEMP_DIR=$(mktemp -d)
tar -xzf "${BACKUP_FILE}" -C "${TEMP_DIR}"

# Find the extracted directory
EXTRACTED_DIR=$(find "${TEMP_DIR}" -type d -mindepth 1 -maxdepth 1 | head -1)

echo -e "${GREEN}Restoring database...${NC}"

# Extract connection details from URI
if [[ "${MONGODB_URI}" == mongodb+srv://* ]]; then
    # MongoDB Atlas connection
    mongorestore --uri="${MONGODB_URI}" --drop "${EXTRACTED_DIR}"
elif [[ "${MONGODB_URI}" == mongodb://* ]]; then
    # Standard MongoDB connection
    DB_HOST=$(echo "${MONGODB_URI}" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "${MONGODB_URI}" | sed -n 's/.*:\/\/[^:]*:\([^/]*\).*/\1/p')
    DB_NAME=$(echo "${MONGODB_URI}" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    # Extract username and password if present
    if [[ "${MONGODB_URI}" == *"@"* ]]; then
        DB_USER=$(echo "${MONGODB_URI}" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        DB_PASS=$(echo "${MONGODB_URI}" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        DB_HOST=$(echo "${MONGODB_URI}" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo "${MONGODB_URI}" | sed -n 's/.*@[^:]*:\([^/]*\).*/\1/p')
        
        mongorestore --host="${DB_HOST}" --port="${DB_PORT}" \
                     --username="${DB_USER}" --password="${DB_PASS}" \
                     --db="${DB_NAME}" --drop "${EXTRACTED_DIR}"
    else
        mongorestore --host="${DB_HOST}" --port="${DB_PORT}" \
                     --db="${DB_NAME}" --drop "${EXTRACTED_DIR}"
    fi
else
    echo -e "${RED}Invalid MongoDB URI format${NC}"
    exit 1
fi

# Cleanup
rm -rf "${TEMP_DIR}"

echo -e "${GREEN}Database restored successfully!${NC}"






