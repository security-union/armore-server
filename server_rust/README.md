# HTTP Gateway

Armore's API

## How to run tests

```
make tests_local_run
```

To run this service locally, use

```
make build_and_run
```

Within the `server` top folder.

## Sample refresh payload

### Android

```
[
{
  "deviceId": "Device1",
   "data": {
     "custom": {
         "data": {
             "command": "FRefreshTelemetry",
             "correlationId": "12312",
             "username": "dario",
             "aps": {
               "content-available": 1
             }
         }
     }
   }
}
]
```

### iOS

```
[{
  "deviceId": "Device2",
  "data": {
     "contentAvailable": true,
      "silent": true,
      "payload": {
        "command":"RefreshTelemetry",
        "correlationId":"12312",
        "username":"dario"
      }
  }
}]
```
