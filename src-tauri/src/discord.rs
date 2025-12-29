// Discord Rich Presence module for AlkaLauncher
// Handles connection to Discord IPC and activity updates

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// Default Discord Application ID for Alka Launcher
const DEFAULT_CLIENT_ID: &str = "1454731999637147732";

/// Manages Discord Rich Presence connection and activity updates
pub struct DiscordRpc {
    client: Mutex<Option<DiscordIpcClient>>,
    connected: AtomicBool,
}

impl DiscordRpc {
    /// Create a new Discord RPC manager
    pub fn new() -> Self {
        Self {
            client: Mutex::new(None),
            connected: AtomicBool::new(false),
        }
    }

    /// Connect to Discord IPC
    /// Returns Ok if already connected or connection successful
    /// Returns Err if Discord is not running or connection failed
    pub fn connect(&self) -> Result<(), String> {
        // Already connected, skip
        if self.connected.load(Ordering::Relaxed) {
            return Ok(());
        }

        let mut client_guard = self.client.lock();
        
        // Double-check after acquiring lock
        if self.connected.load(Ordering::Relaxed) {
            return Ok(());
        }

        // DiscordIpcClient::new() returns Self directly, not Result
        let mut client = DiscordIpcClient::new(DEFAULT_CLIENT_ID);
        
        client.connect()
            .map_err(|e| format!("Failed to connect to Discord: {}", e))?;
        
        *client_guard = Some(client);
        self.connected.store(true, Ordering::Relaxed);
        log::info!("Connected to Discord Rich Presence");
        Ok(())
    }

    /// Disconnect from Discord IPC
    pub fn disconnect(&self) {
        let mut client_guard = self.client.lock();
        if let Some(ref mut client) = *client_guard {
            let _ = client.close();
        }
        *client_guard = None;
        self.connected.store(false, Ordering::Relaxed);
        log::info!("Disconnected from Discord Rich Presence");
    }

    /// Set the current activity (game being played)
    /// 
    /// # Arguments
    /// * `game_title` - The game title to display
    /// * `cover_url` - Optional cover art URL from VNDB
    /// * `developer` - Optional developer name to show as state
    /// * `buttons` - List of buttons to display (max 2), each as (label, url)
    /// * `start_timestamp` - Unix timestamp when game started
    pub fn set_activity(
        &self,
        game_title: &str,
        cover_url: Option<&str>,
        developer: Option<&str>,
        buttons: Vec<(&str, &str)>,
        start_timestamp: u64,
    ) -> Result<(), String> {
        // Try to connect if not connected
        if !self.connected.load(Ordering::Relaxed) {
            // Silently try to connect, don't fail if Discord isn't running
            if self.connect().is_err() {
                return Ok(()); // Discord not available, skip silently
            }
        }

        let mut client_guard = self.client.lock();
        let client = match client_guard.as_mut() {
            Some(c) => c,
            None => return Ok(()), // No client, skip silently
        };

        // Build activity - always show game title
        let state_text = developer.unwrap_or("Playing Visual Novel");
        let mut activity_builder = activity::Activity::new()
            .details(game_title)
            .state(state_text);

        // Set timestamps (shows elapsed time)
        let timestamps = activity::Timestamps::new().start(start_timestamp as i64);
        activity_builder = activity_builder.timestamps(timestamps);

        // Set assets with cover art
        let mut assets = activity::Assets::new()
            .large_text(game_title);
        
        if let Some(url) = cover_url {
            // Discord supports external URLs for images
            assets = assets.large_image(url);
        }
        
        activity_builder = activity_builder.assets(assets);

        // Add buttons if provided (max 2 supported by Discord)
        if !buttons.is_empty() {
            let button_list: Vec<activity::Button> = buttons
                .into_iter()
                .take(2)
                .map(|(label, url)| activity::Button::new(label, url))
                .collect();
            activity_builder = activity_builder.buttons(button_list);
        }

        match client.set_activity(activity_builder) {
            Ok(_) => {
                log::info!("Discord activity set: {}", game_title);
                Ok(())
            }
            Err(e) => {
                // Connection may have been lost, mark as disconnected
                self.connected.store(false, Ordering::Relaxed);
                log::warn!("Failed to set Discord activity: {}", e);
                Ok(()) // Don't propagate error, Discord is optional
            }
        }
    }

    /// Clear the current activity
    pub fn clear_activity(&self) -> Result<(), String> {
        if !self.connected.load(Ordering::Relaxed) {
            return Ok(());
        }

        let mut client_guard = self.client.lock();
        if let Some(ref mut client) = *client_guard {
            match client.clear_activity() {
                Ok(_) => {
                    log::info!("Discord activity cleared");
                }
                Err(e) => {
                    log::warn!("Failed to clear Discord activity: {}", e);
                    self.connected.store(false, Ordering::Relaxed);
                }
            }
        }
        Ok(())
    }

    /// Check if currently connected to Discord
    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Relaxed)
    }
}

impl Default for DiscordRpc {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for DiscordRpc {
    fn drop(&mut self) {
        self.disconnect();
    }
}

/// Get current Unix timestamp in seconds
pub fn get_unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
