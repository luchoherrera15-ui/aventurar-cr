Namespace Services

    ''' <summary>
    ''' Un turno de la conversación tal como lo espera la API de Claude: un rol
    ''' ("user" o "assistant") y un contenido que es SIEMPRE un arreglo JSON de
    ''' bloques (texto, tool_use o tool_result), serializado como texto.
    ''' Guardar el JSON crudo (en vez de solo el texto) es necesario para poder
    ''' reconstruir el historial completo -incluyendo llamadas a herramientas-
    ''' en la siguiente petición a la API, ya que cada mensaje de WhatsApp llega
    ''' en una petición HTTP nueva y separada.
    ''' </summary>
    Public Class MensajeConversacion

        Public Property Rol As String
        Public Property ContenidoJson As String
        Public Property CreadoEn As DateTimeOffset

        Public Sub New(rol As String, contenidoJson As String)
            Me.Rol = rol
            Me.ContenidoJson = contenidoJson
            Me.CreadoEn = DateTimeOffset.UtcNow
        End Sub

    End Class

End Namespace
