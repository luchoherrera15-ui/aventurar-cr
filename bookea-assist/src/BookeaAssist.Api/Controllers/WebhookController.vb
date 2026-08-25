Namespace Controllers

    <ApiController>
    <Route("webhook")>
    Public Class WebhookController
        Inherits ControllerBase

        Private ReadOnly _opcionesWhatsApp As WhatsAppOptions
        Private ReadOnly _scopeFactory As IServiceScopeFactory
        Private ReadOnly _logger As ILogger(Of WebhookController)

        Public Sub New(opcionesWhatsApp As IOptions(Of WhatsAppOptions), scopeFactory As IServiceScopeFactory, logger As ILogger(Of WebhookController))
            _opcionesWhatsApp = opcionesWhatsApp.Value
            _scopeFactory = scopeFactory
            _logger = logger
        End Sub

        <HttpGet>
        Public Function Verificar(<FromQuery(Name:="hub.mode")> modo As String, <FromQuery(Name:="hub.verify_token")> tokenVerificacion As String, <FromQuery(Name:="hub.challenge")> desafio As String) As IActionResult
            If modo = "subscribe" AndAlso tokenVerificacion = _opcionesWhatsApp.VerifyToken Then
                Return Content(desafio, "text/plain")
            End If

            _logger.LogWarning("Verificación de webhook de WhatsApp rechazada (modo={Modo}).", modo)
            Return StatusCode(403)
        End Function

        <HttpPost>
        Public Async Function RecibirAsync(<FromBody> payload As WhatsAppWebhookPayload) As Task(Of IActionResult)
            If payload Is Nothing OrElse payload.Entradas Is Nothing OrElse payload.Entradas.Count = 0 Then
                Return Ok()
            End If

            Dim mensajesEntrantes = payload.Entradas.
                SelectMany(Function(entrada) If(entrada.Cambios, New List(Of WhatsAppCambio)())).
                SelectMany(Function(cambio) If(cambio.Valor?.Mensajes, New List(Of WhatsAppMensajeEntrante)())).
                Where(Function(mensaje) mensaje.Tipo = "text" AndAlso mensaje.Texto IsNot Nothing).
                ToList()

            For Each mensaje In mensajesEntrantes
                Task.Run(Function() ProcesarMensajeEnSegundoPlanoAsync(mensaje))
            Next

            Return Ok()
        End Function

        Private Async Function ProcesarMensajeEnSegundoPlanoAsync(mensaje As WhatsAppMensajeEntrante) As Task
            Try
                Using scope = _scopeFactory.CreateScope()
                    Dim conversationEngine = scope.ServiceProvider.GetRequiredService(Of IConversationEngine)()
                    Dim whatsAppSender = scope.ServiceProvider.GetRequiredService(Of IWhatsAppSender)()
                    Dim respuesta = Await conversationEngine.ProcesarMensajeEntranteAsync(mensaje.De, mensaje.Texto.Body)
                    Await whatsAppSender.EnviarTextoAsync(mensaje.De, respuesta)
                End Using
            Catch ex As Exception
                _logger.LogError(ex, "Error procesando el mensaje entrante de WhatsApp de {Numero}.", mensaje.De)
            End Try
        End Function

    End Class

End Namespace
