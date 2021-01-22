{{/*
Expand the name of the chart.
*/}}
{{- define "armore.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "armore.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "armore.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "armore.labels" -}}
helm.sh/chart: {{ include "armore.chart" . }}
{{ include "armore.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "armore.selectorLabels" -}}
app.kubernetes.io/name: {{ include "armore.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Cloud storage environment variables
*/}}
{{- define "armore.cloudStorage" -}}
- name: CS_TYPE
  valueFrom:
    configMapKeyRef:
      name: "{{ include "armore.fullname" . }}-config"
      key: cloudStorageType
- name: CS_BUCKET
  valueFrom:
    configMapKeyRef:
      name: "{{ include "armore.fullname" . }}-config"
      key: cloudStorageBucket
- name: CS_PROJECT
  valueFrom:
    configMapKeyRef:
      name: "{{ include "armore.fullname" . }}-config"
      key: cloudProjectId
{{- end }}

{{/*
Rabbit MQ environment variables
*/}}
{{- define "armore.rabbitMQ" -}}
- name: RABBITMQ_HOST
  value: "{{ include "armore.fullname" . }}-rabbitmq"
- name: RABBIT_MQ_HOST
  value: "{{ include "armore.fullname" . }}-rabbitmq"
- name: RABBITMQ_VHOST
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-rabbitmq"
      key: rabbitmqVirtualHost
- name: RABBITMQ_USER
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-rabbitmq"
      key: user
- name: RABBITMQ_PASS
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-rabbitmq"
      key: pass
{{- end }}

{{/*
Internal Rabbit MQ environment variables
*/}}
{{- define "armore.internalRabbitMQ" -}}
- name: RABBITMQ_DEFAULT_VHOST
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-rabbitmq"
      key: rabbitmqVirtualHost
- name: RABBITMQ_ERLANG_COOKIE
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-rabbitmq"
      key: erlangCookie
- name: RABBITMQ_DEFAULT_USER
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-rabbitmq"
      key: user
- name: RABBITMQ_DEFAULT_PASS
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-rabbitmq"
      key: pass
- name: RABBITMQ_DEFAULT_PASS_HASH
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-rabbitmq"
      key: passHash
{{- end }}

{{/*
Postgres environment variables
*/}}
{{- define "armore.postgres" -}}
- name: PG_URL
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-postgres"
      key: appUrl
{{- end }}

{{- define "armore.postgreSuper" -}}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-postgres"
      key: dbmateUrl
{{- end }}

{{/*
Push Notification environment variables
*/}}
{{- define "armore.pushNotifications" -}}
- name: PUSH_NOTIFICATIONS_TOKEN_ANDROID
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-push-notifications"
      key: token-android
- name: PUSH_NOTIFICATIONS_TOKEN_IOS
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-push-notifications"
      key: token-ios
- name: PUSH_NOTIFICATIONS_TOKEN_KEY_ID_IOS
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-push-notifications"
      key: key-id-ios
- name: PUSH_NOTIFICATIONS_TOKEN_TEAM_ID_IOS
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-push-notifications"
      key: team-id-ios
{{- end }}

{{/*
Redis environment variables
*/}}
{{- define "armore.redis" -}}
- name: REDIS_URL
  valueFrom:
    configMapKeyRef:
      name: "{{ include "armore.fullname" . }}-config"
      key: redisUrl
{{- end }}

{{/*
Sendgrid environment variables
*/}}
{{- define "armore.sendgrid" -}}
- name: SENDGRID_API_KEY
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-sendgrid"
      key: token
{{- end }}

{{/*
Slack environment variables
*/}}
{{- define "armore.slack" -}}
{{- end }}

{{/*
Twilio environment variables
*/}}
{{- define "armore.twilio" -}}
- name: TWILIO_ACCOUNT_SID
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-twilio"
      key: sid
- name: TWILIO_AUTH_TOKEN
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-twilio"
      key: token
- name: TWILIO_NUMBER
  valueFrom:
    secretKeyRef:
      name: "{{ include "armore.fullname" . }}-twilio"
      key: number
{{- end }}

{{/*
Google Cloud Sql Environment Variables
*/}}
{{- define "armore.cloudSql" -}}
- name: CS_CREDENTIALS_FILE
  value: /secrets/cloudsql/credentials.json
{{- end }}

{{/*
Google Cloud Sql Proxy Volume
*/}}
{{- define "armore.cloudSqlVolume" -}}
{{- $namespace := .Release.Namespace -}}
{{- if eq $namespace "default" -}}
- name: {{ printf "%s-cloudsql" (include "armore.fullname" . ) }}
  secret:
    secretName: {{ printf "%s-cloudsql" (include "armore.fullname" . ) }}
{{- else -}}
- name: {{ printf "%s-cloudsql-%s" (include "armore.fullname" .) $namespace }}
  secret:
    secretName: {{ printf "%s-cloudsql" (include "armore.fullname" . ) }}
{{- end }}
{{- end }}

{{/*
Google Cloud Sql Proxy Volume Mount
*/}}
{{- define "armore.cloudSqlVolumeMount" -}}
{{- $namespace := .Release.Namespace -}}
{{- if eq $namespace "default" -}}
- name: {{ printf "%s-cloudsql" (include "armore.fullname" . ) }}
  mountPath: /secrets/cloudsql
  readOnly: true
{{- else -}}
- name: {{ printf "%s-cloudsql-%s" (include "armore.fullname" .) $namespace }}
  mountPath: /secrets/cloudsql
  readOnly: true
{{- end }}
{{- end }}

{{/*
Google Cloud Sql Proxy Sidecar Container
*/}}
{{- define "armore.cloudSqlSidecar" -}}
- name: cloudsql-proxy
  image: gcr.io/cloudsql-docker/gce-proxy:1.14
  command: [
      "/cloud_sql_proxy",
      "-instances=iot-garage-242501:us-central1:garage-db=tcp:5432",
        # If running on a VPC, the Cloud SQL proxy can connect via Private IP. See:
        # https://cloud.google.com/sql/docs/mysql/private-ip for more info.
        # "-ip_address_types=PRIVATE",
      "-credential_file=/secrets/cloudsql/credentials.json",
    ]
  env:
    - name: CS_PROJECT
      valueFrom:
        configMapKeyRef:
          name: "{{ include "armore.fullname" . }}-config"
          key: cloudProjectId
    - name: DB_NAME
      valueFrom:
        secretKeyRef:
          name: "{{ include "armore.fullname" . }}-postgres"
          key: name
  securityContext:
    runAsUser: 2
    allowPrivilegeEscalation: false
  volumeMounts:
{{- include "armore.cloudSqlVolumeMount" . | nindent 4 }}
{{- end }}
