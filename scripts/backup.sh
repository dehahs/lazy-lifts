#!/bin/bash

# Create backups directory if it doesn't exist
mkdir -p backups

# Run the backup script
echo "Creating Firebase backup..."
node scripts/backup-firebase.mjs