# Rust Server

Armore's API

## How to run tests

```
make tests_run
```

To run the services locally, use

```
make tests_up
```

## Sample refresh payload

### Android

```
[
{
  "deviceId": "D1617C36-D805-4FD8-AE6D-EBC57AF5FBCD",
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
  "deviceId": "D1617C36-D805-4FD8-AE6D-EBC57AF5FBCD",
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
