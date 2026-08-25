Namespace Services

    ''' <summary>
    ''' Implementación de IConversationEngine que usa la API de Claude (Anthropic)
    ''' con tool use. Llama a la API directamente por HTTP (System.Net.Http +
    ''' System.Text.Json) en vez de un paquete NuGet del SDK, para tener control
    ''' total sobre el formato exacto de las herramientas y poder auditar cada
    ''' petición/respuesta sin depender de tipos de un SDK de terceros.
    ''' Mantiene el contexto de la conversación por número de teléfono, usando
    ''' IConversationStore para persistir el historial entre peticiones HTTP
    ''' (cada mensaje de WhatsApp llega en una petición nueva y separada).
    ''' </summary>
    Public Class ClaudeConversationEngine
        Implements IConversationEngine

        Private Const AnthropicApiUrl As String = "https://api.anthropic.com/v1/messages"
        Private Const AnthropicVersion As String = "2023-06-01"
        Private Const MaxTokensRespuesta As Integer = 1024
        Private Const MaxIteracionesHerramientas As Integer = 6

        Private Shared ReadOnly CulturaCostaRica As New Globalization.CultureInfo("es-CR")

        Private ReadOnly _httpClientFactory As IHttpClientFactory
        Private ReadOnly _opcionesAnthropic As AnthropicOptions
        Private ReadOnly _bookeaClient As IBookeaClient
        Private ReadOnly _conversationStore As IConversationStore
        Private ReadOnly _logger As ILogger(Of ClaudeConversationEngine)
        Private ReadOnly _herramientas As JsonArray

        Public Sub New(httpClientFactory As IHttpClientFactory,
                       opcionesAnthropic As IOptions(Of AnthropicOptions),
                       bookeaClient As IBookeaClient,
                       conversationStore As IConversationStore,
                       logger As ILogger(Of ClaudeConversationEngine))
            _httpClientFactory = httpClientFactory
            _opcionesAnthropic = opcionesAnthropic.Value
            _bookeaClient = bookeaClient
            _conversationStore = conversationStore
            _logger = logger
            _herramientas = ClaudeTools.ConstruirHerramientas()
        End Sub

        Public Async Function ProcesarMensajeEntranteAsync(numeroTelefono As String, textoUsuario As String) As Task(Of String) Implements IConversationEngine.ProcesarMensajeEntranteAsync

            Dim historial = Await _conversationStore.ObtenerHistorialAsync(numeroTelefono)

            ' Reconstruimos el arreglo "messages" que espera la API a partir del historial guardado.
            Dim mensajes As New JsonArray()
            For Each turnoGuardado In historial
                Dim contenidoGuardado = JsonNode.Parse(turnoGuardado.ContenidoJson)
                mensajes.Add(New JsonObject From {
                    {"role", turnoGuardado.Rol},
                    {"content", contenidoGuardado}
                })
            Next

            Dim contenidoUsuario As New JsonArray From {
                New JsonObject From {
                    {"type", "text"},
                    {"text", textoUsuario}
                }
            }
            Dim mensajesNuevos As New List(Of MensajeConversacion) From {
                New MensajeConversacion("user", contenidoUsuario.ToJsonString())
            }
            mensajes.Add(New JsonObject From {
                {"role", "user"},
                {"content", contenidoUsuario}
            })

            Dim textoFinal As String = "Perdón, tuve un problema procesando tu mensaje. ¿Podés escribirme de nuevo en unos minutos?"
            Dim seObtuvoRespuesta As Boolean = False

            For iteracion = 1 To MaxIteracionesHerramientas

                Dim respuesta = Await LlamarClaudeAsync(mensajes)

                If respuesta Is Nothing Then
                    Exit For
                End If

                Dim contentBlocks = respuesta("content").AsArray()
                Dim stopReason = respuesta("stop_reason").GetValue(Of String)()

                ' Guardamos el turno del asistente tal cual vino, para poder reproducirlo en la próxima llamada.
                Dim contenidoAsistenteJson = contentBlocks.ToJsonString()
                mensajesNuevos.Add(New MensajeConversacion("assistant", contenidoAsistenteJson))
                mensajes.Add(New JsonObject From {
                    {"role", "assistant"},
                    {"content", JsonNode.Parse(contenidoAsistenteJson)}
                })

                If stopReason <> "tool_use" Then
                    textoFinal = ExtraerTexto(contentBlocks)
                    seObtuvoRespuesta = True
                    Exit For
                End If

                ' Ejecutamos cada herramienta solicitada y devolvemos todos los resultados en un solo turno "user".
                Dim resultadosHerramientas As New JsonArray()

                For Each bloque In contentBlocks
                    If bloque("type").GetValue(Of String)() <> "tool_use" Then
                        Continue For
                    End If

                    Dim nombreHerramienta = bloque("name").GetValue(Of String)()
                    Dim idHerramienta = bloque("id").GetValue(Of String)()
                    Dim entrada = bloque("input")

                    Dim textoResultado As String
                    Dim esError As Boolean = False

                    Try
                        textoResultado = Await EjecutarHerramientaAsync(nombreHerramienta, entrada, numeroTelefono)
                    Catch ex As Bookea.BookeaExcepcion
                        textoResultado = ex.Message
                        esError = True
                    Catch ex As Exception
                        _logger.LogError(ex, "Error ejecutando la herramienta {Herramienta}", nombreHerramienta)
                        textoResultado = "Ocurrió un error técnico inesperado al ejecutar esta acción. Explicale al cliente que hubo un problema y que lo intente de nuevo en unos minutos."
                        esError = True
                    End Try

                    Dim bloqueResultado As New JsonObject From {
                        {"type", "tool_result"},
                        {"tool_use_id", idHerramienta},
                        {"content", textoResultado}
                    }
                    If esError Then
                        bloqueResultado("is_error") = True
                    End If
                    resultadosHerramientas.Add(bloqueResultado)
                Next

                Dim resultadosJson = resultadosHerramientas.ToJsonString()
                mensajesNuevos.Add(New MensajeConversacion("user", resultadosJson))
                mensajes.Add(New JsonObject From {
                    {"role", "user"},
                    {"content", JsonNode.Parse(resultadosJson)}
                })

            Next

            If Not seObtuvoRespuesta Then
                _logger.LogWarning("Se alcanzó el límite de {Max} iteraciones de herramientas para {Numero} sin una respuesta final.", MaxIteracionesHerramientas, numeroTelefono)
                textoFinal = "Necesito revisar esto con más calma. Un momento, ya te respondo."

                ' La API de Claude exige que los roles alternen estrictamente user/assistant. Si salimos del
                ' bucle sin una respuesta final (falló la llamada HTTP, o se agotaron las iteraciones de
                ' herramientas), "mensajesNuevos" puede terminar en un turno "user" sin su "assistant"
                ' correspondiente. Guardar eso rompería la conversación de este cliente para siempre: el
                ' próximo mensaje reconstruiría el historial con dos turnos "user" seguidos y la API
                ' respondería 400 en cascada. Cerramos el turno con un mensaje sintético del asistente.
                Dim contenidoAsistenteSintetico As New JsonArray From {
                    New JsonObject From {
                        {"type", "text"},
                        {"text", textoFinal}
                    }
                }
                mensajesNuevos.Add(New MensajeConversacion("assistant", contenidoAsistenteSintetico.ToJsonString()))
            End If

            ' Persistimos todo lo ocurrido en este turno (mensaje del cliente + idas y vueltas con herramientas).
            For Each nuevo In mensajesNuevos
                Await _conversationStore.AgregarMensajeAsync(numeroTelefono, nuevo)
            Next

            Return textoFinal

        End Function

        Private Async Function LlamarClaudeAsync(mensajes As JsonArray) As Task(Of JsonNode)

            Dim cuerpo As New JsonObject From {
                {"model", _opcionesAnthropic.Modelo},
                {"max_tokens", MaxTokensRespuesta},
                {"system", ConstruirPromptSistema()},
                {"tools", JsonNode.Parse(_herramientas.ToJsonString())},
                {"messages", JsonNode.Parse(mensajes.ToJsonString())}
            }

            Dim cliente = _httpClientFactory.CreateClient("Anthropic")

            Try
                Using peticion As New HttpRequestMessage(HttpMethod.Post, AnthropicApiUrl)
                    peticion.Headers.Add("x-api-key", _opcionesAnthropic.ApiKey)
                    peticion.Headers.Add("anthropic-version", AnthropicVersion)
                    peticion.Content = New StringContent(cuerpo.ToJsonString(), System.Text.Encoding.UTF8, "application/json")

                    Using respuestaHttp = Await cliente.SendAsync(peticion)
                        Dim cuerpoRespuesta = Await respuestaHttp.Content.ReadAsStringAsync()

                        If Not respuestaHttp.IsSuccessStatusCode Then
                            _logger.LogError("La API de Claude respondió {StatusCode}: {Cuerpo}", CInt(respuestaHttp.StatusCode), cuerpoRespuesta)
                            Return Nothing
                        End If

                        Return JsonNode.Parse(cuerpoRespuesta)
                    End Using
                End Using
            Catch ex As Exception
                _logger.LogError(ex, "Falló la llamada HTTP a la API de Claude.")
                Return Nothing
            End Try

        End Function

        Private Async Function EjecutarHerramientaAsync(nombreHerramienta As String, entrada As JsonNode, numeroTelefono As String) As Task(Of String)

            Select Case nombreHerramienta

                Case "listar_servicios"
                    Dim servicios = Await _bookeaClient.ListarServiciosAsync()
                    Return FormatearServicios(servicios)

                Case "ver_disponibilidad"
                    Dim servicioId = ObtenerCadena(entrada, "servicio_id")
                    Dim fecha As DateTime
                    If Not DateTime.TryParse(ObtenerCadena(entrada, "fecha"), Globalization.CultureInfo.InvariantCulture, Globalization.DateTimeStyles.None, fecha) Then
                        Return "La fecha indicada no es válida. Pedile al cliente una fecha concreta (ej. 25 de agosto) y volvé a intentar."
                    End If
                    Dim horarios = Await _bookeaClient.VerDisponibilidadAsync(servicioId, fecha)
                    Return FormatearDisponibilidad(horarios)

                Case "crear_turno"
                    Dim servicioId = ObtenerCadena(entrada, "servicio_id")
                    Dim clienteNombre = ObtenerCadena(entrada, "cliente_nombre")
                    Dim fechaHora As DateTime
                    If Not DateTime.TryParse(ObtenerCadena(entrada, "fecha_hora"), Globalization.CultureInfo.InvariantCulture, Globalization.DateTimeStyles.None, fechaHora) Then
                        Return "La fecha/hora indicada no es válida. Confirmá con el cliente una fecha y hora concretas y volvé a intentar."
                    End If
                    Dim turnoCreado = Await _bookeaClient.CrearTurnoAsync(servicioId, fechaHora, clienteNombre, numeroTelefono)
                    Return FormatearTurno("Turno confirmado", turnoCreado)

                Case "reprogramar_turno"
                    Dim nuevaFecha As DateTime
                    If Not DateTime.TryParse(ObtenerCadena(entrada, "nueva_fecha_hora"), Globalization.CultureInfo.InvariantCulture, Globalization.DateTimeStyles.None, nuevaFecha) Then
                        Return "La nueva fecha/hora indicada no es válida. Confirmá con el cliente una fecha y hora concretas y volvé a intentar."
                    End If
                    Dim turnoIdReprogramar = ObtenerCadena(entrada, "turno_id")
                    If String.IsNullOrWhiteSpace(turnoIdReprogramar) Then
                        turnoIdReprogramar = Await ResolverTurnoIdDelClienteAsync(numeroTelefono)
                    End If
                    Dim turnoReprogramado = Await _bookeaClient.ReprogramarTurnoAsync(turnoIdReprogramar, nuevaFecha)
                    Return FormatearTurno("Turno reprogramado", turnoReprogramado)

                Case "cancelar_turno"
                    Dim turnoIdCancelar = ObtenerCadena(entrada, "turno_id")
                    If String.IsNullOrWhiteSpace(turnoIdCancelar) Then
                        turnoIdCancelar = Await ResolverTurnoIdDelClienteAsync(numeroTelefono)
                    End If
                    Dim turnoCancelado = Await _bookeaClient.CancelarTurnoAsync(turnoIdCancelar)
                    Return FormatearTurno("Turno cancelado", turnoCancelado)

                Case Else
                    Throw New Bookea.BookeaExcepcion($"Herramienta desconocida: {nombreHerramienta}")

            End Select

        End Function

        Private Async Function ResolverTurnoIdDelClienteAsync(numeroTelefono As String) As Task(Of String)
            Dim turnosCliente = Await _bookeaClient.ListarTurnosDeClienteAsync(numeroTelefono)

            If turnosCliente.Count = 0 Then
                Throw New Bookea.BookeaExcepcion("Este cliente no tiene turnos activos en este momento.")
            End If

            If turnosCliente.Count > 1 Then
                Dim lista = String.Join("; ", turnosCliente.Select(Function(t) $"{t.ServicioNombre} el {t.FechaHora.ToString("d 'de' MMMM 'a las' HH:mm", CulturaCostaRica)} (id: {t.Id})"))
                Throw New Bookea.BookeaExcepcion($"El cliente tiene varios turnos activos: {lista}. Pedile que te confirme cuál, y volvé a llamar a la herramienta indicando el turno_id correspondiente.")
            End If

            Return turnosCliente(0).Id
        End Function

        Private Shared Function ObtenerCadena(entrada As JsonNode, clave As String) As String
            If entrada Is Nothing Then
                Return String.Empty
            End If
            Dim valor = entrada(clave)
            If valor Is Nothing Then
                Return String.Empty
            End If
            Return valor.GetValue(Of String)()
        End Function

        Private Shared Function ExtraerTexto(bloques As JsonArray) As String
            Dim partes As New List(Of String)
            For Each bloque In bloques
                If bloque("type").GetValue(Of String)() = "text" Then
                    partes.Add(bloque("text").GetValue(Of String)())
                End If
            Next
            If partes.Count = 0 Then
                Return "Perdón, no logré generar una respuesta. ¿Podés reformular tu mensaje?"
            End If
            Return String.Join(Environment.NewLine, partes)
        End Function

        Private Shared Function FormatearServicios(servicios As List(Of Bookea.Servicio)) As String
            If servicios.Count = 0 Then
                Return "El negocio no tiene servicios configurados todavía."
            End If
            Dim lineas = servicios.Select(Function(s) $"- {s.Nombre} (id: {s.Id}): {s.DuracionMinutos} min, ₡{s.PrecioColones:N0}")
            Return String.Join(Environment.NewLine, lineas)
        End Function

        Private Shared Function FormatearDisponibilidad(horarios As List(Of DateTime)) As String
            If horarios.Count = 0 Then
                Return "No hay horarios disponibles ese día. Ofrecele al cliente consultar otra fecha."
            End If
            Dim lineas = horarios.Select(Function(h) h.ToString("dddd d 'de' MMMM, HH:mm", CulturaCostaRica))
            Return "Horarios disponibles: " & String.Join(", ", lineas)
        End Function

        Private Shared Function FormatearTurno(titulo As String, turno As Bookea.Turno) As String
            Return $"{titulo}. ID del turno: {turno.Id}. Servicio: {turno.ServicioNombre}. Fecha y hora: {turno.FechaHora.ToString("dddd d 'de' MMMM, HH:mm", CulturaCostaRica)}. Cliente: {turno.ClienteNombre}. Estado: {turno.Estado}."
        End Function

        Private Shared Function ConstruirPromptSistema() As String
            Return "Sos el asistente virtual de reservas de Salón Aurora, un negocio de Costa Rica que usa la " &
                   "plataforma Bookea (bookea.lat), y hablás con clientes por WhatsApp." & Environment.NewLine &
                   Environment.NewLine &
                   "Reglas:" & Environment.NewLine &
                   "- Hablá siempre en español, con el trato de Costa Rica (usted/vos según corresponda, tono cercano y profesional)." & Environment.NewLine &
                   "- Los precios son en colones (₡)." & Environment.NewLine &
                   "- La reserva es instantánea: cuando el cliente confirma un horario, se agenda de una vez. No existe un paso de aprobación manual." & Environment.NewLine &
                   "- Antes de llamar a crear_turno, confirmá con el cliente el servicio, la fecha/hora exacta y su nombre." & Environment.NewLine &
                   "- Usá ver_disponibilidad antes de ofrecer un horario, para no inventar horarios que no existen." & Environment.NewLine &
                   "- Si el cliente quiere cancelar o reprogramar y no sabés el ID del turno, llamá a la herramienta igual sin turno_id: el sistema busca automáticamente el turno activo del cliente." & Environment.NewLine &
                   "- Si una herramienta devuelve un error, explicaselo al cliente en lenguaje simple y ofrecé una alternativa." & Environment.NewLine &
                   "- Sé breve y claro: los mensajes son para WhatsApp, no uses tablas ni formato markdown pesado." & Environment.NewLine &
                   "- No inventes servicios, precios ni horarios que no vengan de las herramientas."
        End Function

    End Class

End Namespace
