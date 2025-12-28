# GitHub Actions & Auto-Update Setup Guide

## 🔑 Step 1: Generate Signing Keys

Tauri updater requires signing keys for security. Run this command:

```bash
npx @tauri-apps/cli signer generate -w ~/.tauri/alka-launcher.key
```

This will output:
- **Private key** (saved to `~/.tauri/alka-launcher.key`)
- **Public key** (printed to console - copy this!)

## 📝 Step 2: Update Configuration

1. Open `src-tauri/tauri.conf.json`
2. Replace `"YOUR_PUBLIC_KEY_HERE"` with your public key
3. Replace `"OWNER/REPO"` with your actual GitHub username/repo (e.g., `"yourusername/AlkaLauncher"`)

## 🔐 Step 3: Add GitHub Secrets

Go to **GitHub repo → Settings → Secrets and variables → Actions** and add:

| Secret Name | Value |
|-------------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/alka-launcher.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password you used when generating (or empty) |

## 🚀 Step 4: Create a Release

```bash
git add .
git commit -m "feat: add auto-update support"
git tag v1.0.0
git push origin main --tags
```

GitHub Actions will automatically:
1. Build the Windows app
2. Create NSIS/MSI installers
3. Create portable zip
4. Upload `latest.json` for auto-updater  
5. Publish GitHub Release

## ✅ Done!

After the workflow completes, users can:
- Download from GitHub Releases
- Auto-update from within the app
