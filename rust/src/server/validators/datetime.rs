use crate::lang::TranslationIds;
use crate::model::responses::Errors::APIInternalError;
use chrono::Duration;
use chrono::NaiveDateTime;
use chrono::Utc;

pub fn assert_valid_location_historical_start(
    start_time: &NaiveDateTime,
) -> Result<(), APIInternalError> {
    let week_ago: &NaiveDateTime = &(Utc::now() - Duration::weeks(1)).naive_utc();
    if start_time < week_ago {
        return Err(APIInternalError {
            msg: TranslationIds::InvalidHistoricalLocationStartTime,
            engineering_error: None,
        });
    }
    Ok(())
}
