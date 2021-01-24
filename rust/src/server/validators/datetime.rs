use crate::model::responses::Errors::APIInternalError;
use crate::lang::TranslationIds;
use chrono::Duration;
use chrono::NaiveDateTime;
use chrono::Utc;

pub fn assert_valid_location_historical_start(
    start_time: &NaiveDateTime,
) -> Result<(), APIInternalError> {
    let week_ago: &NaiveDateTime = &(Utc::now().naive_utc() - Duration::weeks(1));
    if start_time < week_ago {
        return Err(APIInternalError {
            msg: TranslationIds::InvalidHistoricalLocationStartTime,
            engineering_error: None
        });
    }
    Ok(())
}
