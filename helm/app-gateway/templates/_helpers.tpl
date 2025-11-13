{{- define "finfy-app-gateway.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{- define "finfy-app-gateway.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
