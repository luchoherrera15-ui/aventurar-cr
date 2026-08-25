Namespace Services

    ''' <summary>
    ''' Guarda el historial de conversación por número de WhatsApp del cliente.
    ''' Implementación actual: InMemoryConversationStore (diccionario en memoria).
    ''' Pensada para cambiarse por Redis/una tabla de base de datos más adelante
    ''' sin tocar el resto del código: solo hay que implementar esta interfaz.
    ''' </summary>
    Public Interface IConversationStore

        ''' <summary>Historial completo de la conversación, en orden cronológico. Lista vacía si no existe.</summary>
        Function ObtenerHistorialAsync(numeroTelefono As String) As Task(Of List(Of MensajeConversacion))

        ''' <summary>Agrega un mensaje al final del historial de esa conversación.</summary>
        Function AgregarMensajeAsync(numeroTelefono As String, mensaje As MensajeConversacion) As Task

        ''' <summary>Borra el historial de una conversación (ej. para reiniciarla manualmente).</summary>
        Function LimpiarHistorialAsync(numeroTelefono As String) As Task

    End Interface

End Namespace
