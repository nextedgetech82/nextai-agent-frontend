#!/bin/bash

set -e

echo "========================================"
echo " GitHub Multi Account Setup (Interactive)"
echo "========================================"

# -----------------------------
# INPUTS
# -----------------------------
read -p "Enter First GitHub Email (abc@gmail.com): " EMAIL1
read -p "Enter First GitHub Name: " NAME1

read -p "Enter Second GitHub Email (pqr@gmail.com): " EMAIL2
read -p "Enter Second GitHub Name: " NAME2

KEY1="$HOME/.ssh/id_ed25519_abc"
KEY2="$HOME/.ssh/id_ed25519_pqr"
SSH_CONFIG="$HOME/.ssh/config"

echo ""
echo "Creating SSH directory..."
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

# -----------------------------
# GENERATE KEYS
# -----------------------------
echo ""
echo "Generating SSH Keys..."

if [ ! -f "$KEY1" ]; then
  ssh-keygen -t ed25519 -C "$EMAIL1" -f "$KEY1" -N ""
else
  echo "Key already exists: $KEY1"
fi

if [ ! -f "$KEY2" ]; then
  ssh-keygen -t ed25519 -C "$EMAIL2" -f "$KEY2" -N ""
else
  echo "Key already exists: $KEY2"
fi

# -----------------------------
# SSH AGENT
# -----------------------------
echo ""
echo "Starting ssh-agent..."
eval "$(ssh-agent -s)"

echo "Adding keys to Keychain..."
ssh-add --apple-use-keychain "$KEY1"
ssh-add --apple-use-keychain "$KEY2"

# -----------------------------
# SSH CONFIG
# -----------------------------
echo ""
echo "Updating SSH config..."

touch "$SSH_CONFIG"

sed -i '' '/^Host github-abc$/,/^$/d' "$SSH_CONFIG" || true
sed -i '' '/^Host github-pqr$/,/^$/d' "$SSH_CONFIG" || true

cat >> "$SSH_CONFIG" <<EOF

Host github-abc
  HostName github.com
  User git
  IdentityFile $KEY1
  IdentitiesOnly yes
  AddKeysToAgent yes
  UseKeychain yes

Host github-pqr
  HostName github.com
  User git
  IdentityFile $KEY2
  IdentitiesOnly yes
  AddKeysToAgent yes
  UseKeychain yes
EOF

chmod 600 "$SSH_CONFIG"

# -----------------------------
# SHOW KEYS
# -----------------------------
echo ""
echo "========================================"
echo " COPY & ADD THESE KEYS TO GITHUB"
echo "========================================"

echo ""
echo "👉 Add this to FIRST GitHub ($EMAIL1):"
cat "${KEY1}.pub"

echo ""
echo "👉 Add this to SECOND GitHub ($EMAIL2):"
cat "${KEY2}.pub"

echo ""
echo "Go to GitHub → Settings → SSH and GPG keys → New SSH Key"

# -----------------------------
# TEST
# -----------------------------
echo ""
echo "Testing SSH (will work after adding keys)..."
set +e
ssh -T git@github-abc
echo ""
ssh -T git@github-pqr
set -e

# -----------------------------
# OPTIONAL CLONE
# -----------------------------
echo ""
read -p "Do you want to clone repositories now? (y/n): " CLONE

if [ "$CLONE" == "y" ]; then

  echo ""
  read -p "Enter Repo1 SSH (format USER/REPO): " REPO1
  read -p "Enter Repo2 SSH (format USER/REPO): " REPO2

  echo ""
  git clone git@github-abc:$REPO1.git
  git clone git@github-pqr:$REPO2.git

  DIR1=$(basename "$REPO1")
  DIR2=$(basename "$REPO2")

  echo ""
  echo "Setting Git configs..."

  cd "$DIR1"
  git config user.name "$NAME1"
  git config user.email "$EMAIL1"
  cd ..

  cd "$DIR2"
  git config user.name "$NAME2"
  git config user.email "$EMAIL2"
  cd ..

fi

echo ""
echo "========================================"
echo " DONE - Everything is configured"
echo "========================================"
echo ""
echo "Use:"
echo "Project1 → github-abc"
echo "Project2 → github-pqr"
echo ""
echo "If repo already exists:"
echo "git remote set-url origin git@github-abc:USER/REPO.git"
echo "git remote set-url origin git@github-pqr:USER/REPO.git"