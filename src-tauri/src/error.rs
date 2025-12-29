use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, specta::Type)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("IO error: {0}")]
    Io(String),

    #[error("JSON error: {0}")]
    Json(String),

    #[error("HTTP error: {0}")]
    Http(String),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Serialization error: {0}")]
    Bincode(String),

    #[error("{0}")]
    NotFound(String),

    #[error("VNDB API error: {0}")]
    VndbApi(String),

    #[error("Authentication required: {0}")]
    AuthRequired(String),

    #[error("Process launch failed: {0}")]
    ProcessLaunch(String),

    #[error("Validation error: {0}")]
    Validation(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Json(e.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        AppError::Http(e.to_string())
    }
}

impl From<redb::Error> for AppError {
    fn from(e: redb::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<redb::TransactionError> for AppError {
    fn from(e: redb::TransactionError) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<redb::TableError> for AppError {
    fn from(e: redb::TableError) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<redb::StorageError> for AppError {
    fn from(e: redb::StorageError) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<bincode::Error> for AppError {
    fn from(e: bincode::Error) -> Self {
        AppError::Bincode(e.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
