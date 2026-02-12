#!/bin/bash

# Find Available PostgreSQL Packages
# Helps identify what PostgreSQL versions are available

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "🔍 Finding Available PostgreSQL Packages"
echo "=========================================="
echo ""

echo -e "${BLUE}Searching for PostgreSQL packages...${NC}"
echo ""

# Search for PostgreSQL packages
echo "Available PostgreSQL packages:"
yum search postgresql 2>/dev/null | grep -i "postgresql" | grep -E "client|tools" | head -20

echo ""
echo -e "${BLUE}Checking repository configuration...${NC}"
yum repolist | grep -i postgres || echo "No PostgreSQL repositories found"

echo ""
echo -e "${BLUE}Checking for installed PostgreSQL versions...${NC}"
find /usr -name "pg_restore*" 2>/dev/null | head -10

echo ""
echo -e "${BLUE}Checking PostgreSQL repository packages...${NC}"
yum list available | grep -i postgresql | head -20

echo ""
echo -e "${YELLOW}If PostgreSQL 12 is not available, try:${NC}"
echo "1. Enable PostgreSQL 12 repository explicitly"
echo "2. Use Docker with PostgreSQL 12"
echo "3. Convert backup to SQL format using alternative method"
