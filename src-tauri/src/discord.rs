use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_CLIENT_ID: &str = "1454731999637147732";

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

    pub fn connect(&self) -> Result<(), String> {
        // Already connected, skip
        if self.connected.load(Ordering::Relaxed) {
            return Ok(());
        }

        let mut client_guard = self.client.lock();

        if self.connected.load(Ordering::Relaxed) {
            return Ok(());
        }

        let mut client = DiscordIpcClient::new(DEFAULT_CLIENT_ID);

        client.connect()
            .map_err(|e| format!("Failed to connect to Discord: {}", e))?;

        *client_guard = Some(client);
        self.connected.store(true, Ordering::Relaxed);
        log::info!("Connected to Discord Rich Presence");
        Ok(())
    }

    pub fn disconnect(&self) {
        let mut client_guard = self.client.lock();
        if let Some(ref mut client) = *client_guard {
            let _ = client.close();
        }
        *client_guard = None;
        self.connected.store(false, Ordering::Relaxed);
        log::info!("Disconnected from Discord Rich Presence");
    }

    pub fn set_activity(
        &self,
        game_title: &str,
        cover_url: Option<&str>,
        developer: Option<&str>,
        buttons: Vec<(&str, &str)>,
        start_timestamp: u64,
    ) -> Result<(), String> {
        if !self.connected.load(Ordering::Relaxed) {
            if self.connect().is_err() {
                return Ok(());
            }
        }

        let mut client_guard = self.client.lock();
        let client = match client_guard.as_mut() {
            Some(c) => c,
            None => return Ok(()),
        };

        let state_text = developer.unwrap_or("Playing Visual Novel");
        let mut activity_builder = activity::Activity::new()
            .details(game_title)
            .state(state_text);

        let timestamps = activity::Timestamps::new().start(start_timestamp as i64);
        activity_builder = activity_builder.timestamps(timestamps);

        let mut assets = activity::Assets::new()
            .large_text(game_title);

        if let Some(url) = cover_url {
            assets = assets.large_image(url);
        }

        activity_builder = activity_builder.assets(assets);

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
                self.connected.store(false, Ordering::Relaxed);
                log::warn!("Failed to set Discord activity: {}", e);
                Ok(())
            }
        }
    }

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

pub fn get_unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
