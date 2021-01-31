use rocket_contrib::json::JsonValue;
use serde::{Deserialize, Serialize};


#[allow(non_snake_case)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Email {
    pub username: String,
    pub email: String,
    pub templateId: String,
    pub dynamicTemplateData: DynamicEmailTemplateData,
}

#[allow(non_snake_case)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DynamicEmailTemplateData {
    pub title: String,
    pub body: String,
    pub linkTitle: String,
    pub picture: Option<String>,
    pub link: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationData {
    pub username: String,
    pub title: String,
    pub body: String,
}

#[allow(non_snake_case)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PushNotification {
    pub deviceId: String,
    pub data: JsonValue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRecipient {
    pub email: Option<String>,
    pub username: String,
}

#[derive(Debug, Clone)]
pub struct AcceptedNotificationData {
    pub creator: String,
    pub language: String,
    pub recipient: String,
}
