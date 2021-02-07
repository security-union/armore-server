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

impl PushNotification {

    pub fn build(device_id: String, data: &NotificationData, priority: Option<&str>) -> Self {
        let mut notification = Self {
            deviceId: device_id,
            data: json!({
                "title": &data.title,
                "body": &data.body
            }),
        };
        if let Some(prior) = priority {
            notification.set_priority(prior)
        }
        notification
    }

    pub fn set_priority(&mut self, priority: &str) {
        self.data["priority"] = serde_json::Value::String(priority.into());
    }
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
