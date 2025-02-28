#!/usr/bin/env bash
# Use this script to set up the development environment for the chat-with-manuals app

# TO RUN ON WINDOWS:
# 1. Install WSL (Windows Subsystem for Linux) - https://learn.microsoft.com/en-us/windows/wsl/install
# 2. Install Docker Desktop for Windows - https://docs.docker.com/docker-for-windows/install/
# 3. Configure Docker (via Docker Desktop) to use your new WSL distribution in Settings
# 4. Open WSL - `wsl`
# 5. Run this script - `./start-dev-env.sh`

# On Linux and macOS you can run this script directly - `./start-dev-env.sh`

# Container names
DB_CONTAINER_NAME="chat-with-manuals-dev-postgres"
CLAMAV_CONTAINER_NAME="chat-with-manuals-dev-clamav"
CHROMA_CONTAINER_NAME="chat-with-manuals-dev-chroma"
TRIGGER_CONTAINER_NAME="trigger"

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo -e "Error: .env file not found.\nPlease create a .env file from .env.example and configure it according to your environment."
  exit 1
fi

# Check if Node.js is installed
if ! [ -x "$(command -v node)" ]; then
    echo "Error: Node.js is not installed."
    echo "Node.js install guide: https://nodejs.org/en/download"
    exit 1
fi

# Check if Docker is installed
if ! [ -x "$(command -v docker)" ]; then
  echo -e "Docker is not installed. Please install docker and try again.\nDocker install guide: https://docs.docker.com/engine/install/"
  exit 1
fi

# Check if Docker daemon is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker daemon is not running. Please start Docker and try again."
  exit 1
fi

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Import env variables from .env
set -a
source .env

# Database setup
echo "Setting up database..."

# Check if postgres container is running
if [ "$(docker ps -q -f name=$DB_CONTAINER_NAME)" ]; then
  echo "Database container '$DB_CONTAINER_NAME' already running"
else
  # Check if postgres container exists but is not running
  if [ "$(docker ps -q -a -f name=$DB_CONTAINER_NAME)" ]; then
    docker start "$DB_CONTAINER_NAME"
    echo "Existing database container '$DB_CONTAINER_NAME' started"
  else
    # Extract database credentials from DATABASE_URL
    DB_PASSWORD=$(echo "$DATABASE_URL" | awk -F':' '{print $3}' | awk -F'@' '{print $1}')
    DB_PORT=$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'\/' '{print $1}')

    if [ "$DB_PASSWORD" = "password" ]; then
      echo "You are using the default database password"
      read -p "Should we generate a random password for you? [y/N]: " -r REPLY
      if ! [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Please change the default password in the .env file and try again"
        exit 1
      fi
      # Generate a random URL-safe password
      DB_PASSWORD=$(openssl rand -base64 12 | tr '+/' '-_')
      sed -i -e "s#:password@#:$DB_PASSWORD@#" .env
    fi

    docker run -d \
      --name $DB_CONTAINER_NAME \
      -e POSTGRES_USER="postgres" \
      -e POSTGRES_PASSWORD="$DB_PASSWORD" \
      -e POSTGRES_DB=chat-with-manuals-dev \
      -p "$DB_PORT":5432 \
      docker.io/postgres && echo "Database container '$DB_CONTAINER_NAME' was successfully created"
  fi
fi

# Prompt for database schema push
echo "Setting up database..."
echo "Do you want to run 'npm run db:push' to update the database schema?"
echo "\n⚠️ WARNING: This may drop the existing database and create a new one"
echo "If it's the first time you're setting up the database, you should answer YES."
echo "If it's not the first time, are you sure you want to continue running this script?"
read -p "Answer [y/N]: " -r REPLY

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "Pushing database schema..."
  npm run db:push

  echo "Seeding database with default values..."
  npm run db:seed
  echo "Database seeded successfully."
else
  echo "Skipping database schema push."
fi

# ClamAV setup
echo "Setting up ClamAV..."

if [ "$(docker ps -q -f name=$CLAMAV_CONTAINER_NAME)" ]; then
  echo "ClamAV container '$CLAMAV_CONTAINER_NAME' already running"
else
  # Check if clamav container exists but is not running
  if [ "$(docker ps -q -a -f name=$CLAMAV_CONTAINER_NAME)" ]; then
    docker start "$CLAMAV_CONTAINER_NAME"
    echo "Existing ClamAV container '$CLAMAV_CONTAINER_NAME' started"
  else
    docker run -d \
      --name $CLAMAV_CONTAINER_NAME \
      -p 3310:3310 \
      clamav/clamav:stable && echo "ClamAV container '$CLAMAV_CONTAINER_NAME' was successfully created"
  fi
fi

# ChromaDB setup
echo "Setting up ChromaDB..."

if [ "$(docker ps -q -f name=$CHROMA_CONTAINER_NAME)" ]; then
  echo "ChromaDB container '$CHROMA_CONTAINER_NAME' already running"
else
  # Check if chromadb container exists but is not running
  if [ "$(docker ps -q -a -f name=$CHROMA_CONTAINER_NAME)" ]; then
    docker start "$CHROMA_CONTAINER_NAME"
    echo "Existing ChromaDB container '$CHROMA_CONTAINER_NAME' started"
  else
    docker run -d \
      --name $CHROMA_CONTAINER_NAME \
      -p 8000:8000 \
      -e ALLOW_RESET="true" \
      chromadb/chroma && echo "ChromaDB container '$CHROMA_CONTAINER_NAME' was successfully created"
  fi
fi

# Check if Trigger.dev container is running
if ! [ "$(docker ps -q -f name=$TRIGGER_CONTAINER_NAME)" ]; then
  echo -e "\n⚠️ Trigger.dev container not detected. Please follow the Trigger.dev setup instructions in SETUP.md."
  echo "You will need to run the Trigger.dev container separately for full functionality."
  echo "See SETUP.md for detailed instructions."
  exit 1
fi

echo -e "\n✅ Development environment setup complete!"
echo "You can now run the app with 'npm run dev'" 