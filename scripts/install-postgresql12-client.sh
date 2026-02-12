#!/bin/bash

# Install PostgreSQL 12 Client for Backup Restore
# Handles different Linux distributions

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "=========================================="
echo "📦 Install PostgreSQL 12 Client"
echo "=========================================="
echo ""

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo -e "${RED}Cannot detect OS${NC}"
    exit 1
fi

echo "Detected OS: ${OS} ${VERSION}"
echo ""

# Check if already installed
if command -v /usr/pgsql-12/bin/pg_restore &> /dev/null; then
    echo -e "${GREEN}✅ PostgreSQL 12 client already installed!${NC}"
    /usr/pgsql-12/bin/pg_restore --version
    exit 0
fi

case $OS in
    "centos"|"rhel"|"rocky"|"almalinux")
        echo -e "${BLUE}Installing PostgreSQL 12 client for CentOS/RHEL...${NC}"
        echo ""
        
        # Try to install from PostgreSQL official repository
        echo "Step 1: Adding PostgreSQL official repository..."
        
        # Check if repo already exists
        if [ -f /etc/yum.repos.d/pgdg-redhat-all.repo ] || [ -f /etc/yum.repos.d/pgdg-common-redhat.repo ]; then
            echo -e "${YELLOW}PostgreSQL repository may already exist${NC}"
        else
            echo "Installing PostgreSQL repository..."
            sudo yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-$(rpm -E %{rhel})-x86_64/pgdg-redhat-repo-latest.noarch.rpm || {
                echo -e "${YELLOW}Could not install official repo, trying alternative...${NC}"
            }
        fi
        
        echo ""
        echo "Step 2: Installing PostgreSQL 12 client..."
        sudo yum install -y postgresql12 || {
            echo -e "${RED}Failed to install postgresql12${NC}"
            echo ""
            echo "Trying alternative package names..."
            
            # Try different package names
            sudo yum install -y postgresql12-client || \
            sudo yum install -y postgresql-client-12 || {
                echo -e "${RED}Could not install PostgreSQL 12 client${NC}"
                echo ""
                echo "Available PostgreSQL packages:"
                yum search postgresql | grep -i "postgresql.*client\|postgresql.*12" | head -10
                exit 1
            }
        }
        ;;
        
    "ubuntu"|"debian")
        echo -e "${BLUE}Installing PostgreSQL 12 client for Ubuntu/Debian...${NC}"
        echo ""
        
        # Add PostgreSQL APT repository
        echo "Step 1: Adding PostgreSQL official repository..."
        sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
        wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
        sudo apt-get update
        
        echo ""
        echo "Step 2: Installing PostgreSQL 12 client..."
        sudo apt-get install -y postgresql-client-12
        ;;
        
    *)
        echo -e "${RED}Unsupported OS: ${OS}${NC}"
        echo "Please install PostgreSQL 12 client manually"
        exit 1
        ;;
esac

# Verify installation
if command -v /usr/pgsql-12/bin/pg_restore &> /dev/null; then
    echo ""
    echo -e "${GREEN}✅ PostgreSQL 12 client installed successfully!${NC}"
    /usr/pgsql-12/bin/pg_restore --version
    echo ""
    echo "You can now use: /usr/pgsql-12/bin/pg_restore"
elif command -v pg_restore-12 &> /dev/null; then
    echo ""
    echo -e "${GREEN}✅ PostgreSQL 12 client installed successfully!${NC}"
    pg_restore-12 --version
    echo ""
    echo "You can now use: pg_restore-12"
else
    echo -e "${YELLOW}⚠️  Installation completed but pg_restore not found in expected location${NC}"
    echo "Searching for pg_restore..."
    find /usr -name "pg_restore*" 2>/dev/null | grep -E "(12|postgresql)" | head -5
fi
