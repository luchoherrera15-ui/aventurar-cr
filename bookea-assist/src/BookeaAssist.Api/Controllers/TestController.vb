Namespace Controllers

    <ApiController>
    <Route("test")>
    Public Class TestController
        Inherits ControllerBase

        Private ReadOnly _conversationEngine As IConversationEngine

        Public Sub New(conversationEngine As IConversationEngine)
            _conversationEngine = conversationEngine
        End Sub

        <HttpPost("simular-mensaje")>
        Public Async Function SimularAsync(<FromBody> solicitud As SimularMensajeRequest) As Task(Of IActionResult)
            If solicitud Is Nothing OrElse String.IsNullOrWhiteSpace(solicitud.NumeroTelefono) OrElse String.IsNullOrWhiteSpace(solicitud.Texto) Then
                Return BadRequest("numeroTelefono y texto son obligatorios.")
            End If

            Dim respuesta = Await _conversationEngine.ProcesarMensajeEntranteAsync(solicitud.NumeroTelefono, solicitud.Texto)
            Return Ok(New SimularMensajeResponse With {.Respuesta = respuesta})
        End Function

    End Class

End Namespace
