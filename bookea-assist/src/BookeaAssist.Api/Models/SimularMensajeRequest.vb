Namespace Models

    ''' <summary>Cuerpo del POST /test/simular-mensaje, para probar el flujo sin depender de Meta.</summary>
    Public Class SimularMensajeRequest

        ''' <summary>Número de teléfono del cliente simulado (identifica la conversación). Ej. "50688887777".</summary>
        Public Property NumeroTelefono As String = String.Empty

        ''' <summary>Texto que "envía" el cliente por WhatsApp.</summary>
        Public Property Texto As String = String.Empty

    End Class

    Public Class SimularMensajeResponse

        Public Property Respuesta As String = String.Empty

    End Class

End Namespace
