Namespace Services

    ''' <summary>Construye las definiciones de herramientas (tools) que Claude puede invocar.</summary>
    Public Module ClaudeTools

        Public Function ConstruirHerramientas() As JsonArray

            Dim listarServicios As New JsonObject From {
                {"name", "listar_servicios"},
                {"description", "Lista los servicios que ofrece el negocio, con su duración en minutos y su precio en colones. Usar cuando el cliente pregunta qué servicios hay, cuánto cuestan o cuánto duran."},
                {"input_schema", New JsonObject From {
                    {"type", "object"},
                    {"properties", New JsonObject()},
                    {"required", New JsonArray()}
                }}
            }

            Dim verDisponibilidad As New JsonObject From {
                {"name", "ver_disponibilidad"},
                {"description", "Consulta los horarios disponibles para un servicio en una fecha específica. Usar antes de crear un turno, para ofrecerle al cliente horarios reales."},
                {"input_schema", New JsonObject From {
                    {"type", "object"},
                    {"properties", New JsonObject From {
                        {"servicio_id", New JsonObject From {
                            {"type", "string"},
                            {"description", "ID del servicio, obtenido con listar_servicios."}
                        }},
                        {"fecha", New JsonObject From {
                            {"type", "string"},
                            {"description", "Fecha a consultar, en formato YYYY-MM-DD."}
                        }}
                    }},
                    {"required", New JsonArray From {"servicio_id", "fecha"}}
                }}
            }

            Dim crearTurno As New JsonObject From {
                {"name", "crear_turno"},
                {"description", "Crea (reserva) un turno para el cliente en un horario disponible. Confirmá el servicio, la fecha/hora exacta y el nombre del cliente con él antes de llamar a esta herramienta — el turno queda reservado de inmediato, sin paso de aprobación manual."},
                {"input_schema", New JsonObject From {
                    {"type", "object"},
                    {"properties", New JsonObject From {
                        {"servicio_id", New JsonObject From {
                            {"type", "string"},
                            {"description", "ID del servicio, obtenido con listar_servicios."}
                        }},
                        {"fecha_hora", New JsonObject From {
                            {"type", "string"},
                            {"description", "Fecha y hora del turno, en formato ISO 8601 (ej. 2026-08-25T15:30:00)."}
                        }},
                        {"cliente_nombre", New JsonObject From {
                            {"type", "string"},
                            {"description", "Nombre completo del cliente que agenda el turno."}
                        }}
                    }},
                    {"required", New JsonArray From {"servicio_id", "fecha_hora", "cliente_nombre"}}
                }}
            }

            Dim reprogramarTurno As New JsonObject From {
                {"name", "reprogramar_turno"},
                {"description", "Cambia la fecha/hora de un turno ya existente del cliente."},
                {"input_schema", New JsonObject From {
                    {"type", "object"},
                    {"properties", New JsonObject From {
                        {"turno_id", New JsonObject From {
                            {"type", "string"},
                            {"description", "ID del turno a reprogramar. Si no lo sabés, dejalo vacío y el sistema busca automáticamente el turno activo de este cliente."}
                        }},
                        {"nueva_fecha_hora", New JsonObject From {
                            {"type", "string"},
                            {"description", "Nueva fecha y hora del turno, en formato ISO 8601 (ej. 2026-08-26T10:00:00)."}
                        }}
                    }},
                    {"required", New JsonArray From {"nueva_fecha_hora"}}
                }}
            }

            Dim cancelarTurno As New JsonObject From {
                {"name", "cancelar_turno"},
                {"description", "Cancela un turno existente del cliente."},
                {"input_schema", New JsonObject From {
                    {"type", "object"},
                    {"properties", New JsonObject From {
                        {"turno_id", New JsonObject From {
                            {"type", "string"},
                            {"description", "ID del turno a cancelar. Si no lo sabés, dejalo vacío y el sistema busca automáticamente el turno activo de este cliente."}
                        }}
                    }},
                    {"required", New JsonArray()}
                }}
            }

            Return New JsonArray From {listarServicios, verDisponibilidad, crearTurno, reprogramarTurno, cancelarTurno}

        End Function

    End Module

End Namespace
