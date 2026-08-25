Namespace Services

    ''' <summary>
    ''' Motor de conversación: recibe el texto que escribió el cliente por WhatsApp
    ''' y devuelve el texto que hay que responderle, después de (si hace falta)
    ''' llamar a las herramientas de Bookea (ver disponibilidad, crear turno, etc.)
    ''' a través de Claude con tool use.
    ''' </summary>
    Public Interface IConversationEngine

        ''' <summary>Procesa un mensaje entrante y devuelve la respuesta a enviar. Mantiene el contexto por número de teléfono.</summary>
        Function ProcesarMensajeEntranteAsync(numeroTelefono As String, textoUsuario As String) As Task(Of String)

    End Interface

End Namespace
