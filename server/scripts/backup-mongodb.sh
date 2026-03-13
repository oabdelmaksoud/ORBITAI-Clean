#!/bin/bash

# MongoDB Backup Script
# Creates automated backups of MongoDB database
# Can be run manually or scheduled via cron

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/orbitai}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="mongodb-backup-${TIMESTAMP}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting MongoDB backup...${NC}"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Extract connection details from URI
if [[ "${MONGODB_URI}" == mongodb+srv://* ]]; then
    # MongoDB Atlas connection
    echo -e "${YELLOW}Using MongoDB Atlas connection${NC}"
    mongodump --uri="${MONGODB_URI}" --out="${BACKUP_DIR}/${BACKUP_NAME}"
elif [[ "${MONGODB_URI}" == mongodb://* ]]; then
    # Standard MongoDB connection
    # Extract host, port, database from URI
    DB_HOST=$(echo "${MONGODB_URI}" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PORT=$(echo "${MONGODB_URI}" | sed -n 's/.*:\/\/[^:]*:\([^/]*\).*/\1/p')
    DB_NAME=$(echo "${MONGODB_URI}" | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    # Extract username and password if present
    if [[ "${MONGODB_URI}" == *"@"* ]]; then
        DB_USER=$(echo "${MONGODB_URI}" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        DB_PASS=$(echo "${MONGODB_URI}" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
        DB_HOST=$(echo "${MONGODB_URI}" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo "${MONGODB_URI}" | sed -n 's/.*@[^:]*:\([^/]*\).*/\1/p')
        
        mongodump --host="${DB_HOST}" --port="${DB_PORT}" \
                  --username="${DB_USER}" --password="${DB_PASS}" \
                  --db="${DB_NAME}" --out="${BACKUP_DIR}/${BACKUP_NAME}"
    else
        mongodump --host="${DB_HOST}" --port="${DB_PORT}" \
                  --db="${DB_NAME}" --out="${BACKUP_DIR}/${BACKUP_NAME}"
    fi
else
    echo -e "${RED}Invalid MongoDB URI format${NC}"
    exit 1
fi

# Compress backup
echo -e "${GREEN}Compressing backup...${NC}"
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" -C "${BACKUP_DIR}" "${BACKUP_NAME}"
rm -rf "${BACKUP_DIR}/${BACKUP_NAME}"

# Get backup size
BACKUP_SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)

echo -e "${GREEN}Backup completed successfully!${NC}"
echo -e "Backup file: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo -e "Size: ${BACKUP_SIZE}"

# Clean up old backups
echo -e "${YELLOW}Cleaning up backups older than ${RETENTION_DAYS} days...${NC}"
find "${BACKUP_DIR}" -name "mongodb-backup-*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

echo -e "${GREEN}Backup process completed!${NC}"

# Optional: Upload to S3 (if AWS credentials are configured)
if [ -n "${AWS_ACCESS_KEY_ID}" ] && [ -n "${AWS_SECRET_ACCESS_KEY}" ] && [ -n "${S3_BACKUP_BUCKET}" ]; then
    echo -e "${YELLOW}Uploading backup to S3...${NC}"
    aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "s3://${S3_BACKUP_BUCKET}/mongodb-backups/${BACKUP_NAME}.tar.gz"
    echo -e "${GREEN}Backup uploaded to S3 successfully!${NC}"
fi






