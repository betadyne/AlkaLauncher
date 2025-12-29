---
description: How to implement Discord Rich Presence for the application
---

# Discord Rich Presence Implementation Workflow

## Prerequisites

1. **Discord Application Already Created**
   - Application ID: `1454731999637147732`
   - This is pre-configured in `src-tauri/src/discord.rs`
   - Copy the **Application ID** (this is your Client ID)
   - (Optional) Go to "Rich Presence > Art Assets" to upload a default icon

2. **Environment Setup**
   - Ensure Discord desktop app is installed for testing
   - Have a game with VNDB cover art linked in the library

## Step 1: Add Rust Dependencies

// turbo
```bash
cd src-tauri
cargo add discord-rich-presence
```

## Step 2: Create Discord RPC Module

Create `src-tauri/src/discord.rs`:

```rust
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_CLIENT_ID: &str = "YOUR_DISCORD_CLIENT_ID_HERE";

pub struct DiscordRpc {
    client: Mutex<Option<DiscordIpcClient>>,
    connected: AtomicBool,
}

impl DiscordRpc {
    pub fn new() -> Self {
        Self {
            client: Mutex::new(None),
            connected: AtomicBool::new(false),
        }
    }

    pub fn connect(&self, client_id: Option<&str>) -> Result<(), String> {
        let id = client_id.unwrap_or(DEFAULT_CLIENT_ID);
        let mut client_guard = self.client.lock();
        
        if self.connected.load(Ordering::Relaxed) {
            return Ok(());
        }

        let mut client = DiscordIpcClient::new(id)
            .map_err(|e| format!("Failed to create Discord client: {}", e))?;
        
        client.connect()
            .map_err(|e| format!("Failed to connect to Discord: {}", e))?;
        
        *client_guard = Some(client);
        self.connected.store(true, Ordering::Relaxed);
        Ok(())
    }

    pub fn disconnect(&self) {
        let mut client_guard = self.client.lock();
        if let Some(ref mut client) = *client_guard {
            let _ = client.close();
        }
        *client_guard = None;
        self.connected.store(false, Ordering::Relaxed);
    }

    pub fn set_activity(
        &self,
        game_title: &str,
        cover_url: Option<&str>,
        start_time: u64,
    ) -> Result<(), String> {
        let mut client_guard = self.client.lock();
        let client = client_guard.as_mut()
            .ok_or("Discord not connected")?;

        let mut activity_builder = activity::Activity::new()
            .details(game_title)
            .state("Playing Visual Novel");

        // Set timestamps
        let timestamps = activity::Timestamps::new().start(start_time as i64);
        activity_builder = activity_builder.timestamps(timestamps);

        // Set assets with cover art
        let mut assets = activity::Assets::new()
            .large_text(game_title);
        
        if let Some(url) = cover_url {
            assets = assets.large_image(url);
        }
        
        activity_builder = activity_builder.assets(assets);

        client.set_activity(activity_builder)
            .map_err(|e| format!("Failed to set activity: {}", e))
    }

    pub fn clear_activity(&self) -> Result<(), String> {
        let mut client_guard = self.client.lock();
        let client = client_guard.as_mut()
            .ok_or("Discord not connected")?;
        
        client.clear_activity()
            .map_err(|e| format!("Failed to clear activity: {}", e))
    }

    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }
}

impl Default for DiscordRpc {
    fn default() -> Self {
        Self::new()
    }
}

pub fn get_unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
```

## Step 3: Integrate with lib.rs

1. Add module declaration at top of `lib.rs`:
   ```rust
   mod discord;
   ```

2. Add to `AppState`:
   ```rust
   discord_rpc: Option<discord::DiscordRpc>,
   ```

3. Modify `AppSettings`:
   ```rust
   pub discord_rpc_enabled: bool,
   ```

4. In `launch_game`, after spawning process:
   ```rust
   if settings.discord_rpc_enabled {
       if let Some(ref rpc) = state.discord_rpc {
           let _ = rpc.connect(None);
           let _ = rpc.set_activity(
               &game.title,
               game.cover_url.as_deref(),
               discord::get_unix_timestamp(),
           );
       }
   }
   ```

5. In game exit handler:
   ```rust
   if let Some(ref rpc) = state.discord_rpc {
       let _ = rpc.clear_activity();
   }
   ```

## Step 4: Add Frontend Settings

Add toggle in Settings modal for "Enable Discord Rich Presence"

## Step 5: Testing

1. Open Discord desktop app
2. Launch a game from Alka Launcher
3. Check Discord profile - should show "Playing Alka Launcher" with game info
4. Close game - presence should disappear

## Troubleshooting

- **Discord not detected**: Ensure Discord desktop app (not browser) is running
- **No cover art**: Check if game has VNDB cover_url set
- **Connection fails**: Discord may need to be restarted
